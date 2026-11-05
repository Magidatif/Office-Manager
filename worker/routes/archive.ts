import { Hono } from 'hono';
import { Env, JwtPayload } from '../types';
import { authMiddleware } from '../auth';
import { generateId, logAudit } from '../db';

export const archiveRoutes = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

archiveRoutes.use('*', authMiddleware);

// GET /api/archive (List documents with filters)
archiveRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const { category, department_id, search, reference_type } = c.req.query();

    let query = `
      SELECT a.*, d.name as department_name
      FROM attachments a
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      query += ` AND a.category = ?`;
      params.push(category);
    }

    if (department_id) {
      query += ` AND a.department_id = ?`;
      params.push(department_id);
    }

    if (reference_type) {
      query += ` AND a.reference_type = ?`;
      params.push(reference_type);
    }

    if (search) {
      query += ` AND (a.title LIKE ? OR a.description LIKE ? OR a.keywords LIKE ? OR a.reference_number LIKE ? OR a.file_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY a.created_at DESC`;

    const documents = (await db.prepare(query).bind(...params).all()).results;

    // Categories with count
    const categoriesWithCount = (
      await db.prepare("SELECT category, COUNT(*) as count FROM attachments GROUP BY category").all()
    ).results;

    return c.json({ success: true, documents, categories: categoriesWithCount });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/archive/upload (Upload document to R2 & register metadata in D1)
archiveRoutes.post('/upload', async (c) => {
  try {
    const db = c.env.DB;
    const user = c.get('user');
    const bucket = c.env.ATTACHMENTS_BUCKET;

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const category = formData.get('category') as string | null;
    const department_id = formData.get('department_id') as string | null;
    const description = formData.get('description') as string | null;
    const keywords = formData.get('keywords') as string | null;
    const reference_type = (formData.get('reference_type') as string | null) || 'archive_doc';
    const reference_id = formData.get('reference_id') as string | null;
    const doc_date = (formData.get('doc_date') as string | null) || new Date().toISOString().split('T')[0];

    if (!file) {
      return c.json({ success: false, error: 'الملف مطلوب' }, 400);
    }

    const id = generateId('doc');
    const ext = file.name.split('.').pop() || 'bin';
    const fileKey = `attachments/${Date.now()}-${id}.${ext}`;
    const year = new Date().getFullYear();
    const reference_number = `DOC-${year}-${Date.now().toString().slice(-4)}`;

    // If R2 bucket is bound, store the actual object bytes
    if (bucket) {
      const buffer = await file.arrayBuffer();
      await bucket.put(fileKey, buffer, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
        customMetadata: {
          originalName: encodeURIComponent(file.name),
          uploadedBy: user.username,
        },
      });
    }

    // Save record in D1
    await db
      .prepare(
        `INSERT INTO attachments (
          id, reference_type, reference_id, reference_number, file_name,
          file_key, file_size, mime_type, title, category,
          department_id, doc_date, description, keywords, uploaded_by, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, DATETIME('now')
        )`
      )
      .bind(
        id,
        reference_type,
        reference_id || null,
        reference_number,
        file.name,
        fileKey,
        file.size,
        file.type || 'application/octet-stream',
        title || file.name,
        category || 'عام',
        department_id || null,
        doc_date,
        description || null,
        keywords || null,
        user.username
      )
      .run();

    await logAudit(db, user.userId, user.username, 'UPLOAD_DOC', 'attachment', id, `رفع مستند: ${title || file.name}`);

    return c.json({
      success: true,
      document: {
        id,
        reference_number,
        file_name: file.name,
        title: title || file.name,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/archive/download/:id (Securely stream file from R2)
archiveRoutes.get('/download/:id', async (c) => {
  try {
    const db = c.env.DB;
    const bucket = c.env.ATTACHMENTS_BUCKET;
    const id = c.req.param('id');

    const doc = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first<any>();
    if (!doc) return c.json({ success: false, error: 'المستند غير موجود' }, 404);

    if (bucket) {
      const object = await bucket.get(doc.file_key);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
        return new Response(object.body, { headers });
      }
    }

    // Fallback if running without R2 instance (dummy mock stream or text)
    return c.text(`الملف: ${doc.file_name}\nالحجم: ${doc.file_size} بايت\nالمفتاح: ${doc.file_key}`);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/archive/:id
archiveRoutes.delete('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const bucket = c.env.ATTACHMENTS_BUCKET;
    const user = c.get('user');
    const id = c.req.param('id');

    const doc = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first<any>();
    if (doc && bucket) {
      try {
        await bucket.delete(doc.file_key);
      } catch (e) {}
    }

    await db.prepare('DELETE FROM attachments WHERE id = ?').bind(id).run();
    await logAudit(db, user.userId, user.username, 'DELETE_DOC', 'attachment', id, `حذف مستند من الأرشيف`);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

