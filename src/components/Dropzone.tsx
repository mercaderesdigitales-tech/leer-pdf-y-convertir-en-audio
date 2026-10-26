import React, { useState, useRef } from 'react';
import { Upload, FileText, ShieldCheck, Zap, HardDrive, Smartphone } from 'lucide-react';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  loadingProgress?: { current: number; total: number; stage: string };
  onOpenGoogleDrive?: () => void;
  onOpenInstallApp?: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelected,
  isLoading,
  loadingProgress,
  onOpenGoogleDrive,
  onOpenInstallApp,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        onFileSelected(file);
      } else {
        alert('Por favor selecciona un archivo PDF válido (.pdf).');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Hero presentation */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2.5 sm:mb-3">
          Convierte tus PDFs en audiolibros interactivos
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Extrae texto limpio de cualquier PDF y escúchalo con Web Speech API o con el modelo neuronal Kokoro-82M. 100% en el navegador, sin APIs de pago ni servidores.
        </p>

        {/* Quick App install pill on mobile */}
        {onOpenInstallApp && (
          <div className="mt-3 inline-flex items-center">
            <button
              type="button"
              onClick={onOpenInstallApp}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Disponible como App instalable (APK / WebAPK)</span>
            </button>
          </div>
        )}
      </div>

      {/* Drop zone container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              Extrayendo y procesando documento...
            </h3>
            {loadingProgress && loadingProgress.total > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Página {loadingProgress.current} de {loadingProgress.total} ({loadingProgress.stage === 'reading' ? 'Leyendo texto' : 'Limpiando formato'})
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-1">
              Arrastra y suelta tu archivo PDF aquí
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
              o selecciona desde tu dispositivo o tu Google Drive
            </p>

            {/* Action buttons: Local PDF + Google Drive */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm sm:max-w-none">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors cursor-pointer text-center"
              >
                Seleccionar PDF del dispositivo
              </button>

              {onOpenGoogleDrive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenGoogleDrive();
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                >
                  <HardDrive className="w-4 h-4 text-emerald-500" />
                  <span>Subir desde Google Drive</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Feature bullets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">100% Privado y Local</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Tus documentos nunca salen de tu ordenador ni móvil. Todo el procesamiento se ejecuta en tu propio navegador.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Doble Motor de Voz</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Elige entre Web Speech API para lectura instantánea, o Kokoro-82M para una calidad neuronal de audiolibro.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Limpieza Inteligente</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Elimina automáticamente guiones de salto de línea, encabezados recurrentes y números de página para una narración fluida.
          </p>
        </div>
      </div>
    </div>
  );
};
