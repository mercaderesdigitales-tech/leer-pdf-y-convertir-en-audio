import { KokoroModelProgress, SentenceItem, VoiceOption } from '../types';

export interface KokoroCallbacks {
  onSentenceStart?: (index: number) => void;
  onSentenceEnd?: (index: number) => void;
  onFinishedAll?: () => void;
  onError?: (error: string) => void;
  onModelProgress?: (progress: KokoroModelProgress) => void;
  onBufferProgress?: (generatedCount: number, totalCount: number) => void;
  onTimeUpdate?: (currentTimeSec: number, totalDurationSec: number) => void;
}

export const KOKORO_VOICES: VoiceOption[] = [
  { id: 'af_heart', name: 'Heart (Recomendada)', lang: 'en-US', engine: 'kokoro', gender: 'Femenino', quality: 'Estudio A' },
  { id: 'af_bella', name: 'Bella (Expresiva)', lang: 'en-US', engine: 'kokoro', gender: 'Femenino', quality: 'Estudio A-' },
  { id: 'af_nicole', name: 'Nicole (Suave)', lang: 'en-US', engine: 'kokoro', gender: 'Femenino', quality: 'Natural' },
  { id: 'af_sky', name: 'Sky (Clara)', lang: 'en-US', engine: 'kokoro', gender: 'Femenino', quality: 'Natural' },
  { id: 'am_fenrir', name: 'Fenrir (Voz profunda)', lang: 'en-US', engine: 'kokoro', gender: 'Masculino', quality: 'Natural' },
  { id: 'am_michael', name: 'Michael (Narrador)', lang: 'en-US', engine: 'kokoro', gender: 'Masculino', quality: 'Natural' },
  { id: 'bf_emma', name: 'Emma (Acento británico)', lang: 'en-GB', engine: 'kokoro', gender: 'Femenino', quality: 'Natural' },
  { id: 'bm_george', name: 'George (Acento británico)', lang: 'en-GB', engine: 'kokoro', gender: 'Masculino', quality: 'Natural' },
];

export class KokoroService {
  private worker: Worker | null = null;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;

  private isModelReady: boolean = false;
  private isModelLoading: boolean = false;
  private modelProgress: KokoroModelProgress = { status: 'idle', progress: 0 };

  private sentences: SentenceItem[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private speed: number = 1.0;
  private volume: number = 1.0;
  private selectedVoice: string = 'af_heart';

  // Audio chunk caches
  private audioCache = new Map<string, AudioBuffer>();
  private pendingRequests = new Map<string, { resolve: (buf: AudioBuffer) => void; reject: (err: any) => void }>();
  private prefetchQueue: string[] = [];

  // Playback timing
  private sentenceStartTime: number = 0;
  private pauseOffsetSec: number = 0;
  private callbacks: KokoroCallbacks = {};
  private timeUpdateInterval: number | null = null;

  constructor() {
    try {
      this.initAudioContext();
    } catch {
      // AudioContext will be initialized on first user interaction / playback
    }
  }

  private initAudioContext() {
    try {
      if (typeof window !== 'undefined' && !this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
          this.gainNode = this.audioCtx.createGain();
          this.gainNode.gain.value = this.volume;
          this.gainNode.connect(this.audioCtx.destination);
        }
      }
    } catch (e) {
      console.warn('AudioContext no se pudo inicializar en este momento (se reintentará en reproducción):', e);
    }
  }

  public getModelProgress(): KokoroModelProgress {
    return this.modelProgress;
  }

  public isReady(): boolean {
    return this.isModelReady;
  }

  public setCallbacks(callbacks: KokoroCallbacks) {
    this.callbacks = callbacks;
  }

  public async initModel(preferredDevice?: 'webgpu' | 'wasm') {
    if (this.isModelReady) return;
    if (this.isModelLoading) return;

    this.isModelLoading = true;
    this.modelProgress = { status: 'checking', progress: 5, message: 'Verificando aceleración WebGPU / WASM...' };
    this.callbacks.onModelProgress?.(this.modelProgress);

    try {
      if (!this.worker) {
        this.worker = new Worker(new URL('./kokoroWorker.ts', import.meta.url), { type: 'module' });
        this.setupWorkerListeners();
      }

      this.worker.postMessage({
        type: 'INIT',
        preferredDevice,
      });
    } catch (err: any) {
      this.isModelLoading = false;
      this.modelProgress = {
        status: 'error',
        progress: 0,
        message: err?.message || 'Error al instanciar el Web Worker.',
      };
      this.callbacks.onModelProgress?.(this.modelProgress);
      this.callbacks.onError?.(`Fallo al iniciar Kokoro Worker: ${err?.message}`);
    }
  }

  private setupWorkerListeners() {
    if (!this.worker) return;

    this.worker.onmessage = async (e: MessageEvent) => {
      const msg = e.data;

      if (msg.type === 'PROGRESS') {
        this.modelProgress = {
          status: msg.status,
          progress: msg.progress,
          file: msg.file,
          message: msg.message,
          device: msg.device,
        };
        this.callbacks.onModelProgress?.(this.modelProgress);
      } else if (msg.type === 'READY') {
        this.isModelReady = true;
        this.isModelLoading = false;
        this.modelProgress = {
          status: 'ready',
          progress: 100,
          message: msg.message || 'Kokoro-82M listo para sintetizar.',
          device: msg.device,
        };
        this.callbacks.onModelProgress?.(this.modelProgress);
        // Start prefetching if we have sentences
        this.triggerPrefetch();
      } else if (msg.type === 'ERROR') {
        this.isModelReady = false;
        this.isModelLoading = false;
        this.modelProgress = {
          status: 'error',
          progress: 0,
          message: msg.error,
        };
        this.callbacks.onModelProgress?.(this.modelProgress);
        this.callbacks.onError?.(msg.error);
      } else if (msg.type === 'CHUNK_GENERATED') {
        const { id, sampleRate, audioData } = msg;
        this.initAudioContext();
        if (this.audioCtx) {
          const floatArray = new Float32Array(audioData);
          const audioBuffer = this.audioCtx.createBuffer(1, floatArray.length, sampleRate);
          audioBuffer.copyToChannel(floatArray, 0);

          this.audioCache.set(id, audioBuffer);

          const pending = this.pendingRequests.get(id);
          if (pending) {
            pending.resolve(audioBuffer);
            this.pendingRequests.delete(id);
          }

          this.callbacks.onBufferProgress?.(this.audioCache.size, this.sentences.length);
          this.triggerPrefetch();
        }
      } else if (msg.type === 'CHUNK_ERROR') {
        const { id, error } = msg;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          pending.reject(new Error(error));
          this.pendingRequests.delete(id);
        }
        this.callbacks.onError?.(`Error al sintetizar fragmento ${id}: ${error}`);
      }
    };

    this.worker.onerror = (err) => {
      this.isModelLoading = false;
      this.modelProgress = {
        status: 'error',
        progress: 0,
        message: 'Error en el hilo Web Worker de Kokoro.',
      };
      this.callbacks.onModelProgress?.(this.modelProgress);
      this.callbacks.onError?.('Error en el hilo Web Worker de Kokoro.');
    };
  }

  public setSentences(sentences: SentenceItem[], startIndex: number = 0) {
    this.stop();
    this.sentences = sentences;
    this.currentIndex = Math.max(0, Math.min(sentences.length - 1, startIndex));
    this.triggerPrefetch();
  }

  public setVoice(voiceId: string) {
    this.selectedVoice = voiceId;
    // Clear cache because voice changed
    this.audioCache.clear();
    if (this.isPlaying) {
      this.play(this.currentIndex);
    } else {
      this.triggerPrefetch();
    }
  }

  public getSelectedVoiceId(): string {
    return this.selectedVoice;
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.5, Math.min(2.0, speed));
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.playbackRate.value = this.speed;
      } catch {
        // Fallback
      }
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1.0, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  /**
   * Synthesizes audio for a single sentence item and returns the AudioBuffer
   */
  public async getOrGenerateAudio(sentence: SentenceItem): Promise<AudioBuffer> {
    const cached = this.audioCache.get(sentence.id);
    if (cached) return cached;

    if (!this.isModelReady) {
      await this.initModel();
      // Wait until ready
      if (!this.isModelReady) {
        throw new Error('El modelo Kokoro aún se está inicializando en el navegador.');
      }
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(sentence.id, { resolve, reject });
      this.worker?.postMessage({
        type: 'GENERATE',
        id: sentence.id,
        text: sentence.text,
        voice: this.selectedVoice,
        speed: 1.0, // We control playback rate dynamically on the AudioBufferSourceNode
      });
    });
  }

  /**
   * Pre-fetches upcoming sentences in the background to ensure gapless playback
   */
  private triggerPrefetch() {
    if (!this.isModelReady || this.sentences.length === 0 || !this.worker) return;

    // Buffer 3 sentences ahead of current position
    const lookAhead = 3;
    for (let i = this.currentIndex; i <= Math.min(this.currentIndex + lookAhead, this.sentences.length - 1); i++) {
      const sentence = this.sentences[i];
      if (!this.audioCache.has(sentence.id) && !this.pendingRequests.has(sentence.id)) {
        this.getOrGenerateAudio(sentence).catch(() => {});
        break; // Generate one at a time to keep worker responsive
      }
    }
  }

  public async play(index?: number) {
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (index !== undefined) {
      this.currentIndex = Math.max(0, Math.min(this.sentences.length - 1, index));
      this.pauseOffsetSec = 0;
    }

    if (this.isPaused && this.pauseOffsetSec > 0) {
      this.isPaused = false;
      this.isPlaying = true;
      this.playSentenceAudio(this.currentIndex, this.pauseOffsetSec);
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.pauseOffsetSec = 0;
    this.playSentenceAudio(this.currentIndex, 0);
  }

  private async playSentenceAudio(index: number, startOffsetSec: number = 0) {
    if (!this.isPlaying || index >= this.sentences.length) {
      if (index >= this.sentences.length) {
        this.stop();
        this.callbacks.onFinishedAll?.();
      }
      return;
    }

    this.stopCurrentSourceNode();
    const sentence = this.sentences[index];
    this.callbacks.onSentenceStart?.(index);

    try {
      const buffer = await this.getOrGenerateAudio(sentence);
      if (!this.isPlaying || this.currentIndex !== index) {
        return; // User clicked away while generating
      }

      this.initAudioContext();
      if (!this.audioCtx || !this.gainNode) return;

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = this.speed;
      source.connect(this.gainNode);

      this.currentSourceNode = source;
      this.sentenceStartTime = this.audioCtx.currentTime - (startOffsetSec / this.speed);

      source.onended = () => {
        if (this.currentSourceNode === source) {
          this.currentSourceNode = null;
          this.callbacks.onSentenceEnd?.(index);

          if (this.isPlaying && !this.isPaused) {
            if (this.currentIndex < this.sentences.length - 1) {
              this.currentIndex++;
              this.playSentenceAudio(this.currentIndex, 0);
            } else {
              this.stop();
              this.callbacks.onFinishedAll?.();
            }
          }
        }
      };

      source.start(0, startOffsetSec);
      this.startTimeUpdates();
      this.triggerPrefetch();
    } catch (err: any) {
      this.callbacks.onError?.(`Fallo al reproducir frase: ${err?.message}`);
      // Skip to next if broken
      if (this.isPlaying && this.currentIndex < this.sentences.length - 1) {
        this.currentIndex++;
        this.playSentenceAudio(this.currentIndex, 0);
      }
    }
  }

  private startTimeUpdates() {
    this.stopTimeUpdates();
    this.timeUpdateInterval = window.setInterval(() => {
      if (this.isPlaying && this.audioCtx && this.currentSourceNode) {
        const elapsed = (this.audioCtx.currentTime - this.sentenceStartTime) * this.speed;
        this.callbacks.onTimeUpdate?.(elapsed, this.getTotalEstimatedTime());
      }
    }, 250);
  }

  private stopTimeUpdates() {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  private stopCurrentSourceNode() {
    this.stopTimeUpdates();
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch {
        // Ignore errors if already stopped
      }
      this.currentSourceNode = null;
    }
  }

  public pause() {
    if (!this.isPlaying) return;
    if (this.audioCtx && this.currentSourceNode) {
      this.pauseOffsetSec = (this.audioCtx.currentTime - this.sentenceStartTime) * this.speed;
    }
    this.stopCurrentSourceNode();
    this.isPlaying = false;
    this.isPaused = true;
  }

  public resume() {
    if (this.isPaused) {
      this.play();
    } else {
      this.play(this.currentIndex);
    }
  }

  public stop() {
    this.stopCurrentSourceNode();
    this.isPlaying = false;
    this.isPaused = false;
    this.pauseOffsetSec = 0;
  }

  public nextSentence() {
    if (this.currentIndex < this.sentences.length - 1) {
      this.currentIndex++;
      this.pauseOffsetSec = 0;
      if (this.isPlaying) {
        this.playSentenceAudio(this.currentIndex, 0);
      } else {
        this.callbacks.onSentenceStart?.(this.currentIndex);
      }
    }
  }

  public prevSentence() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.pauseOffsetSec = 0;
      if (this.isPlaying) {
        this.playSentenceAudio(this.currentIndex, 0);
      } else {
        this.callbacks.onSentenceStart?.(this.currentIndex);
      }
    }
  }

  public jumpToSentence(index: number) {
    this.currentIndex = Math.max(0, Math.min(this.sentences.length - 1, index));
    this.pauseOffsetSec = 0;
    if (this.isPlaying) {
      this.playSentenceAudio(this.currentIndex, 0);
    } else {
      this.callbacks.onSentenceStart?.(this.currentIndex);
    }
  }

  public seekDelta(deltaSeconds: number) {
    if (!this.audioCtx) return;
    const currentSentence = this.sentences[this.currentIndex];
    const buffer = this.audioCache.get(currentSentence?.id);
    const sentenceDuration = buffer ? buffer.duration : (currentSentence?.estimatedDurationSec || 3);

    const currentOffset = this.isPlaying && this.currentSourceNode
      ? (this.audioCtx.currentTime - this.sentenceStartTime) * this.speed
      : this.pauseOffsetSec;

    let targetOffset = currentOffset + deltaSeconds;

    if (targetOffset < 0) {
      if (this.currentIndex > 0) {
        this.prevSentence();
      } else {
        targetOffset = 0;
        this.playSentenceAudio(this.currentIndex, 0);
      }
    } else if (targetOffset > sentenceDuration) {
      if (this.currentIndex < this.sentences.length - 1) {
        this.nextSentence();
      }
    } else {
      if (this.isPlaying) {
        this.playSentenceAudio(this.currentIndex, targetOffset);
      } else {
        this.pauseOffsetSec = targetOffset;
      }
    }
  }

  public getTotalEstimatedTime(): number {
    return this.sentences.reduce((acc, s) => {
      const cached = this.audioCache.get(s.id);
      return acc + (cached ? cached.duration : s.estimatedDurationSec);
    }, 0);
  }

  public getCachedBuffer(id: string): AudioBuffer | undefined {
    return this.audioCache.get(id);
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }
}

export const kokoroService = new KokoroService();
