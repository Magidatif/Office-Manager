import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
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

    const departments = (await db.prepare('SELECT * FROM departments ORDER BY display_order ASC').all()).results;

    return c.json({ success: true, settings, departments });
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

    if (user.role !== 'admin') {
      return c.json({ success: false, error: 'غير مصرح: هذه العملية تتطلب صلاحية مدير النظام' }, 403);
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
