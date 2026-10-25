import React, { useState } from 'react';
import { AlertTriangle, Scan, CheckCircle2, Loader2 } from 'lucide-react';
import { performOcrOnPdfPage } from '../services/ocrService';

interface ScannedAlertProps {
  scannedCount: number;
  totalPages: number;
  originalFile: File | null;
  onOcrCompleted: (pageNumber: number, text: string) => void;
}

export const ScannedAlert: React.FC<ScannedAlertProps> = ({
  scannedCount,
  totalPages,
  originalFile,
  onOcrCompleted,
}) => {
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ page: number; progress: number; status: string } | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState(false);

  if (scannedCount === 0 && !ocrSuccess) return null;

  const handleRunOcr = async () => {
    if (!originalFile) {
      alert('Para ejecutar OCR necesitas haber cargado un archivo PDF real.');
      return;
    }

    setIsRunningOcr(true);
    setOcrSuccess(false);

    try {
      // Run OCR on the first scanned page as demonstration / processing
      for (let p = 1; p <= Math.min(totalPages, 3); p++) {
        setOcrProgress({ page: p, progress: 10, status: `Procesando página ${p}...` });
        const text = await performOcrOnPdfPage(originalFile, p, (progress, status) => {
          setOcrProgress({ page: p, progress, status });
        });
        if (text && text.trim().length > 0) {
          onOcrCompleted(p, text);
        }
      }
      setOcrSuccess(true);
    } catch (err: any) {
      alert(`Error durante el reconocimiento OCR: ${err?.message}`);
    } finally {
      setIsRunningOcr(false);
      setOcrProgress(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 mt-4">
      <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 text-slate-800 dark:text-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-300">
                Páginas sin capa de texto digital detectadas ({scannedCount} de {totalPages})
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                Este PDF contiene páginas escaneadas como imágenes sin texto seleccionable. Puedes aplicar OCR en el navegador para extraer y leer su contenido.
              </p>
            </div>
          </div>

          {originalFile && (
            <button
              onClick={handleRunOcr}
              disabled={isRunningOcr}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              {isRunningOcr ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{ocrProgress ? `${ocrProgress.progress}%` : 'Ejecutando OCR...'}</span>
                </>
              ) : (
                <>
                  <Scan className="w-3.5 h-3.5" />
                  <span>Extraer texto con OCR (Tesseract)</span>
                </>
              )}
            </button>
          )}
        </div>

        {isRunningOcr && ocrProgress && (
          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/40">
            <div className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-300 font-medium mb-1">
              <span>{ocrProgress.status}</span>
              <span className="font-mono">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 transition-all duration-200"
                style={{ width: `${ocrProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {ocrSuccess && (
          <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Texto reconocido e incorporado a la lectura.</span>
          </div>
        )}
      </div>
    </div>
  );
};
