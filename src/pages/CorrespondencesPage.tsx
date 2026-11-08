import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Correspondence, Department } from '../types';
import { StatusBadge, TypeBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EntityAttachments } from '../components/common/EntityAttachments';
import { toast } from '../context/ToastContext';
import {
  Plus,
  Search,
  ArrowUpRight,
  Sparkles,
  Edit,
  Trash2,
  Mail,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const CorrespondencesPage: React.FC = () => {
  const [items, setItems] = useState<Correspondence[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Correspondence | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState<any>({
    id: undefined,
    subject: '',
    letter_type: 'وارد',
    sender: '',
    recipient: 'مدير فرع الهيئة',
    official_letter_number: '',
    letter_date: new Date().toISOString().split('T')[0],
    date_received_or_sent: new Date().toISOString().split('T')[0],
    summary: '',
    required_action: '',
    department_id: '',
    reply_due_date: '',
    status: 'under_process',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedType) params.append('letter_type', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedDept) params.append('department_id', selectedDept);

      const res = await apiRequest<{ success: boolean; correspondences: Correspondence[] }>(
        `/correspondences?${params.toString()}`
      );
      if (res.success) setItems(res.correspondences);
    } catch (e) {
      console.error(e);
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

  const openDetails = async (id: string) => {
    try {
      const res = await apiRequest<{ success: boolean; correspondence: Correspondence }>(`/correspondences/${id}`);
      if (res.success) {
        setSelectedItem(res.correspondence);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDepartments();
    const handleRefresh = () => loadData();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    const corrId = searchParams.get('corrId');
    if (corrId) {
      openDetails(corrId);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [selectedType, selectedStatus, selectedDept]);

  const openEditModal = (corr: Correspondence, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormData({
      id: corr.id,
      subject: corr.subject || '',
      letter_type: corr.letter_type || 'وارد',
      sender: corr.sender || '',
      recipient: corr.recipient || 'مدير فرع الهيئة',
      official_letter_number: corr.official_letter_number || '',
      letter_date: corr.letter_date || new Date().toISOString().split('T')[0],
      date_received_or_sent: corr.date_received_or_sent || new Date().toISOString().split('T')[0],
      summary: corr.summary || '',
      required_action: corr.required_action || '',
      department_id: corr.department_id || '',
      reply_due_date: corr.reply_due_date || '',
      status: corr.status || 'under_process',
      notes: corr.notes || '',
    });
    setSelectedItem(null);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) return;

    try {
      if (formData.id) {
        await apiRequest(`/correspondences/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('تم تحديث بيانات المكاتبة بنجاح');
      } else {
        await apiRequest('/correspondences', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        toast.success('تم قيد المخاطبة بنجاح');
      }
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشلت العملية');
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await apiRequest(`/correspondences/${deleteTargetId}`, { method: 'DELETE' });
      toast.success('تم حذف المكاتبة بنجاح');
      if (selectedItem?.id === deleteTargetId) setSelectedItem(null);
      setDeleteTargetId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف المكاتبة');
    }
  };

  const handleConvertToTask = async (id: string) => {
    try {
      const res = await apiRequest<{ success: boolean; taskId: string; task_number: string }>(
        `/correspondences/${id}/convert-to-task`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.success(`تم تحويل المخاطبة بنجاح إلى المهمة رقم: ${res.task_number}`);
        loadData();
        if (selectedItem) setSelectedItem(null);
        navigate(`/tasks?taskId=${res.taskId}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل التحويل إلى مهمة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            سجل المراسلات والمخاطبات الرسمية
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-bold border border-sky-200">
              {items.length} مكاتبة
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            قيد ومتابعة الخطابات الواردة والصادرة ومذكرات العرض والتكليفات الوزارية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setFormData({
                id: undefined,
                subject: '',
                letter_type: 'وارد',
                sender: '',
                recipient: 'مدير فرع الهيئة',
                official_letter_number: '',
                letter_date: new Date().toISOString().split('T')[0],
                date_received_or_sent: new Date().toISOString().split('T')[0],
                summary: '',
                required_action: '',
                department_id: '',
                reply_due_date: '',
                status: 'under_process',
                notes: '',
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            قيد مخاطبة جديدة
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            placeholder="بحث برقم القيد، الرقم الرسمي، الموضوع، جهة الإرسال..."
            className="w-full pr-10 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          <option value="">جميع الأنواع</option>
          <option value="وارد">وارد</option>
          <option value="صادر">صادر</option>
          <option value="مذكرة عرض">مذكرة عرض</option>
          <option value="تكليف">تكليف</option>
          <option value="قرار">قرار</option>
          <option value="مكاتبة داخلية">مكاتبة داخلية</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          <option value="">جميع الحالات</option>
          <option value="under_process">قيد المتابعة</option>
          <option value="replied">تم الرد</option>
          <option value="closed">محفوظة / منتهية</option>
          <option value="transferred_to_task">تم تحويلها لمهمة</option>
          <option value="waiting_info">طلب استيفاء</option>
        </select>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          <option value="">جميع الإدارات</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
        >
          بحث
        </button>
      </div>

      {/* Correspondences Table */}
      {loading ? (
        <LoadingSpinner text="جاري استرجاع سجل المراسلات..." />
      ) : items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم القيد</th>
                  <th className="py-3 px-4 font-bold">النوع</th>
                  <th className="py-3 px-4 font-bold">الموضوع والمحتوى</th>
                  <th className="py-3 px-4 font-bold">جهة الإرسال</th>
                  <th className="py-3 px-4 font-bold">الإدارة المختصة</th>
                  <th className="py-3 px-4 font-bold">تاريخ الخطاب</th>
                  <th className="py-3 px-4 font-bold">الحالة</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((corr) => (
                  <tr
                    key={corr.id}
                    onClick={() => openDetails(corr.id)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                      {corr.reg_number}
                      {corr.official_letter_number && (
                        <span className="block text-[10px] text-slate-400 font-mono">
                          رسمي: {corr.official_letter_number}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <TypeBadge type={corr.letter_type} />
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-400">
                        {corr.subject}
                      </div>
                      {corr.required_action && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          الإجراء: {corr.required_action}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {corr.sender}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {corr.department_name || 'عام'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {corr.letter_date}
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={corr.status} />
                    </td>

                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {!corr.linked_task_id ? (
                          <button
                            onClick={() => handleConvertToTask(corr.id)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 text-[11px] transition-colors flex items-center gap-1"
                            title="تحويل لمهمة متابعة"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            لمهمة
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/tasks?taskId=${corr.linked_task_id}`)}
                            className="px-2 py-1 text-slate-500 hover:text-emerald-600 text-[11px] font-bold flex items-center gap-1"
                            title="فتح المهمة المرتبطة"
                          >
                            المهمة
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={(e) => openEditModal(corr, e)}
                          title="تعديل المخاطبة"
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(corr.id);
                          }}
                          title="حذف المخاطبة"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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
          title="لا توجد مكاتبات مسجلة"
          description="سجل الخطابات والمذكرات الواردة والصادرة لمتابعة مواعيد الرد ومخرجاتها"
          actionText="قيد مخاطبة جديدة"
          onAction={() => setShowAddModal(true)}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={formData.id ? 'تعديل بيانات المخاطبة' : 'قيد مخاطبة رسمية جديدة'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              موضوع الخطاب أو المكاتبة <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="مثال: بشأن تفعيل منظومة الإحالة الإلكترونية بين المراكز والمستشفيات..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نوع المكاتبة
              </label>
              <select
                value={formData.letter_type}
                onChange={(e) => setFormData({ ...formData, letter_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="وارد">وارد</option>
                <option value="صادر">صادر</option>
                <option value="مذكرة عرض">مذكرة عرض</option>
                <option value="تكليف">تكليف</option>
                <option value="قرار">قرار</option>
                <option value="توجيه">توجيه</option>
                <option value="مكاتبة داخلية">مكاتبة داخلية</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                حالة المكاتبة
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="under_process">قيد المتابعة</option>
                <option value="replied">تم الرد</option>
                <option value="closed">محفوظة / منتهية</option>
                <option value="waiting_info">طلب استيفاء</option>
                <option value="transferred_to_task">تم تحويلها لمهمة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                جهة الإرسال (المصدر)
              </label>
              <input
                type="text"
                required
                value={formData.sender}
                onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                placeholder="رئاسة الهيئة / مستشفى..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                جهة الاستقبال
              </label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                رقم الخطاب الرسمي (إن وجد)
              </label>
              <input
                type="text"
                value={formData.official_letter_number || ''}
                onChange={(e) => setFormData({ ...formData, official_letter_number: e.target.value })}
                placeholder="مثال: 412/ص/2025"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ الخطاب
              </label>
              <input
                type="date"
                value={formData.letter_date || ''}
                onChange={(e) => setFormData({ ...formData, letter_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الموعد المحدد للرد
              </label>
              <input
                type="date"
                value={formData.reply_due_date || ''}
                onChange={(e) => setFormData({ ...formData, reply_due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الإجراء المطلوب
              </label>
              <input
                type="text"
                value={formData.required_action || ''}
                onChange={(e) => setFormData({ ...formData, required_action: e.target.value })}
                placeholder="مثال: إعداد إفادة عاجلة خلال 48 ساعة"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الإدارة المختصة
              </label>
              <select
                value={formData.department_id || ''}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">-- اختياري --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملخص المحتوى
            </label>
            <textarea
              rows={3}
              value={formData.summary || ''}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="ملخص النقاط الجوهرية الواردة بالخطاب..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
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
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md transition-colors"
            >
              {formData.id ? 'حفظ التعديلات' : 'حفظ المكاتبة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={`تفاصيل المكاتبة: ${selectedItem.reg_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TypeBadge type={selectedItem.letter_type} />
                <StatusBadge status={selectedItem.status} />
                <span className="font-mono text-xs text-slate-400">
                  {selectedItem.reg_number}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedItem.subject}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-1">الجهة المرسلة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.sender}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-1">الجهة المستقبلة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.recipient}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-1">الإدارة المختصة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.department_name || 'عام'}</span>
              </div>
            </div>

            {selectedItem.summary && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <span className="text-xs font-bold text-slate-400 block mb-1">الملخص:</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedItem.summary}
                </p>
              </div>
            )}

            {/* Attachments Section */}
            <EntityAttachments
              referenceType="correspondence"
              referenceId={selectedItem.id}
              departmentId={selectedItem.department_id}
              attachments={(selectedItem as any).attachments || []}
              onRefresh={() => openDetails(selectedItem.id)}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {!selectedItem.linked_task_id ? (
                  <button
                    type="button"
                    onClick={() => handleConvertToTask(selectedItem.id)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    تحويل إلى مهمة
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks?taskId=${selectedItem.linked_task_id}`)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    فتح المهمة المرتبطة
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openEditModal(selectedItem)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-xl transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  تعديل
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTargetId(selectedItem.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDelete}
        title="تأكيد حذف المكاتبة"
        message="هل أنت متأكد من حذف هذه المكاتبة نهائياً؟"
        confirmText="نعم، احذف المكاتبة"
        isDestructive={true}
      />
    </div>
  );
};
