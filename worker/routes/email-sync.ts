import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const emailSyncRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

emailSyncRoutes.use('*', authMiddleware);

class CookieJar {
  private cookies = new Map<string, Map<string, string>>();

  addFromResponse(res: Response, domainUrl: string) {
    const u = new URL(domainUrl);
    const host = u.hostname;
    const setCookies: string[] = (res.headers as any).getSetCookie
      ? (res.headers as any).getSetCookie()
      : res.headers.get('set-cookie')
      ? [res.headers.get('set-cookie') as string]
      : [];

    for (const sc of setCookies) {
      if (!sc) continue;
      const parts = sc.split(';');
      const [kv, ...attrs] = parts;
      const eq = kv.indexOf('=');
      if (eq <= 0) continue;
      const k = kv.slice(0, eq).trim();
      const v = kv.slice(eq + 1).trim();
      let domain = host;
      for (const a of attrs) {
        const [ak, av] = a.split('=').map((s) => s && s.trim());
        if (ak && ak.toLowerCase() === 'domain' && av) {
          domain = av.replace(/^\./, '');
        }
      }
      if (!this.cookies.has(domain)) this.cookies.set(domain, new Map());
      this.cookies.get(domain)!.set(k, v);
    }
  }

  getHeader(urlStr: string): string {
    const u = new URL(urlStr);
    const host = u.hostname;
    const pairs: string[] = [];
    for (const [domain, map] of this.cookies.entries()) {
      if (host === domain || host.endsWith('.' + domain)) {
        for (const [k, v] of map.entries()) {
          pairs.push(`${k}=${v}`);
        }
      }
    }
    return pairs.join('; ');
  }

  getCookie(name: string): string | null {
    const lower = name.toLowerCase();
    for (const map of this.cookies.values()) {
      for (const [k, v] of map.entries()) {
        if (k.toLowerCase() === lower) return v;
      }
    }
    return null;
  }

  toJSON(): Record<string, Record<string, string>> {
    const out: Record<string, Record<string, string>> = {};
    for (const [domain, map] of this.cookies.entries()) {
      out[domain] = Object.fromEntries(map.entries());
    }
    return out;
  }

  static fromJSON(data: Record<string, Record<string, string>>): CookieJar {
    const jar = new CookieJar();
    if (data && typeof data === 'object') {
      for (const [domain, obj] of Object.entries(data)) {
        if (obj && typeof obj === 'object') {
          jar.cookies.set(domain, new Map(Object.entries(obj)));
        }
      }
    }
    return jar;
  }
}

interface CachedOwaSession {
  email: string;
  jar: CookieJar;
  canary: string;
  ua: string;
  owaOrigin: string;
  owaBaseUrl: string;
  expiresAt: number;
}

let inMemoryOwaSession: CachedOwaSession | null = null;
let inFlightAuthPromise: Promise<CachedOwaSession> | null = null;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function ensureEmailSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS email_config (
        id TEXT PRIMARY KEY,
        email_address TEXT NOT NULL,
        password TEXT NOT NULL,
        owa_url TEXT NOT NULL DEFAULT 'https://mail.egcloud.gov.eg/owa/',
        adfs_url TEXT NOT NULL DEFAULT 'https://fed.egcloud.gov.eg',
        default_assigned_to TEXT NOT NULL DEFAULT 'د. ماجد عاطف',
        default_task_type TEXT NOT NULL DEFAULT 'تكليف إداري',
        default_priority TEXT NOT NULL DEFAULT 'high',
        sync_interval_minutes INTEGER NOT NULL DEFAULT 5,
        max_emails_per_sync INTEGER NOT NULL DEFAULT 25,
        only_unread INTEGER NOT NULL DEFAULT 0,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        last_sync_at TEXT,
        last_sync_status TEXT,
        last_sync_error TEXT,
        total_synced_count INTEGER NOT NULL DEFAULT 0,
        session_cache_json TEXT,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
      )`
    )
    .run();

  // Safely add session_cache_json column if table was created earlier without it
  await db
    .prepare('ALTER TABLE email_config ADD COLUMN session_cache_json TEXT')
    .run()
    .catch(() => {});

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS synced_emails (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL UNIQUE,
        ews_item_id TEXT,
        subject TEXT NOT NULL,
        sender_name TEXT,
        sender_email TEXT,
        received_at TEXT,
        body_text TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        priority TEXT NOT NULL DEFAULT 'high',
        department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
        assigned_to TEXT,
        notes TEXT,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        correspondence_id TEXT REFERENCES correspondences(id) ON DELETE SET NULL,
        attachments_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
      )`
    )
    .run();

  // Safely add standalone email columns to existing synced_emails table
  const extraCols = [
    'ALTER TABLE synced_emails ADD COLUMN body_text TEXT',
    "ALTER TABLE synced_emails ADD COLUMN status TEXT NOT NULL DEFAULT 'new'",
    "ALTER TABLE synced_emails ADD COLUMN priority TEXT NOT NULL DEFAULT 'high'",
    'ALTER TABLE synced_emails ADD COLUMN department_id TEXT',
    'ALTER TABLE synced_emails ADD COLUMN assigned_to TEXT',
    'ALTER TABLE synced_emails ADD COLUMN notes TEXT',
  ];
  for (const sql of extraCols) {
    await db.prepare(sql).run().catch(() => {});
  }

  // One-time cleanup: migrate existing email-generated tasks & correspondences into synced_emails so Tasks & Correspondences stay 100% separate from Emails
  const linkedRows = (
    await db
      .prepare('SELECT id, task_id, correspondence_id FROM synced_emails WHERE task_id IS NOT NULL OR correspondence_id IS NOT NULL')
      .all<{ id: string; task_id?: string; correspondence_id?: string }>()
  ).results;

  for (const row of linkedRows) {
    if (row.task_id) {
      const t = await db
        .prepare('SELECT description, status, priority, department_id, assigned_to FROM tasks WHERE id = ?')
        .bind(row.task_id)
        .first<any>();
      if (t) {
        await db
          .prepare(
            `UPDATE synced_emails SET
              body_text = COALESCE(body_text, ?),
              status = COALESCE(?, status, 'new'),
              priority = COALESCE(?, priority, 'high'),
              department_id = COALESCE(department_id, ?),
              assigned_to = COALESCE(assigned_to, ?)
             WHERE id = ?`
          )
          .bind(t.description || '', t.status || 'new', t.priority || 'high', t.department_id || null, t.assigned_to || null, row.id)
          .run();
      }
      // Re-parent attachments from taskId to synced_emails.id
      await db
        .prepare("UPDATE attachments SET reference_type = 'email', reference_id = ? WHERE reference_id = ?")
        .bind(row.id, row.task_id)
        .run();
      await db.prepare('DELETE FROM task_history WHERE task_id = ?').bind(row.task_id).run();
      await db.prepare('DELETE FROM tasks WHERE id = ?').bind(row.task_id).run();
    }
    if (row.correspondence_id) {
      await db.prepare('DELETE FROM correspondences WHERE id = ?').bind(row.correspondence_id).run();
    }
    await db
      .prepare('UPDATE synced_emails SET task_id = NULL, correspondence_id = NULL WHERE id = ?')
      .bind(row.id)
      .run();
  }

  const existing = await db.prepare('SELECT id FROM email_config LIMIT 1').first();
  if (!existing) {
    await db
      .prepare(
        `INSERT INTO email_config (
          id, email_address, password, owa_url, adfs_url,
          default_assigned_to, default_task_type, default_priority,
          sync_interval_minutes, max_emails_per_sync, only_unread, is_enabled
        ) VALUES (
          'email-cfg-1',
          'technicaloffice.luxor@eha.gov.eg',
          'P@ssw0rdP@ssw0rd15',
          'https://mail.egcloud.gov.eg/owa/',
          'https://fed.egcloud.gov.eg',
          'د. ماجد عاطف',
          'تكليف إداري',
          'high',
          5,
          25,
          0,
          1
        )`
      )
      .run();
  }
}

async function performFreshOwaLogin(
  email: string,
  password: string,
  owaBaseUrl = 'https://mail.egcloud.gov.eg/owa/'
): Promise<CachedOwaSession> {
  if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const jar = new CookieJar();
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  // Step 1: GET /owa/ -> 302 Redirect to ADFS
  let url = owaBaseUrl.endsWith('/') ? owaBaseUrl : `${owaBaseUrl}/`;
  let res = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'manual' });
  jar.addFromResponse(res, url);

  const adfsRedirect = res.headers.get('location');
  if (!adfsRedirect) {
    throw new Error('لم يتم استلام رابط التوجيه لخدمة المصادقة الموحدة (ADFS)');
  }

  // Step 2: GET ADFS Login page
  url = new URL(adfsRedirect, url).toString();
  res = await fetch(url, {
    headers: { 'User-Agent': ua, Cookie: jar.getHeader(url) },
    redirect: 'manual',
  });
  jar.addFromResponse(res, url);
  let html = await res.text();

  const actionMatch =
    html.match(/<form[^>]+id="loginForm"[^>]+action="([^"]+)"/i) ||
    html.match(/<form[^>]+action="([^"]+)"/i);

  const postUrl = actionMatch ? new URL(decodeHtmlEntities(actionMatch[1]), url).toString() : url;
  const form = new URLSearchParams();
  form.set('UserName', email);
  form.set('Password', password);
  form.set('AuthMethod', 'FormsAuthentication');

  // Step 3: POST Credentials to ADFS
  res = await fetch(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': ua,
      Cookie: jar.getHeader(postUrl),
    },
    body: form.toString(),
    redirect: 'manual',
  });
  jar.addFromResponse(res, postUrl);

  if (res.status === 302 && res.headers.get('location')) {
    const nextUrl = new URL(res.headers.get('location')!, postUrl).toString();
    res = await fetch(nextUrl, {
      headers: { 'User-Agent': ua, Cookie: jar.getHeader(nextUrl) },
      redirect: 'manual',
    });
    jar.addFromResponse(res, nextUrl);
    html = await res.text();
  } else {
    html = await res.text();
  }

  // Step 4: Parse WS-Federation token form
  const formActionMatch = html.match(/<form[^>]+action="([^"]+)"/i);
  const waMatch = html.match(/name="wa"\s+value="([^"]+)"/i);
  const wresultMatch = html.match(/name="wresult"\s+value="([^"]+)"/i);
  const wctxMatch = html.match(/name="wctx"\s+value="([^"]+)"/i);

  if (!formActionMatch || !waMatch || !wresultMatch) {
    if (html.includes('incorrect') || html.includes('غير صحيحة') || html.includes('errorText')) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة في خادم البريد الرسمي');
    }
    throw new Error('تعذر استخراج شهادة المصادقة (WS-Federation Token) من خادم البريد');
  }

  const owaPostUrl = decodeHtmlEntities(formActionMatch[1]).replace(':443/', '/');
  const wsfedForm = new URLSearchParams();
  wsfedForm.set('wa', decodeHtmlEntities(waMatch[1]));
  wsfedForm.set('wresult', decodeHtmlEntities(wresultMatch[1]));
  if (wctxMatch) wsfedForm.set('wctx', decodeHtmlEntities(wctxMatch[1]));

  const adfsOrigin = new URL(postUrl).origin;

  res = await fetch(owaPostUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': ua,
      Cookie: jar.getHeader(owaPostUrl),
      Origin: adfsOrigin,
      Referer: `${adfsOrigin}/`,
    },
    body: wsfedForm.toString(),
    redirect: 'manual',
  });
  jar.addFromResponse(res, owaPostUrl);

  // Follow redirects on OWA to obtain FedAuth and X-OWA-CANARY
  let curUrl = res.headers.get('location')
    ? new URL(res.headers.get('location')!, owaPostUrl).toString()
    : owaPostUrl;

  for (let i = 0; i < 5 && res.status >= 300 && res.status < 400; i++) {
    res = await fetch(curUrl, {
      headers: { 'User-Agent': ua, Cookie: jar.getHeader(curUrl) },
      redirect: 'manual',
    });
    jar.addFromResponse(res, curUrl);
    if (res.headers.get('location')) {
      curUrl = new URL(res.headers.get('location')!, curUrl).toString();
    }
  }

  let canary = jar.getCookie('X-OWA-CANARY');
  const owaOrigin = new URL(owaPostUrl).origin;
  const normalizedBaseUrl = `${owaOrigin}/owa/`;

  // Fallback: if GET /owa/ redirected to errorfe.aspx (e.g. MapiExceptionSessionLimit on heavy DefaultPage),
  // ping lightweight service.svc with FedAuth cookies to receive X-OWA-CANARY header/cookie
  if (!canary && jar.getCookie('FedAuth')) {
    const pingUrl = `${normalizedBaseUrl}service.svc?action=GetOwaUserConfiguration`;
    const pingRes = await fetch(pingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Action: 'GetOwaUserConfiguration',
        Cookie: jar.getHeader(pingUrl),
        'User-Agent': ua,
        Origin: owaOrigin,
        Referer: normalizedBaseUrl,
      },
      body: '{}',
      redirect: 'manual',
    });
    jar.addFromResponse(pingRes, pingUrl);
    canary = jar.getCookie('X-OWA-CANARY');
  }

  if (!canary) {
    if (curUrl.includes('TooManyObjectsOpenedException') || curUrl.includes('MapiExceptionSessionLimit')) {
      throw new Error(
        'خادم البريد الحكومي مشغول حالياً (تجاوز عدد الجلسات المفتوحة MAPI Session Limit). يرجى الانتظار دقيقة والمحاولة مرة أخرى.'
      );
    }
    throw new Error('تم تسجيل الدخول ولكن تعذر الحصول على رمز الجلسة (X-OWA-CANARY)');
  }

  return {
    email,
    jar,
    canary,
    ua,
    owaOrigin,
    owaBaseUrl: normalizedBaseUrl,
    expiresAt: Date.now() + 25 * 60 * 1000, // Reuse session for 25 minutes to prevent MAPI session exhaustion!
  };
}

async function getOrCreateOwaSession(
  db: D1Database,
  email: string,
  password: string,
  owaBaseUrl = 'https://mail.egcloud.gov.eg/owa/',
  forceRefresh = false
): Promise<CachedOwaSession> {
  if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const now = Date.now();

  // 1. Check in-memory session cache
  if (!forceRefresh && inMemoryOwaSession && inMemoryOwaSession.email === email && inMemoryOwaSession.expiresAt > now) {
    return inMemoryOwaSession;
  }

  // 2. Check D1 persisted session cache
  if (!forceRefresh) {
    try {
      const row = await db
        .prepare('SELECT session_cache_json FROM email_config WHERE email_address = ? LIMIT 1')
        .bind(email)
        .first<{ session_cache_json?: string }>();
      if (row?.session_cache_json) {
        const parsed = JSON.parse(row.session_cache_json);
        if (parsed && parsed.email === email && parsed.expiresAt > now && parsed.canary && parsed.cookies) {
          inMemoryOwaSession = {
            email: parsed.email,
            jar: CookieJar.fromJSON(parsed.cookies),
            canary: parsed.canary,
            ua: parsed.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            owaOrigin: parsed.owaOrigin || 'https://mail.egcloud.gov.eg',
            owaBaseUrl: parsed.owaBaseUrl || 'https://mail.egcloud.gov.eg/owa/',
            expiresAt: parsed.expiresAt,
          };
          return inMemoryOwaSession;
        }
      }
    } catch (e) {
      // Ignore cache parse errors
    }
  }

  // 3. Deduplicate concurrent login requests
  if (inFlightAuthPromise) {
    return inFlightAuthPromise;
  }

  inFlightAuthPromise = (async () => {
    try {
      const session = await performFreshOwaLogin(email, password, owaBaseUrl);
      inMemoryOwaSession = session;

      // Persist session in D1 so across worker invocations we don't open new MAPI sessions
      const serialized = JSON.stringify({
        email: session.email,
        cookies: session.jar.toJSON(),
        canary: session.canary,
        ua: session.ua,
        owaOrigin: session.owaOrigin,
        owaBaseUrl: session.owaBaseUrl,
        expiresAt: session.expiresAt,
      });
      await db
        .prepare('UPDATE email_config SET session_cache_json = ? WHERE email_address = ?')
        .bind(serialized, email)
        .run()
        .catch(() => {});

      return session;
    } finally {
      inFlightAuthPromise = null;
    }
  })();

  return inFlightAuthPromise;
}

function inferDepartmentAndType(
  subject: string,
  bodyText: string,
  senderName: string,
  senderEmail: string,
  departments: { id: string; name: string; code?: string }[]
): { departmentId: string | null; taskType: string; priority: string } {
  const combined = `${subject} ${bodyText} ${senderName} ${senderEmail}`.toLowerCase();

  let priority = 'high';
  if (
    combined.includes('عاجل جدا') ||
    combined.includes('عاجل للغاية') ||
    combined.includes('هام جدا') ||
    combined.includes('فوري') ||
    combined.includes('جلسة تحقيق') ||
    combined.includes('استدعاء')
  ) {
    priority = 'urgent_critical';
  }

  let taskType = 'تكليف إداري';
  if (combined.includes('اجتماع') || combined.includes('حضور')) {
    taskType = 'اجتماع تنسيقي';
  } else if (combined.includes('شكوى') || combined.includes('شكاوى') || combined.includes('تحقيق')) {
    taskType = 'فحص شكوى';
  } else if (combined.includes('تقرير') || combined.includes('إحصائية') || combined.includes('بيان')) {
    taskType = 'إعداد تقرير';
  } else if (combined.includes('مذكرة')) {
    taskType = 'مذكرة عرض';
  }

  let matchedDeptId: string | null = null;
  const rules: { keywords: string[]; namePart: string }[] = [
    { keywords: ['مقدمي الخدمات', 'الاكلينيكية', 'مستشفى', 'زراعة', 'طبية', 'الكرنك', 'ايزيس', 'msp'], namePart: 'الثانوية' },
    { keywords: ['رعاية اولية', 'وحدات', 'مراكز'], namePart: 'الأولية' },
    { keywords: ['جودة', 'مكافحة العدوى', 'اعتماد'], namePart: 'الجودة' },
    { keywords: ['مالية', 'إدارية', 'مشتريات', 'تعاقدات', 'هندسية', 'غازات', 'biomedical'], namePart: 'المالية' },
    { keywords: ['تحول رقمي', 'تكنولوجيا', 'معلومات', 'نظم'], namePart: 'التحول الرقمي' },
    { keywords: ['رضاء', 'شكاوى', 'منتفعين'], namePart: 'رضاء' },
    { keywords: ['موارد بشرية', 'عاملين', 'مأمورية', 'انتداب', 'تحقيق'], namePart: 'الموارد البشرية' },
    { keywords: ['تخطيط', 'متابعة', 'مشروعات'], namePart: 'التخطيط' },
    { keywords: ['إمداد', 'تموين', 'صيدل', 'أدوية', 'مستلزمات'], namePart: 'الإمداد' },
  ];

  for (const r of rules) {
    if (r.keywords.some((k) => combined.includes(k))) {
      const found = departments.find((d) => d.name.includes(r.namePart));
      if (found) {
        matchedDeptId = found.id;
        break;
      }
    }
  }

  if (!matchedDeptId) {
    const techOffice = departments.find((d) => d.name.includes('المكتب الفني'));
    if (techOffice) matchedDeptId = techOffice.id;
  }

  return { departmentId: matchedDeptId, taskType, priority };
}

export interface EmailSyncOptions {
  limit?: number;
  forceAll?: boolean;
  targetDate?: string; // YYYY-MM-DD (single day)
  fromDate?: string;   // YYYY-MM-DD (range start, inclusive)
  toDate?: string;     // YYYY-MM-DD (range end, inclusive)
}

export async function syncEmailsToTasks(env: Env, options?: EmailSyncOptions) {
  const db = env.DB;
  const bucket = env.ATTACHMENTS_BUCKET;
  await ensureEmailSchema(db);

  const config = await db.prepare('SELECT * FROM email_config LIMIT 1').first<any>();
  if (!config) {
    throw new Error('لم يتم العثور على إعدادات البريد الإلكتروني');
  }

  const filterStartDate = options?.targetDate || options?.fromDate || undefined;
  const filterEndDate = options?.targetDate || options?.toDate || undefined;
  const hasDateFilter = Boolean(filterStartDate || filterEndDate);

  const maxToFetch = options?.limit || (hasDateFilter ? 100 : config.max_emails_per_sync || 20);

  try {
    let session = await getOrCreateOwaSession(db, config.email_address, config.password, config.owa_url, false);

    const buildFindPayload = (offset = 0, pageSize = maxToFetch) => ({
      __type: 'FindItemJsonRequest:#Exchange',
      Header: {
        __type: 'JsonRequestHeaders:#Exchange',
        RequestServerVersion: 'Exchange2013',
        TimeZoneContext: {
          __type: 'TimeZoneContext:#Exchange',
          TimeZoneDefinition: {
            __type: 'TimeZoneDefinitionType:#Exchange',
            Id: 'Egypt Standard Time',
          },
        },
      },
      Body: {
        __type: 'FindItemRequest:#Exchange',
        ItemShape: {
          __type: 'ItemResponseShape:#Exchange',
          BaseShape: 'IdOnly',
          AdditionalProperties: [
            { __type: 'PropertyUri:#Exchange', FieldURI: 'Subject' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'DateTimeReceived' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'From' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'Sender' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'Importance' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'IsRead' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'Preview' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'InternetMessageId' },
            { __type: 'PropertyUri:#Exchange', FieldURI: 'HasAttachments' },
          ],
        },
        ParentFolderIds: [{ __type: 'DistinguishedFolderId:#Exchange', Id: 'inbox' }],
        Traversal: 'Shallow',
        Paging: {
          __type: 'IndexedPageView:#Exchange',
          BasePoint: 'Beginning',
          Offset: offset,
          MaxEntriesReturned: pageSize,
        },
        SortOrder: [
          {
            __type: 'SortResults:#Exchange',
            Order: 'Descending',
            Path: { __type: 'PropertyUri:#Exchange', FieldURI: 'DateTimeReceived' },
          },
        ],
      },
    });

    const executeFindItem = async (sess: CachedOwaSession, offset = 0, pageSize = maxToFetch) => {
      const findUrl = `${sess.owaBaseUrl}service.svc?action=FindItem`;
      return fetch(findUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Action: 'FindItem',
          'X-OWA-Canary': sess.canary,
          Cookie: sess.jar.getHeader(findUrl),
          'User-Agent': sess.ua,
          Origin: sess.owaOrigin,
          Referer: sess.owaBaseUrl,
        },
        body: JSON.stringify(buildFindPayload(offset, pageSize)),
        redirect: 'manual',
      });
    };

    const pageSize = hasDateFilter ? 100 : maxToFetch;
    let findRes = await executeFindItem(session, 0, pageSize);

    // If cached session expired (401, 440 Login Timeout, or 302 redirect), re-authenticate once
    if (findRes.status === 401 || findRes.status === 440 || (findRes.status >= 300 && findRes.status < 400)) {
      session = await getOrCreateOwaSession(db, config.email_address, config.password, config.owa_url, true);
      findRes = await executeFindItem(session, 0, pageSize);
    }

    if (!findRes.ok) {
      throw new Error(`فشل استرجاع قائمة الرسائل من الخادم (HTTP ${findRes.status})`);
    }

    const { jar, canary, ua, owaOrigin, owaBaseUrl } = session;
    const firstFindJson: any = await findRes.json();
    const firstRootFolder = firstFindJson?.Body?.ResponseMessages?.Items?.[0]?.RootFolder;
    let rawItems: any[] = firstRootFolder?.Items || [];
    let includesLastItem = Boolean(firstRootFolder?.IncludesLastItemInRange ?? true);
    let currentOffset = rawItems.length;

    // If filtering by date and the oldest item fetched so far is still newer than filterStartDate, fetch further pages (up to 500 items max)
    while (hasDateFilter && filterStartDate && !includesLastItem && currentOffset < 500 && rawItems.length > 0) {
      const oldestReceivedAt: string = rawItems[rawItems.length - 1]?.DateTimeReceived || '';
      const oldestDateStr = oldestReceivedAt.split('T')[0] || '';
      if (oldestDateStr && oldestDateStr < filterStartDate) {
        break; // Already reached emails older than the start date
      }
      const nextRes = await executeFindItem(session, currentOffset, 100);
      if (!nextRes.ok) break;
      const nextJson: any = await nextRes.json();
      const nextFolder = nextJson?.Body?.ResponseMessages?.Items?.[0]?.RootFolder;
      const nextBatch: any[] = nextFolder?.Items || [];
      if (nextBatch.length === 0) break;
      rawItems = rawItems.concat(nextBatch);
      currentOffset += nextBatch.length;
      includesLastItem = Boolean(nextFolder?.IncludesLastItemInRange ?? true);
    }

    // Filter items by date if date filter was specified
    const items = hasDateFilter
      ? rawItems.filter((item) => {
          const itemDateStr = (item?.DateTimeReceived || '').split('T')[0];
          if (!itemDateStr) return false;
          if (filterStartDate && itemDateStr < filterStartDate) return false;
          if (filterEndDate && itemDateStr > filterEndDate) return false;
          return true;
        })
      : rawItems;

    const departments = (
      await db.prepare('SELECT id, name, code FROM departments WHERE is_active = 1').all<{ id: string; name: string; code?: string }>()
    ).results;

    let importedCount = 0;
    let skippedCount = 0;
    let attachmentsSavedCount = 0;
    const importedTasks: any[] = [];

    // Process from oldest to newest among the fetched batch so task numbers are chronological
    const orderedItems = [...items].reverse();

    for (const item of orderedItems) {
      const ewsId: string = item?.ItemId?.Id || '';
      const internetMsgId: string = item?.InternetMessageId || ewsId;
      const subject: string = (item?.Subject || '').trim() || '(بدون عنوان)';
      const senderMailbox = item?.From?.Mailbox || item?.Sender?.Mailbox || {};
      const senderName: string = senderMailbox.Name || 'بريد وارد';
      const senderEmail: string = senderMailbox.EmailAddress || '';
      const receivedAt: string = item?.DateTimeReceived || new Date().toISOString();

      // Skip automated undeliverable / bounce system messages
      if (
        subject.toLowerCase().startsWith('undeliverable:') ||
        senderEmail.toLowerCase().includes('microsoftexchange')
      ) {
        skippedCount++;
        continue;
      }

      if (config.only_unread && item.IsRead && !options?.forceAll) {
        skippedCount++;
        continue;
      }

      // Check if already synced
      const alreadySynced = await db
        .prepare('SELECT id FROM synced_emails WHERE message_id = ? OR ews_item_id = ?')
        .bind(internetMsgId, ewsId)
        .first<{ id: string }>();

      if (alreadySynced) {
        skippedCount++;
        continue;
      }

      // Fetch full email body & attachments via GetItem
      let fullBodyText = item?.Preview || '';
      let itemAttachments: any[] = [];

      try {
        const getPayload = {
          __type: 'GetItemJsonRequest:#Exchange',
          Header: {
            __type: 'JsonRequestHeaders:#Exchange',
            RequestServerVersion: 'Exchange2013',
            TimeZoneContext: {
              __type: 'TimeZoneContext:#Exchange',
              TimeZoneDefinition: {
                __type: 'TimeZoneDefinitionType:#Exchange',
                Id: 'Egypt Standard Time',
              },
            },
          },
          Body: {
            __type: 'GetItemRequest:#Exchange',
            ItemShape: {
              __type: 'ItemResponseShape:#Exchange',
              BaseShape: 'IdOnly',
              BodyType: 'Text',
              AdditionalProperties: [
                { __type: 'PropertyUri:#Exchange', FieldURI: 'Subject' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'Body' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'DateTimeReceived' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'From' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'Sender' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'Importance' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'InternetMessageId' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'HasAttachments' },
                { __type: 'PropertyUri:#Exchange', FieldURI: 'Attachments' },
              ],
            },
            ItemIds: [{ __type: 'ItemId:#Exchange', Id: ewsId }],
          },
        };

        const getUrl = `${owaBaseUrl}service.svc?action=GetItem`;
        const getRes = await fetch(getUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Action: 'GetItem',
            'X-OWA-Canary': canary,
            Cookie: jar.getHeader(getUrl),
            'User-Agent': ua,
            Origin: owaOrigin,
            Referer: owaBaseUrl,
          },
          body: JSON.stringify(getPayload),
        });

        if (getRes.ok) {
          const getJson: any = await getRes.json();
          const fullItem = getJson?.Body?.ResponseMessages?.Items?.[0]?.Items?.[0];
          if (fullItem?.Body?.Value) {
            fullBodyText = fullItem.Body.Value.trim();
          }
          if (Array.isArray(fullItem?.Attachments)) {
            itemAttachments = fullItem.Attachments.filter(
              (a: any) => a?.__type === 'FileAttachment:#Exchange' && a?.AttachmentId?.Id
            );
          }
        }
      } catch (e) {
        console.error('[EmailSync] Error fetching GetItem details:', e);
      }

      const { departmentId, priority } = inferDepartmentAndType(
        subject,
        fullBodyText,
        senderName,
        senderEmail,
        departments
      );

      const finalPriority =
        item?.Importance === 'High'
          ? 'urgent_critical'
          : priority || config.default_priority || 'high';

      const receivedDateStr = receivedAt.split('T')[0] || new Date().toISOString().split('T')[0];
      const year = new Date().getFullYear();
      const emailRecordId = generateId('emlsync');

      const formattedBodyText = [
        `📧 رسالة واردة عبر البريد الرسمي للمكتب الفني (${config.email_address})`,
        `• الراسل: ${senderName}${senderEmail ? ` <${senderEmail}>` : ''}`,
        `• وقت الاستلام: ${receivedAt.replace('T', ' ').slice(0, 16)}`,
        `• المرفقات: ${itemAttachments.length > 0 ? `${itemAttachments.length} ملف مرفق` : 'لا يوجد'}`,
        `────────────────────────────────────────`,
        fullBodyText || '(لا يوجد نص إضافي بالرسالة — يرجى مراجعة المرفقات)',
      ].join('\n');

      // Download and save any file attachments into R2 + attachments table linked directly to emailRecordId
      let savedAttsForThisEmail = 0;
      for (const att of itemAttachments) {
        try {
          const attId = att.AttachmentId.Id;
          const fileName = att.Name || `attachment-${Date.now()}.pdf`;
          const mimeType = att.ContentType || 'application/octet-stream';
          const dlUrl = `${owaBaseUrl}service.svc/s/GetFileAttachment?id=${encodeURIComponent(attId)}&X-OWA-CANARY=${encodeURIComponent(canary)}`;

          const attRes = await fetch(dlUrl, {
            headers: {
              Cookie: jar.getHeader(dlUrl),
              'User-Agent': ua,
              Referer: owaBaseUrl,
            },
          });

          if (attRes.ok) {
            const arrayBuf = await attRes.arrayBuffer();
            const docId = generateId('doc');
            const ext = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
            const fileKey = `attachments/email-${Date.now()}-${docId}.${ext}`;
            const docRefNum = `DOC-${year}-${Date.now().toString().slice(-4)}`;

            if (bucket) {
              await bucket.put(fileKey, arrayBuf, {
                httpMetadata: { contentType: mimeType },
                customMetadata: {
                  originalName: encodeURIComponent(fileName),
                  uploadedBy: 'البريد الرسمي',
                },
              });
            }

            await db
              .prepare(
                `INSERT INTO attachments (
                  id, reference_type, reference_id, reference_number, file_name,
                  file_key, file_size, mime_type, title, category,
                  department_id, doc_date, description, keywords, uploaded_by, created_at
                ) VALUES (
                  ?, 'email', ?, ?, ?,
                  ?, ?, ?, ?, 'خطابات رسمية',
                  ?, ?, ?, ?, 'البريد الإلكتروني الرسمي', DATETIME('now')
                )`
              )
              .bind(
                docId,
                emailRecordId,
                docRefNum,
                fileName,
                fileKey,
                arrayBuf.byteLength,
                mimeType,
                fileName.replace(/\.[^/.]+$/, ''),
                departmentId,
                receivedDateStr,
                `مرفق مسحوب تلقائياً من البريد: ${subject}`,
                `بريد إلكتروني, ${senderName}`
              )
              .run();

            savedAttsForThisEmail++;
            attachmentsSavedCount++;
          }
        } catch (attErr) {
          console.error('[EmailSync] Attachment download error:', attErr);
        }
      }

      // Record standalone email in synced_emails (completely separate from tasks & correspondences)
      await db
        .prepare(
          `INSERT INTO synced_emails (
            id, message_id, ews_item_id, subject, sender_name, sender_email,
            received_at, body_text, status, priority, department_id, assigned_to,
            task_id, correspondence_id, attachments_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, NULL, NULL, ?, DATETIME('now'))`
        )
        .bind(
          emailRecordId,
          internetMsgId,
          ewsId,
          subject,
          senderName,
          senderEmail,
          receivedAt,
          formattedBodyText,
          finalPriority,
          departmentId,
          config.default_assigned_to || 'د. ماجد عاطف',
          savedAttsForThisEmail
        )
        .run();

      // Create notification for the new email
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read, created_at)
           VALUES (?, NULL, ?, ?, ?, ?, 0, DATETIME('now'))`
        )
        .bind(
          generateId('notif'),
          `بريد رسمي وارد جديد`,
          `${subject.slice(0, 120)} (من: ${senderName})`,
          finalPriority === 'urgent_critical' ? 'urgent' : 'info',
          `/emails`
        )
        .run();

      importedCount++;
      importedTasks.push({
        emailId: emailRecordId,
        subject,
        senderName,
        senderEmail,
        receivedAt,
        attachmentsCount: savedAttsForThisEmail,
      });
    }

    await db
      .prepare(
        `UPDATE email_config SET
          last_sync_at = DATETIME('now'),
          last_sync_status = 'success',
          last_sync_error = NULL,
          total_synced_count = (SELECT COUNT(*) FROM synced_emails),
          updated_at = DATETIME('now')
         WHERE id = ?`
      )
      .bind(config.id)
      .run();

    return {
      success: true,
      email: config.email_address,
      fetchedCount: items.length,
      importedCount,
      skippedCount,
      attachmentsSavedCount,
      importedTasks,
    };
  } catch (err: any) {
    await db
      .prepare(
        `UPDATE email_config SET
          last_sync_at = DATETIME('now'),
          last_sync_status = 'error',
          last_sync_error = ?,
          updated_at = DATETIME('now')
         WHERE id = ?`
      )
      .bind(err.message || 'Unknown error', config.id)
      .run();

    throw err;
  }
}

// GET /api/email/list (Full standalone list of synced emails with filters)
emailSyncRoutes.get('/list', async (c) => {
  try {
    const db = c.env.DB;
    await ensureEmailSchema(db);

    const { search, date, from_date, to_date, status, priority, department_id } = c.req.query();

    let query = `
      SELECT
        s.*,
        d.name as department_name
      FROM synced_emails s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (s.subject LIKE ? OR s.sender_name LIKE ? OR s.sender_email LIKE ? OR s.body_text LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (date && date.trim()) {
      query += ` AND SUBSTR(s.received_at, 1, 10) = ?`;
      params.push(date.trim());
    } else {
      if (from_date && from_date.trim()) {
        query += ` AND SUBSTR(s.received_at, 1, 10) >= ?`;
        params.push(from_date.trim());
      }
      if (to_date && to_date.trim()) {
        query += ` AND SUBSTR(s.received_at, 1, 10) <= ?`;
        params.push(to_date.trim());
      }
    }

    if (status && status.trim()) {
      query += ` AND s.status = ?`;
      params.push(status.trim());
    }

    if (priority && priority.trim()) {
      query += ` AND s.priority = ?`;
      params.push(priority.trim());
    }

    if (department_id && department_id.trim()) {
      query += ` AND s.department_id = ?`;
      params.push(department_id.trim());
    }

    query += ` ORDER BY s.received_at DESC, s.created_at DESC LIMIT 250`;

    const emails = (await db.prepare(query).bind(...params).all()).results;
    const config = await db.prepare('SELECT email_address, last_sync_at, last_sync_status, total_synced_count FROM email_config LIMIT 1').first();

    return c.json({
      success: true,
      emails,
      config,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/email/item/:id (Single standalone email with its attachments)
emailSyncRoutes.get('/item/:id', async (c) => {
  try {
    const db = c.env.DB;
    await ensureEmailSchema(db);
    const id = c.req.param('id');

    const email = await db
      .prepare(
        `SELECT s.*, d.name as department_name
         FROM synced_emails s
         LEFT JOIN departments d ON s.department_id = d.id
         WHERE s.id = ?`
      )
      .bind(id)
      .first<any>();

    if (!email) {
      return c.json({ success: false, error: 'الإيميل غير موجود' }, 404);
    }

    const attachments = (
      await db
        .prepare('SELECT * FROM attachments WHERE reference_id = ? ORDER BY created_at DESC')
        .bind(id)
        .all()
    ).results;

    return c.json({
      success: true,
      email,
      attachments,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/email/item/:id (Update standalone email status, priority, department, or notes)
emailSyncRoutes.put('/item/:id', async (c) => {
  try {
    const db = c.env.DB;
    await ensureEmailSchema(db);
    const id = c.req.param('id');
    const body = await c.req.json();

    await db
      .prepare(
        `UPDATE synced_emails SET
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          department_id = COALESCE(?, department_id),
          assigned_to = COALESCE(?, assigned_to),
          notes = COALESCE(?, notes)
         WHERE id = ?`
      )
      .bind(
        body.status || null,
        body.priority || null,
        body.department_id !== undefined ? body.department_id : null,
        body.assigned_to !== undefined ? body.assigned_to : null,
        body.notes !== undefined ? body.notes : null,
        id
      )
      .run();

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/email/item/:id
emailSyncRoutes.delete('/item/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('DELETE FROM attachments WHERE reference_id = ?').bind(id).run();
    await db.prepare('DELETE FROM synced_emails WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/email/config
emailSyncRoutes.get('/config', async (c) => {
  try {
    const db = c.env.DB;
    await ensureEmailSchema(db);

    const config = await db.prepare('SELECT * FROM email_config LIMIT 1').first<any>();
    const recentSynced = (
      await db
        .prepare(
          `SELECT s.*, t.task_number, t.status as task_status, t.priority as task_priority
           FROM synced_emails s
           LEFT JOIN tasks t ON s.task_id = t.id
           ORDER BY s.received_at DESC, s.created_at DESC
           LIMIT 30`
        )
        .all()
    ).results;

    return c.json({
      success: true,
      config,
      recentSynced,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/email/config
emailSyncRoutes.put('/config', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    await ensureEmailSchema(db);

    const body = await c.req.json();
    const existing = await db.prepare('SELECT * FROM email_config LIMIT 1').first<any>();

    // Clear session cache if credentials changed
    if (
      (body.email_address && body.email_address.trim() !== existing.email_address) ||
      (body.password && body.password.trim() !== existing.password)
    ) {
      inMemoryOwaSession = null;
      await db.prepare('UPDATE email_config SET session_cache_json = NULL WHERE id = ?').bind(existing.id).run();
    }

    await db
      .prepare(
        `UPDATE email_config SET
          email_address = COALESCE(?, email_address),
          password = COALESCE(?, password),
          owa_url = COALESCE(?, owa_url),
          adfs_url = COALESCE(?, adfs_url),
          default_assigned_to = COALESCE(?, default_assigned_to),
          default_task_type = COALESCE(?, default_task_type),
          default_priority = COALESCE(?, default_priority),
          sync_interval_minutes = COALESCE(?, sync_interval_minutes),
          max_emails_per_sync = COALESCE(?, max_emails_per_sync),
          only_unread = COALESCE(?, only_unread),
          is_enabled = COALESCE(?, is_enabled),
          updated_at = DATETIME('now')
         WHERE id = ?`
      )
      .bind(
        body.email_address?.trim() || null,
        body.password?.trim() || null,
        body.owa_url?.trim() || null,
        body.adfs_url?.trim() || null,
        body.default_assigned_to?.trim() || null,
        body.default_task_type?.trim() || null,
        body.default_priority || null,
        body.sync_interval_minutes ?? null,
        body.max_emails_per_sync ?? null,
        body.only_unread !== undefined ? (body.only_unread ? 1 : 0) : null,
        body.is_enabled !== undefined ? (body.is_enabled ? 1 : 0) : null,
        existing.id
      )
      .run();

    await logAudit(
      db,
      user.userId,
      user.username,
      'UPDATE_EMAIL_CONFIG',
      'email_config',
      existing.id,
      `تحديث إعدادات ربط البريد الإلكتروني: ${body.email_address || existing.email_address}`
    );

    return c.json({ success: true, message: 'تم حفظ إعدادات البريد الإلكتروني بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/email/test
emailSyncRoutes.post('/test', async (c) => {
  try {
    const db = c.env.DB;
    await ensureEmailSchema(db);
    const body = await c.req.json().catch(() => ({}));
    const config = await db.prepare('SELECT * FROM email_config LIMIT 1').first<any>();

    const email = body.email_address?.trim() || config?.email_address;
    const password = body.password?.trim() || config?.password;
    const owaUrl = body.owa_url?.trim() || config?.owa_url;

    const session = await getOrCreateOwaSession(db, email, password, owaUrl, false);
    return c.json({
      success: true,
      message: `تم الاتصال وتوثيق الدخول بنجاح لحساب ${email} عبر خادم ${session.owaOrigin}`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// POST /api/email/sync
emailSyncRoutes.post('/sync', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const targetDate = typeof body.targetDate === 'string' && body.targetDate.trim() ? body.targetDate.trim() : undefined;
    const fromDate = typeof body.fromDate === 'string' && body.fromDate.trim() ? body.fromDate.trim() : undefined;
    const toDate = typeof body.toDate === 'string' && body.toDate.trim() ? body.toDate.trim() : undefined;

    const result = await syncEmailsToTasks(c.env, {
      limit: body.limit ? Number(body.limit) : undefined,
      forceAll: Boolean(body.forceAll),
      targetDate,
      fromDate,
      toDate,
    });

    const dateDesc = targetDate
      ? ` ليوم ${targetDate}`
      : fromDate || toDate
      ? ` للفترة (${fromDate || 'البداية'} إلى ${toDate || 'اليوم'})`
      : '';

    await logAudit(
      c.env.DB,
      user.userId,
      user.username,
      'SYNC_EMAILS',
      'email_config',
      'email-cfg-1',
      `سحب البريد الإلكتروني${dateDesc}: تم فحص ${result.fetchedCount} رسالة وتحويل ${result.importedCount} رسالة إلى مهام، وحفظ ${result.attachmentsSavedCount} مرفق`
    );

    return c.json({
      ...result,
      filterDate: targetDate || (fromDate || toDate ? `${fromDate || ''}..${toDate || ''}` : null),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
