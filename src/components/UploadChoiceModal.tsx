import React from 'react';
import { X, Upload, HardDrive, FileText, ArrowRight } from 'lucide-react';

interface UploadChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocal: () => void;
  onSelectGoogleDrive: () => void;
}

export const UploadChoiceModal: React.FC<UploadChoiceModalProps> = ({
  isOpen,
  onClose,
  onSelectLocal,
  onSelectGoogleDrive,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Subir documento PDF
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona el origen de tu documento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content with 2 clean choices */}
        <div className="p-5 space-y-3">
          {/* Choice 1: From this device */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectLocal();
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-slate-900 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-all text-left cursor-pointer group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  Desde este dispositivo
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Explorador de archivos, almacenamiento o descargas (.pdf)
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Choice 2: Google Drive */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectGoogleDrive();
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-left cursor-pointer group shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  Desde Google Drive
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Importa tus archivos PDF guardados en la nube
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            Los documentos se procesan 100% en tu navegador de forma privada
          </p>
        </div>
      </div>
    </div>
  );
};
