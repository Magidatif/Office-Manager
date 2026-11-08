export type TaskPriority = 'urgent_critical' | 'high' | 'medium' | 'low';

export type TaskStatus =
  | 'new'
  | 'not_started'
  | 'in_progress'
  | 'waiting_reply'
  | 'waiting_approval'
  | 'suspended'
  | 'completed'
  | 'cancelled';

export interface User {
  id: string;
  username: string;
  full_name: string;
  job_title: string;
  role: 'admin' | 'director' | 'deputy_director' | 'officer' | 'viewer';
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  display_order?: number;
  is_active?: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: number;
  sort_order: number;
  completed_at?: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id?: string;
  user_name: string;
  comment: string;
  created_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id?: string;
  action: string;
  details?: string;
  created_at: string;
}

export interface Task {
  id: string;
  task_number: string;
  title: string;
  description?: string;
  task_type: string;
  department_id?: string;
  department_name?: string;
  assigned_by: string;
  assigned_to: string;
  priority: TaskPriority;
  status: TaskStatus;
  start_date?: string;
  due_date?: string;
  completion_date?: string;
  progress: number;
  reference_number?: string;
  notes?: string;
  follow_up_date?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_rule?: string;
  postponed_count?: number;
  postpone_reason?: string;
  is_archived: number;
  is_overdue?: boolean;
  subtasks?: Subtask[];
  comments?: TaskComment[];
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface DailyWorkLog {
  id: string;
  user_id: string;
  user_name?: string;
  log_date: string;
  start_time?: string;
  end_time?: string;
  activity_type: string;
  department_id?: string;
  department_name?: string;
  task_id?: string;
  task_title?: string;
  description: string;
  actions_taken?: string;
  results?: string;
  obstacles?: string;
  next_step?: string;
  notes?: string;
  is_completed: number;
  created_at: string;
  updated_at: string;
}

export type CorrespondenceType =
  | 'وارد'
  | 'صادر'
  | 'مذكرة عرض'
  | 'تكليف'
  | 'قرار'
  | 'توجيه'
  | 'مكاتبة داخلية';

export type CorrespondenceStatus =
  | 'under_process'
  | 'replied'
  | 'closed'
  | 'transferred_to_task'
  | 'waiting_info';

export interface Correspondence {
  id: string;
  reg_number: string;
  official_letter_number?: string;
  letter_date: string;
  date_received_or_sent: string;
  letter_type: CorrespondenceType;
  sender: string;
  recipient: string;
  subject: string;
  summary?: string;
  required_action?: string;
  department_id?: string;
  department_name?: string;
  assigned_to?: string;
  reply_due_date?: string;
  status: CorrespondenceStatus;
  linked_task_id?: string;
  linked_task_title?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  item_type: 'قرار' | 'توصية' | 'تكليف';
  content: string;
  assigned_to_dept?: string;
  assigned_to_person?: string;
  due_date?: string;
  linked_task_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time?: string;
  location?: string;
  chairman: string;
  attendees?: string;
  agenda?: string;
  summary_of_discussions?: string;
  decisions?: MeetingDecision[];
  created_at: string;
  updated_at: string;
}

export interface TaskFollowUp {
  id: string;
  task_id?: string;
  task_title?: string;
  correspondence_id?: string;
  correspondence_subject?: string;
  follow_up_date: string;
  follow_up_channel: string;
  target_person_or_dept: string;
  outcome: string;
  reply_received?: string;
  next_step?: string;
  next_follow_up_date?: string;
  status: 'pending' | 'resolved' | 'escalated';
  created_by?: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  reference_type: 'task' | 'correspondence' | 'meeting' | 'archive_doc';
  reference_id?: string;
  reference_number?: string;
  file_name: string;
  file_key: string;
  file_size: number;
  mime_type: string;
  title: string;
  category: string;
  department_id?: string;
  department_name?: string;
  doc_date?: string;
  description?: string;
  keywords?: string;
  uploaded_by: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'urgent' | 'warning' | 'info' | 'success';
  link_url?: string;
  is_read: number;
  created_at: string;
}

export interface DashboardStats {
  totalTasks: number;
  todayTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  waitingReplyTasks: number;
  dueTomorrowTasks: number;
  weeklyCompletionRate: number;
  activeCorrespondences: number;
  urgentTasksList: Task[];
  approachingDueTasks: Task[];
  recentlyCompletedTasks: Task[];
  waitingApprovalTasks: Task[];
  todayMeetings: Meeting[];
  recentActivities: {
    id: string;
    action: string;
    title: string;
    time: string;
    type: 'task' | 'log' | 'correspondence' | 'meeting';
  }[];
  tasksByStatus: { name: string; value: number; color: string }[];
  tasksByPriority: { name: string; value: number; color: string }[];
}

export interface UserSettings {
  work_start_time: string;
  work_end_time: string;
  default_reminder_hours: number;
  theme: 'light' | 'dark' | 'system';
  language: 'ar' | 'en';
  email_notifications: number;
  browser_notifications: number;
}

