import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Meeting, MeetingDecision } from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EntityAttachments } from '../components/common/EntityAttachments';
import { StatusBadge } from '../components/common/Badge';
import { toast } from '../context/ToastContext';
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  Trash2,
  Edit,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const MeetingsPage: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recommendations, setRecommendations] = useState<MeetingDecision[]>([]);
  const [viewTab, setViewTab] = useState<'meetings' | 'recommendations'>('meetings');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    id: undefined,
    title: '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '10:00',
    location: 'قاعة الاجتماعات الكبرى بالفرع',
    chairman: 'مدير الفرع',
    attendees: '',
    agenda: '',
    summary_of_discussions: '',
    decisions: [
      { item_type: 'قرار', content: '', assigned_to_dept: '', due_date: '' },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [meetsRes, recsRes] = await Promise.all([
        apiRequest<{ success: boolean; meetings: Meeting[] }>('/meetings'),
        apiRequest<{ success: boolean; recommendations: MeetingDecision[] }>('/meetings/recommendations'),
      ]);

      if (meetsRes.success) setMeetings(meetsRes.meetings);
      if (recsRes.success) setRecommendations(recsRes.recommendations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openMeetingDetails = async (id: string) => {
    try {
      const res = await apiRequest<{ success: boolean; meeting: Meeting }>(`/meetings/${id}`);
      if (res.success) {
        setSelectedMeeting(res.meeting);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    const meetId = searchParams.get('meetId');
    const dateParam = searchParams.get('date');
    if (meetId) {
      openMeetingDetails(meetId);
    } else if (dateParam) {
      setFormData((prev: any) => ({ ...prev, id: undefined, meeting_date: dateParam }));
      setShowAddModal(true);
    }
  }, [searchParams]);

  const openEditModal = async (meet: Meeting, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await apiRequest<{ success: boolean; meeting: Meeting }>(`/meetings/${meet.id}`);
      const fullMeet = res.success ? res.meeting : meet;
      setFormData({
        id: fullMeet.id,
        title: fullMeet.title || '',
        meeting_date: fullMeet.meeting_date || new Date().toISOString().split('T')[0],
        meeting_time: fullMeet.meeting_time || '10:00',
        location: fullMeet.location || 'قاعة الاجتماعات الكبرى بالفرع',
        chairman: fullMeet.chairman || 'مدير الفرع',
        attendees: fullMeet.attendees || '',
        agenda: fullMeet.agenda || '',
        summary_of_discussions: fullMeet.summary_of_discussions || '',
        decisions:
          fullMeet.decisions && fullMeet.decisions.length > 0
            ? fullMeet.decisions.map((d) => ({
                id: d.id,
                item_type: d.item_type || 'قرار',
                content: d.content || '',
                assigned_to_dept: d.assigned_to_dept || '',
                due_date: d.due_date || '',
                status: d.status,
              }))
            : [{ item_type: 'قرار', content: '', assigned_to_dept: '', due_date: '' }],
      });
      setSelectedMeeting(null);
      setShowAddModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (formData.id) {
        await apiRequest(`/meetings/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('تم تحديث بيانات الاجتماع والقرارات بنجاح');
      } else {
        await apiRequest('/meetings', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        toast.success('تم توثيق الاجتماع بنجاح');
      }
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    }
  };

  const handleConvertDecisionToTask = async (decisionId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; taskId: string; task_number: string }>(
        `/meetings/decisions/${decisionId}/convert-to-task`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.success(`تم تحويل التوصية بنجاح إلى المهمة رقم: ${res.task_number}`);
        loadData();
        if (selectedMeeting) openMeetingDetails(selectedMeeting.id);
        navigate(`/tasks?taskId=${res.taskId}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل تحويل التوصية لمهمة');
    }
  };

  const handleToggleDecisionStatus = async (decisionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await apiRequest(`/meetings/decisions/${decisionId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(newStatus === 'completed' ? 'تم تعليم القرار كمكتمل' : 'تم إعادة القرار لقيد التنفيذ');
      loadData();
      if (selectedMeeting) openMeetingDetails(selectedMeeting.id);
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث الحالة');
    }
  };

  const confirmDeleteMeeting = async () => {
    if (!deleteTargetId) return;
    try {
      await apiRequest(`/meetings/${deleteTargetId}`, { method: 'DELETE' });
      toast.success('تم حذف الاجتماع بنجاح');
      if (selectedMeeting?.id === deleteTargetId) setSelectedMeeting(null);
      setDeleteTargetId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف الاجتماع');
    }
  };

  const addDecisionRow = () => {
    setFormData({
      ...formData,
      decisions: [
        ...formData.decisions,
        { item_type: 'توصية', content: '', assigned_to_dept: '', due_date: '' },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            توثيق الاجتماعات ومتابعة القرارات والتوصيات
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold border border-purple-200">
              {meetings.length} اجتماع
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            محاضر الجلسات، لجان التسيير، وقرارات الإدارة العليا القابلة للتحويل إلى مهام فورية
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              id: undefined,
              title: '',
              meeting_date: new Date().toISOString().split('T')[0],
              meeting_time: '10:00',
              location: 'قاعة الاجتماعات الكبرى بالفرع',
              chairman: 'مدير الفرع',
              attendees: '',
              agenda: '',
              summary_of_discussions: '',
              decisions: [
                { item_type: 'قرار', content: '', assigned_to_dept: '', due_date: '' },
              ],
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          توثيق اجتماع جديد
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setViewTab('meetings')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            viewTab === 'meetings'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          سجل الاجتماعات
        </button>
        <button
          onClick={() => setViewTab('recommendations')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            viewTab === 'recommendations'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          متابعة تنفيذ القرارات والتوصيات ({recommendations.length})
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="جاري استرجاع سجلات الاجتماعات..." />
      ) : viewTab === 'meetings' ? (
        meetings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {meetings.map((meet) => (
              <div
                key={meet.id}
                onClick={() => openMeetingDetails(meet.id)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-mono text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {meet.meeting_date} | {meet.meeting_time || '10:00'}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {meet.location}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors mb-2">
                    {meet.title}
                  </h3>

                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                    برئاسة: {meet.chairman}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-purple-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    عرض المحضر والقرارات
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => openEditModal(meet, e)}
                      title="تعديل الاجتماع"
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(meet.id);
                      }}
                      title="حذف الاجتماع"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="لا توجد اجتماعات مسجلة"
            description="وثق اجتماعات مجلس إدارة الفرع واللجان الفنية لمتابعة توصياتها"
            actionText="توثيق اجتماع جديد"
            onAction={() => setShowAddModal(true)}
          />
        )
      ) : (
        /* Recommendations Tab */
        recommendations.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">النوع</th>
                    <th className="py-3 px-4 font-bold">نص القرار أو التوصية</th>
                    <th className="py-3 px-4 font-bold">الاجتماع المنبثق عنه</th>
                    <th className="py-3 px-4 font-bold">الجهة المكلفة</th>
                    <th className="py-3 px-4 font-bold">الموعد النهائي</th>
                    <th className="py-3 px-4 font-bold">الحالة</th>
                    <th className="py-3 px-4 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recommendations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-bold text-purple-700">
                        {rec.item_type}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-sm">
                        {rec.content}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {(rec as any).meeting_title}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {rec.assigned_to_dept || rec.assigned_to_person || 'المكتب الفني'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {rec.due_date || 'غير محدد'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={rec.status} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleDecisionStatus(rec.id, rec.status)}
                            title={rec.status === 'completed' ? 'إعادة لقيد المتابعة' : 'تعليم كمكتمل'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              rec.status === 'completed'
                                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          {!rec.linked_task_id ? (
                            <button
                              onClick={() => handleConvertDecisionToTask(rec.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-[11px] transition-colors flex items-center gap-1"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              تحويل لمهمة
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/tasks?taskId=${rec.linked_task_id}`)}
                              className="px-2 py-1 text-slate-500 hover:text-emerald-600 font-bold text-[11px] flex items-center gap-1"
                            >
                              {(rec as any).linked_task_number || 'فتح المهمة'}
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState title="لا توجد قرارات أو توصيات مسجلة حالياً" />
        )
      )}

      {/* Add/Edit Meeting Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={formData.id ? 'تعديل بيانات الاجتماع والقرارات' : 'توثيق اجتماع جديد وإدراج القرارات'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان أو موضوع الاجتماع <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="مثال: اجتماع مناقشة خطة تلافي ملاحظات هيئة الاعتماد والرقابة الصحية..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ الاجتماع
              </label>
              <input
                type="date"
                value={formData.meeting_date}
                onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الوقت
              </label>
              <input
                type="time"
                value={formData.meeting_time}
                onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                مكان الانعقاد
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                رئيس الاجتماع
              </label>
              <input
                type="text"
                value={formData.chairman}
                onChange={(e) => setFormData({ ...formData, chairman: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الحضور
              </label>
              <input
                type="text"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder="أسماء الإدارات أو المسؤولين المشاركين..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              جدول الأعمال والمناقشات
            </label>
            <textarea
              rows={3}
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              placeholder="بنود جدول الأعمال والملخص العام للمناقشات..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {/* Decisions */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                القرارات والتوصيات الصادرة
              </span>
              <button
                type="button"
                onClick={addDecisionRow}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                + إضافة بند
              </button>
            </div>

            {formData.decisions.map((dec: any, idx: number) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={dec.item_type}
                    onChange={(e) => {
                      const updated = [...formData.decisions];
                      updated[idx].item_type = e.target.value;
                      setFormData({ ...formData, decisions: updated });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="قرار">قرار</option>
                    <option value="توصية">توصية</option>
                    <option value="تكليف">تكليف</option>
                  </select>

                  <input
                    type="text"
                    placeholder="الجهة المكلفة..."
                    value={dec.assigned_to_dept}
                    onChange={(e) => {
                      const updated = [...formData.decisions];
                      updated[idx].assigned_to_dept = e.target.value;
                      setFormData({ ...formData, decisions: updated });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />

                  <input
                    type="date"
                    value={dec.due_date}
                    onChange={(e) => {
                      const updated = [...formData.decisions];
                      updated[idx].due_date = e.target.value;
                      setFormData({ ...formData, decisions: updated });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="نص القرار أو التوصية..."
                    value={dec.content}
                    onChange={(e) => {
                      const updated = [...formData.decisions];
                      updated[idx].content = e.target.value;
                      setFormData({ ...formData, decisions: updated });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                  {formData.decisions.length > 1 && (
                    <button
                      type="button"
                      title="حذف هذا البند"
                      onClick={() => {
                        const updated = formData.decisions.filter((_: any, i: number) => i !== idx);
                        setFormData({ ...formData, decisions: updated });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-colors"
            >
              {formData.id ? 'حفظ التعديلات' : 'حفظ وتوثيق الاجتماع'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <Modal
          isOpen={!!selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          title={`محضر اجتماع: ${selectedMeeting.title}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-0.5">التاريخ:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMeeting.meeting_date}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-0.5">الوقت:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMeeting.meeting_time}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-0.5">المكان:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMeeting.location}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block mb-0.5">الرئيس:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMeeting.chairman}</span>
              </div>
            </div>

            {selectedMeeting.attendees && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="text-slate-400 block font-bold mb-1">الحضور:</span>
                <span className="text-slate-800 dark:text-slate-200">{selectedMeeting.attendees}</span>
              </div>
            )}

            {selectedMeeting.agenda && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="text-slate-400 block font-bold mb-1">جدول الأعمال والمناقشات:</span>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedMeeting.agenda}
                </p>
              </div>
            )}

            {/* Decisions List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400">
                القرارات والتوصيات الصادرة ({selectedMeeting.decisions?.length || 0}):
              </h4>
              {selectedMeeting.decisions && selectedMeeting.decisions.length > 0 ? (
                selectedMeeting.decisions.map((dec) => (
                  <div
                    key={dec.id}
                    className="p-3 rounded-xl border border-purple-100 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-900 ml-2">
                        {dec.item_type}
                      </span>
                      <span
                        className={`font-bold ${
                          dec.status === 'completed'
                            ? 'line-through text-slate-400'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {dec.content}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        الجهة المكلفة: {dec.assigned_to_dept || 'المكتب الفني'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleDecisionStatus(dec.id, dec.status)}
                        className={`px-2 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 border transition-colors ${
                          dec.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {dec.status === 'completed' ? 'مكتمل' : 'تم التنفيذ؟'}
                      </button>

                      {!dec.linked_task_id ? (
                        <button
                          onClick={() => handleConvertDecisionToTask(dec.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          تحويل لمهمة
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/tasks?taskId=${dec.linked_task_id}`)}
                          className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          المهمة المرتبطة
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">لا توجد قرارات مدونة</p>
              )}
            </div>

            {/* Attachments */}
            <EntityAttachments
              referenceType="meeting"
              referenceId={selectedMeeting.id}
              attachments={(selectedMeeting as any).attachments || []}
              onRefresh={() => openMeetingDetails(selectedMeeting.id)}
            />

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedMeeting)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  تعديل الاجتماع
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(selectedMeeting.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف الاجتماع
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMeeting(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
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
        onConfirm={confirmDeleteMeeting}
        title="تأكيد حذف الاجتماع"
        message="هل أنت متأكد من حذف هذا الاجتماع وجميع قراراته المرتبطة به؟"
        confirmText="نعم، احذف الاجتماع"
        isDestructive={true}
      />
    </div>
  );
};
