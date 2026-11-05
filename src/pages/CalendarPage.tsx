import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Task, Meeting } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Clock,
  Bell,
  CheckCircle2,
  CalendarCheck,
  CheckSquare,
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
  }, []);

  const requestNotification = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
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

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const getEventsForDate = (dateStr: string) => {
    const dayTasks = tasks.filter((t) => t.due_date === dateStr);
    const dayMeetings = meetings.filter((m) => m.meeting_date === dateStr);
    return { dayTasks, dayMeetings };
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
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

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={goToToday}
              className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              اليوم
            </button>
            <button
              onClick={prevMonth}
              className="p-1 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-900 dark:text-slate-100">
              {monthNamesArabic[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <LoadingSpinner text="جاري تجهيز التقويم الإداري..." />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center text-xs font-bold text-slate-500 py-3">
            <div>الأحد</div>
            <div>الإثنين</div>
            <div>الثلاثاء</div>
            <div>الأربعاء</div>
            <div>الخميس</div>
            <div>الجمعة</div>
            <div>السبت</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {/* Blank padding days for start of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/30 dark:bg-slate-950/20 p-2" />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const { dayTasks, dayMeetings } = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dayNum}
                  className={`min-h-[110px] p-2 transition-colors flex flex-col justify-between ${
                    isToday
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-2 border-emerald-500/40'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {(dayTasks.length > 0 || dayMeetings.length > 0) && (
                      <span className="text-[10px] font-bold text-slate-400">
                        {dayTasks.length + dayMeetings.length} بنود
                      </span>
                    )}
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
      )}
    </div>
  );
};

