import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';

export const reportRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

reportRoutes.use('*', authMiddleware);

// GET /api/reports/data
reportRoutes.get('/data', async (c) => {
  try {
    const db = c.env.DB;
    const {
      reportType = 'daily',
      startDate,
      endDate,
      department_id,
      priority,
      status,
    } = c.req.query();

    const todayStr = new Date().toISOString().split('T')[0];
    const fromDate = startDate || todayStr;
    const toDate = endDate || todayStr;

    let results: any[] = [];
    let summary: Record<string, any> = {};

    switch (reportType) {
      // 1. تقرير الأعمال اليومية
      case 'daily': {
        const query = `
          SELECT l.*, d.name as department_name, t.title as task_title
          FROM daily_work_logs l
          LEFT JOIN departments d ON l.department_id = d.id
          LEFT JOIN tasks t ON l.task_id = t.id
          WHERE l.log_date = ?
          ORDER BY l.start_time ASC
        `;
        results = (await db.prepare(query).bind(fromDate).all()).results;
        summary = {
          totalEntries: results.length,
          completedCount: results.filter(r => r.is_completed === 1).length,
        };
        break;
      }

      // 2. التقرير الأسبوعي
      case 'weekly': {
        const query = `
          SELECT t.*, d.name as department_name
          FROM tasks t
          LEFT JOIN departments d ON t.department_id = d.id
          WHERE t.deleted_at IS NULL AND (t.created_at >= ? OR t.due_date >= ?) AND (t.created_at <= ? OR t.due_date <= ?)
          ORDER BY t.priority, t.due_date ASC
        `;
        results = (await db.prepare(query).bind(fromDate, fromDate, `${toDate} 23:59:59`, toDate).all()).results;
        summary = {
          total: results.length,
          completed: results.filter(r => r.status === 'completed').length,
          inProgress: results.filter(r => r.status === 'in_progress').length,
        };
        break;
      }

      // 3. التقرير الشهري
      case 'monthly': {
        const query = `
          SELECT t.*, d.name as department_name
          FROM tasks t
          LEFT JOIN departments d ON t.department_id = d.id
          WHERE t.deleted_at IS NULL AND t.created_at >= ? AND t.created_at <= ?
          ORDER BY t.created_at DESC
        `;
        results = (await db.prepare(query).bind(fromDate, `${toDate} 23:59:59`).all()).results;
        summary = {
          totalCreated: results.length,
          completed: results.filter(r => r.status === 'completed').length,
          averageProgress: results.length > 0 ? Math.round(results.reduce((acc, r) => acc + (r.progress || 0), 0) / results.length) : 0,
        };
        break;
      }

      // 4. تقرير المهام المكتملة
      case 'completed': {
        const query = `
          SELECT t.*, d.name as department_name
          FROM tasks t
          LEFT JOIN departments d ON t.department_id = d.id
          WHERE t.deleted_at IS NULL AND t.status = 'completed'
          ORDER BY t.completion_date DESC, t.updated_at DESC
        `;
        results = (await db.prepare(query).all()).results;
        summary = { totalCompleted: results.length };
        break;
      }

      // 5. تقرير المهام المتأخرة
      case 'overdue': {
        const query = `
          SELECT t.*, d.name as department_name
          FROM tasks t
          LEFT JOIN departments d ON t.department_id = d.id
          WHERE t.deleted_at IS NULL AND t.due_date IS NOT NULL AND t.due_date < ? AND t.status NOT IN ('completed', 'cancelled')
          ORDER BY t.due_date ASC
        `;
        results = (await db.prepare(query).bind(todayStr).all()).results;
        summary = { totalOverdue: results.length };
        break;
      }

      // 6. تقرير الأعمال حسب الإدارة
      case 'department': {
        const query = `
          SELECT d.name as department_name, d.code,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
            SUM(CASE WHEN t.due_date < ? AND t.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as overdue_tasks
          FROM departments d
          LEFT JOIN tasks t ON d.id = t.department_id AND t.deleted_at IS NULL
          GROUP BY d.id
          ORDER BY total_tasks DESC
        `;
        results = (await db.prepare(query).bind(todayStr).all()).results;
        summary = { totalDepartments: results.length };
        break;
      }

      // 7. تقرير متابعة التكليفات
      case 'assigned': {
        const query = `
          SELECT t.assigned_by, t.assigned_to, t.task_number, t.title, t.priority, t.status, t.due_date, t.progress, d.name as department_name
          FROM tasks t
          LEFT JOIN departments d ON t.department_id = d.id
          WHERE t.deleted_at IS NULL AND t.is_archived = 0
          ORDER BY t.assigned_by, t.due_date ASC
        `;
        results = (await db.prepare(query).all()).results;
        summary = { totalAssignments: results.length };
        break;
      }

      // 8. تقرير تنفيذ توصيات الاجتماعات
      case 'recommendations': {
        const query = `
          SELECT d.*, m.title as meeting_title, m.meeting_date, t.title as linked_task_title, t.status as task_status
          FROM meeting_decisions d
          JOIN meetings m ON d.meeting_id = m.id
          LEFT JOIN tasks t ON d.linked_task_id = t.id
          ORDER BY m.meeting_date DESC, d.due_date ASC
        `;
        results = (await db.prepare(query).all()).results;
        summary = {
          totalDecisions: results.length,
          completed: results.filter(r => r.status === 'completed').length,
          pending: results.filter(r => r.status === 'pending').length,
        };
        break;
      }

      // 9. تقرير المراسلات والمخاطبات
      case 'correspondences': {
        const query = `
          SELECT c.*, d.name as department_name
          FROM correspondences c
          LEFT JOIN departments d ON c.department_id = d.id
          WHERE 1=1
          ORDER BY c.date_received_or_sent DESC
        `;
        results = (await db.prepare(query).all()).results;
        summary = {
          total: results.length,
          underProcess: results.filter(r => r.status === 'under_process').length,
          closed: results.filter(r => r.status === 'closed').length,
          transferred: results.filter(r => r.status === 'transferred_to_task').length,
        };
        break;
      }

      // 10. تقرير الإنجازات الشخصية
      case 'achievements': {
        const query = `
          SELECT l.*, d.name as department_name
          FROM daily_work_logs l
          LEFT JOIN departments d ON l.department_id = d.id
          WHERE l.is_completed = 1
          ORDER BY l.log_date DESC, l.start_time DESC
        `;
        results = (await db.prepare(query).all()).results;
        summary = { totalAchievements: results.length };
        break;
      }

      default:
        results = [];
    }

    return c.json({
      success: true,
      reportType,
      fromDate,
      toDate,
      summary,
      data: results,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

