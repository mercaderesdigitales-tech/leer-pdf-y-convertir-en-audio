import React from 'react';
import { Home, Upload, Clock, Sliders, HelpCircle, Download } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenUploadModal: () => void;
  onOpenSettings: () => void;
  onOpenHowItWorks: () => void;
  onOpenInstallApp?: () => void;
  onGoHome: () => void;
  onScrollToRecent?: () => void;
  hasDocument: boolean;
  onOpenExport?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenUploadModal,
  onOpenSettings,
  onOpenHowItWorks,
  onOpenInstallApp,
  onGoHome,
  onScrollToRecent,
  hasDocument,
  onOpenExport,
}) => {
  // If a document is active, the AudioPlayerBar takes the bottom slot with reader actions.
  // When no document is active, this nav bar provides instant thumb-friendly access to all features.
  if (hasDocument) return null;

  return (
    <nav
      aria-label="Navegación móvil inferior"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-xl transition-colors pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-2 py-1.5">
        {/* 1. Inicio */}
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            onGoHome();
          }}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer"
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium leading-none">Inicio</span>
        </button>

        {/* 2. Recientes / Buscar */}
        <button
          type="button"
          onClick={() => {
            onScrollToRecent?.();
            const el = document.getElementById('recent-documents-section');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer"
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium leading-none">Recientes</span>
        </button>

        {/* 3. Subir PDF (Primary elevated button) */}
        <button
          type="button"
          onClick={onOpenUploadModal}
          className="flex flex-col items-center justify-center -mt-4 group active:scale-95 transition-all cursor-pointer px-2"
          title="Subir documento PDF"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900 group-hover:bg-indigo-700 transition-colors">
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 leading-none">
            Subir PDF
          </span>
        </button>

        {/* 4. Ajustes */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer"
        >
          <Sliders className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium leading-none">Ajustes</span>
        </button>

        {/* 5. Ayuda / Cómo funciona */}
        <button
          type="button"
          onClick={onOpenHowItWorks}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer"
        >
          <HelpCircle className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium leading-none">Ayuda</span>
        </button>
      </div>
    </nav>
  );
};
