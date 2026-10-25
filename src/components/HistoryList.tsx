import React from 'react';
import { HistoryItem } from '../types';
import { Clock, FileText, Play, Trash2, ArrowRight } from 'lucide-react';

interface HistoryListProps {
  history: HistoryItem[];
  onOpenDocument: (id: string, resume: boolean) => void;
  onDeleteDocument: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onOpenDocument,
  onDeleteDocument,
}) => {
  if (history.length === 0) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `Hoy, ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-8">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Documentos Recientes ({history.length})
          </h2>
        </div>
        <span className="text-xs text-slate-400">Guardados en tu navegador</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {history.map((item) => (
          <div
            key={item.id}
            className="group relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className="text-sm font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                      title={item.name}
                      onClick={() => onOpenDocument(item.id, true)}
                    >
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{item.totalPages} {item.totalPages === 1 ? 'pág' : 'págs'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.totalWords.toLocaleString()} palabras</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(item.lastReadTimestamp)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDocument(item.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                  title="Eliminar del historial"
                  aria-label="Eliminar documento del historial"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="mt-2.5 mb-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-mono">
                  <span>Progreso: Frase {item.lastSentenceIndex + 1}</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{item.progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, item.progressPercent)}%` }}
                  />
                </div>
              </div>

              {item.lastSentenceText && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate mt-1.5">
                  "{item.lastSentenceText}..."
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => onOpenDocument(item.id, false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Desde el inicio
              </button>

              <button
                onClick={() => onOpenDocument(item.id, true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Continuar ({item.progressPercent}%)</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
