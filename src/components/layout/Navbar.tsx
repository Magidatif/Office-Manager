import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apiRequest } from '../../api/client';
import {
  Search,
  Plus,
  Sun,
  Moon,
  LogOut,
  Bell,
  Menu,
  AlertTriangle,
  Clock,
  Info,
  CheckCheck,
  Mail,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { toast } from '../../context/ToastContext';
import { QuickAddModal } from '../common/QuickAddModal';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, language, toggleLanguage } = useTheme();
  const navigate = useNavigate();

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncingMail, setSyncingMail] = useState(false);
  const [showMailSyncMenu, setShowMailSyncMenu] = useState(false);
  const [customSyncDate, setCustomSyncDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleQuickMailSync = async (silent = false, targetDate?: string) => {
    if (syncingMail) return;
    try {
      setSyncingMail(true);
      setShowMailSyncMenu(false);
      if (!silent) {
        toast.info(
          targetDate
            ? `جاري سحب الإيميلات الواردة ليوم (${targetDate})...`
            : 'جاري سحب الإيميلات الواردة على البريد الرسمي...'
        );
      }
      const res = await apiRequest<{
        success: boolean;
        fetchedCount: number;
        importedCount: number;
        skippedCount: number;
        attachmentsSavedCount: number;
      }>('/email/sync', {
        method: 'POST',
        body: JSON.stringify(targetDate ? { targetDate } : {}),
      });

      if (res.success) {
        if (res.importedCount > 0) {
          toast.success(
            targetDate
              ? `تم سحب ${res.importedCount} رسالة ليوم (${targetDate}) وتحويلها لمهام عمل!`
              : `بريد وارد: تم سحب ${res.importedCount} رسالة جديدة وتحويلها لمهام عمل!`
          );
          window.dispatchEvent(new CustomEvent('dom-refresh'));
          loadNotifications();
        } else if (!silent) {
          toast.info(
            targetDate
              ? res.fetchedCount > 0
                ? `جميع رسائل يوم (${targetDate}) البالغ عددها (${res.fetchedCount}) مسحوبة بالفعل كمهام`
                : `لا توجد رسائل واردة على البريد في يوم (${targetDate})`
              : 'البريد الرسمي محدّث — لا توجد رسائل جديدة حالياً'
          );
        }
      }
    } catch (err: any) {
      if (!silent) toast.error(err.message || 'تعذر سحب البريد الإلكتروني');
    } finally {
      setSyncingMail(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await apiRequest<{ success: boolean; notifications: any[]; unreadCount: number }>(
        '/settings/notifications'
      );
      if (res.success) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      }
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    // Auto-sync official email inbox every 5 minutes in the background
    const mailInterval = setInterval(() => handleQuickMailSync(true), 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      clearInterval(mailInterval);
    };
  }, []);

  // Global Ctrl+K / Cmd+K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/settings/notifications/mark-read', { method: 'POST' });
      loadNotifications();
    } catch (e) {}
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 shadow-xs transition-colors no-print">
        {/* Left: Mobile hamburger & Global Search Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Trigger */}
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm hover:border-slate-300 transition-all w-48 sm:w-72 shadow-2xs"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-normal">بحث سريع... (Ctrl + K)</span>
            <kbd className="hidden sm:inline-block mr-auto px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Quick Add, Notifications, Theme, Language, Profile */}
        <div className="flex items-center gap-2">
          {/* Official Email Sync Button & Date Picker Popover */}
          <div className="relative">
            <div className="flex items-center rounded-xl bg-sky-600 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => handleQuickMailSync(false)}
                disabled={syncingMail}
                title="سحب أحدث الإيميلات الواردة على technicaloffice.luxor@eha.gov.eg كمهام"
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingMail ? 'animate-spin' : ''}`} />
                <Mail className="w-3.5 h-3.5 hidden sm:inline" />
                <span className="hidden md:inline">
                  {syncingMail ? 'جاري السحب...' : 'سحب البريد'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowMailSyncMenu((prev) => !prev)}
                disabled={syncingMail}
                title="تحديد يوم معين لسحب إيميلاته"
                className="px-2 py-1.5 border-r border-sky-500/60 hover:bg-sky-700 disabled:opacity-60 text-white text-xs transition-all flex items-center"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
            </div>

            {showMailSyncMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMailSyncMenu(false)} />
                <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 z-50 p-3.5 text-right space-y-3">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    <span>سحب الإيميلات حسب اليوم</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setCustomSyncDate(today);
                        handleQuickMailSync(false, today);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-bold transition-colors"
                    >
                      إيميلات اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        const yesterday = d.toISOString().split('T')[0];
                        setCustomSyncDate(yesterday);
                        handleQuickMailSync(false, yesterday);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                    >
                      إيميلات أمس
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      أو اختر تاريخ يوم محدد:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={customSyncDate}
                        onChange={(e) => setCustomSyncDate(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickMailSync(false, customSyncDate)}
                        disabled={!customSyncDate}
                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shrink-0"
                      >
                        سحب اليوم
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickMailSync(false)}
                    className="w-full py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-colors"
                  >
                    سحب أحدث الرسائل (بدون تحديد يوم)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick Add Button */}
          <button
            type="button"
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">إضافة سريعة</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                if (!showNotifMenu) loadNotifications();
              }}
              className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="التنبيهات والإشعارات"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifMenu(false)} />
                <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 z-50 text-right overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      التنبيهات الإدارية ({notifications.length})
                    </span>
                    {notifications.some((n) => !String(n.id).startsWith('live-') && !n.is_read) && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        تعليم الكل كمقروء
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setShowNotifMenu(false);
                            if (n.link_url) navigate(n.link_url);
                          }}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex items-start gap-2.5"
                        >
                          <div className="mt-0.5 shrink-0">
                            {n.type === 'urgent' ? (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            ) : n.type === 'warning' ? (
                              <Clock className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Info className="w-4 h-4 text-sky-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                              {n.message}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400">
                        لا توجد تنبيهات عاجلة حالياً
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="تغيير المظهر"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-bold"
            title="تغيير اللغة"
          >
            {language === 'ar' ? 'EN' : 'عربي'}
          </button>

          {/* User Profile dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                {user?.full_name ? user.full_name.charAt(0) : 'م'}
              </div>
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.full_name || 'المستخدم الإداري'}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {user?.job_title || 'المكتب الفني'}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 text-right">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {user?.full_name}
                    </p>
                    <p className="text-[11px] text-slate-400">{user?.job_title}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {user?.role === 'admin' ? 'مدير النظام' : 'عضو مكتب'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent('dom-refresh'));
          loadNotifications();
        }}
      />
      <GlobalSearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
};
