import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { apiRequest } from '../../api/client';
import { toast } from '../../context/ToastContext';
import { CheckSquare, Award, Mail, Calendar, Sparkles } from 'lucide-react';
import { Department, User } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultTab?: 'task' | 'achievement' | 'correspondence';
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = 'task',
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'task' | 'achievement' | 'correspondence'>('task');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  // Task fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDeptId, setTaskDeptId] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');

  // Achievement fields
  const [achieveDesc, setAchieveDesc] = useState('');
  const [achieveType, setAchieveType] = useState('إنجاز سريع');
  const [achieveResults, setAchieveResults] = useState('');

  // Correspondence fields
  const [corrSubject, setCorrSubject] = useState('');
  const [corrType, setCorrType] = useState('وارد');
  const [corrSender, setCorrSender] = useState('');
  const [corrOfficialNumber, setCorrOfficialNumber] = useState('');

  useEffect(() => {
    setActiveTab(defaultTab);
    if (isOpen) {
      setTaskAssignedTo(user?.full_name || '');
      apiRequest<{ success: boolean; departments: Department[] }>('/departments')
        .then((res) => {
          if (res.success) setDepartments(res.departments);
        })
        .catch(console.error);
      apiRequest<{ success: boolean; users: User[] }>('/settings/users')
        .then((res) => {
          if (res.success && res.users) setTeamUsers(res.users);
        })
        .catch(() => {});
    }
  }, [isOpen, defaultTab, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'task') {
        if (!taskTitle.trim()) return;
        await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: taskTitle.trim(),
            priority: taskPriority,
            due_date: taskDueDate || null,
            department_id: taskDeptId || null,
            assigned_to: taskAssignedTo.trim() || user?.full_name || 'عضو المكتب الفني',
          }),
        });
        setTaskTitle('');
        setTaskDueDate('');
        toast.success('تم إضافة المهمة بنجاح');
      } else if (activeTab === 'achievement') {
        if (!achieveDesc.trim()) return;
        await apiRequest('/daily-logs', {
          method: 'POST',
          body: JSON.stringify({
            description: achieveDesc.trim(),
            activity_type: achieveType,
            results: achieveResults.trim() || null,
            is_completed: 1,
          }),
        });
        setAchieveDesc('');
        setAchieveResults('');
        toast.success('تم تسجيل الإنجاز في سجل أعمال اليوم');
      } else if (activeTab === 'correspondence') {
        if (!corrSubject.trim()) return;
        await apiRequest('/correspondences', {
          method: 'POST',
          body: JSON.stringify({
            subject: corrSubject.trim(),
            letter_type: corrType,
            sender: corrSender.trim() || 'جهة خارجية',
            official_letter_number: corrOfficialNumber.trim() || null,
          }),
        });
        setCorrSubject('');
        setCorrSender('');
        setCorrOfficialNumber('');
        toast.success('تم قيد المخاطبة بنجاح');
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'فشلت العملية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة سريعة لنظام العمل" maxWidth="lg">
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 -mt-2">
        <button
          type="button"
          onClick={() => setActiveTab('task')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'task'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          مهمة جديدة
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('achievement')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'achievement'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Award className="w-4 h-4" />
          إنجاز سريع
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('correspondence')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'correspondence'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Mail className="w-4 h-4" />
          قيد مكاتبة
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === 'task' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                عنوان المهمة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="مثال: مراجعة خطة النوبتجيات واعتمادها..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الأولوية
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="urgent_critical">عاجل جداً</option>
                  <option value="high">مرتفع</option>
                  <option value="medium">متوسط</option>
                  <option value="low">منخفض</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الموعد النهائي
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المسؤول عن التنفيذ (عضو المكتب الفني)
                </label>
                <input
                  type="text"
                  list="quick-team-users-list"
                  value={taskAssignedTo}
                  onChange={(e) => setTaskAssignedTo(e.target.value)}
                  placeholder="اختر عضو المكتب الفني..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <datalist id="quick-team-users-list">
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.full_name}>
                      {u.job_title}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الإدارة المعنية
                </label>
                <select
                  value={taskDeptId}
                  onChange={(e) => setTaskDeptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
          </>
        )}

        {activeTab === 'achievement' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وصف الإنجاز أو العمل المنجز <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={achieveDesc}
                onChange={(e) => setAchieveDesc(e.target.value)}
                placeholder="ما الذي تم إنجازه الآن؟ مثال: تم الانتهاء من إعداد بيان الاحتياجات العاجلة..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نوع النشاط
                </label>
                <select
                  value={achieveType}
                  onChange={(e) => setAchieveType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="إنجاز سريع">إنجاز سريع</option>
                  <option value="صياغة مذكرة">صياغة مذكرة</option>
                  <option value="فحص موضوع">فحص موضوع</option>
                  <option value="متابعة تليفونية">متابعة تليفونية</option>
                  <option value="اجتماع تنسيقي">اجتماع تنسيقي</option>
                  <option value="إعداد إحصائية">إعداد إحصائية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  النتيجة أو المخرجات
                </label>
                <input
                  type="text"
                  value={achieveResults}
                  onChange={(e) => setAchieveResults(e.target.value)}
                  placeholder="مثال: جاهز للعرض على مدير الفرع"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'correspondence' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                موضوع المكاتبة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={corrSubject}
                onChange={(e) => setCorrSubject(e.target.value)}
                placeholder="موضوع الخطاب أو المذكرة..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  النوع
                </label>
                <select
                  value={corrType}
                  onChange={(e) => setCorrType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="وارد">وارد</option>
                  <option value="صادر">صادر</option>
                  <option value="مذكرة عرض">مذكرة عرض</option>
                  <option value="تكليف">تكليف</option>
                  <option value="قرار">قرار</option>
                  <option value="مكاتبة داخلية">مكاتبة داخلية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  جهة الإرسال
                </label>
                <input
                  type="text"
                  value={corrSender}
                  onChange={(e) => setCorrSender(e.target.value)}
                  placeholder="مثال: رئاسة الهيئة / مستشفى..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                رقم الخطاب الرسمي (إن وجد)
              </label>
              <input
                type="text"
                value={corrOfficialNumber}
                onChange={(e) => setCorrOfficialNumber(e.target.value)}
                placeholder="مثال: 541/ص/2025"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            {loading ? (
              'جاري الحفظ...'
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                حفظ فوري
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

