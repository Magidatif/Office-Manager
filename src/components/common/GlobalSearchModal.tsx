import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { apiRequest } from '../../api/client';
import { Search, CheckSquare, Mail, Calendar, FileText, ClipboardList, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiRequest<{ success: boolean; results: any[] }>(`/search?q=${encodeURIComponent(query.trim())}`);
        if (res.success) {
          setResults(res.results);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: any) => {
    onClose();
    if (item.type === 'task') {
      navigate(`/tasks?taskId=${item.id}`);
    } else if (item.type === 'correspondence') {
      navigate(`/correspondences?corrId=${item.id}`);
    } else if (item.type === 'meeting') {
      navigate(`/meetings?meetId=${item.id}`);
    } else if (item.type === 'archive_doc') {
      navigate('/archive');
    } else if (item.type === 'log') {
      navigate('/daily-log');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare className="w-4 h-4 text-emerald-600" />;
      case 'correspondence': return <Mail className="w-4 h-4 text-sky-600" />;
      case 'meeting': return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'archive_doc': return <FileText className="w-4 h-4 text-amber-600" />;
      case 'log': return <ClipboardList className="w-4 h-4 text-indigo-600" />;
      default: return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'task': return 'مهمة';
      case 'correspondence': return 'مخاطبة';
      case 'meeting': return 'اجتماع';
      case 'archive_doc': return 'وثيقة أرشيف';
      case 'log': return 'سجل عمل';
      default: return type;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="البحث الشامل في النظام" maxWidth="2xl">
      <div className="relative mb-4">
        <Search className="absolute right-3.5 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم، الرقم، الموضوع، جهة الإصدار..."
          className="w-full pr-11 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
        />
        {loading && (
          <Loader2 className="absolute left-3.5 top-3.5 w-5 h-5 text-emerald-600 animate-spin" />
        )}
      </div>

      <div className="max-h-[50vh] overflow-y-auto space-y-2">
        {results.length > 0 ? (
          results.map((item, idx) => (
            <div
              key={`${item.type}-${item.id}-${idx}`}
              onClick={() => handleSelect(item)}
              className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 hover:bg-emerald-50 dark:bg-slate-800/40 dark:hover:bg-emerald-950/20 cursor-pointer transition-all flex items-center justify-between group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-xs border border-slate-200/60 dark:border-slate-700">
                  {getIcon(item.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {getTypeName(item.type)}
                    </span>
                    {item.ref && (
                      <span className="text-xs font-mono text-slate-500">
                        {item.ref}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    {item.title}
                  </h4>
                  {item.snippet && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {item.snippet}
                    </p>
                  )}
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
          ))
        ) : query.trim() && !loading ? (
          <p className="text-center text-sm text-slate-500 py-8">لا توجد نتائج مطابقة لـ "{query}"</p>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            يمكنك كتابة اسم المهمة أو رقم الخطاب أو اسم الإدارة للبحث الفوري
          </div>
        )}
      </div>
    </Modal>
  );
};

