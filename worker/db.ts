import { Env } from './types';

export async function logAudit(
  db: D1Database,
  userId: string | null,
  userName: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: string | null,
  ipAddress: string | null = null
) {
  try {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await db
      .prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))`
      )
      .bind(id, userId, userName, action, entityType, entityId, details, ipAddress)
      .run();
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

export function generateId(prefix = 'item'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

