import React from 'react';
import { Volume2, Settings, Download, Sun, Moon, Sparkles, Zap, Home, HelpCircle, HardDrive, Smartphone } from 'lucide-react';
import { TTSEngineType } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  engine: TTSEngineType;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenHowItWorks: () => void;
  onOpenGoogleDrive: () => void;
  onOpenInstallApp: () => void;
  onGoHome: () => void;
  hasDocument: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenFilePicker: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  engine,
  onOpenSettings,
  onOpenExport,
  onOpenHowItWorks,
  onOpenGoogleDrive,
  onOpenInstallApp,
  onGoHome,
  hasDocument,
  theme,
  onToggleTheme,
  onOpenFilePicker,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Brand Wordmark (Clickable to go home) */}
        <div
          onClick={onGoHome}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
          title="Ir a la página de inicio"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-700 transition-colors">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              VozPDF
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation & Status Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
          {hasDocument && (
            <button
              onClick={onGoHome}
              className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap font-medium text-slate-700 dark:text-slate-200"
              title="Volver a la pantalla principal"
            >
              <Home className="w-4 h-4 text-slate-500" />
              <span>Inicio</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title="Cambiar motor o voz"
          >
            {engine === 'webspeech' ? (
              <>
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Motor: Rápido (Web Speech)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Motor: Alta Calidad (Kokoro)</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenGoogleDrive}
            className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title="Abrir PDF desde Google Drive"
          >
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={onOpenHowItWorks}
            className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Cómo funciona</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions (Mobile + Desktop) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Home button */}
          {hasDocument && (
            <button
              onClick={onGoHome}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Volver al inicio"
              aria-label="Inicio"
            >
              <Home className="w-4 h-4" />
            </button>
          )}

          {/* Google Drive button in header */}
          <button
            onClick={onOpenGoogleDrive}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition-colors cursor-pointer"
            title="Importar documento desde Google Drive"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Drive</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Configuración de voz y lectura"
            aria-label="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Export Audio (when document loaded) */}
          {hasDocument && (
            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Descargar audio en MP3 o WAV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}

          {/* File Picker button */}
          <button
            onClick={onOpenFilePicker}
            className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            <span className="hidden sm:inline">{hasDocument ? 'Cargar otro' : 'Subir PDF'}</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
};
