import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Scissors,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Sparkles,
  RefreshCw,
  Check,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  getPdfInfo,
  renderPdfPageThumbnails,
  splitPdfByPages,
  downloadBlob,
  PageThumbnail,
} from '../services/pdfSplitter';

interface SplitPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | null;
  onOpenSplitPdfInReader?: (file: File) => void;
}

export const SplitPdfModal: React.FC<SplitPdfModalProps> = ({
  isOpen,
  onClose,
  initialFile,
  onOpenSplitPdfInReader,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Page range state ("Desde página" -> "Hasta página")
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
  const [startInput, setStartInput] = useState<string>('1');
  const [endInput, setEndInput] = useState<string>('1');

  // Selected pages set (allows range selection + clicking individual page thumbnails)
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<'range' | 'custom'>('range');

  // Custom output filename state
  const [customFileName, setCustomFileName] = useState<string>('');
  const [hasEditedFileName, setHasEditedFileName] = useState<boolean>(false);

  // Thumbnails state
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [isRenderingThumbs, setIsRenderingThumbs] = useState<boolean>(false);

  // Processing & result state
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [splitResult, setSplitResult] = useState<{
    blob: Blob;
    file: File;
    fileName: string;
    pageCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbAbortRef = useRef<AbortController | null>(null);

  // Generate suggested filename based on original file and range
  const suggestedFileName = useMemo(() => {
    if (!sourceFile) return 'documento_dividido';
    const baseName = sourceFile.name.replace(/\.pdf$/i, '').trim() || 'documento';
    if (selectedPages.length === 0) return `${baseName}_dividido`;
    if (selectedPages.length === 1) {
      return `${baseName}_pagina_${selectedPages[0]}`;
    }
    const minP = selectedPages[0];
    const maxP = selectedPages[selectedPages.length - 1];
    return `${baseName}_paginas_${minP}_a_${maxP}`;
  }, [sourceFile, selectedPages]);

  // Keep customFileName synced with suggestedFileName unless the user manually edited it
  useEffect(() => {
    if (!hasEditedFileName && sourceFile) {
      setCustomFileName(suggestedFileName);
    }
  }, [suggestedFileName, hasEditedFileName, sourceFile]);

  // Load a PDF file into the splitter
  const loadPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMsg('Por favor, selecciona un archivo con formato PDF válido.');
      return;
    }

    // Cancel any ongoing thumbnail render
    if (thumbAbortRef.current) {
      thumbAbortRef.current.abort();
    }

    setIsLoadingPdf(true);
    setErrorMsg(null);
    setSplitResult(null);
    setThumbnails([]);
    setHasEditedFileName(false);

    try {
      const info = await getPdfInfo(file);
      const pagesCount = Math.max(1, info.totalPages);

      setSourceFile(file);
      setTotalPages(pagesCount);
      setStartPage(1);
      setEndPage(pagesCount);
      setStartInput('1');
      setEndInput(String(pagesCount));
      setSelectionMode('range');

      const initialRange: number[] = [];
      for (let i = 1; i <= pagesCount; i++) {
        initialRange.push(i);
      }
      setSelectedPages(initialRange);

      // Start rendering visual thumbnails in background
      const abortCtrl = new AbortController();
      thumbAbortRef.current = abortCtrl;
      setIsRenderingThumbs(true);

      renderPdfPageThumbnails(
        file,
        Math.min(pagesCount, 60),
        (thumb) => {
          if (!abortCtrl.signal.aborted) {
            setThumbnails((prev) => {
              if (prev.some((t) => t.pageNumber === thumb.pageNumber)) return prev;
              return [...prev, thumb];
            });
          }
        },
        abortCtrl.signal
      )
        .catch(() => {
          // Non-fatal if thumbnails fail
        })
        .finally(() => {
          if (!abortCtrl.signal.aborted) {
            setIsRenderingThumbs(false);
          }
        });
    } catch (err: any) {
      console.error('Error al cargar el PDF para dividir:', err);
      setErrorMsg(
        err?.message || 'No se pudo leer el archivo PDF. Asegúrate de que no esté dañado.'
      );
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // When modal opens, if initialFile is available and no sourceFile is loaded yet, preload it
  useEffect(() => {
    if (isOpen && initialFile && !sourceFile) {
      loadPdfFile(initialFile);
    }
    return () => {
      if (!isOpen && thumbAbortRef.current) {
        thumbAbortRef.current.abort();
      }
    };
  }, [isOpen, initialFile]);

  // Apply range helper
  const applyPageRange = (newStart: number, newEnd: number) => {
    if (totalPages <= 0) return;
    const clampedStart = Math.max(1, Math.min(totalPages, newStart));
    const clampedEnd = Math.max(clampedStart, Math.min(totalPages, newEnd));

    setStartPage(clampedStart);
    setEndPage(clampedEnd);
    setStartInput(String(clampedStart));
    setEndInput(String(clampedEnd));
    setSelectionMode('range');
    setSplitResult(null);

    const rangePages: number[] = [];
    for (let i = clampedStart; i <= clampedEnd; i++) {
      rangePages.push(i);
    }
    setSelectedPages(rangePages);
  };

  const handleStartInputChange = (val: string) => {
    setStartInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      const validEnd = Math.max(parsed, endPage);
      setStartPage(parsed);
      setEndPage(validEnd);
      setEndInput(String(validEnd));
      setSelectionMode('range');
      setSplitResult(null);

      const rangePages: number[] = [];
      for (let i = parsed; i <= validEnd; i++) {
        rangePages.push(i);
      }
      setSelectedPages(rangePages);
    }
  };

  const handleEndInputChange = (val: string) => {
    setEndInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      const validStart = Math.min(startPage, parsed);
      setStartPage(validStart);
      setEndPage(parsed);
      setStartInput(String(validStart));
      setSelectionMode('range');
      setSplitResult(null);

      const rangePages: number[] = [];
      for (let i = validStart; i <= parsed; i++) {
        rangePages.push(i);
      }
      setSelectedPages(rangePages);
    }
  };

  const handleBlurRangeInputs = () => {
    const parsedStart = parseInt(startInput, 10);
    const parsedEnd = parseInt(endInput, 10);
    const safeStart = isNaN(parsedStart) ? 1 : Math.max(1, Math.min(totalPages, parsedStart));
    const safeEnd = isNaN(parsedEnd)
      ? totalPages
      : Math.max(safeStart, Math.min(totalPages, parsedEnd));
    applyPageRange(safeStart, safeEnd);
  };

  // Toggle a single page when clicking its thumbnail
  const handleTogglePage = (pageNum: number) => {
    setSplitResult(null);
    setSelectionMode('custom');
    setSelectedPages((prev) => {
      const exists = prev.includes(pageNum);
      const next = exists ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b);
      if (next.length > 0) {
        setStartPage(next[0]);
        setEndPage(next[next.length - 1]);
        setStartInput(String(next[0]));
        setEndInput(String(next[next.length - 1]));
      }
      return next;
    });
  };

  // Execute PDF split & download
  const handleSplitAndDownload = async () => {
    if (!sourceFile || selectedPages.length === 0) return;

    setIsSplitting(true);
    setErrorMsg(null);

    try {
      const finalName = (customFileName || suggestedFileName).trim();
      const result = await splitPdfByPages(sourceFile, selectedPages, finalName);
      setSplitResult(result);
      downloadBlob(result.blob, result.fileName);
    } catch (err: any) {
      console.error('Error al dividir el PDF:', err);
      setErrorMsg(err?.message || 'Error al generar el nuevo PDF.');
    } finally {
      setIsSplitting(false);
    }
  };

  // Open the split PDF directly in the VozPDF voice reader
  const handleOpenInReader = async () => {
    if (!onOpenSplitPdfInReader) return;

    if (splitResult) {
      onOpenSplitPdfInReader(splitResult.file);
      onClose();
      return;
    }

    if (!sourceFile || selectedPages.length === 0) return;
    setIsSplitting(true);
    setErrorMsg(null);

    try {
      const finalName = (customFileName || suggestedFileName).trim();
      const result = await splitPdfByPages(sourceFile, selectedPages, finalName);
      setSplitResult(result);
      onOpenSplitPdfInReader(result.file);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al abrir el PDF dividido.');
    } finally {
      setIsSplitting(false);
    }
  };

  if (!isOpen) return null;

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
              loadPdfFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Dividir y Extraer Páginas PDF
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona desde qué página hasta qué página quieres extraer y ponle el nombre que desees
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Upload or Change PDF */}
          {!sourceFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  loadPdfFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 dark:border-indigo-800/70 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all group"
            >
              {isLoadingPdf ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Analizando páginas del PDF...
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    Sube el PDF que deseas dividir
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                    Arrastra y suelta tu archivo PDF aquí o pulsa para seleccionarlo desde tu dispositivo. El corte se realiza al instante sin perder calidad.
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
              {/* Active PDF Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {sourceFile.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Total: <strong className="text-slate-700 dark:text-slate-200">{totalPages}</strong>{' '}
                      {totalPages === 1 ? 'página' : 'páginas'} •{' '}
                      {(sourceFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Cambiar PDF
                </button>
              </div>

              {/* Step 2: Range Selection ("Desde qué página" -> "Hasta qué página") */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      1. Selecciona el rango de páginas a extraer
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100/80 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                    {selectedPages.length} de {totalPages}{' '}
                    {selectedPages.length === 1 ? 'página seleccionada' : 'páginas seleccionadas'}
                  </span>
                </div>

                {/* From Page -> To Page Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  {/* Desde la página */}
                  <div className="sm:col-span-5 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Desde la página
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyPageRange(startPage - 1, endPage)}
                        disabled={startPage <= 1}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={startInput}
                        onChange={(e) => handleStartInputChange(e.target.value)}
                        onBlur={handleBlurRangeInputs}
                        className="w-full text-center text-base font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => applyPageRange(startPage + 1, Math.max(startPage + 1, endPage))}
                        disabled={startPage >= totalPages}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Arrow Divider */}
                  <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-slate-400">
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  {/* Hasta la página */}
                  <div className="sm:col-span-5 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Hasta la página
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyPageRange(Math.min(startPage, endPage - 1), endPage - 1)}
                        disabled={endPage <= 1}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={endInput}
                        onChange={(e) => handleEndInputChange(e.target.value)}
                        onBlur={handleBlurRangeInputs}
                        className="w-full text-center text-base font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => applyPageRange(startPage, endPage + 1)}
                        disabled={endPage >= totalPages}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Range Shortcuts */}
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 mr-1">Selección rápida:</span>
                    <button
                      type="button"
                      onClick={() => applyPageRange(1, totalPages)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      Todas (1-{totalPages})
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPageRange(1, Math.max(1, Math.floor(totalPages / 2)))}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      1ª Mitad (1-{Math.max(1, Math.floor(totalPages / 2))})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyPageRange(Math.floor(totalPages / 2) + 1, totalPages)
                      }
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      2ª Mitad ({Math.floor(totalPages / 2) + 1}-{totalPages})
                    </button>
                    {totalPages >= 5 && (
                      <button
                        type="button"
                        onClick={() => applyPageRange(1, 5)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                      >
                        Primeras 5 págs.
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => applyPageRange(startPage, startPage)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      Solo pág. {startPage}
                    </button>
                  </div>
                )}
              </div>

              {/* Visual Page Thumbnails Grid */}
              {(thumbnails.length > 0 || isRenderingThumbs) && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vista previa de páginas (pulsa una página para marcarla o desmarcarla)
                    </p>
                    {isRenderingThumbs && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generando vista previa...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    {thumbnails.map((thumb) => {
                      const isSelected = selectedPages.includes(thumb.pageNumber);
                      return (
                        <button
                          key={thumb.pageNumber}
                          type="button"
                          onClick={() => handleTogglePage(thumb.pageNumber)}
                          className={`group relative flex flex-col items-center p-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs'
                              : 'border-transparent bg-white/70 dark:bg-slate-900/60 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="relative w-full aspect-[1/1.35] rounded-lg overflow-hidden bg-white shadow-2xs border border-slate-200 dark:border-slate-800">
                            <img
                              src={thumb.dataUrl}
                              alt={`Página ${thumb.pageNumber}`}
                              className="w-full h-full object-contain"
                            />
                            <div
                              className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-900/60 text-white'
                              }`}
                            >
                              {isSelected ? <Check className="w-3 h-3" /> : thumb.pageNumber}
                            </div>
                          </div>
                          <span
                            className={`mt-1 text-[11px] font-semibold ${
                              isSelected
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            Pág. {thumb.pageNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Custom Output Filename */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="split-pdf-filename"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    2. Nombre del nuevo archivo PDF
                  </label>
                  {hasEditedFileName && (
                    <button
                      type="button"
                      onClick={() => {
                        setHasEditedFileName(false);
                        setCustomFileName(suggestedFileName);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Usar nombre sugerido
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    id="split-pdf-filename"
                    type="text"
                    value={customFileName}
                    onChange={(e) => {
                      setHasEditedFileName(true);
                      setCustomFileName(e.target.value);
                      setSplitResult(null);
                    }}
                    placeholder={suggestedFileName}
                    className="w-full pl-4 pr-16 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 pointer-events-none">
                    .pdf
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  El archivo se descargará como:{' '}
                  <strong className="text-slate-700 dark:text-slate-300 font-mono">
                    {(customFileName || suggestedFileName).replace(/\.pdf$/i, '')}.pdf
                  </strong>
                </p>
              </div>

              {/* Success Confirmation Banner after Splitting */}
              {splitResult && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        ¡PDF creado y descargado con éxito!
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {splitResult.fileName} ({splitResult.pageCount}{' '}
                        {splitResult.pageCount === 1 ? 'página' : 'páginas'})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadBlob(splitResult.blob, splitResult.fileName)}
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
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {sourceFile && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {onOpenSplitPdfInReader && (
                <button
                  type="button"
                  onClick={handleOpenInReader}
                  disabled={isSplitting || selectedPages.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Abrir y leer estas páginas</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSplitAndDownload}
                disabled={isSplitting || selectedPages.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSplitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Crear y Descargar PDF ({selectedPages.length} págs.)</span>
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
