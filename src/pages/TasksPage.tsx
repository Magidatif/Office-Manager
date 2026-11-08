import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Task, Department, Subtask, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EntityAttachments } from '../components/common/EntityAttachments';
import { toast } from '../context/ToastContext';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Copy,
  Archive,
  Trash2,
  Edit,
  Calendar,
  MessageSquare,
  CornerDownLeft,
  ChevronDown,
  CheckSquare,
  ListTodo,
  Sparkles,
  UserCheck,
  Mail,
  RefreshCw,
} from 'lucide-react';

export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [syncTargetDate, setSyncTargetDate] = useState<string>('');

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'today' | 'overdue' | 'urgent' | 'completed' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [taskSources, setTaskSources] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  // Sorting state
  const [sortBy, setSortBy] = useState(''); // e.g., 'priority', 'due_date', 'created_at', 'title'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Modals & Selected Task
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Create/Edit Form state
  const [formData, setFormData] = useState<any>({
    title: '',
    description: '',
    task_type: 'تكليف إداري',
    department_id: '',
    assigned_by: 'مدير الفرع',
    assigned_to: 'د. ماجد عاطف',
    priority: 'medium',
    status: 'new',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    progress: 0,
    reference_number: '',
    notes: '',
  });

  // Postpone state
  const [newDueDate, setNewDueDate] = useState('');
  const [postponeReason, setPostponeReason] = useState('');

  // Comment state
  const [newComment, setNewComment] = useState('');
  // New subtask state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const loadDepartments = async () => {
    try {
      const [deptRes, usrRes] = await Promise.all([
        apiRequest<{ success: boolean; departments: Department[] }>('/departments'),
        apiRequest<{ success: boolean; users: User[] }>('/settings/users').catch(() => ({ success: false, users: [] })),
      ]);
      if (deptRes.success) setDepartments(deptRes.departments);
      if (usrRes.success && usrRes.users) {
        const technicalOfficeMembers = usrRes.users.filter(
          (u) =>
            u.role !== 'director' &&
            u.role !== 'deputy_director' &&
            !u.job_title?.includes('مدير عام') &&
            !u.job_title?.includes('نائب مدير') &&
            u.job_title?.trim() !== 'مدير الفرع'
        );
        setTeamUsers(technicalOfficeMembers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open edit modal with selected task data
  const openEditModal = (task: Task) => {
    setFormData({
      id: task.id,
      title: task.title,
      description: task.description || '',
      task_type: task.task_type || 'تكليف إداري',
      department_id: task.department_id || '',
      assigned_by: task.assigned_by || 'مدير الفرع',
      assigned_to: task.assigned_to || '',
      priority: task.priority || 'medium',
      status: task.status || 'new',
      start_date: task.start_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      due_date: task.due_date?.split('T')[0] ?? '',
      progress: task.progress ?? 0,
      reference_number: task.reference_number || '',
      notes: task.notes || '',
    });
    setShowCreateModal(true);
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (activeTab === 'mine' && user?.full_name) params.append('assigned_to', user.full_name);
      if (activeTab === 'today') params.append('today', '1');
      if (activeTab === 'overdue') params.append('overdue', '1');
      if (activeTab === 'urgent') params.append('priority', 'urgent_critical');
      if (activeTab === 'completed') params.append('status', 'completed');
      if (activeTab === 'archived') params.append('is_archived', '1');
      else params.append('is_archived', '0');

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedDept) params.append('department_id', selectedDept);
      if (selectedSource) params.append('assigned_by', selectedSource);
      if (selectedAssignee && activeTab !== 'mine') params.append('assigned_to', selectedAssignee);
      if (selectedPriority && activeTab !== 'urgent') params.append('priority', selectedPriority);
      if (selectedStatus && activeTab !== 'completed') params.append('status', selectedStatus);

      // Append sorting parameters if set
      if (sortBy) {
        params.append('sort_by', sortBy);
        params.append('order', sortOrder);
      }
      const res = await apiRequest<{ success: boolean; tasks: Task[]; sources?: string[] }>(`/tasks?${params.toString()}`);
      if (res.success) {
        setTasks(res.tasks);
        if (res.sources) setTaskSources(res.sources);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    const handleRefresh = () => loadTasks();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    // Check url search params on mount
    const paramOverdue = searchParams.get('overdue');
    const paramToday = searchParams.get('today');
    const paramPriority = searchParams.get('priority');
    const paramStatus = searchParams.get('status');
    const paramTaskId = searchParams.get('taskId');

    if (paramOverdue === '1') setActiveTab('overdue');
    else if (paramToday === '1') setActiveTab('today');
    else if (paramPriority === 'urgent_critical') setActiveTab('urgent');
    else if (paramStatus === 'completed') setActiveTab('completed');

    if (paramTaskId) {
      openTaskDetails(paramTaskId);
    }
  }, [searchParams]);

  useEffect(() => {
    loadTasks();
  }, [activeTab, selectedDept, selectedSource, selectedAssignee, selectedPriority, selectedStatus, sortBy, sortOrder]);

  const openTaskDetails = async (taskId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; task: Task }>(`/tasks/${taskId}`);
      if (res.success) {
        setSelectedTask(res.task);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (formData.id) {
        await apiRequest(`/tasks/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('تم تحديث بيانات المهمة بنجاح');
      } else {
        await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        toast.success('تم إضافة المهمة الجديدة بنجاح');
      }
      setShowCreateModal(false);
      loadTasks();
      if (formData.id) openTaskDetails(formData.id);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    }
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: string, progress?: number) => {
    try {
      await apiRequest(`/tasks/${taskId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, progress }),
      });
      toast.success(
        newStatus === 'completed'
          ? 'تم اكتمال المهمة ونقلها إلى قائمة المهام المكتملة تلقائياً'
          : 'تم إعادة فتح المهمة وإعادتها للمهام النشطة'
      );
      loadTasks();
      if (selectedTask?.id === taskId) openTaskDetails(taskId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;
    try {
      await apiRequest(`/tasks/subtasks/${subtaskId}/toggle`, { method: 'PUT' });
      openTaskDetails(selectedTask.id);
      loadTasks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    try {
      await apiRequest(`/tasks/${selectedTask.id}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title: newSubtaskTitle.trim() }),
      });
      setNewSubtaskTitle('');
      openTaskDetails(selectedTask.id);
      loadTasks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    try {
      await apiRequest(`/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment: newComment.trim() }),
      });
      setNewComment('');
      toast.success('تم تسجيل ملاحظة المتابعة');
      openTaskDetails(selectedTask.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handlePostpone = async () => {
    if (!selectedTask || !newDueDate) return;
    try {
      await apiRequest(`/tasks/${selectedTask.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          due_date: newDueDate,
          postpone_reason: postponeReason.trim() || 'تأجيل إداري',
        }),
      });
      toast.success('تم اعتماد تأجيل الموعد النهائي');
      setShowPostponeModal(false);
      setNewDueDate('');
      setPostponeReason('');
      openTaskDetails(selectedTask.id);
      loadTasks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDuplicate = async (taskId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; newTaskId: string }>(`/tasks/${taskId}/duplicate`, {
        method: 'POST',
      });
      if (res.success) {
        toast.success('تم تكرار المهمة بنجاح');
        loadTasks();
        openTaskDetails(res.newTaskId);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleArchive = async (taskId: string, archive: boolean) => {
    try {
      await apiRequest(`/tasks/${taskId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archive }),
      });
      toast.success(archive ? 'تم نقل المهمة للأرشيف' : 'تم استعادة المهمة من الأرشيف');
      setSelectedTask(null);
      loadTasks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSyncEmailTasks = async () => {
    try {
      setSyncingEmail(true);
      toast.info(
        syncTargetDate
          ? `جاري الاتصال بخادم البريد الرسمي وسحب إيميلات يوم (${syncTargetDate}) كمهام...`
          : 'جاري الاتصال بخادم البريد الرسمي وسحب الإيميلات كمهام...'
      );
      const res = await apiRequest<{
        success: boolean;
        fetchedCount: number;
        importedCount: number;
        skippedCount: number;
        attachmentsSavedCount: number;
        email: string;
      }>('/email/sync', {
        method: 'POST',
        body: JSON.stringify(syncTargetDate ? { targetDate: syncTargetDate } : {}),
      });

      if (res.success) {
        if (res.importedCount > 0) {
          toast.success(
            syncTargetDate
              ? `تم سحب وتحويل ${res.importedCount} بريد إلكتروني ليوم (${syncTargetDate}) إلى مهام بنجاح (مع ${res.attachmentsSavedCount} مرفق)!`
              : `تم سحب وتحويل ${res.importedCount} بريد إلكتروني إلى مهام بنجاح (مع ${res.attachmentsSavedCount} مرفق)!`
          );
        } else {
          toast.info(
            syncTargetDate
              ? res.fetchedCount > 0
                ? `جميع رسائل يوم (${syncTargetDate}) البالغ عددها (${res.fetchedCount}) مسحوبة بالفعل كمهام`
                : `لا توجد رسائل واردة على البريد الرسمي في يوم (${syncTargetDate})`
              : `البريد محدّث بالكامل — لا توجد رسائل جديدة غير مسحوبة (${res.email})`
          );
        }
        loadTasks();
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل سحب البريد الإلكتروني');
    } finally {
      setSyncingEmail(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;
    try {
      await apiRequest(`/tasks/${selectedTask.id}`, { method: 'DELETE' });
      toast.success('تم حذف المهمة');
      setSelectedTask(null);
      loadTasks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
            إدارة المهام والتكليفات اليومية
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            متابعة موقف التنفيذ، الأولويات، المهام الفرعية وسجل المتابعة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="flex items-center gap-1 px-2.5 py-1.5 border-l border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60">
              <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <input
                type="date"
                value={syncTargetDate}
                onChange={(e) => setSyncTargetDate(e.target.value)}
                title="حدد تاريخ يوم معين لسحب إيميلاته فقط (أو اتركه فارغاً لسحب الأحدث)"
                className="bg-transparent text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none"
              />
              {syncTargetDate && (
                <button
                  type="button"
                  onClick={() => setSyncTargetDate('')}
                  title="إلغاء تحديد اليوم (سحب الأحدث)"
                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 px-1"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSyncEmailTasks}
              disabled={syncingEmail}
              title="سحب الإيميلات الواردة على technicaloffice.luxor@eha.gov.eg وتحويلها لمهام"
              className="flex items-center gap-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${syncingEmail ? 'animate-spin' : ''}`} />
              <Mail className="w-4 h-4" />
              <span>
                {syncingEmail
                  ? 'جاري السحب...'
                  : syncTargetDate
                  ? `سحب إيميلات (${syncTargetDate})`
                  : 'سحب الإيميلات كمهام'}
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              setFormData({
                title: '',
                description: '',
                task_type: 'تكليف إداري',
                department_id: '',
                assigned_by: 'مدير الفرع',
                assigned_to: user?.full_name || 'د. ماجد عاطف',
                priority: 'medium',
                status: 'new',
                start_date: new Date().toISOString().split('T')[0],
                due_date: '',
                progress: 0,
                reference_number: '',
                notes: '',
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            مهمة جديدة
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { key: 'all', label: 'جميع المهام', icon: ListTodo },
          { key: 'mine', label: 'مهامي الشخصية', icon: UserCheck },
          { key: 'today', label: 'مهام اليوم', icon: Calendar },
          { key: 'overdue', label: 'المهام المتأخرة', icon: AlertTriangle, countColor: 'text-red-600' },
          { key: 'urgent', label: 'عاجل جداً', icon: Flame, countColor: 'text-rose-600' },
          { key: 'completed', label: 'المكتملة', icon: CheckCircle2 },
          { key: 'archived', label: 'الأرشيف', icon: Archive },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadTasks()}
            placeholder="بحث في العنوان، الوصف، رقم المهمة..."
            className="w-full pr-10 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Department Filter */}
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="">جميع الإدارات</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Source (assigned_by) Filter */}
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="">جميع جهات التكليف (المصدر)</option>
          {taskSources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>

        {/* Assignee / Team Member Filter */}
        {activeTab !== 'mine' && teamUsers.length > 0 && (
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">جميع أعضاء المكتب الفني</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.full_name}>
                {u.full_name}
              </option>
            ))}
          </select>
        )}

        {/* Priority Filter */}
        {activeTab !== 'urgent' && (
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">جميع الأولويات</option>
            <option value="urgent_critical">عاجل جداً</option>
            <option value="high">مرتفع</option>
            <option value="medium">متوسط</option>
            <option value="low">منخفض</option>
          </select>
        )}

        {/* Sort By Filter */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="">الترتيب حسب (افتراضي)</option>
          <option value="priority">الأولوية</option>
          <option value="due_date">الموعد النهائي</option>
          <option value="created_at">تاريخ الإنشاء</option>
          <option value="title">العنوان</option>
        </select>
        {/* Order Toggle */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="asc">تصاعدي</option>
          <option value="desc">تنازلي</option>
        </select>

        <button
          onClick={loadTasks}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
        >
          تطبيق
        </button>
      </div>

      {/* Tasks Table / Cards */}
      {loading ? (
        <LoadingSpinner text="جاري تحميل سجلات المهام..." />
      ) : tasks.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم المهمة</th>
                  <th className="py-3 px-4 font-bold">عنوان المهمة والتفاصيل</th>
                  <th className="py-3 px-4 font-bold">الإدارة المعنية</th>
                  <th className="py-3 px-4 font-bold">الأولوية</th>
                  <th className="py-3 px-4 font-bold">الحالة</th>
                  <th className="py-3 px-4 font-bold">الموعد النهائي</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    onClick={() => openTaskDetails(task.id)}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                      {task.task_number}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        صادر من: {task.assigned_by} | منفذ: {task.assigned_to}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {task.department_name || 'عام'}
                    </td>

                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={task.priority} />
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={task.status} />
                    </td>

                    <td className="py-3.5 px-4">
                      {task.due_date ? (
                        <span
                          className={`font-medium ${
                            task.is_overdue
                              ? 'text-red-600 font-bold'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {task.due_date}
                          {task.is_overdue && (
                            <span className="block text-[10px] text-red-500 font-bold">
                              متأخرة!
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">غير محدد</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {task.status !== 'completed' ? (
                          <button
                            title="اكتمال المهمة"
                            onClick={() => handleQuickStatusChange(task.id, 'completed', 100)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            title="إعادة الفتح"
                            onClick={() => handleQuickStatusChange(task.id, 'in_progress', 80)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          title="تحرير المهمة"
                          onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          title="نسخ المهمة"
                          onClick={() => handleDuplicate(task.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="لا توجد مهام مسجلة مطابقة للفلاتر"
          description="يمكنك إضافة مهمة جديدة أو تغيير معايير البحث بالأعلى"
          actionText="إضافة مهمة جديدة الآن"
          onAction={() => setShowCreateModal(true)}
        />
      )}

      {/* Task Details Drawer / Modal */}
      {selectedTask && (
        <Modal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={`تفاصيل المهمة: ${selectedTask.task_number}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            {/* Top info header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {selectedTask.task_number}
                  </span>
                  <PriorityBadge priority={selectedTask.priority} />
                  <StatusBadge status={selectedTask.status} />
                  {selectedTask.is_overdue && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                      متأخرة
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedTask.title}
                </h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...selectedTask });
                    setShowCreateModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  تعديل
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewDueDate(selectedTask.due_date || '');
                    setShowPostponeModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  تأجيل
                </button>

                <button
                  type="button"
                  onClick={() => handleArchive(selectedTask.id, !selectedTask.is_archived)}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700"
                  title={selectedTask.is_archived ? 'إلغاء الأرشفة' : 'أرشفة المهمة'}
                >
                  <Archive className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-xl border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50"
                  title="حذف المهمة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Description & Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block mb-1">الإدارة المعنية:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTask.department_name || 'غير محدد'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block mb-1">جهة التكليف:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTask.assigned_by}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block mb-1">المسؤول عن التنفيذ:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTask.assigned_to}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block mb-1">الموعد النهائي:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTask.due_date || 'غير محدد'}
                </span>
              </div>
            </div>

            {selectedTask.description && (
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800">
                <h4 className="text-xs font-bold text-slate-400 mb-1.5">الوصف التفصيلي:</h4>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>
            )}

            {/* Subtasks Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  قائمة المهام الفرعية واستيفاء التنفيذ
                </h4>
                <span className="text-xs font-bold text-emerald-600">
                  نسبة الإنجاز الإجمالية: {selectedTask.progress}%
                </span>
              </div>

              <div className="space-y-2">
                {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                  selectedTask.subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => handleToggleSubtask(sub.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 text-xs ${
                        sub.is_completed
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!sub.is_completed}
                        readOnly
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className={sub.is_completed ? 'line-through text-slate-400' : 'font-medium'}>
                        {sub.title}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد مهام فرعية بعد</p>
                )}

                {/* Add Subtask Form */}
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="إضافة بند فرعي جديد..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    إضافة
                  </button>
                </form>
              </div>
            </div>

            {/* Comments & Follow-up Notes */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                ملاحظات وتعليقات المتابعة
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((cmnt) => (
                    <div
                      key={cmnt.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          {cmnt.user_name}
                        </span>
                        <span>{cmnt.created_at}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">{cmnt.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد ملاحظات متابعة مسجلة</p>
                )}
              </div>

              {/* Add comment */}
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="تسجيل ملاحظة متابعة أو إفادة..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  تسجيل
                </button>
              </form>
            </div>

            {/* Attachments Section */}
            <EntityAttachments
              referenceType="task"
              referenceId={selectedTask.id}
              departmentId={selectedTask.department_id}
              attachments={selectedTask.attachments || []}
              onRefresh={() => openTaskDetails(selectedTask.id)}
            />
          </div>
        </Modal>
      )}

      {/* Create / Edit Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={formData.id ? 'تعديل المهمة والتكليف' : 'إضافة مهمة جديدة'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان المهمة <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="مثال: إعداد مذكرة عرض بشأن نوبتجيات المستشفيات..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الوصف التفصيلي
            </label>
            <textarea
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="بيان تفاصيل التكليف، المخرجات المطلوبة..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نوع المهمة
              </label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="تكليف إداري">تكليف إداري</option>
                <option value="مذكرة عرض">مذكرة عرض</option>
                <option value="متابعة مشروع">متابعة مشروع</option>
                <option value="فحص شكوى">فحص شكوى</option>
                <option value="إعداد تقرير">إعداد تقرير</option>
                <option value="متابعة مكاتبة">متابعة مكاتبة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الإدارة المعنية
              </label>
              <select
                value={formData.department_id || ''}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">-- اختياري --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الأولوية
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="urgent_critical">عاجل جداً</option>
                <option value="high">مرتفع</option>
                <option value="medium">متوسط</option>
                <option value="low">منخفض</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                جهة التكليف (المصدر)
              </label>
              <input
                type="text"
                list="task-sources-datalist"
                value={formData.assigned_by}
                onChange={(e) => setFormData({ ...formData, assigned_by: e.target.value })}
                placeholder="مثال: مدير الفرع، رئيس قطاع الأقاليم، BCM..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <datalist id="task-sources-datalist">
                {taskSources.map((src) => (
                  <option key={src} value={src} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المسؤول عن التنفيذ (عضو المكتب الفني)
              </label>
              <input
                type="text"
                list="team-users-datalist"
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                placeholder="اختر عضو المكتب الفني أو اكتب الاسم..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <datalist id="team-users-datalist">
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.full_name}>
                    {u.job_title}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الحالة
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="new">جديدة</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="waiting_reply">في انتظار رد</option>
                <option value="waiting_approval">في انتظار اعتماد</option>
                <option value="suspended">معلقة</option>
                <option value="completed">مكتملة</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ البدء
              </label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الموعد النهائي
              </label>
              <input
                type="date"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors"
            >
              حفظ المهمة
            </button>
          </div>
        </form>
      </Modal>

      {/* Postpone Modal */}
      <Modal
        isOpen={showPostponeModal}
        onClose={() => setShowPostponeModal(false)}
        title="تحديث الموعد النهائي وتسجيل سبب التأجيل"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الموعد الجديد للاستحقاق <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              سبب التأجيل (للتوثيق الإداري) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={postponeReason}
              onChange={(e) => setPostponeReason(e.target.value)}
              placeholder="مثال: تأخر موافاة الفرع ببيانات إدارات المستشفيات المعنية..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowPostponeModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handlePostpone}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md"
            >
              اعتماد التأجيل
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="تأكيد حذف المهمة"
        message="هل أنت متأكد من رغبتك في حذف هذه المهمة؟ سيتم نقلها إلى سلة المحذوفات بأمان."
        confirmText="نعم، حذف المهمة"
      />
    </div>
  );
};

