import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { DailyWorkLog, Department } from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { toast } from '../context/ToastContext';
import {
  Calendar,
  Clock,
  Plus,
  Award,
  FileCheck2,
  AlertCircle,
  ArrowRightCircle,
  Printer,
  Sparkles,
  Edit,
  Trash2,
  Building,
} from 'lucide-react';

export const DailyLogPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [logs, setLogs] = useState<DailyWorkLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [endOfDayReport, setEndOfDayReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    log_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '',
    activity_type: 'صياغة مذكرة',
    department_id: '',
    description: '',
    actions_taken: '',
    results: '',
    obstacles: '',
    next_step: '',
    notes: '',
    is_completed: 1,
  });

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; logs: DailyWorkLog[] }>(
        `/daily-logs?date=${selectedDate}`
      );
      if (res.success) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    loadDepartments();
    const handleRefresh = () => loadLogs();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    try {
      if (formData.id) {
        await apiRequest(`/daily-logs/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('تم تحديث النشاط في سجل اليوم');
      } else {
        await apiRequest('/daily-logs', {
          method: 'POST',
          body: JSON.stringify({ ...formData, log_date: selectedDate }),
        });
        toast.success('تم تسجيل النشاط بنجاح');
      }
      setShowAddModal(false);
      loadLogs();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await apiRequest(`/daily-logs/${deleteTargetId}`, { method: 'DELETE' });
      toast.success('تم حذف النشاط من السجل');
      setDeleteTargetId(null);
      loadLogs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEndOfDayReport = async () => {
    try {
      setReportLoading(true);
      setShowReportModal(true);
      const res = await apiRequest<any>(`/daily-logs/end-of-day-report?date=${selectedDate}`);
      if (res.success) {
        setEndOfDayReport(res);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            سجل الأعمال والإنجازات اليومية
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200">
              {logs.length} نشاط مسجل
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            توثيق التسلسل الزمني للأعمال والمهام الميدانية والمكتبية المنجزة خلال يوم العمل
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Quick Achievement Button */}
          <button
            onClick={() => {
              setFormData({
                log_date: selectedDate,
                start_time: new Date().toTimeString().substring(0, 5),
                end_time: '',
                activity_type: 'إنجاز سريع',
                department_id: '',
                description: '',
                actions_taken: '',
                results: '',
                obstacles: '',
                next_step: '',
                notes: '',
                is_completed: 1,
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            إضافة إنجاز سريع
          </button>

          {/* End of Day Report Button */}
          <button
            onClick={openEndOfDayReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            تقرير نهاية اليوم
          </button>
        </div>
      </div>

      {/* Timeline of Logs */}
      {loading ? (
        <LoadingSpinner text="جاري استرجاع سجل أعمال اليوم..." />
      ) : logs.length > 0 ? (
        <div className="relative border-r-2 border-emerald-200 dark:border-emerald-900 mr-4 pr-6 space-y-6">
          {logs.map((log) => (
            <div key={log.id} className="relative group">
              {/* Dot on timeline */}
              <span className="absolute -right-[31px] top-4 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white dark:border-slate-900 shadow-sm" />

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-mono text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {log.start_time || '--:--'} {log.end_time ? `إلى ${log.end_time}` : ''}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      {log.activity_type}
                    </span>
                    {log.department_name && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        {log.department_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-auto opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setFormData({ ...log });
                        setShowAddModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      title="تعديل السجل"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(log.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Log Description */}
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 leading-relaxed">
                  {log.description}
                </h4>

                {/* Details Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mt-3 pt-3 border-t border-slate-50 dark:border-slate-800/60">
                  {log.actions_taken && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                      <span className="text-slate-400 block font-bold mb-0.5">الإجراء المتخذ:</span>
                      <span className="text-slate-700 dark:text-slate-300">{log.actions_taken}</span>
                    </div>
                  )}
                  {log.results && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40">
                      <span className="block font-bold mb-0.5">النتائج والمخرجات:</span>
                      <span>{log.results}</span>
                    </div>
                  )}
                  {log.obstacles && (
                    <div className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40">
                      <span className="block font-bold mb-0.5">المعوقات:</span>
                      <span>{log.obstacles}</span>
                    </div>
                  )}
                  {log.next_step && (
                    <div className="p-2.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 text-sky-900 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40">
                      <span className="block font-bold mb-0.5">الخطوة القادمة:</span>
                      <span>{log.next_step}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={`لا توجد أعمال مسجلة بتاريخ ${selectedDate}`}
          description="سجل أعمالك وإنجازاتك اليومية أولاً بأول لإنشاء تقرير نهاية اليوم بنقرة زر واحدة"
          actionText="تسجيل عمل أو إنجاز الآن"
          onAction={() => setShowAddModal(true)}
        />
      )}

      {/* Add / Edit Daily Log Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={formData.id ? 'تعديل نشاط يومي' : 'تسجيل عمل أو إنجاز جديد'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              وصف العمل أو النشاط <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="مثال: فحص مقترح تشغيل قسم الطوارئ بمستشفى الكرنك وإعداد التقرير الفني..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نوع النشاط
              </label>
              <select
                value={formData.activity_type}
                onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="صياغة مذكرة">صياغة مذكرة</option>
                <option value="مراجعة تقرير">مراجعة تقرير</option>
                <option value="اجتماع تنسيقي">اجتماع تنسيقي</option>
                <option value="متابعة تليفونية">متابعة تليفونية</option>
                <option value="إعداد إحصائية">إعداد إحصائية</option>
                <option value="فحص موضوع">فحص موضوع</option>
                <option value="إنجاز سريع">إنجاز سريع</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وقت البدء
              </label>
              <input
                type="time"
                value={formData.start_time || '09:00'}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وقت الانتهاء
              </label>
              <input
                type="time"
                value={formData.end_time || ''}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ما تم تنفيذه (الإجراءات)
              </label>
              <input
                type="text"
                value={formData.actions_taken || ''}
                onChange={(e) => setFormData({ ...formData, actions_taken: e.target.value })}
                placeholder="الإجراءات المتخذة بالتفصيل..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                النتائج المحققة
              </label>
              <input
                type="text"
                value={formData.results || ''}
                onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                placeholder="النتيجة الملموسة..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المعوقات (إن وجدت)
              </label>
              <input
                type="text"
                value={formData.obstacles || ''}
                onChange={(e) => setFormData({ ...formData, obstacles: e.target.value })}
                placeholder="معوقات واجهت التنفيذ..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الخطوة القادمة
              </label>
              <input
                type="text"
                value={formData.next_step || ''}
                onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                placeholder="المطلوب استكماله..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors"
            >
              حفظ في سجل اليوم
            </button>
          </div>
        </form>
      </Modal>

      {/* End of Day Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title={`تقرير نهاية يوم العمل — ${selectedDate}`}
        maxWidth="3xl"
      >
        {reportLoading || !endOfDayReport ? (
          <LoadingSpinner text="جاري توليد التقرير الآلي لنهاية اليوم..." />
        ) : (
          <div className="space-y-6">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block font-bold">الهيئة العامة للرعاية الصحية</span>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  المكتب الفني لمدير الفرع — التقرير الإداري اليومي
                </h3>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                طباعة التقرير
              </button>
            </div>

            {/* 1. ما تم إنجازه */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
                <FileCheck2 className="w-4 h-4" />
                أولاً: ما تم إنجازه خلال اليوم ({endOfDayReport.completedItems.length} بند)
              </h4>
              <div className="space-y-1.5">
                {endOfDayReport.completedItems.length > 0 ? (
                  endOfDayReport.completedItems.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {idx + 1}. {item.description}
                      </div>
                      {item.results && (
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">
                          المخرجات: {item.results}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">لم تسجل إنجازات مكتملة بهذا التاريخ</p>
                )}
              </div>
            </div>

            {/* 2. الأعمال الجاري تنفيذها */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 uppercase">
                <Clock className="w-4 h-4" />
                ثانياً: الأعمال الجاري استكمالها
              </h4>
              <div className="space-y-1.5">
                {endOfDayReport.inProgressItems.length > 0 ? (
                  endOfDayReport.inProgressItems.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {idx + 1}. {item.description}
                      </div>
                      {item.next_step && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                          الخطوة القادمة: {item.next_step}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد أعمال معلقة لليوم</p>
                )}
              </div>
            </div>

            {/* 3. المعوقات */}
            {endOfDayReport.obstaclesList.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase">
                  <AlertCircle className="w-4 h-4" />
                  ثالثاً: المعوقات التي واجهت العمل
                </h4>
                <ul className="list-disc list-inside space-y-1 p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200">
                  {endOfDayReport.obstaclesList.map((obs: string, idx: number) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. المطلوب متابعته غداً */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 uppercase">
                <ArrowRightCircle className="w-4 h-4" />
                رابعاً: المطلوب متابعته وتجهيزه لصباح الغد
              </h4>
              <div className="space-y-1.5">
                {endOfDayReport.tasksDueTomorrow.length > 0 || endOfDayReport.followUpsDueTomorrow.length > 0 ? (
                  <>
                    {endOfDayReport.tasksDueTomorrow.map((t: any, idx: number) => (
                      <div
                        key={`due-${idx}`}
                        className="p-2.5 rounded-xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 text-xs flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {t.task_number}: {t.title}
                        </span>
                        <span className="text-[11px] text-sky-700 dark:text-sky-300 font-semibold">
                          استحقاق الغد
                        </span>
                      </div>
                    ))}
                    {endOfDayReport.followUpsDueTomorrow.map((f: any, idx: number) => (
                      <div
                        key={`flw-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs"
                      >
                        متابعة مع: {f.target_person_or_dept} ({f.follow_up_channel})
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">لا توجد مواعيد نهائية مسجلة لصباح الغد</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="تأكيد حذف النشاط"
        message="هل تريد حذف هذا السجل من أعمال اليوم؟"
        confirmText="نعم، احذف السجل"
        isDestructive={true}
      />
    </div>
  );
};

