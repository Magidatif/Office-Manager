import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

dashboardRoutes.use('*', authMiddleware);

dashboardRoutes.get('/stats', async (c) => {
  try {
    const db = c.env.DB;
    const today = new Date().toISOString().split('T')[0];
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = tomorrowObj.toISOString().split('T')[0];

    // 1. Total tasks (active, non-deleted)
    const totalRow = await db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0")
      .first<{ count: number }>();
    const totalTasks = totalRow?.count || 0;

    // 2. Today tasks (due today or scheduled start today)
    const todayRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND (due_date = ? OR start_date = ?)"
      )
      .bind(today, today)
      .first<{ count: number }>();
    const todayTasks = todayRow?.count || 0;

    // 3. In progress tasks
    const inProgressRow = await db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND status = 'in_progress'")
      .first<{ count: number }>();
    const inProgressTasks = inProgressRow?.count || 0;

    // 4. Completed tasks
    const completedRow = await db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND status = 'completed'")
      .first<{ count: number }>();
    const completedTasks = completedRow?.count || 0;

    // 5. Overdue tasks: due_date < today AND status NOT IN ('completed', 'cancelled')
    const overdueRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND due_date IS NOT NULL AND due_date < ? AND status NOT IN ('completed', 'cancelled')"
      )
      .bind(today)
      .first<{ count: number }>();
    const overdueTasks = overdueRow?.count || 0;

    // 6. Urgent tasks
    const urgentRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND priority = 'urgent_critical' AND status NOT IN ('completed', 'cancelled')"
      )
      .first<{ count: number }>();
    const urgentTasks = urgentRow?.count || 0;

    // 7. Tasks waiting for reply
    const waitingReplyRow = await db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND status = 'waiting_reply'")
      .first<{ count: number }>();
    const waitingReplyTasks = waitingReplyRow?.count || 0;

    // 8. Tasks due tomorrow
    const dueTomorrowRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND is_archived = 0 AND due_date = ? AND status NOT IN ('completed', 'cancelled')"
      )
      .bind(tomorrow)
      .first<{ count: number }>();
    const dueTomorrowTasks = dueTomorrowRow?.count || 0;

    // 9. Weekly completion rate
    const weekAgoObj = new Date();
    weekAgoObj.setDate(weekAgoObj.getDate() - 7);
    const weekAgo = weekAgoObj.toISOString().split('T')[0];

    const weeklyDoneRow = await db
      .prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND status = 'completed' AND (completion_date >= ? OR updated_at >= ?)"
      )
      .bind(weekAgo, weekAgo)
      .first<{ count: number }>();
    const weeklyDone = weeklyDoneRow?.count || 0;

    const weeklyCreatedRow = await db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND created_at >= ?")
      .bind(weekAgo)
      .first<{ count: number }>();
    const weeklyTotal = (weeklyCreatedRow?.count || 0) + weeklyDone;
    const weeklyCompletionRate = weeklyTotal > 0 ? Math.round((weeklyDone / weeklyTotal) * 100) : (completedTasks > 0 ? 100 : 0);

    // 10. Active correspondences
    const activeCorrRow = await db
      .prepare("SELECT COUNT(*) as count FROM correspondences WHERE status IN ('under_process', 'waiting_info')")
      .first<{ count: number }>();
    const activeCorrespondences = activeCorrRow?.count || 0;

    // Top 5 Urgent Tasks
    const urgentTasksList = (
      await db
        .prepare(
          `SELECT t.*, d.name as department_name
           FROM tasks t
           LEFT JOIN departments d ON t.department_id = d.id
           WHERE t.deleted_at IS NULL AND t.is_archived = 0 AND t.priority = 'urgent_critical' AND t.status NOT IN ('completed', 'cancelled')
           ORDER BY t.due_date ASC, t.created_at DESC
           LIMIT 5`
        )
        .all()
    ).results;

    // Tasks approaching due (within next 3 days)
    const inThreeDaysObj = new Date();
    inThreeDaysObj.setDate(inThreeDaysObj.getDate() + 3);
    const inThreeDays = inThreeDaysObj.toISOString().split('T')[0];

    const approachingDueTasks = (
      await db
        .prepare(
          `SELECT t.*, d.name as department_name
           FROM tasks t
           LEFT JOIN departments d ON t.department_id = d.id
           WHERE t.deleted_at IS NULL AND t.is_archived = 0 AND t.due_date >= ? AND t.due_date <= ? AND t.status NOT IN ('completed', 'cancelled')
           ORDER BY t.due_date ASC
           LIMIT 5`
        )
        .bind(today, inThreeDays)
        .all()
    ).results;

    // Recently completed tasks
    const recentlyCompletedTasks = (
      await db
        .prepare(
          `SELECT t.*, d.name as department_name
           FROM tasks t
           LEFT JOIN departments d ON t.department_id = d.id
           WHERE t.deleted_at IS NULL AND t.status = 'completed'
           ORDER BY t.updated_at DESC
           LIMIT 5`
        )
        .all()
    ).results;

    // Tasks waiting for approval or reply
    const waitingApprovalTasks = (
      await db
        .prepare(
          `SELECT t.*, d.name as department_name
           FROM tasks t
           LEFT JOIN departments d ON t.department_id = d.id
           WHERE t.deleted_at IS NULL AND t.is_archived = 0 AND t.status IN ('waiting_approval', 'waiting_reply')
           ORDER BY t.updated_at DESC
           LIMIT 5`
        )
        .all()
    ).results;

    // Today Meetings
    const todayMeetings = (
      await db
        .prepare("SELECT * FROM meetings WHERE meeting_date = ? ORDER BY meeting_time ASC")
        .bind(today)
        .all()
    ).results;

    // Recent system activities (from task_history, daily_work_logs, audit_logs)
    const recentHistory = (
      await db
        .prepare(
          `SELECT h.id, h.action, t.title, h.created_at as time, 'task' as type
           FROM task_history h
           JOIN tasks t ON h.task_id = t.id
           ORDER BY h.created_at DESC
           LIMIT 8`
        )
        .all()
    ).results;

    // Tasks by Status distribution
    const statusCounts = (
      await db
        .prepare(
          `SELECT status, COUNT(*) as count
           FROM tasks
           WHERE deleted_at IS NULL AND is_archived = 0
           GROUP BY status`
        )
        .all<{ status: string; count: number }>()
    ).results;

    const statusNameMap: Record<string, { label: string; color: string }> = {
      new: { label: 'جديدة', color: '#3b82f6' },
      not_started: { label: 'لم تبدأ', color: '#94a3b8' },
      in_progress: { label: 'قيد التنفيذ', color: '#eab308' },
      waiting_reply: { label: 'في انتظار رد', color: '#f97316' },
      waiting_approval: { label: 'في انتظار اعتماد', color: '#a855f7' },
      suspended: { label: 'معلقة', color: '#64748b' },
      completed: { label: 'مكتملة', color: '#22c55e' },
      cancelled: { label: 'ملغاة', color: '#ef4444' },
    };

    const tasksByStatus = statusCounts.map(sc => ({
      name: statusNameMap[sc.status]?.label || sc.status,
      value: sc.count,
      color: statusNameMap[sc.status]?.color || '#94a3b8',
    }));

    // Tasks by Priority distribution
    const priorityCounts = (
      await db
        .prepare(
          `SELECT priority, COUNT(*) as count
           FROM tasks
           WHERE deleted_at IS NULL AND is_archived = 0 AND status NOT IN ('completed', 'cancelled')
           GROUP BY priority`
        )
        .all<{ priority: string; count: number }>()
    ).results;

    const priorityNameMap: Record<string, { label: string; color: string }> = {
      urgent_critical: { label: 'عاجل جداً', color: '#ef4444' },
      high: { label: 'مرتفع', color: '#f97316' },
      medium: { label: 'متوسط', color: '#3b82f6' },
      low: { label: 'منخفض', color: '#10b981' },
    };

    const tasksByPriority = priorityCounts.map(pc => ({
      name: priorityNameMap[pc.priority]?.label || pc.priority,
      value: pc.count,
      color: priorityNameMap[pc.priority]?.color || '#94a3b8',
    }));

    return c.json({
      success: true,
      stats: {
        totalTasks,
        todayTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        urgentTasks,
        waitingReplyTasks,
        dueTomorrowTasks,
        weeklyCompletionRate,
        activeCorrespondences,
        urgentTasksList,
        approachingDueTasks,
        recentlyCompletedTasks,
        waitingApprovalTasks,
        todayMeetings,
        recentActivities: recentHistory,
        tasksByStatus,
        tasksByPriority,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

