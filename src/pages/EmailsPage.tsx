import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Department, Attachment } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EntityAttachments } from '../components/common/EntityAttachments';
import { toast } from '../context/ToastContext';
import {
  Mail,
  RefreshCw,
  Search,
  Calendar,
  Paperclip,
  ExternalLink,
  CheckCircle2,
  Clock,
  Inbox,
  User,
  Building2,
} from 'lucide-react';

interface SyncedEmailRecord {
  id: string;
  message_id: string;
  ews_item_id?: string;
  subject: string;
  sender_name?: string;
  sender_email?: string;
  received_at?: string;
  task_id?: string;
  correspondence_id?: string;
  attachments_count: number;
  created_at?: string;
  task_number?: string;
  task_title?: string;
  task_description?: string;
  task_status?: string;
  task_priority?: string;
  task_assigned_to?: string;
  task_due_date?: string;
  task_department_id?: string;
  department_name?: string;
  correspondence_reg_number?: string;
}

export const EmailsPage: React.FC = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<SyncedEmailRecord[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Sync by day / range controls
  const [syncMode, setSyncMode] = useState<'day' | 'range'>('day');
  const [syncTargetDate, setSyncTargetDate] = useState<string>('');
  const [syncFromDate, setSyncFromDate] = useState<string>('');
  const [syncToDate, setSyncToDate] = useState<string>('');

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'attachments' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');

  // Selected email modal
  const [selectedEmail, setSelectedEmail] = useState<SyncedEmailRecord | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);

  const loadSelectedTaskAttachments = async (taskId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; task: any }>(`/tasks/${taskId}`);
      if (res.success && res.task?.attachments) {
        setSelectedAttachments(res.task.attachments);
      } else {
        setSelectedAttachments([]);
      }
    } catch (e) {
      setSelectedAttachments([]);
    }
  };

  const openEmailDetails = (em: SyncedEmailRecord) => {
    setSelectedEmail(em);
    if (em.task_id) {
      loadSelectedTaskAttachments(em.task_id);
    } else {
      setSelectedAttachments([]);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await apiRequest<{ success: boolean; departments: Department[] }>('/departments');
      if (res.success) setDepartments(res.departments);
    } catch (e) {
      console.error(e);
    }
  };

  const loadEmails = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (filterDate) params.append('date', filterDate);
      else if (activeTab === 'today') params.append('date', new Date().toISOString().split('T')[0]);

      if (selectedDept) params.append('department_id', selectedDept);
      if (selectedPriority) params.append('priority', selectedPriority);
      if (activeTab === 'completed') params.append('status', 'completed');

      const res = await apiRequest<{ success: boolean; emails: SyncedEmailRecord[]; config: any }>(
        `/email/list?${params.toString()}`
      );
      if (res.success) {
        let list = res.emails || [];
        if (activeTab === 'attachments') {
          list = list.filter((e) => (e.attachments_count || 0) > 0);
        } else if (activeTab === 'pending') {
          list = list.filter((e) => e.task_status !== 'completed');
        }
        setEmails(list);
        if (res.config) setConfig(res.config);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    const handleRefresh = () => loadEmails();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    loadEmails();
  }, [activeTab, filterDate, selectedDept, selectedPriority]);

  const handleSyncEmails = async (options?: { targetDate?: string; fromDate?: string; toDate?: string }) => {
    try {
      setSyncing(true);
      const payload: any = {};
      if (options) {
        if (options.targetDate) payload.targetDate = options.targetDate;
        if (options.fromDate) payload.fromDate = options.fromDate;
        if (options.toDate) payload.toDate = options.toDate;
      } else if (syncMode === 'day' && syncTargetDate) {
        payload.targetDate = syncTargetDate;
      } else if (syncMode === 'range' && (syncFromDate || syncToDate)) {
        if (syncFromDate) payload.fromDate = syncFromDate;
        if (syncToDate) payload.toDate = syncToDate;
      }

      const labelDesc = payload.targetDate
        ? `ليوم (${payload.targetDate})`
        : payload.fromDate || payload.toDate
        ? `للفترة (${payload.fromDate || 'البداية'} إلى ${payload.toDate || 'اليوم'})`
        : '';

      toast.info(`جاري سحب الإيميلات الواردة ${labelDesc} من البريد الرسمي...`);
      const res = await apiRequest<{
        success: boolean;
        fetchedCount: number;
        importedCount: number;
        skippedCount: number;
        attachmentsSavedCount: number;
      }>('/email/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        if (res.importedCount > 0) {
          toast.success(
            `تم سحب ${res.importedCount} إيميل جديد ${labelDesc} وتحويله لمهام عمل (مع ${res.attachmentsSavedCount} مرفق)!`
          );
        } else {
          toast.info(
            res.fetchedCount > 0
              ? `جميع إيميلات ${labelDesc || 'البريد الأخيرة'} (${res.fetchedCount} رسالة) مسحوبة بالفعل`
              : `لا توجد رسائل واردة على البريد الرسمي ${labelDesc || 'جديدة حالياً'}`
          );
        }
        if (payload.targetDate) {
          setFilterDate(payload.targetDate);
        }
        loadEmails();
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل سحب البريد الإلكتروني');
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await apiRequest(`/tasks/${taskId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, progress: newStatus === 'completed' ? 100 : 50 }),
      });
      toast.success(newStatus === 'completed' ? 'تم تعليم مهمة الإيميل كمكتملة' : 'تم إعادة فتح المهمة');
      loadEmails();
      if (selectedEmail?.task_id === taskId) {
        setSelectedEmail((prev) => (prev ? { ...prev, task_status: newStatus } : null));
      }
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحديث الحالة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Mail className="w-6 h-6 text-sky-600" />
            <span>الإيميلات الواردة (البريد الرسمي للمكتب الفني)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-bold border border-sky-200">
              {emails.length} رسالة
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            تبويب مستقل لمتابعة وسحب رسائل البريد الإلكتروني الرسمي ({config?.email_address || 'technicaloffice.luxor@eha.gov.eg'}) ومرفقاتها ومهامها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => handleSyncEmails({})}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <Mail className="w-4 h-4" />
            <span>{syncing ? 'جاري السحب...' : 'سحب أحدث الإيميلات'}</span>
          </button>
        </div>
      </div>

      {/* Sync By Day / Date Range Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-sky-900/60 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span>سحب الإيميلات من الخادم باليوم أو لفترة محددة:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSyncMode('day')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                syncMode === 'day'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              سحب باليوم
            </button>
            <button
              type="button"
              onClick={() => setSyncMode('range')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                syncMode === 'range'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              فترة من / إلى
            </button>
          </div>
        </div>

        {syncMode === 'day' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setSyncTargetDate(today);
                handleSyncEmails({ targetDate: today });
              }}
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold transition-colors"
            >
              سحب إيميلات اليوم
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const yesterday = d.toISOString().split('T')[0];
                setSyncTargetDate(yesterday);
                handleSyncEmails({ targetDate: yesterday });
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors"
            >
              سحب إيميلات أمس
            </button>

            <div className="flex items-center gap-2 mr-auto">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">تاريخ اليوم المطلوب:</span>
              <input
                type="date"
                value={syncTargetDate}
                onChange={(e) => setSyncTargetDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!syncTargetDate || syncing}
                onClick={() => handleSyncEmails({ targetDate: syncTargetDate })}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>سحب إيميلات هذا اليوم</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">من يوم:</span>
              <input
                type="date"
                value={syncFromDate}
                onChange={(e) => setSyncFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">إلى يوم:</span>
              <input
                type="date"
                value={syncToDate}
                onChange={(e) => setSyncToDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={(!syncFromDate && !syncToDate) || syncing}
              onClick={() => handleSyncEmails({ fromDate: syncFromDate, toDate: syncToDate })}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>سحب إيميلات الفترة</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { key: 'all', label: 'جميع الإيميلات المسحوبة', icon: Inbox },
          { key: 'today', label: 'إيميلات اليوم', icon: Calendar },
          { key: 'pending', label: 'قيد المتابعة', icon: Clock },
          { key: 'attachments', label: 'بها مرفقات PDF', icon: Paperclip },
          { key: 'completed', label: 'المكتملة', icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400'
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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadEmails()}
            placeholder="بحث في عنوان الإيميل، اسم الراسل، البريد الإلكتروني، رقم المهمة..."
            className="w-full pr-10 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500">فلتر باليوم:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="text-xs text-red-500 hover:underline font-bold px-1"
            >
              مسح
            </button>
          )}
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          <option value="">جميع الإدارات المختصة</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          <option value="">جميع الأولويات</option>
          <option value="urgent_critical">عاجل جداً</option>
          <option value="high">مرتفع</option>
          <option value="medium">متوسط</option>
        </select>
      </div>

      {/* Emails List */}
      {loading ? (
        <LoadingSpinner text="جاري تحميل قائمة الإيميلات..." />
      ) : emails.length === 0 ? (
        <EmptyState
          title="لا توجد إيميلات مطابقة للعرض"
          description="يمكنك الضغط على زر سحب الإيميلات بالأعلى أو اختيار تاريخ يوم محدد لسحب رسائله من الخادم."
        />
      ) : (
        <div className="space-y-3">
          {emails.map((em) => (
            <div
              key={em.id}
              onClick={() => openEmailDetails(em)}
              className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-700 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-mono text-[11px] font-bold border border-sky-200/70 dark:border-sky-800">
                    <Mail className="w-3 h-3" />
                    {em.received_at ? em.received_at.replace('T', ' ').slice(0, 16) : ''}
                  </span>

                  {em.task_number && (
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-bold">
                      {em.task_number}
                    </span>
                  )}

                  {em.task_priority && <PriorityBadge priority={em.task_priority as any} />}
                  {em.task_status && <StatusBadge status={em.task_status as any} />}

                  {em.attachments_count > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-800">
                      <Paperclip className="w-3 h-3" />
                      {em.attachments_count} مرفق
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
                  {em.subject}
                </h3>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-sky-600" />
                    الراسل: {em.sender_name || 'بريد رسمي'}
                    {em.sender_email && (
                      <span className="font-mono text-[11px] text-slate-400">({em.sender_email})</span>
                    )}
                  </span>

                  {em.department_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      {em.department_name}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {em.task_id && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickTaskStatus(
                          em.task_id!,
                          em.task_status === 'completed' ? 'in_progress' : 'completed'
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                        em.task_status === 'completed'
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {em.task_status === 'completed' ? 'إعادة فتح' : 'إتمام المهمة'}
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/tasks?tab=emails&taskId=${em.task_id}`)}
                      className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح المهمة</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Email Details Modal */}
      <Modal
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        title={selectedEmail?.subject || 'تفاصيل البريد الإلكتروني'}
        maxWidth="2xl"
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-500">من: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {selectedEmail.sender_name}
                  </span>{' '}
                  {selectedEmail.sender_email && (
                    <span className="font-mono text-sky-600">&lt;{selectedEmail.sender_email}&gt;</span>
                  )}
                </div>
                <div className="font-mono text-slate-500">
                  تاريخ الاستلام: {selectedEmail.received_at?.replace('T', ' ').slice(0, 16)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                {selectedEmail.task_number && (
                  <span>
                    رقم المهمة: <strong className="font-mono text-sky-600">{selectedEmail.task_number}</strong>
                  </span>
                )}
                {selectedEmail.department_name && (
                  <span>
                    الإدارة المختصة: <strong>{selectedEmail.department_name}</strong>
                  </span>
                )}
                {selectedEmail.task_assigned_to && (
                  <span>
                    المكلف بالمتابعة: <strong>{selectedEmail.task_assigned_to}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">نص ومحتوى الرسالة:</h4>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto text-slate-700 dark:text-slate-200">
                {selectedEmail.task_description || '(لا يوجد نص إضافي بالرسالة — يرجى مراجعة المرفقات بالأسفل)'}
              </div>
            </div>

            {selectedEmail.task_id && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <EntityAttachments
                  referenceType="task"
                  referenceId={selectedEmail.task_id}
                  departmentId={selectedEmail.task_department_id}
                  attachments={selectedAttachments}
                  onRefresh={() => {
                    loadSelectedTaskAttachments(selectedEmail.task_id!);
                    loadEmails();
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {selectedEmail.task_id && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedEmail.task_id;
                    setSelectedEmail(null);
                    navigate(`/tasks?tab=emails&taskId=${id}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح صفحة المهمة الكاملة</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
