import React from 'react';
import { TaskPriority, TaskStatus, CorrespondenceType, CorrespondenceStatus } from '../../types';

interface BadgeProps {
  status?: TaskStatus | CorrespondenceStatus | string;
  priority?: TaskPriority | string;
  type?: CorrespondenceType | string;
  className?: string;
  label?: string;
}

export const StatusBadge: React.FC<{ status: TaskStatus | CorrespondenceStatus | string; className?: string }> = ({
  status,
  className = '',
}) => {
  const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
    // Task statuses
    new: { label: 'جديدة', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    not_started: { label: 'لم تبدأ', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
    in_progress: { label: 'قيد التنفيذ', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    waiting_reply: { label: 'في انتظار رد', bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
    waiting_approval: { label: 'في انتظار اعتماد', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    suspended: { label: 'معلقة', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
    completed: { label: 'مكتملة', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    cancelled: { label: 'ملغاة', bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },

    // Correspondence statuses
    under_process: { label: 'قيد المتابعة', bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
    replied: { label: 'تم الرد', bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
    closed: { label: 'محفوظة / منتهية', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    transferred_to_task: { label: 'تم تحويلها لمهمة', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
    waiting_info: { label: 'طلب استيفاء', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  };

  const item = map[status] || { label: status, bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${item.bg} ${item.text} ${item.border} ${className}`}>
      {item.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: TaskPriority | string; className?: string }> = ({
  priority,
  className = '',
}) => {
  const map: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    urgent_critical: { label: 'عاجل جداً', bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800', text: 'text-red-700', dot: 'bg-red-500 animate-pulse' },
    high: { label: 'مرتفع', bg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800', text: 'text-orange-700', dot: 'bg-orange-500' },
    medium: { label: 'متوسط', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800', text: 'text-blue-700', dot: 'bg-blue-500' },
    low: { label: 'منخفض', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  };

  const item = map[priority] || { label: priority, bg: 'bg-gray-100 text-gray-700 border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.bg} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
};

export const TypeBadge: React.FC<{ type: string; className?: string }> = ({ type, className = '' }) => {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 ${className}`}>
      {type}
    </span>
  );
};

