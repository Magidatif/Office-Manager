import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const dailyLogRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

dailyLogRoutes.use('*', authMiddleware);

// GET /api/daily-logs (Filter by date, department, activity_type)
dailyLogRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { date, department_id, activity_type } = c.req.query();
    const targetDate = date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT l.*, d.name as department_name, t.title as task_title, u.full_name as user_name
      FROM daily_work_logs l
      LEFT JOIN departments d ON l.department_id = d.id
      LEFT JOIN tasks t ON l.task_id = t.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      query += ` AND l.log_date = ?`;
      params.push(date);
    } else {
      query += ` AND l.log_date = ?`;
      params.push(targetDate);
    }

    if (department_id) {
      query += ` AND l.department_id = ?`;
      params.push(department_id);
    }

    if (activity_type) {
      query += ` AND l.activity_type = ?`;
      params.push(activity_type);
    }

    query += ` ORDER BY l.start_time DESC, l.created_at DESC`;

    const logs = (await db.prepare(query).bind(...params).all()).results;

    return c.json({ success: true, date: targetDate, logs });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/daily-logs (Create a log entry or quick achievement)
dailyLogRoutes.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();

    if (!body.description || !body.description.trim()) {
      return c.json({ success: false, error: 'وصف العمل مطلوب' }, 400);
    }

    const id = generateId('log');
    const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:mm
    const logDate = body.log_date || new Date().toISOString().split('T')[0];

    await db
      .prepare(
        `INSERT INTO daily_work_logs (
          id, user_id, log_date, start_time, end_time, activity_type,
          department_id, task_id, description, actions_taken, results,
          obstacles, next_step, notes, is_completed, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        id,
        user.userId,
        logDate,
        body.start_time || nowTime,
        body.end_time || null,
        body.activity_type || 'إنجاز سريع',
        body.department_id || null,
        body.task_id || null,
        body.description.trim(),
        body.actions_taken || null,
        body.results || null,
        body.obstacles || null,
        body.next_step || null,
        body.notes || null,
        body.is_completed !== undefined ? (body.is_completed ? 1 : 0) : 1
      )
      .run();

    await logAudit(db, user.userId, user.username, 'CREATE_DAILY_LOG', 'daily_log', id, `تسجيل نشاط يومي: ${body.description.substring(0, 50)}`);

    return c.json({ success: true, id, message: 'تم حفظ سجل العمل بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/daily-logs/:id (Update log)
dailyLogRoutes.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json();

    await db
      .prepare(
        `UPDATE daily_work_logs SET
          log_date = COALESCE(?, log_date),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          activity_type = COALESCE(?, activity_type),
          department_id = ?,
          task_id = ?,
          description = COALESCE(?, description),
          actions_taken = COALESCE(?, actions_taken),
          results = COALESCE(?, results),
          obstacles = COALESCE(?, obstacles),
          next_step = COALESCE(?, next_step),
          notes = COALESCE(?, notes),
          is_completed = COALESCE(?, is_completed),
          updated_at = DATETIME('now')
        WHERE id = ?`
      )
      .bind(
        body.log_date,
        body.start_time,
        body.end_time,
        body.activity_type,
        body.department_id || null,
        body.task_id || null,
        body.description,
        body.actions_taken,
        body.results,
        body.obstacles,
        body.next_step,
        body.notes,
        body.is_completed !== undefined ? (body.is_completed ? 1 : 0) : null,
        id
      )
      .run();

    return c.json({ success: true, message: 'تم تحديث السجل' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/daily-logs/:id
dailyLogRoutes.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('DELETE FROM daily_work_logs WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/daily-logs/end-of-day-report
dailyLogRoutes.get('/end-of-day-report', async (c) => {
  try {
    const db = c.env.DB;
    const { date } = c.req.query();
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Logs of the day
    const logs = (
      await db
        .prepare(
          `SELECT l.*, d.name as department_name, t.title as task_title
           FROM daily_work_logs l
           LEFT JOIN departments d ON l.department_id = d.id
           LEFT JOIN tasks t ON l.task_id = t.id
           WHERE l.log_date = ?
           ORDER BY l.start_time ASC`
        )
        .bind(targetDate)
        .all<any>()
    ).results;

    // Categorized logs
    const completedItems = logs.filter(l => l.is_completed === 1);
    const inProgressItems = logs.filter(l => l.is_completed === 0);
    const obstaclesList = logs.filter(l => l.obstacles && l.obstacles.trim().length > 0).map(l => l.obstacles);
    const nextStepsList = logs.filter(l => l.next_step && l.next_step.trim().length > 0).map(l => l.next_step);

    // Tasks completed on this date
    const tasksCompletedToday = (
      await db
        .prepare("SELECT * FROM tasks WHERE DATE(completion_date) = ? AND deleted_at IS NULL")
        .bind(targetDate)
        .all()
    ).results;

    // Follow-ups due tomorrow
    const tomorrowObj = new Date(targetDate);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const followUpsDueTomorrow = (
      await db
        .prepare("SELECT * FROM task_followups WHERE next_follow_up_date = ?")
        .bind(tomorrowStr)
        .all()
    ).results;

    // Tasks due tomorrow
    const tasksDueTomorrow = (
      await db
        .prepare("SELECT * FROM tasks WHERE due_date = ? AND deleted_at IS NULL AND status NOT IN ('completed', 'cancelled')")
        .bind(tomorrowStr)
        .all()
    ).results;

    return c.json({
      success: true,
      reportDate: targetDate,
      summary: {
        totalLogs: logs.length,
        completedCount: completedItems.length,
        inProgressCount: inProgressItems.length,
        tasksCompletedCount: tasksCompletedToday.length,
      },
      completedItems,
      inProgressItems,
      obstaclesList,
      nextStepsList,
      tasksCompletedToday,
      tasksDueTomorrow,
      followUpsDueTomorrow,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

