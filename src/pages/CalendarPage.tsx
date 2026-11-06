import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Task, Meeting } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { toast } from '../context/ToastContext';
import {
  ChevronRight,
  ChevronLeft,
  Bell,
  CalendarCheck,
  CheckSquare,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const navigate = useNavigate();

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const [tRes, mRes] = await Promise.all([
        apiRequest<{ success: boolean; tasks: Task[] }>('/tasks?limit=100'),
        apiRequest<{ success: boolean; meetings: Meeting[] }>('/meetings'),
      ]);
      if (tRes.success) setTasks(tRes.tasks);
      if (mRes.success) setMeetings(mRes.meetings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
    const handleRefresh = () => loadCalendarData();
    window.addEventListener('dom-refresh', handleRefresh);
    return () => window.removeEventListener('dom-refresh', handleRefresh);
  }, []);

  const requestNotification = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        toast.success('تم تفعيل إشعارات المتصفح بنجاح');
        new Notification('Daily Office Manager', {
          body: 'تم تفعيل التنبيهات المحلية بنجاح داخل النظام.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  // Helper date functions
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month - 1, 1));
    else if (viewMode === 'week') setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getTime() - 86400000));
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month + 1, 1));
    else if (viewMode === 'week') setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getTime() + 86400000));
  };

  const goToToday = () => setCurrentDate(new Date());

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const getEventsForDate = (dateStr: string) => {
    const dayTasks = tasks.filter((t) => t.due_date === dateStr);
    const dayMeetings = meetings.filter((m) => m.meeting_date === dateStr);
    return { dayTasks, dayMeetings };
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Week days calculation
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + idx);
      return d.toISOString().split('T')[0];
    });
  };

  const selectedDateStr = currentDate.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            التقويم الإداري والمواعيد
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold border border-indigo-200">
              توقيت القاهرة (Africa/Cairo)
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            جدولة مواعيد استحقاق المهام، الاجتماعات الدورية، ومواعيد المتابعة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {notificationPermission !== 'granted' && (
            <button
              onClick={requestNotification}
              className="px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5"
            >
              <Bell className="w-4 h-4" />
              تفعيل إشعارات المتصفح
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              شهري
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              أسبوعي
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              يومي
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={goToToday}
              className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              اليوم
            </button>
            <button
              onClick={navigatePrev}
              className="p-1 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-900 dark:text-slate-100">
              {viewMode === 'day'
                ? selectedDateStr
                : `${monthNamesArabic[month]} ${year}`}
            </span>
            <button
              onClick={navigateNext}
              className="p-1 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Body */}
      {loading ? (
        <LoadingSpinner text="جاري تجهيز التقويم الإداري..." />
      ) : viewMode === 'month' ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center text-xs font-bold text-slate-500 py-3">
            {dayNamesArabic.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[115px] bg-slate-50/30 dark:bg-slate-950/20 p-2" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const { dayTasks, dayMeetings } = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dayNum}
                  className={`min-h-[115px] p-2 transition-colors flex flex-col justify-between group ${
                    isToday
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-2 border-emerald-500/40'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      onClick={() => {
                        setCurrentDate(new Date(dateStr));
                        setViewMode('day');
                      }}
                      className={`cursor-pointer text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/meetings?date=${dateStr}`)}
                      title="إضافة اجتماع في هذا اليوم"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-purple-600 rounded transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Events */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px]">
                    {dayMeetings.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => navigate(`/meetings?meetId=${m.id}`)}
                        className="px-2 py-1 rounded bg-purple-100/70 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] font-bold truncate cursor-pointer hover:opacity-90 flex items-center gap-1"
                        title={m.title}
                      >
                        <CalendarCheck className="w-3 h-3 shrink-0" />
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}

                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => navigate(`/tasks?taskId=${t.id}`)}
                        className={`px-2 py-1 rounded text-[10px] font-bold truncate cursor-pointer hover:opacity-90 flex items-center gap-1 ${
                          t.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : t.priority === 'urgent_critical'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                        title={t.title}
                      >
                        <CheckSquare className="w-3 h-3 shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* Week View */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {getWeekDays().map((dateStr, idx) => {
            const { dayTasks, dayMeetings } = getEventsForDate(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={`p-3.5 rounded-2xl border bg-white dark:bg-slate-900 min-h-[260px] flex flex-col justify-between ${
                  isToday
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {dayNamesArabic[idx]}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{dateStr.slice(5)}</span>
                  </div>

                  <div className="space-y-2">
                    {dayMeetings.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => navigate(`/meetings?meetId=${m.id}`)}
                        className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-xs cursor-pointer"
                      >
                        <div className="font-bold text-purple-800 dark:text-purple-300">{m.title}</div>
                        <div className="text-[10px] text-purple-600 mt-0.5">{m.meeting_time}</div>
                      </div>
                    ))}
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => navigate(`/tasks?taskId=${t.id}`)}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                      >
                        <div className="font-bold text-slate-800 dark:text-slate-200">{t.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.task_number}</div>
                      </div>
                    ))}
                    {dayMeetings.length === 0 && dayTasks.length === 0 && (
                      <p className="text-[11px] text-slate-400 text-center py-8">لا توجد التزامات</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/meetings?date=${dateStr}`)}
                  className="mt-3 w-full py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  إضافة موعد
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Day View */
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                أجندة يوم {dayNamesArabic[currentDate.getDay()]} — {selectedDateStr}
              </h3>
              <p className="text-xs text-slate-500">جميع الاجتماعات والمهام المستحقة في هذا التاريخ</p>
            </div>
            <button
              onClick={() => navigate(`/meetings?date=${selectedDateStr}`)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              توثيق اجتماع بهذا اليوم
            </button>
          </div>

          {(() => {
            const { dayTasks, dayMeetings } = getEventsForDate(selectedDateStr);
            if (dayTasks.length === 0 && dayMeetings.length === 0) {
              return (
                <p className="text-center text-xs text-slate-400 py-12">
                  لا توجد اجتماعات أو مهام مسجلة بتاريخ {selectedDateStr}
                </p>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-purple-700">الاجتماعات ({dayMeetings.length})</h4>
                  {dayMeetings.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => navigate(`/meetings?meetId=${m.id}`)}
                      className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 dark:bg-purple-950/20 cursor-pointer"
                    >
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{m.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        الوقت: {m.meeting_time} | المكان: {m.location}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-700">المهام المستحقة ({dayTasks.length})</h4>
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/tasks?taskId=${t.id}`)}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer"
                    >
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {t.task_number} — {t.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        المسؤول: {t.assigned_to} | الإنجاز: {t.progress}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
