-- Migration: 0002_seed_data.sql
-- Core Setup for Daily Office Manager (الهيئة العامة للرعاية الصحية)
-- Contains only essential configuration: official departments and the technical office admin user.

-- 1. Departments
INSERT OR IGNORE INTO departments (id, name, code, display_order, is_active) VALUES
('dept-1', 'المكتب الفني لمدير الفرع', 'TECH-OFFICE', 1, 1),
('dept-2', 'إدارة الرعاية الأولية', 'PRIM-CARE', 2, 1),
('dept-3', 'إدارة الرعاية الثانوية والثالثية', 'SEC-CARE', 3, 1),
('dept-4', 'إدارة الجودة ومكافحة العدوى', 'QUALITY', 4, 1),
('dept-5', 'إدارة الشؤون المالية والإدارية', 'FIN-ADMIN', 5, 1),
('dept-6', 'إدارة التحول الرقمي وتكنولوجيا المعلومات', 'IT-DIGITAL', 6, 1),
('dept-7', 'إدارة رضاء المنتفعين والشكاوى', 'BENEFICIARY', 7, 1),
('dept-8', 'إدارة الموارد البشرية', 'HR', 8, 1),
('dept-9', 'إدارة التخطيط والمتابعة الاستراتيجية', 'PLAN-MONITOR', 9, 1),
('dept-10', 'إدارة الإمداد والتموين الصيدلي', 'PHARM-SUPPLY', 10, 1);

-- 2. Default User: admin / admin123@office
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, job_title, role) VALUES
('user-1', 'admin', 'd7eb2aa9c30100d0769c885a64ede7b78d32a129ee4ac8187b9465814bd97fea:dailyoffice2025', 'د. ماجد عاطف', 'عضو المكتب الفني لمدير الفرع', 'admin');

-- 3. Default User Settings
INSERT OR IGNORE INTO user_settings (id, user_id, work_start_time, work_end_time, default_reminder_hours, theme, language) VALUES
('settings-1', 'user-1', '08:30', '15:30', 24, 'light', 'ar');
