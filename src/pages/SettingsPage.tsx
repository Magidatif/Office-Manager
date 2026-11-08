import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { toast } from '../context/ToastContext';
import { Department, User } from '../types';
import {
  Clock,
  Download,
  Upload,
  Database,
  Lock,
  Trash2,
  AlertTriangle,
  Building2,
  Plus,
  Edit,
  Check,
  X,
  Users,
  Shield,
  UserPlus,
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [settings, setSettings] = useState<any>({
    work_start_time: '08:30',
    work_end_time: '15:30',
    default_reminder_hours: 24,
    theme: 'light',
    language: 'ar',
    browser_notifications: 1,
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [editingDeptCode, setEditingDeptCode] = useState('');
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);

  // Users / Team Members state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserJobTitle, setNewUserJobTitle] = useState('عضو المكتب الفني لمدير الفرع');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'director' | 'deputy_director' | 'officer' | 'viewer'>('officer');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserData, setEditingUserData] = useState<{
    full_name: string;
    username: string;
    job_title: string;
    role: 'admin' | 'director' | 'deputy_director' | 'officer' | 'viewer';
    password?: string;
  }>({ full_name: '', username: '', job_title: '', role: 'officer', password: '' });
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await apiRequest<{ success: boolean; settings: any; departments: Department[]; users?: User[] }>('/settings');
      if (res.success) {
        if (res.settings) setSettings(res.settings);
        if (res.departments) setDepartments(res.departments);
        if (res.users) setUsersList(res.users);
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
      toast.success('تم حفظ الإعدادات والتفضيلات بنجاح');
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      await apiRequest('/settings/departments', {
        method: 'POST',
        body: JSON.stringify({ name: newDeptName.trim(), code: newDeptCode.trim() || null }),
      });
      toast.success('تم إضافة الإدارة بنجاح');
      setNewDeptName('');
      setNewDeptCode('');
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'فشل إضافة الإدارة');
    }
  };

  const handleUpdateDepartment = async (id: string) => {
    if (!editingDeptName.trim()) return;
    try {
      await apiRequest(`/settings/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editingDeptName.trim(), code: editingDeptCode.trim() || null }),
      });
      toast.success('تم تحديث بيانات الإدارة');
      setEditingDeptId(null);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث الإدارة');
    }
  };

  const handleToggleDeptActive = async (dept: Department) => {
    try {
      await apiRequest(`/settings/departments/${dept.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: dept.is_active ? 0 : 1 }),
      });
      toast.info(dept.is_active ? 'تم تعطيل الإدارة' : 'تم تفعيل الإدارة');
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'فشل التحديث');
    }
  };

  const confirmDeleteDepartment = async () => {
    if (!deleteDeptId) return;
    try {
      await apiRequest(`/settings/departments/${deleteDeptId}`, { method: 'DELETE' });
      toast.success('تم حذف الإدارة');
      setDeleteDeptId(null);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف الإدارة');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFullName.trim() || !newUsername.trim() || !newUserPassword.trim()) return;
    try {
      await apiRequest('/settings/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newUserFullName.trim(),
          username: newUsername.trim(),
          password: newUserPassword.trim(),
          job_title: newUserJobTitle.trim() || 'عضو المكتب الفني',
          role: newUserRole,
        }),
      });
      toast.success('تم إضافة حساب المستخدم بنجاح');
      setNewUserFullName('');
      setNewUsername('');
      setNewUserPassword('');
      setNewUserJobTitle('عضو المكتب الفني لمدير الفرع');
      setNewUserRole('officer');
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'فشل إضافة المستخدم');
    }
  };

  const handleUpdateUser = async (id: string) => {
    if (!editingUserData.full_name.trim() || !editingUserData.username.trim()) return;
    try {
      await apiRequest(`/settings/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editingUserData),
      });
      toast.success('تم تحديث بيانات العضو بنجاح');
      setEditingUserId(null);
      await loadSettings();
      if (id === user?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث بيانات المستخدم');
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await apiRequest(`/settings/users/${deleteUserId}`, { method: 'DELETE' });
      toast.success('تم حذف حساب المستخدم بنجاح');
      setDeleteUserId(null);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف المستخدم');
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
        toast.success('تم تغيير كلمة المرور بنجاح');
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
        toast.success('تم تصدير النسخة الاحتياطية بنجاح');
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل تصدير النسخة الاحتياطية');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await apiRequest<{ success: boolean; message?: string }>('/settings/backup/import', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      if (res.success) {
        toast.success('تم استعادة النسخة الاحتياطية بنجاح!');
        loadSettings();
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل استيراد ملف النسخة الاحتياطية');
    } finally {
      setImportingBackup(false);
      e.target.value = '';
    }
  };

  const handleResetAllData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetPassword.trim()) {
      toast.error('يرجى إدخال كلمة المرور لتأكيد عملية المسح');
      return;
    }
    try {
      setResetting(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/settings/reset-all-data', {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword }),
      });
      if (res.success) {
        toast.success('تم مسح كافة البيانات التشغيلية وإعادة ضبط النظام بنجاح!');
        setShowResetConfirm(false);
        setResetPassword('');
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err: any) {
      toast.error(err.message || 'كلمة المرور غير صحيحة أو فشلت عملية مسح البيانات');
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
          إدارة حسابات أعضاء المكتب الفني ومدير الفرع، الهيكل التنظيمي والإدارات، ساعات العمل، والنسخ الاحتياطي
        </p>
      </div>

      {/* Users & Technical Office Members Management */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              إدارة المستخدمين وأعضاء المكتب الفني ({usersList.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              إضافة حسابات الدخول لمدير عام الفرع وأعضاء المكتب الفني وتحديد صلاحيات كل عضو في متابعة وإدارة المهام
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            صلاحيتك الحالية:{' '}
            {user?.role === 'admin'
              ? 'مدير النظام (Admin)'
              : user?.role === 'director'
              ? 'مدير عام الفرع'
              : user?.role === 'deputy_director'
              ? 'نائب مدير الفرع'
              : user?.role === 'officer'
              ? 'عضو المكتب الفني'
              : 'متابع / مطلع'}
          </span>
        </div>

        {user?.role === 'admin' && (
          <form onSubmit={handleAddUser} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              إضافة مستخدم جديد (حصرياً لمدير النظام Admin):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="الاسم الكامل (مثال: د. أحمد محمد)..."
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="اسم المستخدم للدخول (مثال: ahmed)..."
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="password"
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="كلمة المرور للدخول..."
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                value={newUserJobTitle}
                onChange={(e) => setNewUserJobTitle(e.target.value)}
                placeholder="المسمى الوظيفي (مثال: عضو المكتب الفني)..."
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'director' | 'deputy_director' | 'officer' | 'viewer')}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="officer">عضو المكتب الفني</option>
                <option value="director">مدير عام الفرع</option>
                <option value="deputy_director">نائب مدير الفرع</option>
                <option value="admin">مدير النظام (Admin)</option>
                <option value="viewer">متابع / استعراض فقط</option>
              </select>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                إنشاء الحساب
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
          {usersList.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-xs flex-wrap"
            >
              {editingUserId === u.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 w-full items-center">
                  <input
                    type="text"
                    value={editingUserData.full_name}
                    onChange={(e) => setEditingUserData({ ...editingUserData, full_name: e.target.value })}
                    placeholder="الاسم الكامل"
                    className="px-2.5 py-1.5 rounded-lg border border-emerald-400 bg-white dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    value={editingUserData.username}
                    onChange={(e) => setEditingUserData({ ...editingUserData, username: e.target.value })}
                    placeholder="اسم الدخول"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={editingUserData.job_title}
                    onChange={(e) => setEditingUserData({ ...editingUserData, job_title: e.target.value })}
                    placeholder="المسمى الوظيفي"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                  {user?.role === 'admin' && (
                    <select
                      value={editingUserData.role}
                      onChange={(e) => setEditingUserData({ ...editingUserData, role: e.target.value as any })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    >
                      <option value="officer">عضو المكتب الفني</option>
                      <option value="director">مدير عام الفرع</option>
                      <option value="deputy_director">نائب مدير الفرع</option>
                      <option value="admin">مدير النظام (Admin)</option>
                      <option value="viewer">متابع فقط</option>
                    </select>
                  )}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      value={editingUserData.password || ''}
                      onChange={(e) => setEditingUserData({ ...editingUserData, password: e.target.value })}
                      placeholder="كلمة مرور جديدة (اختياري)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateUser(u.id)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      title="حفظ"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                      title="إلغاء"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                      {u.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{u.full_name}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono text-[10px]">
                          @{u.username}
                        </span>
                        {u.id === user?.id && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300 text-[10px] font-bold">
                            أنت
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{u.job_title}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                          : u.role === 'director'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : u.role === 'deputy_director'
                          ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                          : u.role === 'officer'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {u.role === 'admin'
                        ? 'مدير النظام (Admin)'
                        : u.role === 'director'
                        ? 'مدير عام الفرع'
                        : u.role === 'deputy_director'
                        ? 'نائب مدير الفرع'
                        : u.role === 'officer'
                        ? 'عضو المكتب الفني'
                        : 'متابع فقط'}
                    </span>

                    {(user?.role === 'admin' || u.id === user?.id) && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(u.id);
                            setEditingUserData({
                              full_name: u.full_name,
                              username: u.username,
                              job_title: u.job_title,
                              role: u.role,
                              password: '',
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg"
                          title="تعديل بيانات العضو أو كلمة المرور"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {user?.role === 'admin' && u.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => setDeleteUserId(u.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Departments Management */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            إدارة الإدارات والأقسام بالفرع ({departments.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            إضافة أو تعديل الإدارات التي تظهر في قوائم التكليفات والمراسلات والتقارير
          </p>
        </div>

        <form onSubmit={handleAddDepartment} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            required
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="اسم الإدارة الجديدة (مثال: إدارة نظم المعلومات والتحول الرقمي)..."
            className="flex-1 min-w-[220px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <input
            type="text"
            value={newDeptCode}
            onChange={(e) => setNewDeptCode(e.target.value)}
            placeholder="الكود المختصر (اختياري: IT)"
            className="w-36 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            إضافة إدارة
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-xs"
            >
              {editingDeptId === dept.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editingDeptName}
                    onChange={(e) => setEditingDeptName(e.target.value)}
                    className="flex-1 px-2.5 py-1 rounded-lg border border-emerald-400 bg-white dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    value={editingDeptCode}
                    onChange={(e) => setEditingDeptCode(e.target.value)}
                    placeholder="الكود"
                    className="w-24 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateDepartment(dept.id)}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="حفظ"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDeptId(null)}
                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                    title="إلغاء"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${dept.is_active ? 'text-slate-800 dark:text-slate-200' : 'line-through text-slate-400'}`}>
                      {dept.name}
                    </span>
                    {dept.code && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono text-[10px]">
                        {dept.code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleDeptActive(dept)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        dept.is_active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                      }`}
                    >
                      {dept.is_active ? 'مفعلة' : 'معطلة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDeptId(dept.id);
                        setEditingDeptName(dept.name);
                        setEditingDeptCode(dept.code || '');
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg"
                      title="تعديل"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteDeptId(dept.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
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

      {/* Cloudflare D1 & R2 Backup Export & Import */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-purple-600" />
          النسخ الاحتياطي الشامل واستعادة البيانات
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          تصدير أو استيراد نسخة احتياطية كاملة بصيغة JSON تحتوي على كافة المهام، المراسلات، محاضر الاجتماعات، سجل الأعمال اليومية والإدارات.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={exportingBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            {exportingBackup ? 'جاري تجهيز النسخة...' : 'تصدير نسخة احتياطية (JSON)'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importingBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            <Upload className="w-4 h-4 text-purple-600" />
            {importingBackup ? 'جاري الاستعادة...' : 'استعادة نسخة احتياطية (Import JSON)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackupFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Danger Zone: Wipe All Data (Admin, Branch Director & Deputy Director Only) */}
      {(user?.role === 'admin' ||
        user?.role === 'director' ||
        user?.role === 'deputy_director' ||
        user?.job_title?.includes('مدير عام') ||
        user?.job_title?.includes('مدير الفرع') ||
        user?.job_title?.includes('نائب مدير')) && (
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
            onClick={() => {
              setResetPassword('');
              setShowResetConfirm(true);
            }}
            disabled={resetting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {resetting ? 'جاري مسح البيانات...' : 'مسح كافة البيانات وإعادة الضبط'}
          </button>
        </div>
      )}

      {/* Confirm Wipe Dialog with Password */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleResetAllData}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-5 bg-red-50/70 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-800 dark:text-red-300">
                    تأكيد مسح كافة بيانات النظام
                  </h3>
                  <p className="text-[11px] text-red-600/80 dark:text-red-400/80">
                    عملية نهائية لا يمكن التراجع عنها
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetPassword('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                تحذير: سيتم حذف وتفريغ كافة <strong>المهام، المراسلات، محاضر الاجتماعات، الأرشيف، وسجلات العمل اليومية</strong> نهائياً.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-red-600" />
                  أدخل كلمة مرور تأكيد المسح لإتمام العملية:
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور التأكيد..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetPassword('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  تراجع وإلغاء
                </button>
                <button
                  type="submit"
                  disabled={resetting || !resetPassword.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {resetting ? 'جاري التحقق والمسح...' : 'تأكيد ومسح كل البيانات'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete Dept Dialog */}
      <ConfirmDialog
        isOpen={!!deleteDeptId}
        onClose={() => setDeleteDeptId(null)}
        onConfirm={confirmDeleteDepartment}
        title="تأكيد حذف الإدارة"
        message="هل أنت متأكد من حذف هذه الإدارة؟ لن يتم حذف المهام المرتبطة بها ولكن ستصبح بدون إدارة."
        confirmText="نعم، احذف الإدارة"
        isDestructive={true}
      />

      {/* Confirm Delete User Dialog */}
      <ConfirmDialog
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={confirmDeleteUser}
        title="تأكيد حذف حساب المستخدم"
        message="هل أنت متأكد من حذف حساب هذا العضو؟ لن يتم حذف المهام أو السجلات التي أنشأها سابقاً."
        confirmText="نعم، احذف الحساب"
        isDestructive={true}
      />
    </div>
  );
};
