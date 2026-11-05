import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalD1Database } from '../worker/local-d1.mjs';
import app from '../dist-worker/index.js';

describe('Daily Office Manager — Automated Full-Stack Test Suite', () => {
  let env;
  let authToken = '';

  before(() => {
    const { d1 } = createLocalD1Database(':memory:');
    env = {
      DB: d1,
      JWT_SECRET: 'daily-office-manager-secure-jwt-secret-key-2025',
      DEFAULT_TIMEZONE: 'Africa/Cairo',
    };
  });

  const request = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    const req = new Request(`http://localhost${path}`, {
      ...options,
      headers,
    });
    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    };
    const res = await app.fetch(req, env, ctx);
    const contentType = res.headers.get('content-type') || '';
    let json = null;
    if (contentType.includes('application/json')) {
      json = await res.json();
    }
    return { status: res.status, headers: res.headers, json };
  };

  test('1. Security & Authentication: Reject unauthenticated requests', async () => {
    const res = await request('/api/tasks');
    assert.equal(res.status, 401, 'Protected route must return 401 without auth header');
    assert.equal(res.json.success, false);
  });

  test('2. Authentication: Reject invalid credentials', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.success, false);
  });

  test('3. Authentication: Login successfully with seed user', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123@office' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.token, 'JWT token must be returned');
    assert.equal(res.json.user.username, 'admin');

    authToken = res.json.token; // Save for subsequent calls
  });

  test('4. Authentication: Verify current user session (/api/auth/me)', async () => {
    const res = await request('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.user.username, 'admin');
    assert.equal(res.json.user.role, 'admin');
  });

  test('5. Dashboard: Real-time DB Stats Calculation', async () => {
    const res = await request('/api/dashboard/stats');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(typeof res.json.stats.totalTasks, 'number', 'Total tasks count is a valid number');
    assert.ok(Array.isArray(res.json.stats.tasksByStatus), 'Status distribution array exists');
    assert.ok(Array.isArray(res.json.stats.tasksByPriority), 'Priority distribution array exists');
  });

  test('6. Tasks: Create new task with subtasks', async () => {
    const payload = {
      title: 'مراجعة عقود الصيانة لمنظومة الحريق بمستشفى الكرنك',
      description: 'مراجعة الملاحظات الفنية الخاصة بالدفاع المدني وإعداد مذكرة عرض.',
      task_type: 'تكليف إداري',
      priority: 'urgent_critical',
      due_date: '2026-11-20',
      assigned_by: 'مدير الفرع',
      assigned_to: 'د. ماجد عاطف',
      subtasks: [
        { title: 'معاينة الموقع ومطابقة الملاحظات', is_completed: 1 },
        { title: 'طلب المقايسة الفنية من الإدارة الهندسية', is_completed: 0 },
      ],
    };

    const res = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.taskId);
    assert.ok(res.json.task_number.startsWith('TSK-'));

    // Fetch single task
    const taskRes = await request(`/api/tasks/${res.json.taskId}`);
    assert.equal(taskRes.status, 200);
    assert.equal(taskRes.json.task.title, payload.title);
    assert.equal(taskRes.json.task.subtasks.length, 2);
    assert.ok(taskRes.json.task.history.length >= 1, 'History log recorded');
  });

  test('7. Tasks: Automatic Overdue Detection', async () => {
    // Create an overdue task (due yesterday)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const res = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'مهمة متأخرة لاختبار الفحص التلقائي',
        due_date: yesterday,
        priority: 'high',
        status: 'in_progress',
      }),
    });
    assert.equal(res.status, 200);

    const checkRes = await request(`/api/tasks/${res.json.taskId}`);
    assert.equal(checkRes.json.task.is_overdue, 1, 'Task with past due_date must be flagged as overdue');
  });

  test('8. Tasks: Postpone deadline with recorded reason', async () => {
    // Create task
    const createRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'مهمة للتأجيل', due_date: '2026-11-10' }),
    });
    const taskId = createRes.json.taskId;

    // Postpone
    const updateRes = await request(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        due_date: '2026-11-25',
        postpone_reason: 'تأخر ورود رد المستشفى المختص',
      }),
    });
    assert.equal(updateRes.status, 200);

    const getRes = await request(`/api/tasks/${taskId}`);
    assert.equal(getRes.json.task.due_date, '2026-11-25');
    assert.equal(getRes.json.task.postponed_count, 1);
    assert.equal(getRes.json.task.postpone_reason, 'تأخر ورود رد المستشفى المختص');
  });

  test('9. Tasks: Archive & Soft Delete', async () => {
    const createRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'مهمة للأرشفة والحذف' }),
    });
    const taskId = createRes.json.taskId;

    // Archive
    const archRes = await request(`/api/tasks/${taskId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archive: true }),
    });
    assert.equal(archRes.status, 200);

    // Verify archived
    const checkArch = await request(`/api/tasks/${taskId}`);
    assert.equal(checkArch.json.task.is_archived, 1);

    // Delete
    const delRes = await request(`/api/tasks/${taskId}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    // Should return 404
    const checkDel = await request(`/api/tasks/${taskId}`);
    assert.equal(checkDel.status, 404);
  });

  test('10. Follow-up Center: Add Follow-up & verify linkage', async () => {
    // Create a task to follow up on
    const taskRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'مهمة لاختبار المتابعة' }),
    });
    const targetTaskId = taskRes.json.taskId;

    // Follow-up on created task
    const res = await request('/api/follow-ups', {
      method: 'POST',
      body: JSON.stringify({
        task_id: targetTaskId,
        follow_up_channel: 'اتصال هاتفي',
        target_person_or_dept: 'مدير إدارة الرعاية الأولية',
        outcome: 'تم الاتفاق على موافاة المكتب الفني بالتقرير صباح الغد',
        next_step: 'استلام التقرير ومطابقته',
        next_follow_up_date: '2026-11-06',
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);

    // Check history timeline
    const histRes = await request(`/api/follow-ups/history/${targetTaskId}`);
    assert.equal(histRes.status, 200);
    assert.ok(histRes.json.history.length >= 1, 'Should include the new followup');
  });

  test('11. Correspondences: Create and convert to task', async () => {
    // 1. Create incoming correspondence
    const corrRes = await request('/api/correspondences', {
      method: 'POST',
      body: JSON.stringify({
        subject: 'خطاب بشأن فحص جاهزية شبكة الأكسجين بمستشفى حورس',
        letter_type: 'وارد',
        sender: 'الإدارة العامة للشؤون الهندسية برئاسة الهيئة',
        recipient: 'مدير فرع الهيئة',
        official_letter_number: 'ص-994/2026',
        reply_due_date: '2026-11-12',
        summary: 'مطلوب إفادة شاملة عن نتائج المعاينة الفنية خلال أسبوع',
      }),
    });
    assert.equal(corrRes.status, 200);
    assert.equal(corrRes.json.success, true);
    const corrId = corrRes.json.id;

    // 2. Convert to task
    const convRes = await request(`/api/correspondences/${corrId}/convert-to-task`, {
      method: 'POST',
    });
    assert.equal(convRes.status, 200);
    assert.equal(convRes.json.success, true);
    assert.ok(convRes.json.taskId);

    // 3. Verify mutual linkage
    const corrCheck = await request(`/api/correspondences/${corrId}`);
    assert.equal(corrCheck.json.correspondence.linked_task_id, convRes.json.taskId);
    assert.equal(corrCheck.json.correspondence.status, 'transferred_to_task');
  });

  test('12. Meetings: Create meeting and convert recommendation to task', async () => {
    const meetRes = await request('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({
        title: 'اجتماع لجنة الطوارئ والأزمات بالفرع',
        meeting_date: '2026-11-05',
        chairman: 'د. مدير الفرع',
        decisions: [
          {
            item_type: 'توصية',
            content: 'إجراء مناورة طوارئ وإخلاء بمستشفى طيبة التخصصي يوم الخميس القادم',
            assigned_to_dept: 'إدارة السلامة والصحة المهنية',
            due_date: '2026-11-12',
          },
        ],
      }),
    });
    assert.equal(meetRes.status, 200);
    const meetId = meetRes.json.id;

    // Fetch meeting details
    const detailsRes = await request(`/api/meetings/${meetId}`);
    assert.equal(detailsRes.status, 200);
    assert.equal(detailsRes.json.meeting.decisions.length, 1);
    const decisionId = detailsRes.json.meeting.decisions[0].id;

    // Convert decision to task
    const convRes = await request(`/api/meetings/decisions/${decisionId}/convert-to-task`, {
      method: 'POST',
    });
    assert.equal(convRes.status, 200);
    assert.ok(convRes.json.taskId);
  });

  test('13. Daily Work Log: Create log & generate End-of-Day Report', async () => {
    const today = new Date().toISOString().split('T')[0];
    const logRes = await request('/api/daily-logs', {
      method: 'POST',
      body: JSON.stringify({
        description: 'إعداد مقترح توزيع الكوادر الطبية على مراكز الرعاية الأولية',
        activity_type: 'صياغة مذكرة',
        actions_taken: 'حصر العجز بالوحدات الطرفية وإعادة تسكين الأطباء المقيمين',
        results: 'تم رفع المذكرة للمكتب الفني لاعتمادها',
        is_completed: 1,
      }),
    });
    assert.equal(logRes.status, 200);

    // End of day report
    const reportRes = await request(`/api/daily-logs/end-of-day-report?date=${today}`);
    assert.equal(reportRes.status, 200);
    assert.equal(reportRes.json.success, true);
    assert.ok(reportRes.json.completedItems.length >= 1);
  });

  test('14. Search: System-wide Unified Search', async () => {
    const res = await request('/api/search?q=الكرنك');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.results.length >= 1, 'Should find matches across tasks/meetings');
  });

  test('15. Reports: Generate report data', async () => {
    const res = await request('/api/reports/data?reportType=weekly');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(Array.isArray(res.json.data));
  });

  test('16. Settings: Update work hours & export backup JSON', async () => {
    const updateRes = await request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        work_start_time: '08:00',
        work_end_time: '16:00',
      }),
    });
    assert.equal(updateRes.status, 200);

    const backupRes = await request('/api/settings/backup/export');
    assert.equal(backupRes.status, 200);
    assert.equal(backupRes.json.success, true);
    assert.ok(backupRes.json.backup.data.tasks.length >= 4);
    assert.ok(backupRes.json.backup.data.departments.length >= 10);
  });
});
