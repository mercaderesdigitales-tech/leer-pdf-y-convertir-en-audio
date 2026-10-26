export type TTSEngineType = 'webspeech' | 'kokoro';

export interface SentenceItem {
  id: string;
  pageIndex: number;
  paragraphIndex: number;
  sentenceIndex: number;
  text: string;
  startChar: number;
  endChar: number;
  estimatedDurationSec: number;
}

export interface ParagraphItem {
  id: string;
  pageIndex: number;
  paragraphIndex: number;
  text: string;
  sentences: SentenceItem[];
}

export interface PageData {
  pageNumber: number;
  text: string;
  paragraphs: ParagraphItem[];
  hasText: boolean;
  charCount: number;
  isScannedLikely: boolean;
  originalRawText?: string;
}

export interface PDFDocumentData {
  name: string;
  author?: string;
  creationDate?: string;
  fileSize: number;
  totalPages: number;
  pages: PageData[];
  allSentences: SentenceItem[];
  totalWords: number;
  scannedPagesCount: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  engine: TTSEngineType;
  gender?: string;
  quality?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  currentWordIndex?: number;
  speed: number;
  volume: number;
  pitch: number;
  autoScroll: boolean;
}

export interface PageRange {
  start: number;
  end: number;
}

export interface CleaningOptions {
  removeHyphenation: boolean;
  removePageNumbers: boolean;
  removeRepetitiveHeaders: boolean;
  normalizeWhitespace: boolean;
}

export interface KokoroModelProgress {
  status: 'idle' | 'checking' | 'downloading' | 'loading' | 'ready' | 'error';
  progress: number;
  file?: string;
  message?: string;
  device?: 'webgpu' | 'wasm' | 'cpu';
}

export interface ExportProgress {
  isExporting: boolean;
  currentSentence: number;
  totalSentences: number;
  percent: number;
  format: 'mp3' | 'wav';
  statusText: string;
}

export interface HistoryItem {
  id: string;
  name: string;
  author?: string;
  creationDate?: string;
  fileSize: number;
  totalPages: number;
  totalWords: number;
  lastSentenceIndex: number;
  lastSentenceText: string;
  lastReadTimestamp: number;
  progressPercent: number;
}

