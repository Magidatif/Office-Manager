-- Migration: 0001_initial_schema.sql
-- Daily Office Manager — Database Schema for Cloudflare D1 (SQLite)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'officer', 'viewer'
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  task_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'تكليف إداري', -- تكليف إداري, مذكرة عرض, متابعة مشروع, فحص شكوى, إعداد تقرير, أخرى
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  assigned_by TEXT NOT NULL, -- الجهة المصدرة (مثلاً: مدير الفرع, نائب المدير, الإدارة المركزية)
  assigned_to TEXT NOT NULL, -- المسؤول عن التنفيذ
  priority TEXT NOT NULL DEFAULT 'medium', -- 'urgent_critical', 'high', 'medium', 'low'
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'not_started', 'in_progress', 'waiting_reply', 'waiting_approval', 'suspended', 'completed', 'cancelled'
  start_date TEXT,
  due_date TEXT,
  completion_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0, -- 0 - 100
  reference_number TEXT, -- رقم المرجع أو رقم المكاتبة
  notes TEXT,
  follow_up_date TEXT,
  recurrence TEXT DEFAULT 'none', -- 'none', 'daily', 'weekly', 'monthly'
  recurrence_rule TEXT,
  postponed_count INTEGER DEFAULT 0,
  postpone_reason TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON tasks(is_archived);

-- 4. Subtasks Table
CREATE TABLE IF NOT EXISTS task_subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON task_subtasks(task_id);

-- 5. Task Comments & Follow-up Notes
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  user_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);

-- 6. Task Activity History
CREATE TABLE IF NOT EXISTS task_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT,
  action TEXT NOT NULL, -- 'created', 'updated_status', 'updated_progress', 'postponed', 'comment_added', etc.
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);

-- 7. Follow-up Center Records (سجلات المتابعة الدورية)
CREATE TABLE IF NOT EXISTS task_followups (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  correspondence_id TEXT,
  follow_up_date TEXT NOT NULL,
  follow_up_channel TEXT NOT NULL, -- اتصال هاتفي, مكاتبة رسمية, زيارة ميدانية, بريد إلكتروني, اجتماع, تطبيق واتساب
  target_person_or_dept TEXT NOT NULL, -- المسؤول أو الإدارة التي تمت متابعتها
  outcome TEXT NOT NULL, -- نتيجة المتابعة
  reply_received TEXT, -- الرد المستلم
  next_step TEXT, -- الخطوة القادمة
  next_follow_up_date TEXT, -- موعد المتابعة القادمة
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'escalated'
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_followups_task ON task_followups(task_id);
CREATE INDEX IF NOT EXISTS idx_followups_date ON task_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_followups_next_date ON task_followups(next_follow_up_date);

-- 8. Daily Work Logs (سجل الأعمال والإنجازات اليومية)
CREATE TABLE IF NOT EXISTS daily_work_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  log_date TEXT NOT NULL, -- YYYY-MM-DD
  start_time TEXT, -- HH:mm
  end_time TEXT, -- HH:mm
  activity_type TEXT NOT NULL, -- صياغة مذكرة, مراجعة تقرير, اجتماع تنسيقي, متابعة تليفونية, إعداد إحصائية, فحص موضوع, إنجاز سريع, أخرى
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  actions_taken TEXT,
  results TEXT,
  obstacles TEXT,
  next_step TEXT,
  notes TEXT,
  is_completed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_work_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user ON daily_work_logs(user_id);

-- 9. Correspondences Table (المخاطبات والمراسلات الإدارية)
CREATE TABLE IF NOT EXISTS correspondences (
  id TEXT PRIMARY KEY,
  reg_number TEXT NOT NULL UNIQUE, -- رقم القيد الداخلي
  official_letter_number TEXT, -- رقم الخطاب الرسمي
  letter_date TEXT NOT NULL, -- تاريخ الخطاب
  date_received_or_sent TEXT NOT NULL, -- تاريخ الورود أو الإرسال
  letter_type TEXT NOT NULL, -- وارد, صادر, مذكرة عرض, تكليف, قرار, توجيه, مكاتبة داخلية
  sender TEXT NOT NULL, -- جهة الإرسال
  recipient TEXT NOT NULL, -- جهة الاستقبال
  subject TEXT NOT NULL,
  summary TEXT,
  required_action TEXT, -- الإجراء المطلوب
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  assigned_to TEXT, -- المسؤول عن المتابعة
  reply_due_date TEXT, -- الموعد المحدد للرد
  status TEXT NOT NULL DEFAULT 'under_process', -- 'under_process', 'replied', 'closed', 'transferred_to_task', 'waiting_info'
  linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_corr_reg_num ON correspondences(reg_number);
CREATE INDEX IF NOT EXISTS idx_corr_type ON correspondences(letter_type);
CREATE INDEX IF NOT EXISTS idx_corr_status ON correspondences(status);
CREATE INDEX IF NOT EXISTS idx_corr_due_date ON correspondences(reply_due_date);

-- 10. Meetings Table (الاجتماعات ومحاضر الجلسات)
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL, -- YYYY-MM-DD
  meeting_time TEXT, -- HH:mm
  location TEXT,
  chairman TEXT NOT NULL, -- رئيس الاجتماع
  attendees TEXT, -- أسماء الحضور (مفصولين بفواصل أو JSON)
  agenda TEXT,
  summary_of_discussions TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);

-- 11. Meeting Decisions & Recommendations
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'توصية', -- 'قرار', 'توصية', 'تكليف'
  content TEXT NOT NULL,
  assigned_to_dept TEXT,
  assigned_to_person TEXT,
  due_date TEXT,
  linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON meeting_decisions(meeting_id);

-- 12. Attachments & Electronic Archive (بنك المستندات والأرشيف)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  reference_type TEXT NOT NULL, -- 'task', 'correspondence', 'meeting', 'archive_doc'
  reference_id TEXT, -- ID of the task/correspondence/meeting or null for standalone archive
  reference_number TEXT, -- رقم مرجعي للأرشيف
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL, -- Cloudflare R2 object key
  file_size INTEGER NOT NULL, -- in bytes
  mime_type TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام', -- قرارات وزارية, خطابات رسمية, مذكرات فنية, لوائح تنظيمية, محاضر اجتماعات, عقود واتفاقيات, أخرى
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  doc_date TEXT,
  description TEXT,
  keywords TEXT, -- الكلمات المفتاحية للبحث
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_att_ref ON attachments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_att_category ON attachments(category);
CREATE INDEX IF NOT EXISTS idx_att_key ON attachments(file_key);

-- 13. System Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'urgent', 'warning', 'info', 'success'
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- 14. Audit Logs (سجل العمليات الإدارية)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', etc.
  entity_type TEXT NOT NULL, -- 'task', 'correspondence', 'meeting', 'daily_log', 'auth'
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- 15. User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  work_start_time TEXT NOT NULL DEFAULT '08:30',
  work_end_time TEXT NOT NULL DEFAULT '15:30',
  default_reminder_hours INTEGER NOT NULL DEFAULT 24,
  theme TEXT NOT NULL DEFAULT 'light', -- 'light', 'dark', 'system'
  language TEXT NOT NULL DEFAULT 'ar', -- 'ar', 'en'
  email_notifications INTEGER NOT NULL DEFAULT 0,
  browser_notifications INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 16. Email Integration Configuration (إعدادات ربط البريد الإلكتروني الرسمي للمكتب الفني)
CREATE TABLE IF NOT EXISTS email_config (
  id TEXT PRIMARY KEY,
  email_address TEXT NOT NULL,
  password TEXT NOT NULL,
  owa_url TEXT NOT NULL DEFAULT 'https://mail.egcloud.gov.eg/owa/',
  adfs_url TEXT NOT NULL DEFAULT 'https://fed.egcloud.gov.eg',
  default_assigned_to TEXT NOT NULL DEFAULT 'د. ماجد عاطف',
  default_task_type TEXT NOT NULL DEFAULT 'تكليف إداري',
  default_priority TEXT NOT NULL DEFAULT 'high',
  sync_interval_minutes INTEGER NOT NULL DEFAULT 5,
  max_emails_per_sync INTEGER NOT NULL DEFAULT 25,
  only_unread INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  last_sync_status TEXT,
  last_sync_error TEXT,
  total_synced_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 17. Synced Emails Log (سجل الرسائل المسحوبة لمنع التكرار وربطها بالمهام والمرفقات)
CREATE TABLE IF NOT EXISTS synced_emails (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  ews_item_id TEXT,
  subject TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  received_at TEXT,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  correspondence_id TEXT REFERENCES correspondences(id) ON DELETE SET NULL,
  attachments_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS idx_synced_emails_msg ON synced_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_synced_emails_task ON synced_emails(task_id);


