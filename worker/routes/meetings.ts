import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const meetingRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

meetingRoutes.use('*', authMiddleware);

// GET /api/meetings (List meetings)
meetingRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { date, search } = c.req.query();

    let query = `
      SELECT m.*,
        (SELECT COUNT(*) FROM meeting_decisions d WHERE d.meeting_id = m.id) as decisions_count,
        (SELECT COUNT(*) FROM meeting_decisions d WHERE d.meeting_id = m.id AND d.status = 'completed') as completed_decisions
      FROM meetings m
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      query += ` AND m.meeting_date = ?`;
      params.push(date);
    }

    if (search) {
      query += ` AND (m.title LIKE ? OR m.chairman LIKE ? OR m.attendees LIKE ? OR m.agenda LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY m.meeting_date DESC, m.meeting_time DESC`;

    const meetings = (await db.prepare(query).bind(...params).all()).results;

    return c.json({ success: true, meetings });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/meetings/recommendations (Special view for following up all recommendations/decisions)
meetingRoutes.get('/recommendations', async (c) => {
  try {
    const db = c.env.DB;
    const { status, item_type } = c.req.query();

    let query = `
      SELECT d.*, m.title as meeting_title, m.meeting_date, t.title as linked_task_title, t.task_number as linked_task_number
      FROM meeting_decisions d
      JOIN meetings m ON d.meeting_id = m.id
      LEFT JOIN tasks t ON d.linked_task_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND d.status = ?`;
      params.push(status);
    }

    if (item_type) {
      query += ` AND d.item_type = ?`;
      params.push(item_type);
    }

    query += ` ORDER BY d.due_date ASC, d.created_at DESC`;

    const decisions = (await db.prepare(query).bind(...params).all()).results;

    return c.json({ success: true, recommendations: decisions });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/meetings/:id
meetingRoutes.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');

    const meeting = await db.prepare('SELECT * FROM meetings WHERE id = ?').bind(id).first();
    if (!meeting) return c.json({ success: false, error: 'الاجتماع غير موجود' }, 404);

    const decisions = (
      await db
        .prepare(
          `SELECT d.*, t.title as linked_task_title, t.task_number as linked_task_number
           FROM meeting_decisions d
           LEFT JOIN tasks t ON d.linked_task_id = t.id
           WHERE d.meeting_id = ?
           ORDER BY d.created_at ASC`
        )
        .bind(id)
        .all()
    ).results;

    const attachments = (
      await db
        .prepare("SELECT * FROM attachments WHERE reference_type = 'meeting' AND reference_id = ?")
        .bind(id)
        .all()
    ).results;

    return c.json({ success: true, meeting: { ...meeting, decisions, attachments } });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/meetings (Create meeting with decisions)
meetingRoutes.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();

    if (!body.title || !body.title.trim()) {
      return c.json({ success: false, error: 'عنوان الاجتماع مطلوب' }, 400);
    }

    const id = generateId('meet');
    await db
      .prepare(
        `INSERT INTO meetings (
          id, title, meeting_date, meeting_time, location, chairman,
          attendees, agenda, summary_of_discussions, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        id,
        body.title.trim(),
        body.meeting_date || new Date().toISOString().split('T')[0],
        body.meeting_time || '10:00',
        body.location || 'قاعة الاجتماعات',
        body.chairman || 'مدير الفرع',
        body.attendees || null,
        body.agenda || null,
        body.summary_of_discussions || null
      )
      .run();

    // Decisions/recommendations
    if (Array.isArray(body.decisions)) {
      for (const dec of body.decisions) {
        if (dec.content && dec.content.trim()) {
          const decId = generateId('dec');
          await db
            .prepare(
              `INSERT INTO meeting_decisions (
                id, meeting_id, item_type, content, assigned_to_dept, assigned_to_person, due_date, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))`
            )
            .bind(
              decId,
              id,
              dec.item_type || 'توصية',
              dec.content.trim(),
              dec.assigned_to_dept || null,
              dec.assigned_to_person || null,
              dec.due_date || null,
              dec.status || 'pending'
            )
            .run();
        }
      }
    }

    await logAudit(db, user.userId, user.username, 'CREATE_MEETING', 'meeting', id, `توثيق اجتماع: ${body.title}`);

    return c.json({ success: true, id });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/meetings/decisions/:decisionId/convert-to-task
meetingRoutes.post('/decisions/:decisionId/convert-to-task', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const decisionId = c.req.param('decisionId');

    const dec = await db
      .prepare(
        `SELECT d.*, m.title as meeting_title, m.meeting_date
         FROM meeting_decisions d
         JOIN meetings m ON d.meeting_id = m.id
         WHERE d.id = ?`
      )
      .bind(decisionId)
      .first<any>();

    if (!dec) return c.json({ success: false, error: 'القرار أو التوصية غير موجودة' }, 404);

    if (dec.linked_task_id) {
      return c.json({ success: false, error: 'تم تحويل هذه التوصية إلى مهمة من قبل' }, 400);
    }

    const taskId = generateId('tsk');
    const year = new Date().getFullYear();
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE task_number LIKE ?").bind(`TSK-${year}-%`).first<{ count: number }>();
    const task_number = `TSK-${year}-${((countRow?.count || 0) + 1).toString().padStart(3, '0')}`;

    const taskTitle = `تنفيذ ${dec.item_type}: ${dec.content.substring(0, 60)}`;
    const taskDesc = `توصية منبثقة من اجتماع: "${dec.meeting_title}" المنعقد بتاريخ ${dec.meeting_date}.\nنص ${dec.item_type}:\n${dec.content}\nالجهة المكلفة: ${dec.assigned_to_dept || dec.assigned_to_person || 'المكتب الفني'}`;

    // Insert task
    await db
      .prepare(
        `INSERT INTO tasks (
          id, task_number, title, description, task_type,
          assigned_by, assigned_to, priority, status, start_date, due_date,
          progress, reference_number, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 'تنفيذ توصية اجتماع',
          ?, ?, 'high', 'in_progress', DATE('now'), ?,
          0, ?, ?, DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        taskId,
        task_number,
        taskTitle,
        taskDesc,
        dec.meeting_title,
        dec.assigned_to_person || user.username,
        dec.due_date || null,
        dec.meeting_title,
        `مربوط بـ ${dec.item_type} بالاجتماع`
      )
      .run();

    // Link decision
    await db
      .prepare("UPDATE meeting_decisions SET linked_task_id = ?, status = 'in_progress' WHERE id = ?")
      .bind(taskId, decisionId)
      .run();

    await logAudit(
      db,
      user.userId,
      user.username,
      'CONVERT_DECISION_TO_TASK',
      'meeting_decision',
      decisionId,
      `تحويل توصية اجتماع إلى مهمة: ${task_number}`
    );

    return c.json({ success: true, taskId, task_number });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/meetings/:id
meetingRoutes.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json();

    await db
      .prepare(
        `UPDATE meetings SET
          title = COALESCE(?, title),
          meeting_date = COALESCE(?, meeting_date),
          meeting_time = COALESCE(?, meeting_time),
          location = COALESCE(?, location),
          chairman = COALESCE(?, chairman),
          attendees = COALESCE(?, attendees),
          agenda = COALESCE(?, agenda),
          summary_of_discussions = COALESCE(?, summary_of_discussions),
          updated_at = DATETIME('now')
        WHERE id = ?`
      )
      .bind(
        body.title,
        body.meeting_date,
        body.meeting_time,
        body.location,
        body.chairman,
        body.attendees,
        body.agenda,
        body.summary_of_discussions,
        id
      )
      .run();

    return c.json({ success: true, message: 'تم تحديث الاجتماع' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/meetings/:id
meetingRoutes.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('DELETE FROM meetings WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
