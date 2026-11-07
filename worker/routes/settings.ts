import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware, verifyPassword, hashPassword } from '../auth';
import { generateId, logAudit } from '../db';

export const settingsRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

settingsRoutes.use('*', authMiddleware);

// GET /api/settings
settingsRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');

    let settings = await db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .bind(user.userId)
      .first();

    if (!settings) {
      const id = generateId('set');
      await db
        .prepare(
          `INSERT INTO user_settings (id, user_id, work_start_time, work_end_time, default_reminder_hours, theme, language)
           VALUES (?, ?, '08:30', '15:30', 24, 'light', 'ar')`
        )
        .bind(id, user.userId)
        .run();
      settings = await db.prepare('SELECT * FROM user_settings WHERE id = ?').bind(id).first();
    }

    // Ensure Magid / admin is always admin and Dr. Ahmed is director
    await db
      .prepare("UPDATE users SET role = 'admin' WHERE LOWER(username) IN ('magid', 'admin') OR full_name LIKE '%ماجد%' OR id = 'usr-admin-01'")
      .run();
    await db
      .prepare("UPDATE users SET role = 'director' WHERE (LOWER(username) LIKE '%ahmed%' OR job_title LIKE '%مدير عام%' OR job_title LIKE '%مدير الفرع%') AND job_title NOT LIKE '%المكتب%' AND LOWER(username) NOT IN ('magid', 'admin')")
      .run();

    const departments = (await db.prepare('SELECT * FROM departments ORDER BY display_order ASC').all()).results;
    const users = (
      await db.prepare('SELECT id, username, full_name, job_title, role, created_at FROM users ORDER BY created_at ASC').all()
    ).results;

    return c.json({ success: true, settings, departments, users });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/settings
settingsRoutes.put('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();

    // Ensure settings record exists
    let existing = await db.prepare('SELECT id FROM user_settings WHERE user_id = ?').bind(user.userId).first();
    if (!existing) {
      await db
        .prepare(
          `INSERT INTO user_settings (id, user_id, work_start_time, work_end_time, default_reminder_hours, theme, language)
           VALUES (?, ?, '08:30', '15:30', 24, 'light', 'ar')`
        )
        .bind(generateId('set'), user.userId)
        .run();
    }

    await db
      .prepare(
        `UPDATE user_settings SET
          work_start_time = COALESCE(?, work_start_time),
          work_end_time = COALESCE(?, work_end_time),
          default_reminder_hours = COALESCE(?, default_reminder_hours),
          theme = COALESCE(?, theme),
          language = COALESCE(?, language),
          email_notifications = COALESCE(?, email_notifications),
          browser_notifications = COALESCE(?, browser_notifications),
          updated_at = DATETIME('now')
        WHERE user_id = ?`
      )
      .bind(
        body.work_start_time ?? null,
        body.work_end_time ?? null,
        body.default_reminder_hours ?? null,
        body.theme ?? null,
        body.language ?? null,
        body.email_notifications ?? null,
        body.browser_notifications ?? null,
        user.userId
      )
      .run();

    await logAudit(db, user.userId, user.username, 'UPDATE_SETTINGS', 'settings', user.userId, 'تحديث تفضيلات وإعدادات النظام');

    return c.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/settings/backup/export (Export full JSON backup)
settingsRoutes.get('/backup/export', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');

    const tasks = (await db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all()).results;
    const subtasks = (await db.prepare('SELECT * FROM task_subtasks').all()).results;
    const correspondences = (await db.prepare('SELECT * FROM correspondences').all()).results;
    const meetings = (await db.prepare('SELECT * FROM meetings').all()).results;
    const decisions = (await db.prepare('SELECT * FROM meeting_decisions').all()).results;
    const dailyLogs = (await db.prepare('SELECT * FROM daily_work_logs').all()).results;
    const followups = (await db.prepare('SELECT * FROM task_followups').all()).results;
    const departments = (await db.prepare('SELECT * FROM departments').all()).results;
    const attachments = (await db.prepare('SELECT * FROM attachments').all()).results;

    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      system: 'Daily Office Manager',
      exportedBy: user.username,
      data: {
        departments,
        tasks,
        subtasks,
        correspondences,
        meetings,
        decisions,
        dailyLogs,
        followups,
        attachments,
      },
    };

    await logAudit(db, user.userId, user.username, 'BACKUP_EXPORT', 'system', null, 'تصدير نسخة احتياطية شاملة من النظام');

    return c.json({ success: true, backup: backupData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/settings/reset-all-data (Wipe all operational data)
settingsRoutes.post('/reset-all-data', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const password = body?.password;

    const dbUser = await db
      .prepare('SELECT role, job_title FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ role: string; job_title: string }>();

    const isAllowed =
      dbUser?.role === 'admin' ||
      dbUser?.role === 'director' ||
      user.role === 'admin' ||
      user.role === 'director' ||
      dbUser?.job_title?.includes('مدير عام') ||
      dbUser?.job_title?.includes('مدير الفرع');

    if (!isAllowed) {
      return c.json({ success: false, error: 'غير مصرح: هذه العملية مخصصة فقط لمدير النظام ومدير عام الفرع' }, 403);
    }

    if (!password || !password.trim()) {
      return c.json({ success: false, error: 'يرجى إدخال كلمة مرور تأكيد المسح' }, 400);
    }

    if (password.trim() !== '123@123456') {
      return c.json({ success: false, error: 'كلمة مرور تأكيد المسح غير صحيحة! تم إلغاء العملية.' }, 401);
    }

    const tables = [
      'tasks',
      'task_subtasks',
      'task_comments',
      'task_history',
      'task_followups',
      'daily_work_logs',
      'correspondences',
      'meetings',
      'meeting_decisions',
      'attachments',
      'notifications',
    ];

    for (const t of tables) {
      await db.prepare(`DELETE FROM ${t}`).run();
    }

    await logAudit(db, user.userId, user.username, 'RESET_ALL_DATA', 'system', null, 'مسح كافة البيانات التشغيلية وإعادة ضبط النظام');

    return c.json({ success: true, message: 'تم مسح كافة البيانات التشغيلية بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/settings/backup/import (Restore JSON backup)
settingsRoutes.post('/backup/import', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();
    const data = body.data || body.backup?.data;

    if (!data || typeof data !== 'object') {
      return c.json({ success: false, error: 'ملف النسخة الاحتياطية غير صالح' }, 400);
    }

    // Restore departments
    if (Array.isArray(data.departments)) {
      for (const d of data.departments) {
        if (!d.id || !d.name) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO departments (id, name, code, display_order, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')))`
          )
          .bind(d.id, d.name, d.code || null, d.display_order || 0, d.is_active ?? 1, d.created_at || null)
          .run();
      }
    }

    // Restore tasks
    if (Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        if (!t.id || !t.title) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO tasks (
              id, task_number, title, description, task_type, department_id,
              assigned_by, assigned_to, priority, status, start_date, due_date,
              completion_date, progress, reference_number, notes, follow_up_date,
              recurrence, recurrence_rule, postponed_count, postpone_reason, is_archived,
              created_at, updated_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')), COALESCE(?, DATETIME('now')), ?)`
          )
          .bind(
            t.id,
            t.task_number || `TSK-${Date.now()}`,
            t.title,
            t.description || null,
            t.task_type || 'تكليف إداري',
            t.department_id || null,
            t.assigned_by || 'مدير الفرع',
            t.assigned_to || user.username,
            t.priority || 'medium',
            t.status || 'new',
            t.start_date || null,
            t.due_date || null,
            t.completion_date || null,
            t.progress ?? 0,
            t.reference_number || null,
            t.notes || null,
            t.follow_up_date || null,
            t.recurrence || 'none',
            t.recurrence_rule || null,
            t.postponed_count ?? 0,
            t.postpone_reason || null,
            t.is_archived ?? 0,
            t.created_at || null,
            t.updated_at || null,
            t.deleted_at || null
          )
          .run();
      }
    }

    // Restore subtasks
    if (Array.isArray(data.subtasks)) {
      for (const s of data.subtasks) {
        if (!s.id || !s.task_id) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO task_subtasks (id, task_id, title, is_completed, sort_order, completed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')))`
          )
          .bind(s.id, s.task_id, s.title || '', s.is_completed ?? 0, s.sort_order ?? 0, s.completed_at || null, s.created_at || null)
          .run();
      }
    }

    // Restore correspondences
    if (Array.isArray(data.correspondences)) {
      for (const corr of data.correspondences) {
        if (!corr.id || !corr.subject) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO correspondences (
              id, reg_number, official_letter_number, letter_date, date_received_or_sent,
              letter_type, sender, recipient, subject, summary, required_action,
              department_id, assigned_to, reply_due_date, status, linked_task_id, notes,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')), COALESCE(?, DATETIME('now')))`
          )
          .bind(
            corr.id,
            corr.reg_number || `REG-${Date.now()}`,
            corr.official_letter_number || null,
            corr.letter_date || new Date().toISOString().split('T')[0],
            corr.date_received_or_sent || new Date().toISOString().split('T')[0],
            corr.letter_type || 'وارد',
            corr.sender || 'غير محدد',
            corr.recipient || 'مدير الفرع',
            corr.subject,
            corr.summary || null,
            corr.required_action || null,
            corr.department_id || null,
            corr.assigned_to || null,
            corr.reply_due_date || null,
            corr.status || 'under_process',
            corr.linked_task_id || null,
            corr.notes || null,
            corr.created_at || null,
            corr.updated_at || null
          )
          .run();
      }
    }

    // Restore meetings
    if (Array.isArray(data.meetings)) {
      for (const m of data.meetings) {
        if (!m.id || !m.title) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO meetings (
              id, title, meeting_date, meeting_time, location, chairman,
              attendees, agenda, summary_of_discussions, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')), COALESCE(?, DATETIME('now')))`
          )
          .bind(
            m.id,
            m.title,
            m.meeting_date || new Date().toISOString().split('T')[0],
            m.meeting_time || '10:00',
            m.location || null,
            m.chairman || 'مدير الفرع',
            m.attendees || null,
            m.agenda || null,
            m.summary_of_discussions || null,
            m.created_at || null,
            m.updated_at || null
          )
          .run();
      }
    }

    // Restore decisions
    if (Array.isArray(data.decisions)) {
      for (const dec of data.decisions) {
        if (!dec.id || !dec.meeting_id) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO meeting_decisions (
              id, meeting_id, item_type, content, assigned_to_dept, assigned_to_person,
              due_date, linked_task_id, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')))`
          )
          .bind(
            dec.id,
            dec.meeting_id,
            dec.item_type || 'توصية',
            dec.content || '',
            dec.assigned_to_dept || null,
            dec.assigned_to_person || null,
            dec.due_date || null,
            dec.linked_task_id || null,
            dec.status || 'pending',
            dec.created_at || null
          )
          .run();
      }
    }

    // Restore daily logs
    if (Array.isArray(data.dailyLogs)) {
      for (const l of data.dailyLogs) {
        if (!l.id || !l.description) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO daily_work_logs (
              id, user_id, log_date, start_time, end_time, activity_type,
              department_id, task_id, description, actions_taken, results,
              obstacles, next_step, notes, is_completed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')), COALESCE(?, DATETIME('now')))`
          )
          .bind(
            l.id,
            l.user_id || user.userId,
            l.log_date || new Date().toISOString().split('T')[0],
            l.start_time || null,
            l.end_time || null,
            l.activity_type || 'إنجاز سريع',
            l.department_id || null,
            l.task_id || null,
            l.description,
            l.actions_taken || null,
            l.results || null,
            l.obstacles || null,
            l.next_step || null,
            l.notes || null,
            l.is_completed ?? 1,
            l.created_at || null,
            l.updated_at || null
          )
          .run();
      }
    }

    // Restore followups
    if (Array.isArray(data.followups)) {
      for (const f of data.followups) {
        if (!f.id) continue;
        await db
          .prepare(
            `INSERT OR REPLACE INTO task_followups (
              id, task_id, correspondence_id, follow_up_date, follow_up_channel,
              target_person_or_dept, outcome, reply_received, next_step,
              next_follow_up_date, status, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATETIME('now')))`
          )
          .bind(
            f.id,
            f.task_id || null,
            f.correspondence_id || null,
            f.follow_up_date || new Date().toISOString().split('T')[0],
            f.follow_up_channel || 'اتصال هاتفي',
            f.target_person_or_dept || '',
            f.outcome || '',
            f.reply_received || null,
            f.next_step || null,
            f.next_follow_up_date || null,
            f.status || 'pending',
            f.created_by || user.username,
            f.created_at || null
          )
          .run();
      }
    }

    await logAudit(db, user.userId, user.username, 'BACKUP_IMPORT', 'system', null, 'استعادة نسخة احتياطية شاملة للنظام');

    return c.json({ success: true, message: 'تم استعادة النسخة الاحتياطية بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Helper to normalize Arabic text for duplicate checking
function normalizeArabic(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ى/g, 'ي')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

// Department CRUD in Settings
settingsRoutes.post('/departments', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const { name, code } = await c.req.json();
    if (!name || !name.trim()) {
      return c.json({ success: false, error: 'اسم الإدارة مطلوب' }, 400);
    }

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const allDepts = (await db.prepare('SELECT id, name FROM departments').all<{ id: string; name: string }>()).results;
    const duplicate = allDepts.find((d) => normalizeArabic(d.name) === normalizeArabic(cleanName));
    if (duplicate) {
      return c.json({ success: false, error: `هذه الإدارة مسجلة بالفعل تحت اسم "${duplicate.name}"` }, 400);
    }

    const id = generateId('dept');
    const maxOrder = await db.prepare('SELECT MAX(display_order) as max_ord FROM departments').first<{ max_ord: number }>();
    const nextOrder = (maxOrder?.max_ord || 0) + 1;

    await db
      .prepare('INSERT INTO departments (id, name, code, display_order, is_active) VALUES (?, ?, ?, ?, 1)')
      .bind(id, cleanName, code?.trim() || null, nextOrder)
      .run();

    await logAudit(db, user.userId, user.username, 'CREATE_DEPARTMENT', 'department', id, `إضافة إدارة: ${cleanName}`);

    return c.json({ success: true, id });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ success: false, error: 'هذه الإدارة مسجلة بالفعل في النظام' }, 400);
    }
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsRoutes.put('/departments/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const { name, code, is_active } = await c.req.json();

    if (name && name.trim()) {
      const cleanName = name.trim().replace(/\s+/g, ' ');
      const allDepts = (await db.prepare('SELECT id, name FROM departments WHERE id != ?').bind(id).all<{ id: string; name: string }>()).results;
      const duplicate = allDepts.find((d) => normalizeArabic(d.name) === normalizeArabic(cleanName));
      if (duplicate) {
        return c.json({ success: false, error: `هذا الاسم مستخدم بالفعل في "${duplicate.name}"` }, 400);
      }
    }

    await db
      .prepare(
        `UPDATE departments SET
          name = COALESCE(?, name),
          code = COALESCE(?, code),
          is_active = COALESCE(?, is_active)
         WHERE id = ?`
      )
      .bind(name?.trim() ?? null, code?.trim() ?? null, is_active ?? null, id)
      .run();

    return c.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ success: false, error: 'اسم الإدارة مسجل بالفعل في النظام' }, 400);
    }
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsRoutes.delete('/departments/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('UPDATE tasks SET department_id = NULL WHERE department_id = ?').bind(id).run();
    await db.prepare('UPDATE correspondences SET department_id = NULL WHERE department_id = ?').bind(id).run();
    await db.prepare('DELETE FROM departments WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Users & Technical Office Members Management
settingsRoutes.get('/users', async (c) => {
  try {
    const db = c.env.DB;
    const users = (
      await db.prepare('SELECT id, username, full_name, job_title, role, created_at FROM users ORDER BY created_at ASC').all()
    ).results;
    return c.json({ success: true, users });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsRoutes.post('/users', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const dbUser = await db.prepare('SELECT role FROM users WHERE id = ?').bind(currentUser.userId).first<{ role: string }>();
    if (dbUser?.role !== 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'غير مصرح: إضافة المستخدمين من اختصاصات مدير النظام (Admin) فقط' }, 403);
    }

    const { username, password, full_name, job_title, role } = await c.req.json();
    if (!username?.trim() || !password?.trim() || !full_name?.trim()) {
      return c.json({ success: false, error: 'الاسم الكامل واسم المستخدم وكلمة المرور حقول مطلوبة' }, 400);
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').bind(cleanUsername).first();
    if (existing) {
      return c.json({ success: false, error: 'اسم المستخدم هذا مسجل بالفعل، يرجى اختيار اسم آخر' }, 400);
    }

    const id = generateId('usr');
    const passwordHash = await hashPassword(password.trim());
    const userRole = ['admin', 'director', 'officer', 'viewer'].includes(role) ? role : 'officer';

    await db
      .prepare(
        `INSERT INTO users (id, username, password_hash, full_name, job_title, role)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        cleanUsername,
        passwordHash,
        full_name.trim(),
        job_title?.trim() || 'عضو المكتب الفني',
        userRole
      )
      .run();

    await logAudit(db, currentUser.userId, currentUser.username, 'CREATE_USER', 'user', id, `إضافة مستخدم جديد: ${full_name.trim()}`);

    return c.json({ success: true, id });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsRoutes.put('/users/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const id = c.req.param('id');
    const dbUser = await db.prepare('SELECT role FROM users WHERE id = ?').bind(currentUser.userId).first<{ role: string }>();
    const isAdmin = dbUser?.role === 'admin' || currentUser.role === 'admin';
    if (!isAdmin && currentUser.userId !== id) {
      return c.json({ success: false, error: 'غير مصرح: تعديل بيانات الأعضاء الآخرين من اختصاصات مدير النظام فقط' }, 403);
    }
    const { username, password, full_name, job_title, role } = await c.req.json();
    const safeRole = isAdmin ? role : null;

    if (username?.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      const dup = await db
        .prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?')
        .bind(cleanUsername, id)
        .first();
      if (dup) {
        return c.json({ success: false, error: 'اسم المستخدم مسجل بالفعل لمستخدم آخر' }, 400);
      }
    }

    if (password && password.trim()) {
      const passwordHash = await hashPassword(password.trim());
      await db.prepare("UPDATE users SET password_hash = ?, updated_at = DATETIME('now') WHERE id = ?").bind(passwordHash, id).run();
    }

    await db
      .prepare(
        `UPDATE users SET
          username = COALESCE(?, username),
          full_name = COALESCE(?, full_name),
          job_title = COALESCE(?, job_title),
          role = COALESCE(?, role),
          updated_at = DATETIME('now')
         WHERE id = ?`
      )
      .bind(
        username?.trim().toLowerCase() ?? null,
        full_name?.trim() ?? null,
        job_title?.trim() ?? null,
        safeRole ?? null,
        id
      )
      .run();

    await logAudit(db, currentUser.userId, currentUser.username, 'UPDATE_USER', 'user', id, `تحديث بيانات المستخدم: ${full_name || id}`);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsRoutes.delete('/users/:id', async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get('user');
    const dbUser = await db.prepare('SELECT role FROM users WHERE id = ?').bind(currentUser.userId).first<{ role: string }>();
    if (dbUser?.role !== 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'غير مصرح: حذف الأعضاء من اختصاصات مدير النظام (Admin) فقط' }, 403);
    }

    const id = c.req.param('id');
    if (id === currentUser.userId) {
      return c.json({ success: false, error: 'لا يمكنك حذف حسابك الشخصي الحالي أثناء تسجيل الدخول' }, 400);
    }

    await db.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(id).run();
    await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    await logAudit(db, currentUser.userId, currentUser.username, 'DELETE_USER', 'user', id, 'حذف حساب مستخدم');

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Notifications Endpoints
settingsRoutes.get('/notifications', async (c) => {
  try {
    const db = c.env.DB;
    const todayStr = new Date().toISOString().split('T')[0];

    // Also dynamically surface overdue/today alerts alongside stored notifications
    const stored = (
      await db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20').all<any>()
    ).results;

    const overdueCountRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND due_date < ? AND status NOT IN ('completed', 'cancelled')"
      )
      .bind(todayStr)
      .first<{ count: number }>();

    const todayCountRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND due_date = ? AND status NOT IN ('completed', 'cancelled')"
      )
      .bind(todayStr)
      .first<{ count: number }>();

    const corrDueRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM correspondences WHERE reply_due_date <= ? AND status IN ('under_process', 'waiting_info')"
      )
      .bind(todayStr)
      .first<{ count: number }>();

    const liveAlerts: any[] = [];
    if ((overdueCountRow?.count || 0) > 0) {
      liveAlerts.push({
        id: 'live-overdue',
        title: `${overdueCountRow?.count} مهام متأخرة عن موعدها`,
        message: 'توجد مهام تجاوزت تاريخ الاستحقاق وتحتاج إلى متابعة عاجلة.',
        type: 'urgent',
        link_url: '/tasks?overdue=1',
        is_read: 0,
        created_at: todayStr,
      });
    }
    if ((todayCountRow?.count || 0) > 0) {
      liveAlerts.push({
        id: 'live-today',
        title: `${todayCountRow?.count} مهام مستحقة اليوم`,
        message: 'يرجى مراجعة مهام اليوم وتحديث نسب الإنجاز.',
        type: 'warning',
        link_url: '/tasks?today=1',
        is_read: 0,
        created_at: todayStr,
      });
    }
    if ((corrDueRow?.count || 0) > 0) {
      liveAlerts.push({
        id: 'live-corr',
        title: `${corrDueRow?.count} مكاتبات حل موعد الرد عليها`,
        message: 'توجد خطابات ومراسلات قيد المتابعة تستلزم الرد.',
        type: 'info',
        link_url: '/correspondences',
        is_read: 0,
        created_at: todayStr,
      });
    }

    const allNotifications = [...liveAlerts, ...stored];
    const unreadCount = allNotifications.filter((n) => !n.is_read).length;

    return c.json({
      success: true,
      notifications: allNotifications,
      unreadCount,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

settingsRoutes.post('/notifications/mark-read', async (c) => {
  try {
    const db = c.env.DB;
    await db.prepare('UPDATE notifications SET is_read = 1').run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
