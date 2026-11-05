import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Settings,
  Clock,
  Shield,
  Download,
  Upload,
  Globe,
  Sun,
  Moon,
  Cloud,
  CheckCircle,
  Database,
  Lock,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme, language, toggleLanguage } = useTheme();

  const [settings, setSettings] = useState<any>({
    work_start_time: '08:30',
    work_end_time: '15:30',
    default_reminder_hours: 24,
    theme: 'light',
    language: 'ar',
    browser_notifications: 1,
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await apiRequest<{ success: boolean; settings: any }>('/settings');
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      alert('تم حفظ الإعدادات والتفضيلات بنجاح');
    } catch (e: any) {
      alert(e.message || 'حدث خطأ');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'كلمة المرور الجديدة غير متطابقة', error: true });
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; message?: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.success) {
        setPasswordMsg({ text: 'تم تغيير كلمة المرور بنجاح', error: false });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordMsg({ text: err.message || 'فشل تغيير كلمة المرور', error: true });
    }
  };

  const handleExportBackup = async () => {
    try {
      setExportingBackup(true);
      const res = await apiRequest<{ success: boolean; backup: any }>('/settings/backup/export');
      if (res.success) {
        const jsonString = JSON.stringify(res.backup, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-office-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(err.message || 'فشل تصدير النسخة الاحتياطية');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleResetAllData = async () => {
    try {
      setResetting(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/settings/reset-all-data', {
        method: 'POST',
      });
      if (res.success) {
        alert('تم مسح كافة البيانات التشغيلية وإعادة ضبط النظام بنجاح!');
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || 'فشلت عملية مسح البيانات');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          إعدادات النظام وتفضيلات العمل
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          ساعات العمل الرسمية، أمان الحساب، والنسخ الاحتياطي السحابي
        </p>
      </div>

      {/* Work Hours Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-emerald-600" />
          تحديد أوقات بداية ونهاية يوم العمل
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                بداية يوم العمل الرسمي
              </label>
              <input
                type="time"
                value={settings.work_start_time || '08:30'}
                onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نهاية يوم العمل الرسمي
              </label>
              <input
                type="time"
                value={settings.work_end_time || '15:30'}
                onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              التنبيه المبكر قبل موعد الاستحقاق (بالساعات)
            </label>
            <input
              type="number"
              min={1}
              max={72}
              value={settings.default_reminder_hours || 24}
              onChange={(e) =>
                setSettings({ ...settings, default_reminder_hours: parseInt(e.target.value, 10) })
              }
              className="w-full sm:w-48 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            {savingSettings ? 'جاري الحفظ...' : 'حفظ إعدادات العمل'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-sky-600" />
          تغيير كلمة المرور وتأمين الحساب
        </h3>

        {passwordMsg && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-bold ${
              passwordMsg.error
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              كلمة المرور الحالية
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            تحديث كلمة المرور
          </button>
        </form>
      </div>

      {/* Cloudflare D1 & R2 Backup Export */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-purple-600" />
          النسخ الاحتياطي الشامل واستعادة البيانات
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          تصدير نسخة احتياطية كاملة بصيغة JSON تحتوي على كافة المهام، المراسلات، محاضر الاجتماعات، سجل الأعمال اليومية وبيانات الأرشيف.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBackup}
            disabled={exportingBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            {exportingBackup ? 'جاري تجهيز النسخة...' : 'تصدير نسخة احتياطية كاملة (JSON)'}
          </button>
        </div>
      </div>

      {/* Danger Zone: Wipe All Data */}
      <div className="p-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          منطقة العمليات الحساسة — مسح كافة البيانات وإعادة الضبط
        </h3>
        <p className="text-xs text-red-600/80 dark:text-red-300/80">
          تفريغ ومسح كافة سجلات المهام، المراسلات، محاضر الاجتماعات، سجل الأعمال اليومية، والمرفقات نهائياً للبدء بنظام فارغ تماماً. لن يتم حذف حساب المستخدم أو الإدارات.
        </p>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          disabled={resetting}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {resetting ? 'جاري مسح البيانات...' : 'مسح كافة البيانات وإعادة الضبط'}
        </button>
      </div>

      {/* Cloudflare Deployment Architecture Info */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
          <Cloud className="w-4 h-4" />
          <span>بنية Cloudflare السحابية المتكاملة</span>
        </div>
        <h4 className="text-sm font-extrabold">
          Daily Office Manager — Architecture Overview
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
          <div className="p-3 rounded-xl bg-white/10 border border-white/10">
            <span className="text-slate-300 block mb-1">قاعدة البيانات:</span>
            <span className="font-bold text-emerald-300 font-mono">Cloudflare D1 (SQLite)</span>
          </div>
          <div className="p-3 rounded-xl bg-white/10 border border-white/10">
            <span className="text-slate-300 block mb-1">تخزين المرفقات:</span>
            <span className="font-bold text-amber-300 font-mono">Cloudflare R2 Bucket</span>
          </div>
          <div className="p-3 rounded-xl bg-white/10 border border-white/10">
            <span className="text-slate-300 block mb-1">المهام المجدولة:</span>
            <span className="font-bold text-sky-300 font-mono">Cloudflare Cron Triggers</span>
          </div>
        </div>
      </div>

      {/* Confirm Wipe Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetAllData}
        title="تأكيد مسح كافة بيانات النظام"
        message="تحذير: هل أنت متأكد من رغبتك في حذف وتفريغ كافة المهام والمراسلات والاجتماعات والأرشيف وسجلات العمل نهائياً؟ هذه العملية لا يمكن التراجع عنها."
        confirmText="نعم، افرغ وامسح كل البيانات الآن"
        cancelText="تراجع"
        isDestructive={true}
      />
    </div>
  );
};

