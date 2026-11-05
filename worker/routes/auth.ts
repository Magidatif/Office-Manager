import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { hashPassword, verifyPassword, signJwt, authMiddleware } from '../auth';
import { logAudit } from '../db';

export const authRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

// Login endpoint
authRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json<{ username?: string; password?: string }>();
    if (!username || !password) {
      return c.json({ success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' }, 400);
    }

    const db = c.env.DB;
    const user = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username.trim())
      .first<{
        id: string;
        username: string;
        password_hash: string;
        full_name: string;
        job_title: string;
        role: string;
      }>();

    if (!user) {
      return c.json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
    }

    const secret = c.env.JWT_SECRET || 'daily-office-manager-secure-jwt-secret-key-2025';
    const token = await signJwt(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      secret,
      86400 * 7 // 7 days valid
    );

    await logAudit(
      db,
      user.id,
      user.full_name,
      'LOGIN',
      'auth',
      user.id,
      'تسجيل دخول ناجح إلى النظام',
      c.req.header('CF-Connecting-IP') || null
    );

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        job_title: user.job_title,
        role: user.role,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'حدث خطأ أثناء تسجيل الدخول' }, 500);
  }
});

// Current User info
authRoutes.get('/me', authMiddleware, async (c) => {
  const payload = c.get('user');
  const db = c.env.DB;
  const user = await db
    .prepare('SELECT id, username, full_name, job_title, role FROM users WHERE id = ?')
    .bind(payload.userId)
    .first();

  if (!user) {
    return c.json({ success: false, error: 'المستخدم غير موجود' }, 404);
  }

  // Get user settings
  const settings = await db
    .prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .bind(payload.userId)
    .first();

  return c.json({ success: true, user, settings });
});

// Change Password
authRoutes.post('/change-password', authMiddleware, async (c) => {
  try {
    const payload = c.get('user');
    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return c.json({ success: false, error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' }, 400);
    }

    const db = c.env.DB;
    const user = await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(payload.userId)
      .first<{ password_hash: string; full_name: string }>();

    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return c.json({ success: false, error: 'كلمة المرور الحالية غير صحيحة' }, 400);
    }

    const newHash = await hashPassword(newPassword);
    await db
      .prepare("UPDATE users SET password_hash = ?, updated_at = DATETIME('now') WHERE id = ?")
      .bind(newHash, payload.userId)
      .run();

    await logAudit(
      db,
      payload.userId,
      user.full_name,
      'CHANGE_PASSWORD',
      'auth',
      payload.userId,
      'تم تغيير كلمة المرور بنجاح'
    );

    return c.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

