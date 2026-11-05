import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  ClipboardList,
  Mail,
  Calendar,
  Clock,
  Compass,
  FileText,
  BarChart3,
  Settings,
  X,
  Building2,
  BookmarkCheck,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
    { to: '/tasks', label: 'إدارة المهام اليومية', icon: CheckSquare },
    { to: '/daily-log', label: 'سجل الأعمال اليومية', icon: ClipboardList },
    { to: '/correspondences', label: 'المخاطبات والمراسلات', icon: Mail },
    { to: '/meetings', label: 'الاجتماعات والقرارات', icon: Calendar },
    { to: '/follow-up', label: 'مركز المتابعة', icon: Clock },
    { to: '/calendar', label: 'التقويم والمواعيد', icon: Compass },
    { to: '/archive', label: 'بنك المستندات والأرشيف', icon: FileText },
    { to: '/reports', label: 'التقارير والإحصائيات', icon: BarChart3 },
    { to: '/settings', label: 'الإعدادات والنسخ الاحتياطي', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 flex w-64 flex-col border-l border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                Daily Office
              </h1>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block leading-tight">
                المكتب الفني لمدير الفرع
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            الوحدات الإدارية
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>الهيئة العامة للرعاية الصحية</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">منظومة التأمين الصحي الشامل</p>
        </div>
      </aside>
    </>
  );
};

