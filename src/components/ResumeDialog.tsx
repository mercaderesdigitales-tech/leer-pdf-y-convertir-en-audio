import React from 'react';
import { Bookmark, RotateCcw, Play, X } from 'lucide-react';

interface ResumeDialogProps {
  isOpen: boolean;
  documentName: string;
  savedSentenceIndex: number;
  totalSentences: number;
  savedPageIndex: number;
  progressPercent: number;
  previewText?: string;
  onResume: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

export const ResumeDialog: React.FC<ResumeDialogProps> = ({
  isOpen,
  documentName,
  savedSentenceIndex,
  totalSentences,
  savedPageIndex,
  progressPercent,
  previewText,
  onResume,
  onStartOver,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Progreso previo detectado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {documentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between font-mono font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            <span>Frase {savedSentenceIndex + 1} de {totalSentences}</span>
            <span>Página {savedPageIndex + 1} ({progressPercent}%)</span>
          </div>

          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full bg-indigo-600 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {previewText && (
            <p className="italic text-slate-500 dark:text-slate-400 line-clamp-2">
              "{previewText}..."
            </p>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-5">
          Ya habías avanzado en este documento. ¿Deseas continuar exactamente donde lo dejaste o empezar la lectura desde el inicio?
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={onResume}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Reanudar lectura</span>
          </button>

          <button
            onClick={onStartOver}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Desde el inicio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
