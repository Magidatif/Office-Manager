import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { DashboardStats, Task } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Flame,
  MessageSquare,
  Calendar,
  TrendingUp,
  Mail,
  ChevronLeft,
  CalendarCheck,
  CheckCircle2,
  Hourglass,
  ArrowUpRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; stats: DashboardStats }>('/dashboard/stats');
      if (res.success) {
        setData(res.stats);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const handleRefresh = () => loadStats();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  if (loading) return <LoadingSpinner text="جاري تجهيز مؤشرات وإحصاءات العمل..." />;
  if (error || !data) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200">
        <p className="font-bold">{error || 'حدث خطأ أثناء تحميل البيانات'}</p>
        <button
          onClick={loadStats}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // 10 Stat Cards definition
  const statCards = [
    { title: 'إجمالي المهام', value: data.totalTasks, icon: CheckSquare, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200', link: '/tasks' },
    { title: 'مهام اليوم', value: data.todayTasks, icon: Calendar, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200', link: '/tasks?today=1' },
    { title: 'قيد التنفيذ', value: data.inProgressTasks, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200', link: '/tasks?status=in_progress' },
    { title: 'المهام المكتملة', value: data.completedTasks, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200', link: '/tasks?status=completed' },
    { title: 'المهام المتأخرة', value: data.overdueTasks, icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200', link: '/tasks?overdue=1', highlight: data.overdueTasks > 0 },
    { title: 'المهام العاجلة', value: data.urgentTasks, icon: Flame, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200', link: '/tasks?priority=urgent_critical', highlight: data.urgentTasks > 0 },
    { title: 'في انتظار رد', value: data.waitingReplyTasks, icon: MessageSquare, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200', link: '/tasks?status=waiting_reply' },
    { title: 'مستحقة غداً', value: data.dueTomorrowTasks, icon: Hourglass, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200', link: '/follow-up?tab=tomorrow' },
    { title: 'نسبة إنجاز الأسبوع', value: `${data.weeklyCompletionRate}%`, icon: TrendingUp, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200', link: '/reports?type=weekly' },
    { title: 'مخاطبات قيد المتابعة', value: data.activeCorrespondences, icon: Mail, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200', link: '/correspondences' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white shadow-lg">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-emerald-200 mb-2">
            لوحة المتابعة والمؤشرات الإدارية
          </span>
          <h2 className="text-xl sm:text-2xl font-black">
            المكتب الفني لمدير الفرع — الهيئة العامة للرعاية الصحية
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
            متابعة حية للمهام والتكليفات الوزارية والمخاطبات الرسمية والاجتماعات الدورية
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/daily-log')}
            className="px-4 py-2 bg-white text-emerald-900 font-bold text-xs sm:text-sm rounded-xl shadow-md hover:bg-emerald-50 transition-all flex items-center gap-2 shrink-0"
          >
            سجل أعمال اليوم
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 10 Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(card.link)}
              className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition-all cursor-pointer relative overflow-hidden group ${
                card.highlight ? 'border-red-300 dark:border-red-800/80 ring-2 ring-red-500/10' : 'border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status Chart */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              توزيع المهام حسب حالة التنفيذ
            </h3>
            <span className="text-xs text-slate-400">بيانات D1 اللحظية</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            {data.tasksByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.tasksByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {data.tasksByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} مهمة`, name]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">لا توجد مهام مسجلة حالياً</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {data.tasksByStatus.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks by Priority Chart */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              توزيع المهام النشطة حسب الأولوية
            </h3>
            <span className="text-xs text-slate-400">تصنيف الأهمية</span>
          </div>
          <div className="h-64">
            {data.tasksByPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tasksByPriority} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(val) => [`${val} مهمة`, 'العدد']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {data.tasksByPriority.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 text-center pt-24">لا توجد بيانات للأولويات</p>
            )}
          </div>
        </div>
      </div>

      {/* Actionable Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Urgent Tasks */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                أهم المهام العاجلة الواجب متابعتها اليوم
              </h3>
            </div>
            <button
              onClick={() => navigate('/tasks?priority=urgent_critical')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {data.urgentTasksList.length > 0 ? (
              data.urgentTasksList.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks?taskId=${task.id}`)}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {task.task_number}
                      </span>
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      جهة التكليف: {task.assigned_by} | المسؤول: {task.assigned_to}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {task.due_date && (
                      <span className="text-xs font-medium text-slate-500 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        الاستحقاق: {task.due_date}
                      </span>
                    )}
                    <span className="text-xs font-bold text-emerald-600">
                      {task.progress}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">
                ممتاز! لا توجد مهام عاجلة متأخرة حالياً
              </p>
            )}
          </div>
        </div>

        {/* Today Meetings & Waiting Reply */}
        <div className="space-y-6">
          {/* Today Meetings */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  اجتماعات اليوم
                </h3>
              </div>
              <button
                onClick={() => navigate('/meetings')}
                className="text-xs font-bold text-emerald-600"
              >
                جدول الاجتماعات
              </button>
            </div>

            {data.todayMeetings.length > 0 ? (
              data.todayMeetings.map((meet) => (
                <div
                  key={meet.id}
                  onClick={() => navigate(`/meetings?meetId=${meet.id}`)}
                  className="p-3 rounded-xl border border-purple-100 dark:border-purple-950 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/50 cursor-pointer transition-all mb-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                      {meet.meeting_time || '10:00'}
                    </span>
                    <span className="text-[11px] text-slate-500">{meet.location}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {meet.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">برئاسة: {meet.chairman}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                لا توجد اجتماعات مقررة اليوم
              </p>
            )}
          </div>

          {/* Tasks Waiting for Reply / Approval */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  تنتظر موافقة أو رداً
                </h3>
              </div>
              <button
                onClick={() => navigate('/follow-up?tab=waiting_reply')}
                className="text-xs font-bold text-emerald-600"
              >
                مركز المتابعة
              </button>
            </div>

            <div className="space-y-2">
              {data.waitingApprovalTasks.length > 0 ? (
                data.waitingApprovalTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks?taskId=${task.id}`)}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 hover:bg-slate-100/60 dark:bg-slate-800/30 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                        {task.title}
                      </span>
                      <StatusBadge status={task.status} />
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {task.department_name || task.assigned_by}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  لا توجد مهام معلقة في انتظار الرد
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

