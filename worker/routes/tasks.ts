import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const taskRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

taskRoutes.use('*', authMiddleware);

// GET /api/tasks (List with filters)
taskRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const {
      status,
      priority,
      department_id,
      assigned_to,
      is_archived,
      search,
      overdue,
      today,
      page = '1',
      limit = '50',
    } = c.req.query();

    const todayStr = new Date().toISOString().split('T')[0];

    let query = `
      SELECT t.*, d.name as department_name,
        (SELECT COUNT(*) FROM task_subtasks s WHERE s.task_id = t.id) as subtasks_total,
        (SELECT COUNT(*) FROM task_subtasks s WHERE s.task_id = t.id AND s.is_completed = 1) as subtasks_completed,
        (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) as comments_count,
        (CASE WHEN t.due_date IS NOT NULL AND t.due_date < ? AND t.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as is_overdue
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.deleted_at IS NULL
    `;
    // Extract sorting parameters
    const { sort_by, order } = c.req.query();
    // Determine ORDER BY clause based on allowed fields
    let orderClause = '';
    if (sort_by) {
      const direction = order && order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      switch (sort_by) {
        case 'priority':
          orderClause = `
            CASE
              WHEN t.priority = 'urgent_critical' THEN 1
              WHEN t.priority = 'high' THEN 2
              WHEN t.priority = 'medium' THEN 3
              ELSE 4
            END ${direction}`;
          break;
        case 'due_date':
          orderClause = `t.due_date ${direction}`;
          break;
        case 'created_at':
          orderClause = `t.created_at ${direction}`;
          break;
        case 'title':
          orderClause = `t.title ${direction}`;
          break;
        default:
          orderClause = `t.created_at ${direction}`;
      }
    } else {
      // Default ordering: priority then due date then created_at desc
      orderClause = `
        CASE
          WHEN t.priority = 'urgent_critical' THEN 1
          WHEN t.priority = 'high' THEN 2
          WHEN t.priority = 'medium' THEN 3
          ELSE 4
        END,
        t.due_date ASC,
        t.created_at DESC`;
    }
    const params: any[] = [todayStr];

    if (is_archived !== undefined && is_archived !== '') {
      query += ` AND t.is_archived = ?`;
      params.push(Number(is_archived));
    } else {
      query += ` AND t.is_archived = 0`;
    }

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (department_id) {
      query += ` AND t.department_id = ?`;
      params.push(department_id);
    }

    if (assigned_to) {
      query += ` AND t.assigned_to LIKE ?`;
      params.push(`%${assigned_to}%`);
    }

    if (search) {
      query += ` AND (t.title LIKE ? OR t.description LIKE ? OR t.task_number LIKE ? OR t.reference_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (overdue === '1' || overdue === 'true') {
      query += ` AND t.due_date IS NOT NULL AND t.due_date < ? AND t.status NOT IN ('completed', 'cancelled')`;
      params.push(todayStr);
    }

    if (today === '1' || today === 'true') {
      query += ` AND (t.due_date = ? OR t.start_date = ? OR DATE(t.created_at) = ?)`;
      params.push(todayStr, todayStr, todayStr);
    }

    query += ` ORDER BY ${orderClause} LIMIT ? OFFSET ?`;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);

    const stmt = db.prepare(query);
    const result = await stmt.bind(...params).all();

    // Total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM tasks t WHERE t.deleted_at IS NULL`;
    const countParams: any[] = [];
    if (is_archived !== undefined && is_archived !== '') {
      countQuery += ` AND t.is_archived = ?`;
      countParams.push(Number(is_archived));
    } else {
      countQuery += ` AND t.is_archived = 0`;
    }
    if (status) {
      countQuery += ` AND t.status = ?`;
      countParams.push(status);
    }
    if (priority) {
      countQuery += ` AND t.priority = ?`;
      countParams.push(priority);
    }
    if (department_id) {
      countQuery += ` AND t.department_id = ?`;
      countParams.push(department_id);
    }
    if (search) {
      countQuery += ` AND (t.title LIKE ? OR t.description LIKE ? OR t.task_number LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countRes = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      tasks: result.results,
      pagination: {
        total: countRes?.total || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((countRes?.total || 0) / limitNum),
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/tasks/:id (Single task with subtasks, comments, history)
taskRoutes.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const todayStr = new Date().toISOString().split('T')[0];

    const task = await db
      .prepare(
        `SELECT t.*, d.name as department_name,
           (CASE WHEN t.due_date IS NOT NULL AND t.due_date < ? AND t.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as is_overdue
         FROM tasks t
         LEFT JOIN departments d ON t.department_id = d.id
         WHERE t.id = ? AND t.deleted_at IS NULL`
      )
      .bind(todayStr, id)
      .first();

    if (!task) {
      return c.json({ success: false, error: 'المهمة غير موجودة' }, 404);
    }

    const subtasks = (
      await db
        .prepare('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC')
        .bind(id)
        .all()
    ).results;

    const comments = (
      await db
        .prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at DESC')
        .bind(id)
        .all()
    ).results;

    const history = (
      await db
        .prepare('SELECT * FROM task_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 20')
        .bind(id)
        .all()
    ).results;

    const attachments = (
      await db
        .prepare("SELECT * FROM attachments WHERE reference_type = 'task' AND reference_id = ?")
        .bind(id)
        .all()
    ).results;

    return c.json({
      success: true,
      task: {
        ...task,
        subtasks,
        comments,
        history,
        attachments,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks (Create new task)
taskRoutes.post('/', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json();

    if (!body.title || !body.title.trim()) {
      return c.json({ success: false, error: 'عنوان المهمة مطلوب' }, 400);
    }

    const id = generateId('tsk');
    // Generate task number: TSK-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE task_number LIKE ?")
      .bind(`TSK-${year}-%`)
      .first<{ count: number }>();
    const nextSeq = ((countRow?.count || 0) + 1).toString().padStart(3, '0');
    const task_number = body.task_number || `TSK-${year}-${nextSeq}`;

    await db
      .prepare(
        `INSERT INTO tasks (
          id, task_number, title, description, task_type, department_id,
          assigned_by, assigned_to, priority, status, start_date, due_date,
          progress, reference_number, notes, follow_up_date, recurrence, recurrence_rule,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        id,
        task_number,
        body.title.trim(),
        body.description || null,
        body.task_type || 'تكليف إداري',
        body.department_id || null,
        body.assigned_by || 'مدير الفرع',
        body.assigned_to || user.username || 'عضو المكتب الفني',
        body.priority || 'medium',
        body.status || 'new',
        body.start_date || new Date().toISOString().split('T')[0],
        body.due_date || null,
        body.progress || 0,
        body.reference_number || null,
        body.notes || null,
        body.follow_up_date || null,
        body.recurrence || 'none',
        body.recurrence_rule || null
      )
      .run();

    // If subtasks provided
    if (Array.isArray(body.subtasks) && body.subtasks.length > 0) {
      for (let i = 0; i < body.subtasks.length; i++) {
        const sub = body.subtasks[i];
        if (sub.title && sub.title.trim()) {
          const subId = generateId('sub');
          await db
            .prepare(
              'INSERT INTO task_subtasks (id, task_id, title, is_completed, sort_order) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(subId, id, sub.title.trim(), sub.is_completed ? 1 : 0, i)
            .run();
        }
      }
    }

    // Add creation history
    await db
      .prepare(
        'INSERT INTO task_history (id, task_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(generateId('hist'), id, user.userId, 'created', `تم إنشاء المهمة بواسطة ${user.username}`)
      .run();

    await logAudit(db, user.userId, user.username, 'CREATE_TASK', 'task', id, `إنشاء مهمة: ${body.title}`);

    return c.json({ success: true, taskId: id, task_number });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/tasks/:id (Update task)
taskRoutes.put('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(id).first<any>();
    if (!existing) {
      return c.json({ success: false, error: 'المهمة غير موجودة' }, 404);
    }

    let completion_date = existing.completion_date;
    if (body.status === 'completed' && existing.status !== 'completed') {
      completion_date = new Date().toISOString();
    } else if (body.status && body.status !== 'completed') {
      completion_date = null;
    }

    // Postpone tracking
    let postponed_count = existing.postponed_count || 0;
    let postpone_reason = existing.postpone_reason;
    if (body.due_date && body.due_date !== existing.due_date && body.postpone_reason) {
      postponed_count += 1;
      postpone_reason = body.postpone_reason;
      await db
        .prepare('INSERT INTO task_history (id, task_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .bind(
          generateId('hist'),
          id,
          user.userId,
          'postponed',
          `تأجيل الموعد من ${existing.due_date} إلى ${body.due_date}. السبب: ${body.postpone_reason}`
        )
        .run();
    }

    // Status change history
    if (body.status && body.status !== existing.status) {
      await db
        .prepare('INSERT INTO task_history (id, task_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .bind(
          generateId('hist'),
          id,
          user.userId,
          'status_changed',
          `تغيير الحالة من ${existing.status} إلى ${body.status}`
        )
        .run();
    }

    await db
      .prepare(
        `UPDATE tasks SET
          title = ?, description = ?, task_type = ?, department_id = ?,
          assigned_by = ?, assigned_to = ?, priority = ?, status = ?,
          start_date = ?, due_date = ?, completion_date = ?, progress = ?,
          reference_number = ?, notes = ?, follow_up_date = ?, recurrence = ?,
          postponed_count = ?, postpone_reason = ?, is_archived = ?,
          updated_at = DATETIME('now')
         WHERE id = ?`
      )
      .bind(
        body.title !== undefined ? body.title : existing.title,
        body.description !== undefined ? body.description : existing.description,
        body.task_type !== undefined ? body.task_type : existing.task_type,
        body.department_id !== undefined ? body.department_id : existing.department_id,
        body.assigned_by !== undefined ? body.assigned_by : existing.assigned_by,
        body.assigned_to !== undefined ? body.assigned_to : existing.assigned_to,
        body.priority !== undefined ? body.priority : existing.priority,
        body.status !== undefined ? body.status : existing.status,
        body.start_date !== undefined ? body.start_date : existing.start_date,
        body.due_date !== undefined ? body.due_date : existing.due_date,
        completion_date,
        body.progress !== undefined ? body.progress : existing.progress,
        body.reference_number !== undefined ? body.reference_number : existing.reference_number,
        body.notes !== undefined ? body.notes : existing.notes,
        body.follow_up_date !== undefined ? body.follow_up_date : existing.follow_up_date,
        body.recurrence !== undefined ? body.recurrence : existing.recurrence,
        postponed_count,
        postpone_reason,
        body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : existing.is_archived,
        id
      )
      .run();

    await logAudit(db, user.userId, user.username, 'UPDATE_TASK', 'task', id, `تحديث مهمة: ${existing.task_number}`);

    return c.json({ success: true, message: 'تم تحديث المهمة بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks/:id/status (Quick update status / progress)
taskRoutes.post('/:id/status', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const id = c.req.param('id');
    const { status, progress } = await c.req.json();

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<any>();
    if (!task) return c.json({ success: false, error: 'المهمة غير موجودة' }, 404);

    const newProgress = progress !== undefined ? progress : (status === 'completed' ? 100 : task.progress);
    const completion_date = status === 'completed' ? new Date().toISOString() : null;

    await db
      .prepare(
        `UPDATE tasks SET
          status = COALESCE(?, status),
          progress = ?,
          completion_date = CASE WHEN ? = 'completed' THEN DATETIME('now') ELSE completion_date END,
          updated_at = DATETIME('now')
         WHERE id = ?`
      )
      .bind(status, newProgress, status, id)
      .run();

    await db
      .prepare('INSERT INTO task_history (id, task_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .bind(
        generateId('hist'),
        id,
        user.userId,
        'quick_status',
        `تحديث الحالة إلى ${status || task.status} ونسبة الإنجاز إلى ${newProgress}%`
      )
      .run();

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks/:id/subtasks (Add subtask)
taskRoutes.post('/:id/subtasks', async (c) => {
  try {
    const db = c.env.DB;
    const taskId = c.req.param('id');
    const { title } = await c.req.json();

    if (!title || !title.trim()) {
      return c.json({ success: false, error: 'العنوان مطلوب' }, 400);
    }

    const subId = generateId('sub');
    await db
      .prepare('INSERT INTO task_subtasks (id, task_id, title, is_completed, sort_order) VALUES (?, ?, ?, 0, 99)')
      .bind(subId, taskId, title.trim())
      .run();

    return c.json({ success: true, id: subId, title: title.trim() });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/tasks/subtasks/:subtaskId/toggle (Toggle subtask)
taskRoutes.put('/subtasks/:subtaskId/toggle', async (c) => {
  try {
    const db = c.env.DB;
    const subtaskId = c.req.param('subtaskId');

    const subtask = await db.prepare('SELECT * FROM task_subtasks WHERE id = ?').bind(subtaskId).first<any>();
    if (!subtask) return c.json({ success: false, error: 'المهمة الفرعية غير موجودة' }, 404);

    const newState = subtask.is_completed ? 0 : 1;
    const completedAt = newState ? new Date().toISOString() : null;

    await db
      .prepare('UPDATE task_subtasks SET is_completed = ?, completed_at = ? WHERE id = ?')
      .bind(newState, completedAt, subtaskId)
      .run();

    // Auto-update task progress based on subtasks
    const stats = await db
      .prepare(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
         FROM task_subtasks WHERE task_id = ?`
      )
      .bind(subtask.task_id)
      .first<{ total: number; completed: number }>();

    if (stats && stats.total > 0) {
      const calcProgress = Math.round((stats.completed / stats.total) * 100);
      await db
        .prepare("UPDATE tasks SET progress = ?, updated_at = DATETIME('now') WHERE id = ?")
        .bind(calcProgress, subtask.task_id)
        .run();
    }

    return c.json({ success: true, is_completed: newState });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks/:id/comments (Add comment)
taskRoutes.post('/:id/comments', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const taskId = c.req.param('id');
    const { comment } = await c.req.json();

    if (!comment || !comment.trim()) {
      return c.json({ success: false, error: 'التعليق مطلوب' }, 400);
    }

    const commentId = generateId('cmnt');
    const userRow = await db
      .prepare('SELECT full_name FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ full_name: string }>();
    const displayName = userRow?.full_name || user.username;

    await db
      .prepare(
        'INSERT INTO task_comments (id, task_id, user_id, user_name, comment, created_at) VALUES (?, ?, ?, ?, ?, DATETIME("now"))'
      )
      .bind(commentId, taskId, user.userId, displayName, comment.trim())
      .run();

    return c.json({ success: true, commentId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks/:id/duplicate (Duplicate task)
taskRoutes.post('/:id/duplicate', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const id = c.req.param('id');

    const source = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<any>();
    if (!source) return c.json({ success: false, error: 'المهمة غير موجودة' }, 404);

    const newId = generateId('tsk');
    const year = new Date().getFullYear();
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE task_number LIKE ?").bind(`TSK-${year}-%`).first<{ count: number }>();
    const task_number = `TSK-${year}-${((countRow?.count || 0) + 1).toString().padStart(3, '0')}`;

    await db
      .prepare(
        `INSERT INTO tasks (
          id, task_number, title, description, task_type, department_id,
          assigned_by, assigned_to, priority, status, start_date, due_date,
          progress, reference_number, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 'new', DATE('now'), ?,
          0, ?, ?, DATETIME('now'), DATETIME('now')
        )`
      )
      .bind(
        newId,
        task_number,
        `نسخة من: ${source.title}`,
        source.description,
        source.task_type,
        source.department_id,
        source.assigned_by,
        source.assigned_to,
        source.priority,
        source.due_date,
        source.reference_number,
        source.notes
      )
      .run();

    return c.json({ success: true, newTaskId: newId, task_number });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks/:id/archive (Archive / Unarchive)
taskRoutes.post('/:id/archive', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const id = c.req.param('id');
    const { archive = true } = await c.req.json();

    await db
      .prepare("UPDATE tasks SET is_archived = ?, updated_at = DATETIME('now') WHERE id = ?")
      .bind(archive ? 1 : 0, id)
      .run();

    await logAudit(db, user.userId, user.username, archive ? 'ARCHIVE_TASK' : 'UNARCHIVE_TASK', 'task', id, 'تغيير حالة الأرشفة');

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/tasks/:id (Soft delete)
taskRoutes.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const id = c.req.param('id');

    await db
      .prepare("UPDATE tasks SET deleted_at = DATETIME('now') WHERE id = ?")
      .bind(id)
      .run();

    await logAudit(db, user.userId, user.username, 'DELETE_TASK', 'task', id, 'حذف مهمة (نقل إلى سلة المحذوفات)');

    return c.json({ success: true, message: 'تم حذف المهمة' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
