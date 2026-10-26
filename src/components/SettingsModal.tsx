import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Sliders,
  Volume2,
  Gauge,
  Check,
  Cpu,
  Play,
  Volume1,
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Music,
} from 'lucide-react';
import { CleaningOptions, KokoroModelProgress, PageRange, TTSEngineType, VoiceOption } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: TTSEngineType;
  onChangeEngine: (engine: TTSEngineType) => void;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  onTestVoice?: (voiceId: string) => void;
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
  onTestVoice,
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
  const [langFilter, setLangFilter] = useState<'all' | 'es' | 'en' | 'other'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Masculino' | 'Femenino'>('all');
  const [voiceSearchQuery, setVoiceSearchQuery] = useState<string>('');
  const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);
  const [showMobileHelp, setShowMobileHelp] = useState<boolean>(false);

  if (!isOpen) return null;

  // Filter voices according to current engine
  const engineVoices = voices.filter((v) => v.engine === engine);

  // Counts for each tab
  const countAll = engineVoices.length;
  const countEs = engineVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('es')).length;
  const countEn = engineVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('en')).length;
  const countOther = engineVoices.filter((v) => {
    const l = (v.lang || '').toLowerCase();
    return !l.startsWith('es') && !l.startsWith('en');
  }).length;
  const countMale = engineVoices.filter((v) => v.gender === 'Masculino').length;
  const countFemale = engineVoices.filter((v) => v.gender === 'Femenino').length;

  // Apply language filter, gender filter and search query
  const currentVoices = engineVoices.filter((v) => {
    const l = (v.lang || '').toLowerCase();
    const matchesLang =
      langFilter === 'all'
        ? true
        : langFilter === 'es'
        ? l.startsWith('es')
        : langFilter === 'en'
        ? l.startsWith('en')
        : !l.startsWith('es') && !l.startsWith('en');

    if (!matchesLang) return false;

    if (genderFilter !== 'all') {
      if (v.gender !== genderFilter) return false;
    }

    if (voiceSearchQuery.trim()) {
      const q = voiceSearchQuery.toLowerCase();
      const nameMatch = v.name.toLowerCase().includes(q);
      const langMatch = (v.lang || '').toLowerCase().includes(q);
      const genderMatch = (v.gender || '').toLowerCase().includes(q);
      return nameMatch || langMatch || genderMatch;
    }

    return true;
  });

  const selectedVoice = engineVoices.find((v) => v.id === selectedVoiceId) || engineVoices[0];

  const handleTestVoice = (voiceId: string) => {
    setIsTestingVoice(true);
    onTestVoice?.(voiceId);
    setTimeout(() => setIsTestingVoice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
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
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Engine Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Motor de Síntesis de Voz
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option A: Fast Web Speech API */}
              <button
                type="button"
                onClick={() => onChangeEngine('webspeech')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  engine === 'webspeech'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Rápido (Nativo)</span>
                  </div>
                  {engine === 'webspeech' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Web Speech API del móvil/navegador. Instantáneo y sin descargas de modelos.
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
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  engine === 'kokoro'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Alta Calidad (Kokoro)</span>
                  </div>
                  {engine === 'kokoro' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Red neuronal local Kokoro-82M. Sonido de audiolibro ultra natural y exportable.
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
                    Descargar modelo (~86MB en caché)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Mobile-Optimized Voice Selector */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Voz del Narrador
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {currentVoices.length} de {engineVoices.length} disponibles
                </span>
              </div>

              {/* Search input for instant voice lookup */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar voz por nombre o país (ej. Jorge, Google, Diego, Michael, Español...)"
                  value={voiceSearchQuery}
                  onChange={(e) => setVoiceSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {voiceSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setVoiceSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filter Row 1: Language filter pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setLangFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    langFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Todos los idiomas ({countAll})
                </button>
                <button
                  type="button"
                  onClick={() => setLangFilter('es')}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    langFilter === 'es'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Español ({countEs})
                </button>
                <button
                  type="button"
                  onClick={() => setLangFilter('en')}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    langFilter === 'en'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Inglés ({countEn})
                </button>
                {countOther > 0 && (
                  <button
                    type="button"
                    onClick={() => setLangFilter('other')}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      langFilter === 'other'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Otros ({countOther})
                  </button>
                )}
              </div>

              {/* Filter Row 2: Gender filter pills for fast mobile filtering */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Género:</span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] overflow-x-auto flex-1">
                  <button
                    type="button"
                    onClick={() => setGenderFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      genderFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Todas ({engineVoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter('Masculino')}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                      genderFilter === 'Masculino'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🧔</span>
                    <span>Masculinas ({countMale})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter('Femenino')}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                      genderFilter === 'Femenino'
                        ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-300 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>👩</span>
                    <span>Femeninas ({countFemale})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Selected voice showcase with test audio button */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <span>Voz activa seleccionada:</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                    selectedVoice?.gender === 'Masculino'
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                      : 'bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300'
                  }`}>
                    {selectedVoice?.gender === 'Masculino' ? '🧔 Masculina' : '👩 Femenina'}
                  </span>
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {selectedVoice ? selectedVoice.name : 'Ninguna seleccionada'}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {selectedVoice?.lang} {selectedVoice?.quality ? `· ${selectedVoice.quality}` : ''} · Tono: {pitch <= 0.85 ? '🧔 Grave (Masc)' : pitch >= 1.1 ? '👩 Agudo (Fem)' : '🎙️ Normal'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleTestVoice(selectedVoiceId || (selectedVoice?.id ?? ''))}
                disabled={isTestingVoice}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Probar cómo suena esta voz en tu dispositivo"
              >
                <Volume1 className={`w-3.5 h-3.5 ${isTestingVoice ? 'animate-bounce' : ''}`} />
                <span>{isTestingVoice ? 'Sonando...' : 'Probar'}</span>
              </button>
            </div>

            {/* Mobile-friendly voice selection list */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 bg-white dark:bg-slate-900">
              {currentVoices.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <p className="font-medium">
                    {genderFilter === 'Masculino'
                      ? 'Tu móvil o navegador no tiene voces masculinas instaladas de fábrica.'
                      : 'No se encontraron voces con los filtros seleccionados.'}
                  </p>
                  {genderFilter === 'Masculino' ? (
                    <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200 text-left space-y-1.5">
                      <p className="font-semibold flex items-center gap-1">
                        <span>💡 Solución rápida:</span>
                      </p>
                      <p>
                        Pulsa abajo en <strong>"🧔 Modo Masculino (Grave)"</strong> para que el motor модуле el tono de la voz estándar a un timbre masculino al instante.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onChangePitch(0.80);
                          setGenderFilter('all');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        <span>Activar Tono Masculino (0.8x)</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLangFilter('all');
                        setGenderFilter('all');
                        setVoiceSearchQuery('');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 text-xs underline font-medium cursor-pointer"
                    >
                      Restablecer filtros y ver todas las voces
                    </button>
                  )}
                </div>
              ) : (
                currentVoices.map((v) => {
                  const isSelected = v.id === selectedVoiceId;
                  const isMale = v.gender === 'Masculino';

                  return (
                    <div
                      key={v.id}
                      onClick={() => onSelectVoice(v.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div
                          className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="truncate">{v.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                          isMale
                            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                            : 'bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300'
                        }`}>
                          {isMale ? '🧔 Masc' : '👩 Fem'}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">({v.lang})</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectVoice(v.id);
                          handleTestVoice(v.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        title="Probar esta voz"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile Help Accordion: How to install native male voices */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setShowMobileHelp((prev) => !prev)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>📱 ¿Cómo activar más voces masculinas en Android y iPhone?</span>
                </div>
                {showMobileHelp ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showMobileHelp && (
                <div className="px-3.5 pb-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-2 border-t border-slate-200 dark:border-slate-700/60 pt-2.5">
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">En Android (Servicios de Google):</strong>
                    <ol className="list-decimal list-inside pl-1 space-y-0.5 mt-0.5">
                      <li>Abre <strong>Ajustes del teléfono</strong> &gt; <strong>Accesibilidad</strong>.</li>
                      <li>Pulsa en <strong>Salida de texto a voz</strong>.</li>
                      <li>Toca el icono de engranaje ⚙️ junto a <em>Motor de Google</em>.</li>
                      <li>Selecciona <strong>Instalar datos de voz</strong> &gt; <strong>Español</strong>.</li>
                      <li>Descarga la <strong>Voz 2</strong> o <strong>Voz 3</strong> (paquetes masculinos).</li>
                    </ol>
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">En iPhone / iPad (iOS):</strong>
                    <ol className="list-decimal list-inside pl-1 space-y-0.5 mt-0.5">
                      <li>Abre <strong>Ajustes</strong> &gt; <strong>Accesibilidad</strong> &gt; <strong>Contenido leído</strong>.</li>
                      <li>Entra en <strong>Voces</strong> &gt; <strong>Español</strong>.</li>
                      <li>Descarga la voz de <strong>Jorge</strong> (voz masculina oficial).</li>
                    </ol>
                  </div>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    ⚡ <em>Recuerda: También puedes activar el botón "🧔 Modo Masculino (Grave)" en la sección de tono abajo para escuchar cualquier voz con timbre masculino de inmediato sin instalar nada.</em>
                  </p>
                </div>
              )}
            </div>
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
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>0.5x</span>
                <span>1.0x (Normal)</span>
                <span>1.5x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Pitch & Simulated Gender Timbre (Solves mobile male voice limitation) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-indigo-500" />
                  Tono de Voz y Timbre (Especial Móviles)
                </span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  {pitch <= 0.85
                    ? `🧔 Grave (Masculino) ${pitch}x`
                    : pitch >= 1.15
                    ? `👩 Agudo (Femenino) ${pitch}x`
                    : `🎙️ Natural (${pitch}x)`}
                </span>
              </div>

              {/* Quick Gender Timbre Presets */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onChangePitch(0.80)}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    pitch <= 0.85
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>🧔</span>
                  <span>Modo Masculino</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangePitch(1.00)}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    pitch > 0.85 && pitch < 1.15
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>🎙️</span>
                  <span>Tono Natural</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangePitch(1.15)}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    pitch >= 1.15
                      ? 'border-pink-600 bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 ring-1 ring-pink-600 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>👩</span>
                  <span>Modo Femenino</span>
                </button>
              </div>

              {/* Fine-tuning Pitch Range Slider */}
              <div className="pt-1">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={pitch}
                  onChange={(e) => onChangePitch(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>0.5x (Grave)</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">0.8x (Masculino recomendado)</span>
                  <span>1.0x (Original)</span>
                  <span>1.5x (Agudo)</span>
                </div>
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
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
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
        <div className="flex items-center justify-end px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer text-center"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
