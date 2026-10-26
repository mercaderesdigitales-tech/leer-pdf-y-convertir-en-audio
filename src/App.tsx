import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  CleaningOptions,
  HistoryItem,
  KokoroModelProgress,
  PageRange,
  PDFDocumentData,
  SentenceItem,
  TTSEngineType,
  VoiceOption,
} from './types';
import { extractPDFData } from './services/pdfExtractor';
import { DEFAULT_CLEANING_OPTIONS, processPageData } from './services/textCleaner';
import { WebSpeechEngine } from './services/webSpeechEngine';
import { kokoroService, KOKORO_VOICES } from './services/kokoroService';
import {
  checkExistingProgress,
  deleteDocumentFromHistory,
  generateDocId,
  getDocumentFromHistory,
  getRecentDocuments,
  saveDocumentToHistory,
  updateReadingProgress,
} from './services/historyStorage';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { TextReaderView } from './components/TextReaderView';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { ScannedAlert } from './components/ScannedAlert';
import { HistoryList } from './components/HistoryList';
import { HowItWorksModal } from './components/HowItWorksModal';
import { ResumeDialog } from './components/ResumeDialog';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { InstallAppModal } from './components/InstallAppModal';
import { UploadChoiceModal } from './components/UploadChoiceModal';

export default function App() {
  const [isUploadChoiceOpen, setIsUploadChoiceOpen] = useState<boolean>(false);
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vozpdf_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('vozpdf_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Document state
  const [documentData, setDocumentData] = useState<PDFDocumentData | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number; stage: string }>({
    current: 0,
    total: 0,
    stage: 'reading',
  });

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Resume dialog state
  const [resumeCandidate, setResumeCandidate] = useState<{
    doc: PDFDocumentData;
    lastSentenceIndex: number;
    progressPercent: number;
  } | null>(null);

  // Settings & Preferences
  const [engine, setEngine] = useState<TTSEngineType>(() => {
    return (localStorage.getItem('vozpdf_engine') as TTSEngineType) || 'webspeech';
  });

  const [speed, setSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('vozpdf_speed');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('vozpdf_volume');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [pitch, setPitch] = useState<number>(() => {
    const saved = localStorage.getItem('vozpdf_pitch');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [cleaningOptions, setCleaningOptions] = useState<CleaningOptions>(() => {
    const saved = localStorage.getItem('vozpdf_cleaning');
    return saved ? JSON.parse(saved) : DEFAULT_CLEANING_OPTIONS;
  });

  const [pageRange, setPageRange] = useState<PageRange>({ start: 1, end: 1 });
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Voices state
  const [webVoices, setWebVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    return localStorage.getItem('vozpdf_voice') || '';
  });

  // Kokoro model progress
  const [kokoroProgress, setKokoroProgress] = useState<KokoroModelProgress>({
    status: 'idle',
    progress: 0,
  });

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState<boolean>(false);
  const [isInstallAppOpen, setIsInstallAppOpen] = useState<boolean>(false);

  // Engines instances
  const webSpeechRef = useRef<WebSpeechEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  const refreshHistory = async () => {
    const items = await getRecentDocuments();
    setHistory(items);
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  // Initialize WebSpeechEngine and listen for voices
  useEffect(() => {
    const ws = new WebSpeechEngine();
    webSpeechRef.current = ws;

    const handleNewVoices = (fresh: VoiceOption[]) => {
      setWebVoices(fresh);
      if (!selectedVoiceId && fresh.length > 0) {
        const spanish = fresh.find((voice) => voice.lang.startsWith('es'));
        const chosen = spanish ? spanish.id : fresh[0].id;
        setSelectedVoiceId(chosen);
        ws.setVoice(chosen);
      }
    };

    ws.setOnVoicesChanged(handleNewVoices);
    handleNewVoices(ws.loadVoices());

    // Callbacks for WebSpeech
    ws.setCallbacks({
      onSentenceStart: (idx) => {
        setCurrentSentenceIndex(idx);
        setIsPlaying(true);
        setIsPaused(false);
      },
      onSentenceEnd: (idx) => {
        // Automatic advance handled inside engine
      },
      onFinishedAll: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
      onError: (err) => {
        console.error('WebSpeech Error:', err);
      },
    });

    // Callbacks for Kokoro
    kokoroService.setCallbacks({
      onSentenceStart: (idx) => {
        setCurrentSentenceIndex(idx);
        setIsPlaying(true);
        setIsPaused(false);
      },
      onSentenceEnd: (idx) => {
        // Automatic advance handled inside service
      },
      onFinishedAll: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
      onModelProgress: (p) => {
        setKokoroProgress(p);
      },
      onError: (err) => {
        console.error('Kokoro Error:', err);
      },
    });

    return () => {
      ws.stop();
      kokoroService.stop();
    };
  }, []);

  // Sync engines and page ranges when document changes
  useEffect(() => {
    if (documentData) {
      setPageRange({ start: 1, end: documentData.totalPages });
      webSpeechRef.current?.setSentences(documentData.allSentences, currentSentenceIndex);
      kokoroService.setSentences(documentData.allSentences, currentSentenceIndex);
    }
  }, [documentData]);

  // Persist reading progress to IndexedDB as user reads
  useEffect(() => {
    if (documentData && documentData.allSentences.length > 0) {
      const docId = generateDocId(documentData.name, documentData.fileSize, documentData.totalPages);
      const currentSentence = documentData.allSentences[currentSentenceIndex];
      const text = currentSentence ? currentSentence.text : '';

      updateReadingProgress(docId, currentSentenceIndex, documentData.allSentences.length, text);
    }
  }, [currentSentenceIndex, documentData]);

  // Combine voices list
  const allVoices = useMemo<VoiceOption[]>(() => {
    return [...webVoices, ...KOKORO_VOICES];
  }, [webVoices]);

  // Sync speed, pitch, volume to current engine
  useEffect(() => {
    webSpeechRef.current?.setSpeed(speed);
    kokoroService.setSpeed(speed);
    localStorage.setItem('vozpdf_speed', speed.toString());
  }, [speed]);

  useEffect(() => {
    webSpeechRef.current?.setVolume(volume);
    kokoroService.setVolume(volume);
    localStorage.setItem('vozpdf_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    webSpeechRef.current?.setPitch(pitch);
    localStorage.setItem('vozpdf_pitch', pitch.toString());
  }, [pitch]);

  useEffect(() => {
    localStorage.setItem('vozpdf_engine', engine);
  }, [engine]);

  useEffect(() => {
    localStorage.setItem('vozpdf_cleaning', JSON.stringify(cleaningOptions));
  }, [cleaningOptions]);

  // Handle voice selection
  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    localStorage.setItem('vozpdf_voice', voiceId);
    if (engine === 'webspeech') {
      webSpeechRef.current?.setVoice(voiceId);
    } else {
      kokoroService.setVoice(voiceId);
    }
  };

  // Test voice sample (essential for mobile audio activation and verification)
  const handleTestVoice = (voiceId: string) => {
    if (engine === 'webspeech') {
      webSpeechRef.current?.testVoice(voiceId);
    } else {
      kokoroService.setVoice(voiceId);
      // Play a short sample
      if (documentData && documentData.allSentences.length > 0) {
        kokoroService.play(currentSentenceIndex);
      }
    }
  };

  // Handle engine switch
  const handleChangeEngine = (newEngine: TTSEngineType) => {
    if (newEngine === engine) return;

    const activeIndex = currentSentenceIndex;
    const wasPlaying = isPlaying;

    if (engine === 'webspeech') {
      webSpeechRef.current?.stop();
    } else {
      kokoroService.stop();
    }

    setEngine(newEngine);

    if (newEngine === 'kokoro') {
      const defaultKokoro = KOKORO_VOICES[0].id;
      setSelectedVoiceId(defaultKokoro);
      kokoroService.setVoice(defaultKokoro);
      if (wasPlaying && documentData) {
        kokoroService.play(activeIndex);
      }
    } else {
      const defaultWeb = webVoices.find((v) => v.lang.startsWith('es'))?.id || webVoices[0]?.id || '';
      setSelectedVoiceId(defaultWeb);
      webSpeechRef.current?.setVoice(defaultWeb);
      if (wasPlaying && documentData) {
        webSpeechRef.current?.play(activeIndex);
      }
    }
  };

  // Return to home page / load another PDF
  const handleGoHome = async () => {
    // Stop any active playback
    webSpeechRef.current?.stop();
    kokoroService.stop();
    setIsPlaying(false);
    setIsPaused(false);

    // Save final progress in history
    if (documentData) {
      await saveDocumentToHistory(documentData, currentSentenceIndex);
      await refreshHistory();
    }

    // Reset document view to null so home Dropzone + History are shown
    setDocumentData(null);
    setOriginalFile(null);
  };

  // Document file selection
  const handleFileSelected = async (file: File) => {
    setIsLoadingDocument(true);
    setOriginalFile(file);
    try {
      const doc = await extractPDFData(
        file,
        file.name,
        file.size,
        cleaningOptions,
        (current, total, stage) => {
          setLoadingProgress({ current, total, stage });
        }
      );

      // Check if this document was previously read
      const existing = await checkExistingProgress(doc.name, doc.fileSize, doc.totalPages);

      if (existing && existing.lastSentenceIndex > 0) {
        // Offer resume option
        setResumeCandidate({
          doc,
          lastSentenceIndex: existing.lastSentenceIndex,
          progressPercent: existing.progressPercent,
        });
      } else {
        // Brand new document or no previous progress
        setDocumentData(doc);
        setCurrentSentenceIndex(0);
        setIsPlaying(false);
        setIsPaused(false);
        await saveDocumentToHistory(doc, 0);
        await refreshHistory();
      }
    } catch (err: any) {
      alert(`Error al abrir el documento PDF: ${err?.message || 'Archivo dañado o incompatible.'}`);
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Resume dialog handlers
  const handleConfirmResume = async () => {
    if (!resumeCandidate) return;
    const { doc, lastSentenceIndex } = resumeCandidate;
    setDocumentData(doc);
    setCurrentSentenceIndex(lastSentenceIndex);
    setIsPlaying(false);
    setIsPaused(false);
    setResumeCandidate(null);
    await saveDocumentToHistory(doc, lastSentenceIndex);
    await refreshHistory();
  };

  const handleStartOver = async () => {
    if (!resumeCandidate) return;
    const { doc } = resumeCandidate;
    setDocumentData(doc);
    setCurrentSentenceIndex(0);
    setIsPlaying(false);
    setIsPaused(false);
    setResumeCandidate(null);
    await saveDocumentToHistory(doc, 0);
    await refreshHistory();
  };

  // Open document from recent history
  const handleOpenFromHistory = async (id: string, resume: boolean) => {
    setIsLoadingDocument(true);
    try {
      const record = await getDocumentFromHistory(id);
      if (record && record.doc) {
        const startIdx = resume ? record.lastSentenceIndex : 0;
        setDocumentData(record.doc);
        setOriginalFile(null);
        setCurrentSentenceIndex(startIdx);
        setIsPlaying(false);
        setIsPaused(false);
        await saveDocumentToHistory(record.doc, startIdx);
        await refreshHistory();
      } else {
        alert('No se pudo encontrar el documento en el historial local.');
      }
    } catch (err: any) {
      alert(`Error al cargar el documento guardado: ${err?.message}`);
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Delete from history
  const handleDeleteFromHistory = async (id: string) => {
    await deleteDocumentFromHistory(id);
    await refreshHistory();
  };

  // Playback handlers
  const handlePlay = () => {
    if (!documentData || documentData.allSentences.length === 0) return;

    if (engine === 'webspeech') {
      if (isPaused) {
        webSpeechRef.current?.resume();
      } else {
        webSpeechRef.current?.play(currentSentenceIndex);
      }
    } else {
      if (isPaused) {
        kokoroService.resume();
      } else {
        kokoroService.play(currentSentenceIndex);
      }
    }
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (engine === 'webspeech') {
      webSpeechRef.current?.pause();
    } else {
      kokoroService.pause();
    }
    setIsPlaying(false);
    setIsPaused(true);
  };

  const handleSentenceClick = (index: number) => {
    setCurrentSentenceIndex(index);
    if (engine === 'webspeech') {
      webSpeechRef.current?.play(index);
    } else {
      kokoroService.play(index);
    }
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handleNextSentence = () => {
    if (!documentData) return;
    if (engine === 'webspeech') {
      webSpeechRef.current?.nextSentence();
    } else {
      kokoroService.nextSentence();
    }
  };

  const handlePrevSentence = () => {
    if (!documentData) return;
    if (engine === 'webspeech') {
      webSpeechRef.current?.prevSentence();
    } else {
      kokoroService.prevSentence();
    }
  };

  const handleSeekDelta = (seconds: number) => {
    if (engine === 'kokoro') {
      kokoroService.seekDelta(seconds);
    } else {
      if (seconds > 0) {
        handleNextSentence();
      } else {
        handlePrevSentence();
      }
    }
  };

  const handleSeekRatio = (ratio: number) => {
    if (!documentData || documentData.allSentences.length === 0) return;
    const targetIdx = Math.floor(ratio * (documentData.allSentences.length - 1));
    handleSentenceClick(targetIdx);
  };

  const handleOcrCompleted = (pageNumber: number, text: string) => {
    if (!documentData) return;
    const updatedPage = processPageData(text, pageNumber, cleaningOptions);
    const updatedPages = [...documentData.pages];
    updatedPages[pageNumber - 1] = updatedPage;

    const allSentences: SentenceItem[] = [];
    updatedPages.forEach((p) => p.paragraphs.forEach((pr) => pr.sentences.forEach((s) => allSentences.push(s))));
    const totalWords = allSentences.reduce((acc, s) => acc + s.text.trim().split(/\s+/).length, 0);

    const updatedDoc: PDFDocumentData = {
      ...documentData,
      pages: updatedPages,
      allSentences,
      totalWords,
      scannedPagesCount: Math.max(0, documentData.scannedPagesCount - 1),
    };

    setDocumentData(updatedDoc);
    webSpeechRef.current?.setSentences(allSentences, currentSentenceIndex);
    kokoroService.setSentences(allSentences, currentSentenceIndex);
    saveDocumentToHistory(updatedDoc, currentSentenceIndex);
  };

  const currentSentence = documentData?.allSentences[currentSentenceIndex];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Hidden file input for Header button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Top Header Bar */}
      <Header
        engine={engine}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenInstallApp={() => setIsInstallAppOpen(true)}
        onGoHome={handleGoHome}
        hasDocument={Boolean(documentData)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenUploadModal={() => setIsUploadChoiceOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {!documentData ? (
          <div className="flex-1 pb-16">
            {/* Upload Zone */}
            <Dropzone
              onFileSelected={handleFileSelected}
              isLoading={isLoadingDocument}
              loadingProgress={loadingProgress}
              onOpenUploadModal={() => setIsUploadChoiceOpen(true)}
              onOpenInstallApp={() => setIsInstallAppOpen(true)}
            />

            {/* Visible History of recent PDFs */}
            <HistoryList
              history={history}
              onOpenDocument={handleOpenFromHistory}
              onDeleteDocument={handleDeleteFromHistory}
            />
          </div>
        ) : (
          <>
            {/* Scanned pages alert & OCR option */}
            <ScannedAlert
              scannedCount={documentData.scannedPagesCount}
              totalPages={documentData.totalPages}
              originalFile={originalFile}
              onOcrCompleted={handleOcrCompleted}
            />

            {/* Document Reader with real-time sentence highlight */}
            <TextReaderView
              document={documentData}
              currentSentenceIndex={currentSentenceIndex}
              onSentenceClick={handleSentenceClick}
              autoScroll={autoScroll}
              onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
              onGoHome={handleGoHome}
              isPlaying={isPlaying}
            />

            {/* Persistent Audio Player Bar */}
            <AudioPlayerBar
              isPlaying={isPlaying}
              isPaused={isPaused}
              currentSentence={currentSentence}
              currentIndex={currentSentenceIndex}
              totalSentences={documentData.allSentences.length}
              speed={speed}
              volume={volume}
              engine={engine}
              onPlay={handlePlay}
              onPause={handlePause}
              onNextSentence={handleNextSentence}
              onPrevSentence={handlePrevSentence}
              onSeekDelta={handleSeekDelta}
              onSeekRatio={handleSeekRatio}
              onChangeSpeed={(s) => setSpeed(s)}
              onChangeVolume={(v) => setVolume(v)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </>
        )}
      </main>

      {/* Resume Progress Dialog */}
      {resumeCandidate && (
        <ResumeDialog
          isOpen={Boolean(resumeCandidate)}
          documentName={resumeCandidate.doc.name}
          savedSentenceIndex={resumeCandidate.lastSentenceIndex}
          totalSentences={resumeCandidate.doc.allSentences.length}
          savedPageIndex={
            resumeCandidate.doc.allSentences[resumeCandidate.lastSentenceIndex]?.pageIndex ?? 0
          }
          progressPercent={resumeCandidate.progressPercent}
          previewText={
            resumeCandidate.doc.allSentences[resumeCandidate.lastSentenceIndex]?.text
          }
          onResume={handleConfirmResume}
          onStartOver={handleStartOver}
          onClose={() => setResumeCandidate(null)}
        />
      )}

      {/* How it Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      {/* Settings Modal with mobile voice tester */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        engine={engine}
        onChangeEngine={handleChangeEngine}
        voices={allVoices}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={handleSelectVoice}
        onTestVoice={handleTestVoice}
        speed={speed}
        onChangeSpeed={(s) => setSpeed(s)}
        volume={volume}
        onChangeVolume={(v) => setVolume(v)}
        pitch={pitch}
        onChangePitch={(p) => setPitch(p)}
        pageRange={pageRange}
        totalPages={documentData?.totalPages || 0}
        onChangePageRange={(range) => setPageRange(range)}
        cleaningOptions={cleaningOptions}
        onChangeCleaningOptions={(opts) => setCleaningOptions(opts)}
        kokoroProgress={kokoroProgress}
        onInitKokoro={() => kokoroService.initModel()}
      />

      {/* Upload Choice Modal: Select Local PDF or Google Drive */}
      <UploadChoiceModal
        isOpen={isUploadChoiceOpen}
        onClose={() => setIsUploadChoiceOpen(false)}
        onSelectLocal={() => fileInputRef.current?.click()}
        onSelectGoogleDrive={() => setIsGoogleDriveOpen(true)}
      />

      {/* Google Drive PDF Import Modal */}
      <GoogleDriveModal
        isOpen={isGoogleDriveOpen}
        onClose={() => setIsGoogleDriveOpen(false)}
        onFileSelected={handleFileSelected}
      />

      {/* PWA & Native WebAPK App Installer Modal */}
      <InstallAppModal
        isOpen={isInstallAppOpen}
        onClose={() => setIsInstallAppOpen(false)}
      />

      {/* Audio Export Modal */}
      {documentData && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          documentName={documentData.name}
          allSentences={documentData.allSentences}
          pageRange={pageRange}
          totalPages={documentData.totalPages}
          activeVoiceName={allVoices.find((v) => v.id === selectedVoiceId)?.name || 'Voz del navegador (Web Speech)'}
          activeEngine={engine}
        />
      )}
    </div>
  );
}
