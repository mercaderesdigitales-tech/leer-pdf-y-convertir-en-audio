import React, { useState, useRef } from 'react';
import { X, Download, AlertCircle, Sparkles, CheckCircle2, Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { ExportProgress, PageRange, SentenceItem } from '../types';
import {
  EXPORT_VOICES,
  exportSentencesToAudio,
  previewSentenceAudio,
  triggerDownload,
} from '../services/audioExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  allSentences: SentenceItem[];
  pageRange: PageRange;
  totalPages: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documentName,
  allSentences,
  pageRange,
  totalPages,
}) => {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(EXPORT_VOICES[0].id);
  const [exportRange, setExportRange] = useState<PageRange>(pageRange);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preview audio state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  // Filter sentences belonging to selected page range
  const targetSentences = allSentences.filter(
    (s) => s.pageIndex >= exportRange.start - 1 && s.pageIndex <= exportRange.end - 1
  );

  const handleTestPreview = async () => {
    if (targetSentences.length === 0) return;
    const testText = targetSentences[0].text;

    // If currently playing, stop
    if (previewAudioRef.current && isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    setIsPreviewLoading(true);
    setErrorMsg(null);

    try {
      const blob = await previewSentenceAudio(testText, selectedVoiceId);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;

      audio.onended = () => {
        setIsPreviewPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setIsPreviewPlaying(false);
        setErrorMsg('Error al reproducir la vista previa de audio.');
      };

      await audio.play();
      setIsPreviewPlaying(true);
    } catch (err: any) {
      setErrorMsg(`Error al generar vista previa: ${err?.message || 'Fallo de audio.'}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleStartExport = async () => {
    if (targetSentences.length === 0) {
      setErrorMsg('No hay frases en el rango de páginas seleccionado.');
      return;
    }

    // Stop preview if playing
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    const controller = new AbortController();
    setAbortController(controller);
    setErrorMsg(null);
    setIsDone(false);

    try {
      const result = await exportSentencesToAudio({
        sentences: targetSentences,
        format,
        voiceId: selectedVoiceId,
        fileName: documentName,
        onProgress: (p) => setProgress(p),
        signal: controller.signal,
      });

      setIsDone(true);
      triggerDownload(result.blob, result.fileName);
    } catch (err: any) {
      if (controller.signal.aborted) {
        setErrorMsg('Exportación cancelada.');
      } else {
        setErrorMsg(err?.message || 'Error al procesar la exportación.');
      }
    } finally {
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
    setProgress(null);
  };

  const handleClose = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (abortController) {
      handleCancel();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Exportar Audiolibro a Archivo
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Voice Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Voz Neuronal para la Grabación
            </label>
            <div className="space-y-2">
              {EXPORT_VOICES.map((v) => (
                <label
                  key={v.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedVoiceId === v.id
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportVoice"
                    value={v.id}
                    checked={selectedVoiceId === v.id}
                    onChange={() => setSelectedVoiceId(v.id)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    disabled={Boolean(progress?.isExporting)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{v.flag}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {v.name}
                      </span>
                      {v.recommended && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                          Recomendada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {v.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Test Preview Button */}
            {targetSentences.length > 0 && (
              <div className="mt-2.5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Prueba la pronunciación de esta voz antes de exportar:
                </span>
                <button
                  type="button"
                  onClick={handleTestPreview}
                  disabled={isPreviewLoading || Boolean(progress?.isExporting)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 border border-indigo-200 dark:border-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  {isPreviewLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cargando...</span>
                    </>
                  ) : isPreviewPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Detener</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Probar voz (1 frase)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Formato de Archivo
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                disabled={Boolean(progress?.isExporting)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  format === 'mp3'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                MP3 (Universal)
                <span className="block text-[11px] font-normal text-slate-400 mt-0.5">Comprimido para móviles</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('wav')}
                disabled={Boolean(progress?.isExporting)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  format === 'wav'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                WAV (PCM)
                <span className="block text-[11px] font-normal text-slate-400 mt-0.5">Máxima fidelidad sin pérdida</span>
              </button>
            </div>
          </div>

          {/* Page Range Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Rango de Páginas a Incluir
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[11px] text-slate-400">Desde página</span>
                <input
                  type="number"
                  min="1"
                  max={exportRange.end}
                  value={exportRange.start}
                  disabled={Boolean(progress?.isExporting)}
                  onChange={(e) =>
                    setExportRange({
                      ...exportRange,
                      start: Math.max(1, Math.min(parseInt(e.target.value) || 1, exportRange.end)),
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div className="flex-1">
                <span className="text-[11px] text-slate-400">Hasta página</span>
                <input
                  type="number"
                  min={exportRange.start}
                  max={totalPages}
                  value={exportRange.end}
                  disabled={Boolean(progress?.isExporting)}
                  onChange={(e) =>
                    setExportRange({
                      ...exportRange,
                      end: Math.max(exportRange.start, Math.min(parseInt(e.target.value) || totalPages, totalPages)),
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Total: {targetSentences.length} frases en {exportRange.end - exportRange.start + 1} página(s).
            </p>
          </div>

          {/* Progress bar during export */}
          {progress && progress.isExporting && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30">
              <div className="flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200 font-medium mb-1.5">
                <span className="truncate max-w-xs">{progress.statusText}</span>
                <span className="font-mono">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {isDone && (
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>¡Archivo de audio descargado correctamente!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          {progress?.isExporting ? (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}

          <button
            onClick={handleStartExport}
            disabled={Boolean(progress?.isExporting) || targetSentences.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar y Descargar {format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
