import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  Zap,
} from 'lucide-react';
import { SentenceItem, TTSEngineType } from '../types';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentSentence: SentenceItem | undefined;
  currentIndex: number;
  totalSentences: number;
  speed: number;
  volume: number;
  engine: TTSEngineType;
  onPlay: () => void;
  onPause: () => void;
  onNextSentence: () => void;
  onPrevSentence: () => void;
  onSeekDelta: (seconds: number) => void;
  onSeekRatio: (ratio: number) => void;
  onChangeSpeed: (speed: number) => void;
  onChangeVolume: (volume: number) => void;
  onOpenSettings: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  isPaused,
  currentSentence,
  currentIndex,
  totalSentences,
  speed,
  volume,
  engine,
  onPlay,
  onPause,
  onNextSentence,
  onPrevSentence,
  onSeekDelta,
  onSeekRatio,
  onChangeSpeed,
  onChangeVolume,
  onOpenSettings,
}) => {
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeekRatio(ratio);
  };

  const progressPercent = totalSentences > 0 ? ((currentIndex + 1) / totalSentences) * 100 : 0;

  // Format estimated minutes and seconds
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Estimate remaining time
  const remainingSec = currentSentence ? currentSentence.estimatedDurationSec : 0;

  return (
    <aside aria-label="Reproductor de audio" className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
      {/* Interactive Progress Bar */}
      <div
        onClick={handleProgressBarClick}
        className="w-full h-2 bg-slate-200 dark:bg-slate-800 cursor-pointer relative group transition-all hover:h-2.5"
        title="Haz clic para saltar a cualquier punto del documento"
      >
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-150 relative"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-xs opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6">
          {/* Left: Current Sentence Preview & Counters */}
          <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={currentSentence?.text}>
                {currentSentence ? currentSentence.text : 'Listo para reproducir'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                <span>Frase {totalSentences > 0 ? currentIndex + 1 : 0} / {totalSentences}</span>
                <span aria-hidden="true">·</span>
                <span>Página {currentSentence ? currentSentence.pageIndex + 1 : 1}</span>
                <span aria-hidden="true">·</span>
                <span>{progressPercent.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0">
            {/* Prev Sentence */}
            <button
              onClick={onPrevSentence}
              disabled={currentIndex <= 0}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-slate-600 rounded-full transition-colors cursor-pointer"
              title="Frase anterior"
              aria-label="Frase anterior"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* -10 seconds */}
            <button
              onClick={() => onSeekDelta(-10)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              title="Retroceder 10 segundos"
              aria-label="Retroceder 10 segundos"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play / Pause button */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
              title={isPlaying ? 'Pausar reproducción' : 'Iniciar lectura'}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* +10 seconds */}
            <button
              onClick={() => onSeekDelta(10)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              title="Adelantar 10 segundos"
              aria-label="Adelantar 10 segundos"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Next Sentence */}
            <button
              onClick={onNextSentence}
              disabled={currentIndex >= totalSentences - 1}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-slate-600 rounded-full transition-colors cursor-pointer"
              title="Siguiente frase"
              aria-label="Siguiente frase"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Speed, Volume & Engine Badges */}
          <div className="flex items-center justify-end gap-3 w-full sm:w-1/3 shrink-0">
            {/* Speed Selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const currIdx = speeds.indexOf(speed);
                  const nextSpeed = speeds[(currIdx + 1) % speeds.length];
                  onChangeSpeed(nextSpeed);
                }}
                className="px-2 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-mono cursor-pointer"
                title="Cambiar velocidad de lectura"
              >
                {speed}x
              </button>
            </div>

            {/* Volume slider */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => onChangeVolume(volume > 0 ? 0 : 1)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                title={volume === 0 ? 'Activar sonido' : 'Silenciar'}
              >
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                title={`Volumen: ${Math.round(volume * 100)}%`}
              />
            </div>

            {/* Engine Quick Switch Indicator */}
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Ajustes de voz y motor"
            >
              {engine === 'webspeech' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Rápido</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>Kokoro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
