import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Attachment, Department } from '../types';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  FileText,
  Upload,
  Download,
  Search,
  Trash2,
  FileCode,
  FileSpreadsheet,
  FileCheck,
  Tag,
  Building,
  Calendar,
  Sparkles,
} from 'lucide-react';

export const ArchivePage: React.FC = () => {
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('عام');
  const [docDeptId, setDocDeptId] = useState('');
  const [docKeywords, setDocKeywords] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedDept) params.append('department_id', selectedDept);

      const res = await apiRequest<{ success: boolean; documents: Attachment[]; categories: any[] }>(
        `/archive?${params.toString()}`
      );
      if (res.success) {
        setDocuments(res.documents);
        setCategories(res.categories);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await apiRequest<{ success: boolean; departments: Department[] }>('/departments');
      if (res.success) setDepartments(res.departments);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory, selectedDept]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('يرجى اختيار ملف لرفعه');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', docTitle.trim() || uploadFile.name);
      formData.append('category', docCategory);
      formData.append('department_id', docDeptId || '');
      formData.append('keywords', docKeywords);
      formData.append('description', docDescription);

      const res = await apiRequest<{ success: boolean }>('/archive/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        setShowUploadModal(false);
        setUploadFile(null);
        setDocTitle('');
        setDocKeywords('');
        setDocDescription('');
        loadDocuments();
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع المستند');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المستند نهائياً من الأرشيف؟')) return;
    try {
      await apiRequest(`/archive/${id}`, { method: 'DELETE' });
      loadDocuments();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getFileIcon = (mime: string, name: string) => {
    if (name.endsWith('.pdf') || mime.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('sheet') || mime.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word')) {
      return <FileCode className="w-5 h-5 text-blue-600" />;
    }
    return <FileCheck className="w-5 h-5 text-slate-500" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            بنك المستندات والأرشيف الإلكتروني
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold border border-amber-200">
              تخزين Cloudflare R2 السحابي
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            حفظ وأرشفة القرارات الوزارية، المذكرات، التقارير واللوائح المنظمة لعمل الهيئة
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          إيداع مستند جديد
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
            placeholder="بحث بالرقم المرجعي، اسم المستند، الكلمات المفتاحية..."
            className="w-full pr-10 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="">جميع التصنيفات</option>
          <option value="قرارات وزارية">قرارات وزارية</option>
          <option value="خطابات رسمية">خطابات رسمية</option>
          <option value="مذكرات فنية">مذكرات فنية</option>
          <option value="لوائح تنظيمية">لوائح تنظيمية</option>
          <option value="محاضر اجتماعات">محاضر اجتماعات</option>
          <option value="عقود واتفاقيات">عقود واتفاقيات</option>
          <option value="عام">عام</option>
        </select>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="">جميع الإدارات</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <button
          onClick={loadDocuments}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
        >
          بحث
        </button>
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <LoadingSpinner text="جاري استرجاع وثائق الأرشيف..." />
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-mono text-[11px] font-bold">
                    {doc.reference_number || 'DOC'}
                  </span>
                  <span className="text-[11px] text-slate-400">{formatSize(doc.file_size)}</span>
                </div>

                <div className="flex items-start gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0">
                    {getFileIcon(doc.mime_type, doc.file_name)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors line-clamp-1">
                      {doc.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{doc.file_name}</p>
                  </div>
                </div>

                {doc.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    {doc.description}
                  </p>
                )}

                {doc.keywords && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.keywords.split(',').map((kw, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        #{kw.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 text-[11px]">
                  {doc.department_name || doc.category}
                </span>

                <div className="flex items-center gap-1">
                  <a
                    href={`/api/archive/download/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1"
                    title="تنزيل الملف"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="الأرشيف الإلكتروني خالي"
          description="قم برفع المستندات واللوائح والقرارات الإدارية للبحث فيها واسترجاعها في أي وقت"
          actionText="إيداع مستند جديد"
          onAction={() => setShowUploadModal(true)}
        />
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="إيداع وتوثيق مستند في الأرشيف الإلكتروني"
        maxWidth="lg"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الملف المراد رفعه <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              required
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  setUploadFile(file);
                  if (!docTitle) setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
                }
              }}
              className="w-full text-xs text-slate-500 file:mr-0 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              اسم أو عنوان المستند <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="مثال: القرار الوزاري رقم 84 لسنة 2024 بشأن معايير مكافحة العدوى..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                التصنيف
              </label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="قرارات وزارية">قرارات وزارية</option>
                <option value="خطابات رسمية">خطابات رسمية</option>
                <option value="مذكرات فنية">مذكرات فنية</option>
                <option value="لوائح تنظيمية">لوائح تنظيمية</option>
                <option value="محاضر اجتماعات">محاضر اجتماعات</option>
                <option value="عقود واتفاقيات">عقود واتفاقيات</option>
                <option value="عام">عام</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الإدارة المختصة
              </label>
              <select
                value={docDeptId}
                onChange={(e) => setDocDeptId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
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

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الكلمات المفتاحية (مفصولة بفواصل)
            </label>
            <input
              type="text"
              value={docKeywords}
              onChange={(e) => setDocKeywords(e.target.value)}
              placeholder="مثال: جودة, اعتماد, الكرنك, طوارئ, تمريض"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              وصف مختصر للمستند
            </label>
            <textarea
              rows={2}
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              placeholder="موجز محتويات الوثيقة..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-colors"
            >
              {uploading ? 'جاري الرفع إلى R2...' : 'حفظ وإيداع بالأرشيف'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

