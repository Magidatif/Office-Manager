-- Migration: 0003_wipe_data.sql
-- Wipes all operational and sample data (tasks, correspondences, meetings, logs, followups, archive)
-- Preserves system configuration: departments, users, and user_settings.

DELETE FROM tasks;
DELETE FROM task_subtasks;
DELETE FROM task_comments;
DELETE FROM task_history;
DELETE FROM task_followups;
DELETE FROM daily_work_logs;
DELETE FROM correspondences;
DELETE FROM meetings;
DELETE FROM meeting_decisions;
DELETE FROM attachments;
DELETE FROM notifications;
DELETE FROM audit_logs;

