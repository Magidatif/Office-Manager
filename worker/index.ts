import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env, JwtPayload } from './types';
import { authRoutes } from './routes/auth';
import { dashboardRoutes } from './routes/dashboard';
import { taskRoutes } from './routes/tasks';
import { dailyLogRoutes } from './routes/daily-logs';
import { correspondenceRoutes } from './routes/correspondences';
import { meetingRoutes } from './routes/meetings';
import { followUpRoutes } from './routes/follow-ups';
import { archiveRoutes } from './routes/archive';
import { reportRoutes } from './routes/reports';
import { searchRoutes } from './routes/search';
import { settingsRoutes } from './routes/settings';
import { generateId } from './db';

const app = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

// CORS & Middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use('*', logger());

// Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    system: 'Daily Office Manager — نظام إدارة ومتابعة الأعمال اليومية',
    timestamp: new Date().toISOString(),
    timezone: c.env.DEFAULT_TIMEZONE || 'Africa/Cairo',
  });
});

// Common Departments List
app.get('/api/departments', async (c) => {
  try {
    const db = c.env.DB;
    const depts = (
      await db
        .prepare('SELECT * FROM departments WHERE is_active = 1 ORDER BY display_order ASC, name ASC')
        .all()
    ).results;
    return c.json({ success: true, departments: depts });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/daily-logs', dailyLogRoutes);
app.route('/api/correspondences', correspondenceRoutes);
app.route('/api/meetings', meetingRoutes);
app.route('/api/follow-ups', followUpRoutes);
app.route('/api/archive', archiveRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/settings', settingsRoutes);

// Scheduled Cron Trigger Handler for Cloudflare Workers
export async function handleScheduled(event: ScheduledEvent, env: Env) {
  console.log('[Cron] Running daily morning task scan and notification generator...');
  try {
    const db = env.DB;
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Check tasks due today
    const dueToday = (
      await db
        .prepare(
          "SELECT id, task_number, title, assigned_to FROM tasks WHERE due_date = ? AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL"
        )
        .bind(todayStr)
        .all<any>()
    ).results;

    for (const t of dueToday) {
      const notifId = generateId('notif');
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read, created_at)
           VALUES (?, NULL, ?, ?, 'warning', ?, 0, DATETIME('now'))`
        )
        .bind(
          notifId,
          `مهمة مستحقة اليوم: ${t.task_number}`,
          `المهمة "${t.title}" موعد تسليمها اليوم (${todayStr})، يرجى المتابعة.`,
          `/tasks/${t.id}`
        )
        .run();
    }

    // 2. Check overdue tasks
    const overdueTasks = (
      await db
        .prepare(
          "SELECT id, task_number, title FROM tasks WHERE due_date < ? AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL"
        )
        .bind(todayStr)
        .all<any>()
    ).results;

    if (overdueTasks.length > 0) {
      const notifId = generateId('notif');
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read, created_at)
           VALUES (?, NULL, ?, ?, 'urgent', ?, 0, DATETIME('now'))`
        )
        .bind(
          notifId,
          `تنبيه: يوجد ${overdueTasks.length} مهام متأخرة`,
          `يوجد ${overdueTasks.length} مهمة تجاوزت موعد الاستحقاق دون اكتمال، يرجى اتخاذ الإجراء اللازم.`,
          '/tasks?overdue=1'
        )
        .run();
    }

    console.log(`[Cron] Completed: ${dueToday.length} due tasks, ${overdueTasks.length} overdue tasks.`);
  } catch (err) {
    console.error('[Cron] Error in scheduled cron handler:', err);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

