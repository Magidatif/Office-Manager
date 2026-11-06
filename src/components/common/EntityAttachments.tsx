import React, { useState } from 'react';
import { apiRequest } from '../../api/client';
import { Attachment } from '../../types';
import { toast } from '../../context/ToastContext';
import { Paperclip, Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';

interface EntityAttachmentsProps {
  referenceType: 'task' | 'correspondence' | 'meeting';
  referenceId: string;
  departmentId?: string | null;
  attachments?: Attachment[];
  onRefresh: () => void;
}

export const EntityAttachments: React.FC<EntityAttachmentsProps> = ({
  referenceType,
  referenceId,
  departmentId,
  attachments = [],
  onRefresh,
}) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('reference_type', referenceType);
      formData.append('reference_id', referenceId);
      if (departmentId) formData.append('department_id', departmentId);
      formData.append(
        'category',
        referenceType === 'correspondence'
          ? 'خطابات رسمية'
          : referenceType === 'meeting'
          ? 'محاضر اجتماعات'
          : 'مذكرات فنية'
      );

      const res = await apiRequest<{ success: boolean }>('/archive/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        toast.success('تم إرفاق المستند وحفظه في الأرشيف بنجاح');
        onRefresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل إرفاق الملف');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/archive/${id}`, { method: 'DELETE' });
      toast.success('تم حذف المرفق');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف المرفق');
    }
  };

  const getDownloadUrl = (id: string) => {
    const token = localStorage.getItem('dom_token') || '';
    return `/api/archive/download/${id}?token=${encodeURIComponent(token)}`;
  };

  return (
    <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-amber-600" />
          المرفقات والوثائق المرتبطة ({attachments.length})
        </h4>

        <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold transition-colors">
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              جاري الرفع...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              إرفاق ملف
            </>
          )}
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      {attachments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{att.title}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{att.file_name}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={getDownloadUrl(att.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                  title="تنزيل المرفق"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="حذف المرفق"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">لا توجد ملفات مرفقة حتى الآن</p>
      )}
    </div>
  );
};

