import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { TaskFollowUp } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { toast } from '../context/ToastContext';
import {
  Clock,
  Calendar,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  PhoneCall,
  Send,
  Plus,
  History,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

export const FollowUpCenterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('today');
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedItemForFollowUp, setSelectedItemForFollowUp] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Log Form
  const [logForm, setLogForm] = useState<any>({
    follow_up_date: new Date().toISOString().split('T')[0],
    follow_up_channel: 'اتصال هاتفي',
    target_person_or_dept: '',
    outcome: '',
    reply_received: '',
    next_step: '',
    next_follow_up_date: '',
    status: 'pending',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; items: any[]; counts: Record<string, number> }>(
        `/follow-ups?category=${activeTab}`
      );
      if (res.success) {
        setItems(res.items);
        setCounts(res.counts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const openLogModal = (item: any) => {
    setSelectedItemForFollowUp(item);
    setLogForm({
      task_id: item.id,
      follow_up_date: new Date().toISOString().split('T')[0],
      follow_up_channel: 'اتصال هاتفي',
      target_person_or_dept: item.assigned_to || item.department_name || '',
      outcome: '',
      reply_received: '',
      next_step: '',
      next_follow_up_date: '',
      status: 'pending',
    });
    setShowLogModal(true);
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.target_person_or_dept || !logForm.outcome) return;

    try {
      await apiRequest('/follow-ups', {
        method: 'POST',
        body: JSON.stringify(logForm),
      });
      toast.success('تم حفظ إجراء المتابعة بنجاح');
      setShowLogModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ إجراء المتابعة');
    }
  };

  const openHistory = async (taskId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; history: any[] }>(`/follow-ups/history/${taskId}`);
      if (res.success) {
        setHistoryList(res.history);
        setShowHistoryModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const tabs = [
    { key: 'today', label: 'متابعة اليوم', count: counts.today || 0 },
    { key: 'tomorrow', label: 'متابعة غداً', count: counts.tomorrow || 0 },
    { key: 'waiting_reply', label: 'تنتظر رداً', count: counts.waiting_reply || 0 },
    { key: 'overdue', label: 'تجاوزت الموعد', count: counts.overdue || 0, alert: true },
    { key: 'waiting_approval', label: 'تنتظر اعتماداً', count: counts.waiting_approval || 0 },
    { key: 'this_week', label: 'خلال الأسبوع', count: counts.this_week || 0 },
    { key: 'suspended', label: 'أعمال معلقة', count: counts.suspended || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          مركز المتابعة الإدارية الشامل
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200">
            {counts.all || 0} موضوع نشط
          </span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          متابعة المهام والمخاطبات المعلقة، تسجيل نتائج الاتصالات، وجدولة المتابعات القادمة
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                tab.alert && tab.count > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Items List */}
      {loading ? (
        <LoadingSpinner text="جاري استرجاع مواضيع المتابعة..." />
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {item.task_number}
                  </span>
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                  {item.department_name && (
                    <span className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                      {item.department_name}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>

                {/* Last Follow-up summary */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span>المسؤول: <b className="text-slate-700 dark:text-slate-300">{item.assigned_to}</b></span>
                  {item.due_date && (
                    <span>الموعد النهائي: <b className="font-mono">{item.due_date}</b></span>
                  )}
                  {item.last_outcome && (
                    <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                      آخر نتيجة: {item.last_outcome} ({item.last_followup_date})
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openLogModal(item)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  تسجيل متابعة
                </button>

                <button
                  type="button"
                  onClick={() => openHistory(item.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  <History className="w-4 h-4" />
                  السجل الزمني
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/tasks?taskId=${item.id}`)}
                  className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-50"
                  title="فتح التفاصيل"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="لا توجد مواضيع تستلزم متابعة في هذا التصنيف حالياً" />
      )}

      {/* Record Follow-up Modal */}
      <Modal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title={`تسجيل إجراء متابعة: ${selectedItemForFollowUp?.task_number || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ المتابعة
              </label>
              <input
                type="date"
                value={logForm.follow_up_date}
                onChange={(e) => setLogForm({ ...logForm, follow_up_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وسيلة المتابعة
              </label>
              <select
                value={logForm.follow_up_channel}
                onChange={(e) => setLogForm({ ...logForm, follow_up_channel: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="اتصال هاتفي">اتصال هاتفي</option>
                <option value="مكاتبة رسمية">مكاتبة رسمية</option>
                <option value="زيارة ميدانية">زيارة ميدانية</option>
                <option value="بريد إلكتروني">بريد إلكتروني</option>
                <option value="اجتماع">اجتماع</option>
                <option value="تطبيق واتساب">تطبيق واتساب</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الشخص أو الإدارة التي تمت متابعتها <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={logForm.target_person_or_dept}
              onChange={(e) => setLogForm({ ...logForm, target_person_or_dept: e.target.value })}
              placeholder="مثال: مدير إدارة الرعاية الأولية / رئيس قسم الصيدلة..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              نتيجة المتابعة والرد المستلم <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={logForm.outcome}
              onChange={(e) => setLogForm({ ...logForm, outcome: e.target.value })}
              placeholder="ما الذي أفاد به المسؤول؟ ما هي النتيجة المحققة؟"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الخطوة القادمة
              </label>
              <input
                type="text"
                value={logForm.next_step}
                onChange={(e) => setLogForm({ ...logForm, next_step: e.target.value })}
                placeholder="مثال: استلام النسخة النهائية المعتمدة"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                موعد المتابعة التالية
              </label>
              <input
                type="date"
                value={logForm.next_follow_up_date}
                onChange={(e) => setLogForm({ ...logForm, next_follow_up_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowLogModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors"
            >
              حفظ المتابعة
            </button>
          </div>
        </form>
      </Modal>

      {/* History Timeline Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="السجل الزمني للمتابعات والإجراءات"
        maxWidth="lg"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {historyList.length > 0 ? (
            historyList.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {h.follow_up_channel} — مع: {h.target_person_or_dept}
                  </span>
                  <span className="font-mono">{h.follow_up_date}</span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 font-medium">{h.outcome}</p>
                {h.next_step && (
                  <p className="text-[11px] text-slate-500">
                    الخطوة التالية: {h.next_step} {h.next_follow_up_date ? `(بتاريخ ${h.next_follow_up_date})` : ''}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              لم تسجل متابعات سابقة لهذا الموضوع بعد
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};

