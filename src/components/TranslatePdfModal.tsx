import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Languages,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Globe,
  Eye,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  ExtractedPdfForTranslation,
  TranslatedPageResult,
  TranslationProgress,
  extractPdfForTranslation,
  translatePdfAndBuildDocument,
} from '../services/pdfTranslator';
import { downloadBlob } from '../services/pdfSplitter';

interface TranslatePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | null;
  onOpenTranslatedPdfInReader?: (file: File) => void;
}

export const TranslatePdfModal: React.FC<TranslatePdfModalProps> = ({
  isOpen,
  onClose,
  initialFile,
  onOpenTranslatedPdfInReader,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedPdfForTranslation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ page: number; total: number }>({
    page: 0,
    total: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Language state
  const [sourceLangCode, setSourceLangCode] = useState<string>('en');
  const [targetLangCode, setTargetLangCode] = useState<string>('es');

  // Page range state
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);

  // Custom filename state
  const [customFileName, setCustomFileName] = useState<string>('');
  const [hasEditedFileName, setHasEditedFileName] = useState<boolean>(false);

  // Translation execution state
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [partialTranslatedPages, setPartialTranslatedPages] = useState<TranslatedPageResult[]>([]);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [translatedResult, setTranslatedResult] = useState<{
    blob: Blob;
    file: File;
    fileName: string;
    pageCount: number;
    translatedPages: TranslatedPageResult[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Suggested output filename
  const suggestedFileName = useMemo(() => {
    if (!sourceFile) return 'documento_traducido';
    const base = sourceFile.name.replace(/\.pdf$/i, '').trim() || 'documento';
    const targetObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLangCode);
    const langSuffix = targetObj ? targetObj.name.toLowerCase().replace(/\s+/g, '_') : targetLangCode;
    return `${base}_traducido_${langSuffix}`;
  }, [sourceFile, targetLangCode]);

  useEffect(() => {
    if (!hasEditedFileName && sourceFile) {
      setCustomFileName(suggestedFileName);
    }
  }, [suggestedFileName, hasEditedFileName, sourceFile]);

  // Analyze uploaded PDF and detect its language
  const handleLoadAndDetectPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMsg('Por favor, selecciona un archivo con formato PDF válido.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setTranslatedResult(null);
    setPartialTranslatedPages([]);
    setTranslationProgress(null);
    setHasEditedFileName(false);

    try {
      const data = await extractPdfForTranslation(file, (page, total) => {
        setAnalyzeProgress({ page, total });
      });

      setSourceFile(file);
      setExtractedData(data);
      setSourceLangCode(data.detectedLangCode);

      // Pick smart default target language (if detected is Spanish -> English, else -> Spanish)
      const defaultTarget = data.detectedLangCode === 'es' ? 'en' : 'es';
      setTargetLangCode(defaultTarget);

      setStartPage(1);
      setEndPage(data.totalPages);
    } catch (err: any) {
      console.error('Error analizando PDF para traducir:', err);
      setErrorMsg(
        err?.message || 'No se pudo analizar el PDF. Verifica que el archivo sea válido.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Preload initialFile when modal opens if not already loaded
  useEffect(() => {
    if (isOpen && initialFile && !sourceFile && !isAnalyzing) {
      handleLoadAndDetectPdf(initialFile);
    }
    return () => {
      if (!isOpen && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, initialFile]);

  const handleStartTranslation = async () => {
    if (!sourceFile || !extractedData) return;
    if (sourceLangCode === targetLangCode) {
      setErrorMsg('El idioma de destino debe ser diferente al idioma de origen.');
      return;
    }

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    setIsTranslating(true);
    setErrorMsg(null);
    setTranslatedResult(null);
    setPartialTranslatedPages([]);

    try {
      const finalName = (customFileName || suggestedFileName).trim();
      const res = await translatePdfAndBuildDocument(
        sourceFile,
        extractedData,
        sourceFile.name,
        sourceLangCode,
        targetLangCode,
        startPage,
        endPage,
        finalName,
        (prog, partial) => {
          setTranslationProgress(prog);
          setPartialTranslatedPages(partial);
        },
        abortCtrl.signal
      );

      setTranslatedResult(res);
      downloadBlob(res.blob, res.fileName);
    } catch (err: any) {
      if (err?.message !== 'Traducción cancelada por el usuario.') {
        setErrorMsg(err?.message || 'Ocurrió un error durante la traducción del PDF.');
      }
    } finally {
      setIsTranslating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTranslating(false);
    setTranslationProgress(null);
  };

  const handleOpenInVozPdf = () => {
    if (translatedResult && onOpenTranslatedPdfInReader) {
      onOpenTranslatedPdfInReader(translatedResult.file);
      onClose();
    }
  };

  if (!isOpen) return null;

  const detectedLangObj = SUPPORTED_LANGUAGES.find(
    (l) => l.code === extractedData?.detectedLangCode
  );
  const targetLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLangCode) || SUPPORTED_LANGUAGES[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleLoadAndDetectPdf(e.target.files[0]);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Traducir Documento PDF
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detecta el idioma automáticamente y genera un nuevo PDF traducido al idioma que elijas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload Zone when no PDF is loaded */}
          {!sourceFile || !extractedData ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleLoadAndDetectPdf(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => !isAnalyzing && fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 dark:border-indigo-800/70 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all group"
            >
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Extrayendo texto y detectando idioma del PDF...
                  </p>
                  {analyzeProgress.total > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Página {analyzeProgress.page} de {analyzeProgress.total}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    Sube el PDF que deseas traducir
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                    Detectaremos automáticamente el idioma original del documento y crearemos un nuevo PDF traducido al idioma que selecciones.
                  </p>
                  <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors">
                    <Upload className="w-4 h-4" />
                    Seleccionar archivo PDF
                  </span>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Active PDF + Auto-Detected Language Banner */}
              <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {sourceFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {extractedData.totalPages}{' '}
                        {extractedData.totalPages === 1 ? 'página' : 'páginas'} •{' '}
                        {(sourceFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isTranslating}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Cambiar PDF
                  </button>
                </div>

                {/* Detected Language Pill */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Idioma detectado: {detectedLangObj?.flag || '🌐'}{' '}
                      {extractedData.detectedLangName} ({extractedData.detectedConfidence}%
                      confianza)
                    </span>
                  </div>
                  {extractedData.sampleText && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-md">
                      "{extractedData.sampleText.slice(0, 95)}..."
                    </p>
                  )}
                </div>
              </div>

              {/* Language Selection Box (Source -> Target) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. Idioma detectado e idioma al que deseas traducir
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  {/* Source Language */}
                  <div className="sm:col-span-5 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Idioma del documento (Detectado)
                    </label>
                    <select
                      value={sourceLangCode}
                      disabled={isTranslating}
                      onChange={(e) => {
                        setSourceLangCode(e.target.value);
                        setTranslatedResult(null);
                      }}
                      className="w-full text-sm font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option
                          key={lang.code}
                          value={lang.code}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {lang.flag} {lang.name} ({lang.nativeName})
                          {lang.code === extractedData.detectedLangCode ? ' — Detectado' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Arrow */}
                  <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-indigo-500">
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  {/* Target Language */}
                  <div className="sm:col-span-5 bg-indigo-50/60 dark:bg-indigo-950/40 p-3.5 rounded-xl border-2 border-indigo-500/70 dark:border-indigo-500/60">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1.5">
                      Traducir al idioma
                    </label>
                    <select
                      value={targetLangCode}
                      disabled={isTranslating}
                      onChange={(e) => {
                        setTargetLangCode(e.target.value);
                        setTranslatedResult(null);
                      }}
                      className="w-full text-sm font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option
                          key={lang.code}
                          value={lang.code}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {lang.flag} {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Target Language Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1">Idiomas frecuentes:</span>
                  {SUPPORTED_LANGUAGES.slice(0, 7).map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      disabled={isTranslating}
                      onClick={() => {
                        setTargetLangCode(lang.code);
                        setTranslatedResult(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        targetLangCode === lang.code
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500'
                      }`}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Range & Output Filename Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Page Range */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    2. Páginas a traducir (1 a {extractedData.totalPages})
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="block text-[10px] text-slate-400">Desde pág.</span>
                      <input
                        type="number"
                        min={1}
                        max={extractedData.totalPages}
                        disabled={isTranslating}
                        value={startPage}
                        onChange={(e) => {
                          const v = Math.max(
                            1,
                            Math.min(extractedData.totalPages, Number(e.target.value) || 1)
                          );
                          setStartPage(v);
                          if (v > endPage) setEndPage(v);
                        }}
                        className="w-full text-sm font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none font-mono"
                      />
                    </div>
                    <span className="text-slate-400 font-bold">–</span>
                    <div className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="block text-[10px] text-slate-400">Hasta pág.</span>
                      <input
                        type="number"
                        min={startPage}
                        max={extractedData.totalPages}
                        disabled={isTranslating}
                        value={endPage}
                        onChange={(e) => {
                          const v = Math.max(
                            startPage,
                            Math.min(
                              extractedData.totalPages,
                              Number(e.target.value) || extractedData.totalPages
                            )
                          );
                          setEndPage(v);
                        }}
                        className="w-full text-sm font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Output Filename */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      3. Nombre del nuevo PDF
                    </label>
                    {hasEditedFileName && (
                      <button
                        type="button"
                        onClick={() => {
                          setHasEditedFileName(false);
                          setCustomFileName(suggestedFileName);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Sugerido
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      disabled={isTranslating}
                      value={customFileName}
                      onChange={(e) => {
                        setHasEditedFileName(true);
                        setCustomFileName(e.target.value);
                      }}
                      placeholder={suggestedFileName}
                      className="w-full pl-3.5 pr-14 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-3 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500">
                      .pdf
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Translation Progress Bar */}
              {isTranslating && translationProgress && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      {translationProgress.stage === 'generating'
                        ? 'Maquetando y generando el nuevo archivo PDF...'
                        : `Traduciendo página ${translationProgress.currentPage} de ${translationProgress.totalPagesToTranslate} al ${targetLangObj.name}...`}
                    </span>
                    <span className="font-mono font-bold">{translationProgress.percent}%</span>
                  </div>
                  <progress
                    value={translationProgress.percent}
                    max={100}
                    className="w-full h-2.5 rounded-full overflow-hidden accent-indigo-600 [&::-webkit-progress-bar]:bg-indigo-200/70 dark:[&::-webkit-progress-bar]:bg-indigo-900/60 [&::-webkit-progress-value]:bg-indigo-600 dark:[&::-webkit-progress-value]:bg-indigo-500 [&::-moz-progress-bar]:bg-indigo-600"
                  />
                </div>
              )}

              {/* Live / Completed Preview of Translated Text */}
              {partialTranslatedPages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowPreview((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {showPreview ? 'Ocultar' : 'Mostrar'} vista previa de la traducción (
                        {partialTranslatedPages.length}{' '}
                        {partialTranslatedPages.length === 1 ? 'página' : 'páginas'})
                      </span>
                    </button>
                  </div>

                  {showPreview && (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-3">
                      {partialTranslatedPages.map((p) => (
                        <div
                          key={p.pageNumber}
                          className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            <span>Página {p.pageNumber}</span>
                            <span>{targetLangObj.flag} {targetLangObj.name}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                            {p.translatedParagraphs.join('\n\n')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Success Banner */}
              {translatedResult && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        ¡Nuevo PDF en {targetLangObj.name} creado y descargado!
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {translatedResult.fileName} ({translatedResult.pageCount}{' '}
                        {translatedResult.pageCount === 1 ? 'página' : 'páginas'})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlob(translatedResult.blob, translatedResult.fileName)
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Descargar de nuevo
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {isTranslating ? (
            <button
              type="button"
              onClick={handleCancelTranslation}
              className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              Cancelar traducción
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}

          {sourceFile && extractedData && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {translatedResult && onOpenTranslatedPdfInReader && (
                <button
                  type="button"
                  onClick={handleOpenInVozPdf}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Abrir y escuchar PDF traducido</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStartTranslation}
                disabled={isTranslating}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Traduciendo y creando PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      Traducir al {targetLangObj.name} y Descargar PDF
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
