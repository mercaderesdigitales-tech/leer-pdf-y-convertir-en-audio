import React from 'react';
import { X, Sparkles, Zap, Sliders, Volume2, Gauge, Check, Cpu } from 'lucide-react';
import { CleaningOptions, KokoroModelProgress, PageRange, TTSEngineType, VoiceOption } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: TTSEngineType;
  onChangeEngine: (engine: TTSEngineType) => void;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  volume: number;
  onChangeVolume: (volume: number) => void;
  pitch: number;
  onChangePitch: (pitch: number) => void;
  pageRange: PageRange;
  totalPages: number;
  onChangePageRange: (range: PageRange) => void;
  cleaningOptions: CleaningOptions;
  onChangeCleaningOptions: (opts: CleaningOptions) => void;
  kokoroProgress: KokoroModelProgress;
  onInitKokoro: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  engine,
  onChangeEngine,
  voices,
  selectedVoiceId,
  onSelectVoice,
  speed,
  onChangeSpeed,
  volume,
  onChangeVolume,
  pitch,
  onChangePitch,
  pageRange,
  totalPages,
  onChangePageRange,
  cleaningOptions,
  onChangeCleaningOptions,
  kokoroProgress,
  onInitKokoro,
}) => {
  if (!isOpen) return null;

  // Filter voices according to current engine
  const currentVoices = voices.filter(v => v.engine === engine);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Configuración de Voz y Lectura
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Engine Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Motor de Síntesis de Voz
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Fast Web Speech API */}
              <button
                type="button"
                onClick={() => onChangeEngine('webspeech')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  engine === 'webspeech'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Rápido</span>
                  </div>
                  {engine === 'webspeech' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Web Speech API del navegador. Lectura instantánea y sin consumo de datos ni descargas.
                </p>
              </button>

              {/* Option B: Kokoro Neural */}
              <button
                type="button"
                onClick={() => {
                  onChangeEngine('kokoro');
                  if (kokoroProgress.status === 'idle') {
                    onInitKokoro();
                  }
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  engine === 'kokoro'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Alta Calidad</span>
                  </div>
                  {engine === 'kokoro' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Kokoro-82M neuronal (ONNX WebGPU / WASM). Voz ultra natural y compatible con exportación a MP3.
                </p>
              </button>
            </div>

            {/* Kokoro Download Progress Banner */}
            {engine === 'kokoro' && kokoroProgress.status !== 'ready' && (
              <div className="mt-3 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30">
                <div className="flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {kokoroProgress.message || 'Preparando motor Kokoro-82M...'}
                  </span>
                  <span className="font-mono">{kokoroProgress.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${kokoroProgress.progress}%` }}
                  />
                </div>
                {kokoroProgress.status === 'idle' && (
                  <button
                    onClick={onInitKokoro}
                    className="mt-2.5 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer"
                  >
                    Descargar modelo (una sola vez, ~86MB)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Voice Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Voz del Narrador ({currentVoices.length} disponibles)
            </label>
            <select
              value={selectedVoiceId}
              onChange={(e) => onSelectVoice(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.lang}) {v.gender ? `- ${v.gender}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              {engine === 'webspeech'
                ? 'Las voces provienen de tu sistema operativo (Google, Microsoft, Apple o eSpeak).'
                : 'Voces neuronales sintetizadas localmente por Kokoro-82M.'}
            </p>
          </div>

          {/* Section 3: Speed, Pitch & Volume Controls */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Speed */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                  Velocidad de Lectura
                </span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{speed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={speed}
                onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>0.5x</span>
                <span>1.0x (Normal)</span>
                <span>1.5x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Volume */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                  Volumen
                </span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          {/* Section 4: Page Range */}
          {totalPages > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Rango de Páginas a Leer
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400">Desde página</label>
                  <input
                    type="number"
                    min="1"
                    max={pageRange.end}
                    value={pageRange.start}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(parseInt(e.target.value) || 1, pageRange.end));
                      onChangePageRange({ ...pageRange, start: val });
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400">Hasta página</label>
                  <input
                    type="number"
                    min={pageRange.start}
                    max={totalPages}
                    value={pageRange.end}
                    onChange={(e) => {
                      const val = Math.max(pageRange.start, Math.min(parseInt(e.target.value) || totalPages, totalPages));
                      onChangePageRange({ ...pageRange, end: val });
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Text Cleaning Filters */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Filtros de Limpieza de Texto
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={cleaningOptions.removeHyphenation}
                  onChange={(e) =>
                    onChangeCleaningOptions({ ...cleaningOptions, removeHyphenation: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Unir palabras partidas con guión al final de línea (silabificación)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={cleaningOptions.removePageNumbers}
                  onChange={(e) =>
                    onChangeCleaningOptions({ ...cleaningOptions, removePageNumbers: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Omitir números de página aislados (ej. "Página 12", "12 / 40")</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={cleaningOptions.removeRepetitiveHeaders}
                  onChange={(e) =>
                    onChangeCleaningOptions({ ...cleaningOptions, removeRepetitiveHeaders: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Filtrar encabezados y pies de página recurrentes</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
