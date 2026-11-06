import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { toast } from '../context/ToastContext';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building,
  Mail,
  Award,
  Layers,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const COLUMN_LABELS: Record<string, string> = {
  task_number: 'رقم المهمة',
  title: 'العنوان',
  description: 'الوصف والتفاصيل',
  task_type: 'نوع المهمة',
  department_name: 'الإدارة المختصة',
  assigned_by: 'جهة التكليف',
  assigned_to: 'المسؤول عن التنفيذ',
  priority: 'الأولوية',
  status: 'الحالة',
  start_date: 'تاريخ البدء',
  due_date: 'تاريخ الاستحقاق',
  completion_date: 'تاريخ الإنجاز',
  progress: 'نسبة الإنجاز (%)',
  reference_number: 'رقم المرجع',
  notes: 'ملاحظات',
  log_date: 'تاريخ السجل',
  start_time: 'وقت البدء',
  end_time: 'وقت الانتهاء',
  activity_type: 'نوع النشاط',
  actions_taken: 'الإجراءات المتخذة',
  results: 'النتائج والمخرجات',
  obstacles: 'المعوقات',
  next_step: 'الخطوة القادمة',
  is_completed: 'مكتمل؟',
  task_title: 'المهمة المرتبطة',
  code: 'كود الإدارة',
  total_tasks: 'إجمالي المهام',
  completed_tasks: 'المهام المكتملة',
  in_progress_tasks: 'قيد التنفيذ',
  overdue_tasks: 'المهام المتأخرة',
  item_type: 'نوع البند',
  content: 'نص القرار / التوصية',
  assigned_to_dept: 'الجهة المكلفة',
  assigned_to_person: 'المسؤول المكلف',
  meeting_title: 'عنوان الاجتماع',
  meeting_date: 'تاريخ الاجتماع',
  linked_task_title: 'المهمة التنفيذية',
  task_status: 'حالة المهمة',
  reg_number: 'رقم القيد',
  official_letter_number: 'رقم الخطاب الرسمي',
  letter_date: 'تاريخ الخطاب',
  date_received_or_sent: 'تاريخ الورود/الإرسال',
  letter_type: 'نوع المكاتبة',
  sender: 'جهة الإرسال',
  recipient: 'جهة الاستقبال',
  subject: 'موضوع المكاتبة',
  summary: 'الملخص',
  required_action: 'الإجراء المطلوب',
  reply_due_date: 'موعد الرد',
};

const SUMMARY_LABELS: Record<string, string> = {
  totalEntries: 'إجمالي الأنشطة المسجلة',
  completedCount: 'الأنشطة المكتملة',
  total: 'الإجمالي',
  completed: 'المكتملة',
  inProgress: 'قيد التنفيذ',
  totalCreated: 'إجمالي المهام المنشأة',
  averageProgress: 'متوسط نسبة الإنجاز (%)',
  totalCompleted: 'إجمالي المهام المكتملة',
  totalOverdue: 'إجمالي المهام المتأخرة',
  totalDepartments: 'عدد الإدارات',
  totalAssignments: 'إجمالي التكليفات',
  totalDecisions: 'إجمالي القرارات والتوصيات',
  pending: 'قيد المتابعة',
  underProcess: 'قيد المتابعة',
  closed: 'محفوظة / منتهية',
  transferred: 'محولة لمهام',
  totalAchievements: 'إجمالي الإنجازات الموثقة',
};

const VALUE_TRANSLATIONS: Record<string, string> = {
  urgent_critical: 'عاجل جداً',
  high: 'مرتفع',
  medium: 'متوسط',
  low: 'منخفض',
  new: 'جديدة',
  not_started: 'لم تبدأ',
  in_progress: 'قيد التنفيذ',
  waiting_reply: 'في انتظار رد',
  waiting_approval: 'في انتظار اعتماد',
  suspended: 'معلقة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
  pending: 'قيد التنفيذ',
  under_process: 'قيد المتابعة',
  replied: 'تم الرد',
  closed: 'محفوظة / منتهية',
  transferred_to_task: 'تم تحويلها لمهمة',
  waiting_info: 'طلب استيفاء',
};

const HIDDEN_COLUMNS = new Set([
  'id',
  'user_id',
  'department_id',
  'task_id',
  'meeting_id',
  'linked_task_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'is_archived',
  'recurrence',
  'recurrence_rule',
  'postponed_count',
  'postpone_reason',
  'follow_up_date',
]);

export const ReportsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const reportOptions = [
    { id: 'daily', name: '1. تقرير الأعمال اليومية', icon: Calendar },
    { id: 'weekly', name: '2. التقرير الأسبوعي للأداء', icon: BarChart3 },
    { id: 'monthly', name: '3. التقرير الشهري الشامل', icon: Layers },
    { id: 'completed', name: '4. تقرير المهام المكتملة', icon: CheckCircle2 },
    { id: 'overdue', name: '5. تقرير المهام المتأخرة', icon: AlertTriangle },
    { id: 'department', name: '6. تقرير الأعمال حسب الإدارة', icon: Building },
    { id: 'assigned', name: '7. تقرير متابعة التكليفات', icon: Filter },
    { id: 'recommendations', name: '8. تقرير تنفيذ توصيات الاجتماعات', icon: CheckCircle2 },
    { id: 'correspondences', name: '9. تقرير المراسلات والمخاطبات', icon: Mail },
    { id: 'achievements', name: '10. تقرير الإنجازات الشخصية', icon: Award },
  ];

  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl && reportOptions.some((r) => r.id === typeFromUrl)) {
      setReportType(typeFromUrl);
    }
  }, [searchParams]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{
        success: boolean;
        data: any[];
        summary: Record<string, any>;
      }>(`/reports/data?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}`);
      if (res.success) {
        setData(res.data);
        setSummary(res.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, startDate, endDate]);

  const formatCellValue = (col: string, val: any): string => {
    if (val === null || val === undefined || val === '') return '-';
    if (col === 'is_completed') return val === 1 ? 'نعم' : 'لا';
    if (col === 'progress') return `${val}%`;
    const strVal = String(val);
    return VALUE_TRANSLATIONS[strVal] || strVal;
  };

  // Export to Excel / CSV with UTF-8 BOM and Arabic Headers
  const exportToCSV = () => {
    if (!data || data.length === 0) {
      toast.info('لا توجد بيانات للتصدير في هذا التقرير');
      return;
    }

    const visibleCols = Object.keys(data[0]).filter((col) => !HIDDEN_COLUMNS.has(col));
    const csvRows: string[] = [];

    // Header row in Arabic
    csvRows.push(['م', ...visibleCols.map((c) => `"${COLUMN_LABELS[c] || c}"`)].join(','));

    // Data rows
    data.forEach((row, idx) => {
      const values = visibleCols.map((col) => {
        const formatted = formatCellValue(col, row[col]);
        return `"${formatted.replace(/"/g, '""')}"`;
      });
      csvRows.push([String(idx + 1), ...values].join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report-${reportType}-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير ملف التقرير بنجاح');
  };

  const handlePrint = () => {
    window.print();
  };

  const visibleColumns = data.length > 0 ? Object.keys(data[0]).filter((col) => !HIDDEN_COLUMNS.has(col)) : [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs no-print">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            التقارير الإدارية ومؤشرات الأداء
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200">
              10 تقارير معتمدة
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            استخراج وتصدير تقارير الإنجازات اليومية، الأسبوعية، الشهرية، والمراسلات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel (CSV)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            طباعة رسمية
          </button>
        </div>
      </div>

      {/* Report Controls (no-print) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs no-print">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            نوع التقرير
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {reportOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            من تاريخ
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            إلى تاريخ
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Official Report Container (for Screen & Print) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
        {/* Printable Official Header */}
        <div className="flex items-center justify-between border-b-2 border-emerald-700 pb-4">
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
              الهيئة العامة للرعاية الصحية — فرع الهيئة
            </h1>
            <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
              المكتب الفني لمدير الفرع
            </h2>
          </div>
          <div className="text-left text-xs font-mono text-slate-500">
            <div>تاريخ الاستخراج: {new Date().toISOString().split('T')[0]}</div>
            <div>الفترة: من {startDate} إلى {endDate}</div>
          </div>
        </div>

        {/* Report Title */}
        <div className="text-center py-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 underline decoration-emerald-500 underline-offset-8">
            {reportOptions.find((r) => r.id === reportType)?.name}
          </h3>
        </div>

        {/* Summary Metric Chips */}
        {summary && Object.keys(summary).length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 py-2">
            {Object.entries(summary).map(([k, v], idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {SUMMARY_LABELS[k] || k}: <b className="text-emerald-600 mr-1">{String(v)}</b>
              </span>
            ))}
          </div>
        )}

        {/* Data Table */}
        {loading ? (
          <LoadingSpinner text="جاري استخراج بيانات التقرير..." />
        ) : data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700">
                  <th className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 font-bold">#</th>
                  {visibleColumns.map((col, idx) => (
                    <th
                      key={idx}
                      className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      {COLUMN_LABELS[col] || col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 font-mono text-center">
                      {idx + 1}
                    </td>
                    {visibleColumns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 font-medium"
                      >
                        {formatCellValue(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400 py-8">
            لا توجد بيانات مسجلة مطابقة لمعايير هذا التقرير في الفترة المحددة
          </p>
        )}

        {/* Printable Footer with Sign-off */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 text-center text-xs text-slate-700 dark:text-slate-300">
          <div>
            <p className="font-bold">إعداد / عضو المكتب الفني</p>
            <div className="h-12" />
            <p className="font-semibold">د. ماجد عاطف</p>
          </div>
          <div>
            <p className="font-bold">يعتمد / مدير فرع الهيئة</p>
            <div className="h-12" />
            <p className="font-semibold">........................................</p>
          </div>
        </div>
      </div>
    </div>
  );
};
