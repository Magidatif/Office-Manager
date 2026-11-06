import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const correspondenceRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

correspondenceRoutes.use('*', authMiddleware);

// GET /api/correspondences (List with filters)
correspondenceRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      letter_type,
      status,
      department_id,
      search,
      sender,
      recipient,
      page = '1',
      limit = '50',
    } = c.req.query();

    let query = `
      SELECT c.*, d.name as department_name, t.title as linked_task_title, t.task_number as linked_task_number
      FROM correspondences c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN tasks t ON c.linked_task_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (letter_type) {
      query += ` AND c.letter_type = ?`;
      params.push(letter_type);
    }

    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }

    if (department_id) {
      query += ` AND c.department_id = ?`;
      params.push(department_id);
    }

    if (sender) {
      query += ` AND c.sender LIKE ?`;
      params.push(`%${sender}%`);
    }

    if (recipient) {
      query += ` AND c.recipient LIKE ?`;
      params.push(`%${recipient}%`);
    }

    if (search) {
      query += ` AND (c.reg_number LIKE ? OR c.official_letter_number LIKE ? OR c.subject LIKE ? OR c.summary LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.date_received_or_sent DESC, c.created_at DESC LIMIT ? OFFSET ?`;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);

    const correspondences = (await db.prepare(query).bind(...params).all()).results;

    // Total count
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM correspondences").first<{ count: number }>();

    return c.json({
      success: true,
      correspondences,
      total: countRow?.count || 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/correspondences/:id
correspondenceRoutes.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');

    const item = await db
      .prepare(
        `SELECT c.*, d.name as department_name, t.title as linked_task_title, t.task_number as linked_task_number
         FROM correspondences c
         LEFT JOIN departments d ON c.department_id = d.id
         LEFT JOIN tasks t ON c.linked_task_id = t.id
         WHERE c.id = ?`
      )
      .bind(id)
      .first();

    if (!item) return c.json({ success: false, error: 'المخاطبة غير موجودة' }, 404);

    const attachments = (
      await db
        .prepare("SELECT * FROM attachments WHERE reference_type = 'correspondence' AND reference_id = ?")
        .bind(id)
        .all()
    ).results;

    return c.json({ success: true, correspondence: { ...item, attachments } });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/correspondences (Create new correspondence)
correspondenceRoutes.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();

    if (!body.subject || !body.subject.trim()) {
      return c.json({ success: false, error: 'موضوع المخاطبة مطلوب' }, 400);
    }

    const id = generateId('corr');
    const year = new Date().getFullYear();
    const typePrefix = body.letter_type ? body.letter_type.substring(0, 5) : 'قيد';
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM correspondences WHERE reg_number LIKE ?").bind(`%${year}%`).first<{ count: number }>();
    const reg_number = body.reg_number || `${typePrefix}-${year}/${((countRow?.count || 0) + 1).toString().padStart(3, '0')}`;

    await db
      .prepare(
        `INSERT INTO correspondences (
          id, reg_number, official_letter_number, letter_date, date_received_or_sent,
          letter_type, sender, recipient, subject, summary, required_action,
          department_id, assigned_to, reply_due_date, status, linked_task_id, notes,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        id,
        reg_number,
        body.official_letter_number || null,
        body.letter_date || new Date().toISOString().split('T')[0],
        body.date_received_or_sent || new Date().toISOString().split('T')[0],
        body.letter_type || 'وارد',
        body.sender || 'غير محدد',
        body.recipient || 'مدير فرع الهيئة',
        body.subject.trim(),
        body.summary || null,
        body.required_action || null,
        body.department_id || null,
        body.assigned_to || user.username,
        body.reply_due_date || null,
        body.status || 'under_process',
        body.linked_task_id || null,
        body.notes || null
      )
      .run();

    await logAudit(db, user.userId, user.username, 'CREATE_CORRESPONDENCE', 'correspondence', id, `قيد مكاتبة: ${reg_number} - ${body.subject}`);

    return c.json({ success: true, id, reg_number });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/correspondences/:id/convert-to-task (Convert correspondence into a task)
correspondenceRoutes.post('/:id/convert-to-task', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const id = c.req.param('id');

    const corr = await db.prepare('SELECT * FROM correspondences WHERE id = ?').bind(id).first<any>();
    if (!corr) return c.json({ success: false, error: 'المخاطبة غير موجودة' }, 404);

    if (corr.linked_task_id) {
      return c.json({ success: false, error: 'هذه المخاطبة مرتبطة بالفعل بمهمة قائمة' }, 400);
    }

    const taskId = generateId('tsk');
    const year = new Date().getFullYear();
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE task_number LIKE ?").bind(`TSK-${year}-%`).first<{ count: number }>();
    const task_number = `TSK-${year}-${((countRow?.count || 0) + 1).toString().padStart(3, '0')}`;

    const taskTitle = `متابعة ${corr.letter_type}: ${corr.subject}`;
    const taskDesc = `مهمة منبثقة من المخاطبة رقم ${corr.reg_number} (رقم رسمي: ${corr.official_letter_number || 'بدون'}).\nالجهة: ${corr.sender}\nالإجراء المطلوب: ${corr.required_action || corr.summary || 'المتابعة والإفادة'}`;

    // Create task
    await db
      .prepare(
        `INSERT INTO tasks (
          id, task_number, title, description, task_type, department_id,
          assigned_by, assigned_to, priority, status, start_date, due_date,
          progress, reference_number, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 'متابعة مكاتبة', ?,
          ?, ?, 'high', 'in_progress', DATE('now'), ?,
          0, ?, ?, DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        taskId,
        task_number,
        taskTitle,
        taskDesc,
        corr.department_id,
        corr.sender,
        corr.assigned_to || user.username,
        corr.reply_due_date || null,
        corr.reg_number,
        `مربوط بالمخاطبة رقم ${corr.reg_number}`
      )
      .run();

    // Update correspondence with linked task & status
    await db
      .prepare("UPDATE correspondences SET linked_task_id = ?, status = 'transferred_to_task', updated_at = DATETIME('now') WHERE id = ?")
      .bind(taskId, id)
      .run();

    await logAudit(
      db,
      user.userId,
      user.username,
      'CONVERT_CORR_TO_TASK',
      'correspondence',
      id,
      `تحويل المكاتبة ${corr.reg_number} إلى مهمة جديدة ${task_number}`
    );

    return c.json({ success: true, taskId, task_number });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/correspondences/:id
correspondenceRoutes.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json();

    await db
      .prepare(
        `UPDATE correspondences SET
          reg_number = COALESCE(?, reg_number),
          official_letter_number = COALESCE(?, official_letter_number),
          letter_date = COALESCE(?, letter_date),
          date_received_or_sent = COALESCE(?, date_received_or_sent),
          letter_type = COALESCE(?, letter_type),
          sender = COALESCE(?, sender),
          recipient = COALESCE(?, recipient),
          subject = COALESCE(?, subject),
          summary = COALESCE(?, summary),
          required_action = COALESCE(?, required_action),
          department_id = ?,
          assigned_to = COALESCE(?, assigned_to),
          reply_due_date = ?,
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          updated_at = DATETIME('now')
        WHERE id = ?`
      )
      .bind(
        body.reg_number,
        body.official_letter_number,
        body.letter_date,
        body.date_received_or_sent,
        body.letter_type,
        body.sender,
        body.recipient,
        body.subject,
        body.summary,
        body.required_action,
        body.department_id || null,
        body.assigned_to,
        body.reply_due_date || null,
        body.status,
        body.notes,
        id
      )
      .run();

    return c.json({ success: true, message: 'تم تحديث المخاطبة بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/correspondences/:id
correspondenceRoutes.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare("DELETE FROM attachments WHERE reference_type = 'correspondence' AND reference_id = ?").bind(id).run();
    await db.prepare('DELETE FROM correspondences WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
