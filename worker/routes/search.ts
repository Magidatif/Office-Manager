import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';

export const searchRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

searchRoutes.use('*', authMiddleware);

// GET /api/search (Unified search across all entities)
searchRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { q, entityType } = c.req.query();

    if (!q || !q.trim()) {
      return c.json({ success: true, results: [] });
    }

    const term = `%${q.trim()}%`;
    const results: any[] = [];

    // 1. Tasks
    if (!entityType || entityType === 'tasks') {
      const tasks = (
        await db
          .prepare(
            `SELECT id, task_number as ref, title, description as snippet, status, priority, 'task' as type, created_at
             FROM tasks
             WHERE deleted_at IS NULL AND (title LIKE ? OR description LIKE ? OR task_number LIKE ? OR reference_number LIKE ?)
             LIMIT 20`
          )
          .bind(term, term, term, term)
          .all()
      ).results;
      results.push(...tasks);
    }

    // 2. Correspondences
    if (!entityType || entityType === 'correspondences') {
      const corrs = (
        await db
          .prepare(
            `SELECT id, reg_number as ref, subject as title, summary as snippet, status, letter_type as priority, 'correspondence' as type, created_at
             FROM correspondences
             WHERE reg_number LIKE ? OR official_letter_number LIKE ? OR subject LIKE ? OR summary LIKE ? OR sender LIKE ? OR recipient LIKE ?
             LIMIT 20`
          )
          .bind(term, term, term, term, term, term)
          .all()
      ).results;
      results.push(...corrs);
    }

    // 3. Meetings
    if (!entityType || entityType === 'meetings') {
      const meets = (
        await db
          .prepare(
            `SELECT id, meeting_date as ref, title, summary_of_discussions as snippet, '' as status, '' as priority, 'meeting' as type, created_at
             FROM meetings
             WHERE title LIKE ? OR chairman LIKE ? OR attendees LIKE ? OR agenda LIKE ? OR summary_of_discussions LIKE ?
             LIMIT 15`
          )
          .bind(term, term, term, term, term)
          .all()
      ).results;
      results.push(...meets);
    }

    // 4. Archive Documents
    if (!entityType || entityType === 'archive') {
      const docs = (
        await db
          .prepare(
            `SELECT id, reference_number as ref, title, description as snippet, category as status, file_name as priority, 'archive_doc' as type, created_at
             FROM attachments
             WHERE title LIKE ? OR description LIKE ? OR keywords LIKE ? OR reference_number LIKE ? OR file_name LIKE ?
             LIMIT 15`
          )
          .bind(term, term, term, term, term)
          .all()
      ).results;
      results.push(...docs);
    }

    // 5. Daily Work Logs
    if (!entityType || entityType === 'logs') {
      const logs = (
        await db
          .prepare(
            `SELECT id, log_date as ref, description as title, actions_taken as snippet, activity_type as status, '' as priority, 'log' as type, created_at
             FROM daily_work_logs
             WHERE description LIKE ? OR actions_taken LIKE ? OR results LIKE ? OR obstacles LIKE ?
             LIMIT 15`
          )
          .bind(term, term, term, term)
          .all()
      ).results;
      results.push(...logs);
    }

    return c.json({
      success: true,
      query: q.trim(),
      totalMatches: results.length,
      results,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

