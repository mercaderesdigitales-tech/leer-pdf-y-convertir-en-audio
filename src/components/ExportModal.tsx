import React, { useState, useRef, useEffect } from 'react';
import { X, Download, AlertCircle, Sparkles, CheckCircle2, Pause, Volume2, Loader2, Info, Zap, Clock, Cpu } from 'lucide-react';
import { ExportProgress, PageRange, SentenceItem, TTSEngineType } from '../types';
import {
  EXPORT_VOICES,
  audioExportQueueManager,
  previewSentenceAudio,
  triggerDownload,
} from '../services/audioExportQueue';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  allSentences: SentenceItem[];
  pageRange: PageRange;
  totalPages: number;
  activeVoiceName?: string;
  activeEngine?: TTSEngineType;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documentName,
  allSentences,
  pageRange,
  totalPages,
  activeVoiceName = 'Voz predeterminada del navegador',
}) => {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(EXPORT_VOICES[0].id);

  // Raw string inputs for start/end pages to allow free typing without aggressive clamping
  const [startInput, setStartInput] = useState<string>(String(pageRange.start || 1));
  const [endInput, setEndInput] = useState<string>(String(pageRange.end || totalPages || 1));

  // Actual clamped numeric range
  const [exportRange, setExportRange] = useState<PageRange>({
    start: Math.max(1, Math.min(pageRange.start || 1, totalPages || 1)),
    end: Math.max(1, Math.min(pageRange.end || totalPages || 1, totalPages || 1)),
  });

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [lastExported, setLastExported] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preview audio state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Reset inputs when modal opens or totalPages changes
  useEffect(() => {
    if (isOpen) {
      const s = Math.max(1, Math.min(pageRange.start || 1, totalPages || 1));
      const e = Math.max(s, Math.min(pageRange.end || totalPages || 1, totalPages || 1));
      setStartInput(String(s));
      setEndInput(String(e));
      setExportRange({ start: s, end: e });
      setIsDone(false);
      setErrorMsg(null);
      setProgress(null);
    }
  }, [isOpen, pageRange, totalPages]);

  if (!isOpen) return null;

  // Filter sentences belonging to selected page range
  const targetSentences = allSentences.filter(
    (s) => s.pageIndex >= exportRange.start - 1 && s.pageIndex <= exportRange.end - 1
  );

  const selectedVoice = EXPORT_VOICES.find((v) => v.id === selectedVoiceId) || EXPORT_VOICES[0];

  // Calculate estimated time based on selected voice and sentence count
  const estimatedSeconds = Math.max(
    2,
    Math.round(targetSentences.length * selectedVoice.estimatedSecondsPerSentence)
  );

  const handleStartInputChange = (val: string) => {
    setStartInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setExportRange((prev) => ({
        ...prev,
        start: parsed,
        end: Math.max(parsed, prev.end),
      }));
    }
  };

  const handleStartInputBlur = () => {
    const parsed = parseInt(startInput, 10);
    const safeStart = isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, totalPages));
    setStartInput(String(safeStart));
    const safeEnd = Math.max(safeStart, exportRange.end);
    setEndInput(String(safeEnd));
    setExportRange({ start: safeStart, end: safeEnd });
  };

  const handleEndInputChange = (val: string) => {
    setEndInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setExportRange((prev) => ({
        ...prev,
        end: parsed,
        start: Math.min(prev.start, parsed),
      }));
    }
  };

  const handleEndInputBlur = () => {
    const parsed = parseInt(endInput, 10);
    const safeEnd = isNaN(parsed) ? totalPages : Math.max(1, Math.min(parsed, totalPages));
    const safeStart = Math.min(exportRange.start, safeEnd);
    setStartInput(String(safeStart));
    setEndInput(String(safeEnd));
    setExportRange({ start: safeStart, end: safeEnd });
  };

  const handleSetQuickRange = (start: number, end: number) => {
    const s = Math.max(1, Math.min(start, totalPages));
    const e = Math.max(s, Math.min(end, totalPages));
    setStartInput(String(s));
    setEndInput(String(e));
    setExportRange({ start: s, end: e });
  };

  const handleTestPreview = async () => {
    if (targetSentences.length === 0) return;
    const testText = targetSentences[0].text;

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
        setErrorMsg('Error al reproducir la muestra de audio en el navegador.');
      };

      await audio.play();
      setIsPreviewPlaying(true);
    } catch (err: any) {
      setErrorMsg(`Error al generar muestra de voz: ${err?.message || 'Fallo de audio.'}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleStartExport = async () => {
    const parsedStart = parseInt(startInput, 10);
    const parsedEnd = parseInt(endInput, 10);
    const finalStart = isNaN(parsedStart) ? 1 : Math.max(1, Math.min(parsedStart, totalPages));
    const finalEnd = isNaN(parsedEnd) ? totalPages : Math.max(finalStart, Math.min(parsedEnd, totalPages));

    const finalRange = { start: finalStart, end: finalEnd };
    setStartInput(String(finalStart));
    setEndInput(String(finalEnd));
    setExportRange(finalRange);

    const sentencesToExport = allSentences.filter(
      (s) => s.pageIndex >= finalRange.start - 1 && s.pageIndex <= finalRange.end - 1
    );

    if (sentencesToExport.length === 0) {
      setErrorMsg('No hay frases en el rango de páginas seleccionado.');
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    const controller = new AbortController();
    setAbortController(controller);
    setErrorMsg(null);
    setIsDone(false);

    try {
      // Execute the export job entirely off the main thread via AudioExportQueue
      const result = await audioExportQueueManager.exportAudio({
        sentences: sentencesToExport,
        format,
        voiceId: selectedVoiceId,
        fileName: documentName,
        onProgress: (p) => setProgress(p),
        signal: controller.signal,
      });

      setProgress(null);
      setIsDone(true);
      setLastExported(result);
      triggerDownload(result.blob, result.fileName);
    } catch (err: any) {
      setProgress(null);
      if (controller.signal.aborted) {
        setErrorMsg('Exportación cancelada por el usuario.');
      } else {
        setErrorMsg(err?.message || 'Error al procesar la exportación del audiolibro.');
      }
    } finally {
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
    audioExportQueueManager.cancelCurrentJob();
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

  const handleReDownload = () => {
    if (lastExported) {
      triggerDownload(lastExported.blob, lastExported.fileName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[92vh]"
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
          {/* Explanation Banner regarding Web Speech vs Audio Export */}
          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-xl text-xs text-blue-950 dark:text-blue-200">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Voz activa en el reproductor: <strong>{activeVoiceName}</strong></span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
              <strong>¿Por qué la exportación usa un motor de voz propio?</strong> El reproductor usa la síntesis del navegador (Web Speech API). Por restricciones de seguridad, ningún navegador permite guardar esa voz directamente en un archivo MP3. Para generar tu audiolibro descargable, la app utiliza redes neuronales avanzadas ejecutadas directamente en tu dispositivo.
            </p>
          </div>

          {/* Web Worker Queue Zero-Freeze Notice */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-200/70 dark:border-indigo-800/50 text-indigo-950 dark:text-indigo-200 text-xs">
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Cola Web Worker en segundo plano:</strong> La síntesis de voz y la codificación MP3 se procesan fuera del hilo de la interfaz. La pantalla y la barra de progreso nunca se congelan.
            </span>
          </div>

          {/* Voice Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Selecciona la Voz de Grabación (100% Natural)
              </label>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Est.: ~{estimatedSeconds < 60 ? `${estimatedSeconds}s` : `${Math.round(estimatedSeconds / 60)}m`}</span>
              </div>
            </div>

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
                      {v.tag && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60">
                          {v.tag}
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
                  Comprueba el sonido de la voz seleccionada:
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
                      <span>Generando muestra...</span>
                    </>
                  ) : isPreviewPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Detener</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>🎧 Probar voz natural (1 frase)</span>
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
                <span className="block text-[11px] font-normal text-slate-400 mt-0.5">Codificado en Web Worker</span>
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
                <span className="block text-[11px] font-normal text-slate-400 mt-0.5">Fidelidad de estudio 16-bit</span>
              </button>
            </div>
          </div>

          {/* Page Range Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Rango de Páginas a Incluir
              </label>
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleSetQuickRange(1, totalPages)}
                  disabled={Boolean(progress?.isExporting)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Todas (1-{totalPages})
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickRange(exportRange.start, exportRange.start)}
                  disabled={Boolean(progress?.isExporting)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Pág {exportRange.start}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickRange(1, Math.min(3, totalPages))}
                  disabled={Boolean(progress?.isExporting)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  1 a {Math.min(3, totalPages)}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[11px] text-slate-400">Desde página</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={startInput}
                  disabled={Boolean(progress?.isExporting)}
                  onChange={(e) => handleStartInputChange(e.target.value)}
                  onBlur={handleStartInputBlur}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex-1">
                <span className="text-[11px] text-slate-400">Hasta página</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={endInput}
                  disabled={Boolean(progress?.isExporting)}
                  onChange={(e) => handleEndInputChange(e.target.value)}
                  onBlur={handleEndInputBlur}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Total a exportar: <strong>{targetSentences.length} frases</strong> ({exportRange.end - exportRange.start + 1} de {totalPages} páginas seleccionadas).
            </p>
          </div>

          {/* Progress bar during export */}
          {progress && progress.isExporting && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200 font-medium mb-1.5">
                <span className="truncate max-w-xs">{progress.statusText}</span>
                <span className="font-mono font-bold">{progress.percent}%</span>
              </div>
              <div className="w-full h-2.5 bg-indigo-200/60 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-150 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Done state */}
          {isDone && (
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>¡Audiolibro generado y descargado con éxito!</span>
              </div>
              {lastExported && (
                <button
                  type="button"
                  onClick={handleReDownload}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-[11px] transition-colors cursor-pointer shrink-0"
                >
                  Descargar de nuevo
                </button>
              )}
            </div>
          )}

          {/* Error alert */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
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
            {progress?.isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generar y Descargar {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
