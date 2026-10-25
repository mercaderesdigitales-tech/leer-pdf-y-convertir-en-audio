import React, { useEffect, useRef, useState } from 'react';
import { PDFDocumentData } from '../types';
import { Play, FileText, ChevronLeft, Eye, MousePointerClick } from 'lucide-react';

interface TextReaderViewProps {
  document: PDFDocumentData;
  currentSentenceIndex: number;
  onSentenceClick: (index: number) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onGoHome: () => void;
  isPlaying: boolean;
}

export const TextReaderView: React.FC<TextReaderViewProps> = ({
  document,
  currentSentenceIndex,
  onSentenceClick,
  autoScroll,
  onToggleAutoScroll,
  onGoHome,
  isPlaying,
}) => {
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | 'all'>('all');
  const activeSentenceRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Floating button state for text marked with mouse
  const [floatingAction, setFloatingAction] = useState<{
    x: number;
    y: number;
    sentenceIndex: number;
  } | null>(null);

  // Auto-scroll to active sentence when it changes
  useEffect(() => {
    if (autoScroll && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex, autoScroll]);

  // Handle mouse selection: detect marked text and show "Leer desde aquí"
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setFloatingAction(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      let node: Node | null = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }

      const sentenceEl = (node as Element | null)?.closest('[data-sentence-index]');
      if (sentenceEl) {
        const idx = parseInt(sentenceEl.getAttribute('data-sentence-index') || '-1', 10);
        if (idx >= 0) {
          const rect = range.getBoundingClientRect();
          setFloatingAction({
            x: Math.min(window.innerWidth - 80, Math.max(80, rect.left + rect.width / 2)),
            y: Math.max(70, rect.top - 44),
            sentenceIndex: idx,
          });
          return;
        }
      }
    } catch {
      // Ignore selection errors
    }
    setFloatingAction(null);
  };

  const fontSizeClasses = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="w-full max-w-5xl mx-auto px-4 py-6 relative"
    >
      {/* Floating Action Button when text is marked with mouse */}
      {floatingAction && (
        <div
          style={{
            position: 'fixed',
            left: `${floatingAction.x}px`,
            top: `${floatingAction.y}px`,
            transform: 'translateX(-50%)',
          }}
          className="z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSentenceClick(floatingAction.sentenceIndex);
              setFloatingAction(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-full shadow-2xl ring-2 ring-white dark:ring-slate-900 cursor-pointer transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Leer desde aquí</span>
          </button>
        </div>
      )}

      {/* Top document toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onGoHome}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Volver a inicio y cargar otro PDF"
            aria-label="Volver a inicio"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
              {document.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{document.totalPages} {document.totalPages === 1 ? 'página' : 'páginas'}</span>
              <span aria-hidden="true">·</span>
              <span>{document.totalWords.toLocaleString()} palabras</span>
              <span aria-hidden="true">·</span>
              <span>{document.allSentences.length} frases</span>
            </div>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-3">
          {/* Page filter buttons */}
          {document.totalPages > 1 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSelectedPageIndex('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedPageIndex === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Todas
              </button>
              {document.pages.slice(0, 8).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    selectedPageIndex === idx
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title={`Ir a página ${p.pageNumber}`}
                >
                  P.{p.pageNumber}
                </button>
              ))}
            </div>
          )}

          {/* Font size control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFontSize('sm')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                fontSize === 'sm' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Texto pequeño"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize('base')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                fontSize === 'base' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Texto normal"
            >
              A
            </button>
            <button
              onClick={() => setFontSize('lg')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                fontSize === 'lg' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Texto grande"
            >
              A+
            </button>
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={onToggleAutoScroll}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              autoScroll
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Mantener la frase activa en el centro de la pantalla"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{autoScroll ? 'Auto-scroll activo' : 'Auto-scroll'}</span>
          </button>
        </div>
      </div>

      {/* Helpful usage hint banner */}
      <div className="mb-6 px-3.5 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-300">
        <MousePointerClick className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>
          <strong>Navegación interactiva:</strong> Haz clic en cualquier frase o marca texto con el ratón para comenzar a escuchar exactamente desde esa parte del documento.
        </span>
      </div>

      {/* Pages content stream */}
      <div className="space-y-8 pb-32">
        {document.pages.map((page, pageIdx) => {
          if (selectedPageIndex !== 'all' && selectedPageIndex !== pageIdx) {
            return null;
          }

          return (
            <article
              key={page.pageNumber}
              className="p-6 sm:p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
            >
              {/* Page header */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800/60 select-none">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Página {page.pageNumber}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {page.charCount} caracteres
                </span>
              </div>

              {/* Page paragraphs and sentences */}
              <div className={`space-y-4 text-slate-700 dark:text-slate-300 font-serif ${fontSizeClasses[fontSize]}`}>
                {page.paragraphs.map((paragraph) => (
                  <p key={paragraph.id} className="text-justify leading-relaxed">
                    {paragraph.sentences.map((sentence) => {
                      const globalIdx = document.allSentences.findIndex(s => s.id === sentence.id);
                      const isActive = globalIdx === currentSentenceIndex;

                      return (
                        <span
                          key={sentence.id}
                          data-sentence-index={globalIdx}
                          ref={isActive ? activeSentenceRef : null}
                          onClick={() => {
                            setFloatingAction(null);
                            onSentenceClick(globalIdx);
                          }}
                          className={`cursor-pointer transition-all duration-150 inline rounded-sm px-1 py-0.5 ${
                            isActive
                              ? 'bg-amber-200 dark:bg-amber-900/60 text-slate-950 dark:text-white font-medium shadow-xs underline decoration-amber-500 decoration-2 underline-offset-4 ring-2 ring-amber-400/50'
                              : 'hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-slate-950 dark:hover:text-white hover:ring-1 hover:ring-amber-300/40'
                          }`}
                          title="Haz clic o marca con el ratón para leer a partir de aquí"
                        >
                          {sentence.text}{' '}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
