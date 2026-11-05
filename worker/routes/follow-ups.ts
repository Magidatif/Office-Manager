import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const followUpRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

followUpRoutes.use('*', authMiddleware);

// GET /api/follow-ups (Categorized center view)
followUpRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { category, search } = c.req.query();

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const weekLaterObj = new Date();
    weekLaterObj.setDate(weekLaterObj.getDate() + 7);
    const weekLaterStr = weekLaterObj.toISOString().split('T')[0];

    // Fetch items with their latest follow-up
    let tasksQuery = `
      SELECT t.id, t.task_number, t.title, t.priority, t.status, t.due_date, t.follow_up_date,
             t.assigned_to, d.name as department_name, 'task' as item_type,
             (SELECT f.follow_up_date FROM task_followups f WHERE f.task_id = t.id ORDER BY f.follow_up_date DESC LIMIT 1) as last_followup_date,
             (SELECT f.outcome FROM task_followups f WHERE f.task_id = t.id ORDER BY f.follow_up_date DESC LIMIT 1) as last_outcome,
             (SELECT f.next_follow_up_date FROM task_followups f WHERE f.task_id = t.id ORDER BY f.follow_up_date DESC LIMIT 1) as next_followup_date,
             (SELECT f.target_person_or_dept FROM task_followups f WHERE f.task_id = t.id ORDER BY f.follow_up_date DESC LIMIT 1) as target_person
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.deleted_at IS NULL AND t.is_archived = 0 AND t.status NOT IN ('completed', 'cancelled')
    `;

    const allTasks = (await db.prepare(tasksQuery).all<any>()).results;

    // Filter by requested category
    let filtered = allTasks;

    if (category === 'today') {
      filtered = allTasks.filter(
        item => item.next_followup_date === todayStr || item.follow_up_date === todayStr
      );
    } else if (category === 'tomorrow') {
      filtered = allTasks.filter(
        item => item.next_followup_date === tomorrowStr || item.follow_up_date === tomorrowStr
      );
    } else if (category === 'waiting_reply') {
      filtered = allTasks.filter(item => item.status === 'waiting_reply');
    } else if (category === 'overdue') {
      filtered = allTasks.filter(item => item.due_date && item.due_date < todayStr);
    } else if (category === 'waiting_approval') {
      filtered = allTasks.filter(item => item.status === 'waiting_approval');
    } else if (category === 'this_week') {
      filtered = allTasks.filter(
        item =>
          (item.next_followup_date && item.next_followup_date >= todayStr && item.next_followup_date <= weekLaterStr) ||
          (item.due_date && item.due_date >= todayStr && item.due_date <= weekLaterStr)
      );
    } else if (category === 'suspended') {
      filtered = allTasks.filter(item => item.status === 'suspended');
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.title?.toLowerCase().includes(q) ||
          item.assigned_to?.toLowerCase().includes(q) ||
          item.department_name?.toLowerCase().includes(q)
      );
    }

    // Counts for tabs
    const counts = {
      today: allTasks.filter(item => item.next_followup_date === todayStr || item.follow_up_date === todayStr).length,
      tomorrow: allTasks.filter(item => item.next_followup_date === tomorrowStr || item.follow_up_date === tomorrowStr).length,
      waiting_reply: allTasks.filter(item => item.status === 'waiting_reply').length,
      overdue: allTasks.filter(item => item.due_date && item.due_date < todayStr).length,
      waiting_approval: allTasks.filter(item => item.status === 'waiting_approval').length,
      this_week: allTasks.filter(
        item =>
          (item.next_followup_date && item.next_followup_date >= todayStr && item.next_followup_date <= weekLaterStr) ||
          (item.due_date && item.due_date >= todayStr && item.due_date <= weekLaterStr)
      ).length,
      suspended: allTasks.filter(item => item.status === 'suspended').length,
      all: allTasks.length,
    };

    return c.json({ success: true, items: filtered, counts });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/follow-ups/history/:taskId (Full timeline of follow-ups for a task)
followUpRoutes.get('/history/:taskId', async (c) => {
  try {
    const db = c.env.DB;
    const taskId = c.req.param('taskId');

    const history = (
      await db
        .prepare('SELECT * FROM task_followups WHERE task_id = ? ORDER BY follow_up_date DESC, created_at DESC')
        .bind(taskId)
        .all()
    ).results;

    return c.json({ success: true, history });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/follow-ups (Record new follow-up)
followUpRoutes.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();

    if (!body.task_id && !body.correspondence_id) {
      return c.json({ success: false, error: 'يجب تحديد المهمة أو المكاتبة المرتبطة' }, 400);
    }
    if (!body.target_person_or_dept || !body.outcome) {
      return c.json({ success: false, error: 'يرجى إدخال الجهة المتابعة ونتيجة المتابعة' }, 400);
    }

    const id = generateId('flw');
    const followUpDate = body.follow_up_date || new Date().toISOString().split('T')[0];

    await db
      .prepare(
        `INSERT INTO task_followups (
          id, task_id, correspondence_id, follow_up_date, follow_up_channel,
          target_person_or_dept, outcome, reply_received, next_step,
          next_follow_up_date, status, created_by, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, DATETIME('now')
        )`
      )
      .bind(
        id,
        body.task_id || null,
        body.correspondence_id || null,
        followUpDate,
        body.follow_up_channel || 'اتصال هاتفي',
        body.target_person_or_dept,
        body.outcome,
        body.reply_received || null,
        body.next_step || null,
        body.next_follow_up_date || null,
        body.status || 'pending',
        user.username
      )
      .run();

    // If task_id provided, update task's follow_up_date
    if (body.task_id) {
      await db
        .prepare("UPDATE tasks SET follow_up_date = ?, updated_at = DATETIME('now') WHERE id = ?")
        .bind(body.next_follow_up_date || followUpDate, body.task_id)
        .run();

      // Also record in task history
      await db
        .prepare('INSERT INTO task_history (id, task_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .bind(
          generateId('hist'),
          body.task_id,
          user.userId,
          'follow_up_logged',
          `متابعة مع ${body.target_person_or_dept}: ${body.outcome}`
        )
        .run();
    }

    await logAudit(db, user.userId, user.username, 'LOG_FOLLOW_UP', 'followup', id, `تسجيل متابعة مع ${body.target_person_or_dept}`);

    return c.json({ success: true, id, message: 'تم حفظ إجراء المتابعة بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

