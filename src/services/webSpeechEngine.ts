import { SentenceItem, VoiceOption } from '../types';

export interface WebSpeechCallbacks {
  onSentenceStart?: (index: number) => void;
  onSentenceEnd?: (index: number) => void;
  onFinishedAll?: () => void;
  onError?: (error: string) => void;
  onBoundary?: (charIndex: number) => void;
}

export class WebSpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoiceId: string = '';
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private sentences: SentenceItem[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private speed: number = 1.0;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private callbacks: WebSpeechCallbacks = {};
  private keepAliveTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();

      // Ensure voiceschanged listener is bound cleanly across mobile browsers
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
      } else if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }

      // Restore saved voice preference from localStorage if available
      try {
        const savedVoiceId = localStorage.getItem('vozpdf_voice');
        if (savedVoiceId) {
          this.selectedVoiceId = savedVoiceId;
        }
      } catch {
        // ignore
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public loadVoices(): VoiceOption[] {
    if (!this.synth) return [];

    const fresh = this.synth.getVoices();
    if (fresh && fresh.length > 0) {
      this.voices = fresh;
    }

    const voiceOptions: VoiceOption[] = this.voices.map((v) => {
      const id = v.voiceURI || v.name;
      const lower = v.name.toLowerCase();
      const isFemale = lower.includes('female') || lower.includes('mujer') || lower.includes('sabina') || lower.includes('monica') || lower.includes('paulina');
      return {
        id,
        name: v.name,
        lang: v.lang,
        engine: 'webspeech',
        gender: isFemale ? 'Femenino' : 'Masculino',
        quality: v.localService ? 'Nativa / Local' : 'Online',
      };
    });

    // Re-resolve selected voice with fresh references
    if (this.selectedVoiceId) {
      this.resolveAndSetVoice(this.selectedVoiceId);
    } else if (this.voices.length > 0) {
      const spanishVoice = this.voices.find(
        (v) => v.lang.startsWith('es-ES') || v.lang.startsWith('es')
      );
      this.selectedVoice = spanishVoice || this.voices[0];
      this.selectedVoiceId = this.selectedVoice.voiceURI || this.selectedVoice.name;
    }

    return voiceOptions;
  }

  public getVoices(): VoiceOption[] {
    return this.loadVoices();
  }

  private resolveAndSetVoice(voiceId: string): boolean {
    if (!this.synth) return false;
    // Always query fresh voices in case mobile browser loaded voices dynamically
    const currentList = this.synth.getVoices();
    if (currentList.length > 0) {
      this.voices = currentList;
    }

    // Try multiple matching strategies for mobile Android/iOS voice IDs
    const found =
      this.voices.find((v) => v.voiceURI === voiceId) ||
      this.voices.find((v) => v.name === voiceId) ||
      this.voices.find((v) => (v.voiceURI || v.name).toLowerCase() === voiceId.toLowerCase()) ||
      this.voices.find((v) => v.lang && voiceId.startsWith(v.lang));

    if (found) {
      this.selectedVoice = found;
      this.selectedVoiceId = found.voiceURI || found.name;
      return true;
    }

    return false;
  }

  public setVoice(voiceId: string) {
    this.selectedVoiceId = voiceId;
    try {
      localStorage.setItem('vozpdf_voice', voiceId);
    } catch {
      // ignore
    }

    this.resolveAndSetVoice(voiceId);

    // If currently playing, restart immediately with new voice on mobile
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentSentence();
    }
  }

  public getSelectedVoiceId(): string {
    return this.selectedVoiceId;
  }

  public testVoice(voiceId: string, testPhrase: string = 'Hola, esta es una prueba de voz para la lectura de documentos.') {
    if (!this.synth) return;
    this.setVoice(voiceId);
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(testPhrase);
    // Find fresh voice reference
    const freshList = this.synth.getVoices();
    const voice = freshList.find((v) => (v.voiceURI || v.name) === voiceId) || this.selectedVoice;

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = this.speed;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    // Mobile garbage-collection guard
    (window as any).__vozpdf_test_utterance = utterance;

    this.synth.speak(utterance);
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.5, Math.min(2.0, speed));
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentSentence();
    }
  }

  public setPitch(pitch: number) {
    this.pitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1.0, volume));
    if (this.currentUtterance) {
      this.currentUtterance.volume = this.volume;
    }
  }

  public setSentences(sentences: SentenceItem[], startIndex: number = 0) {
    this.stop();
    this.sentences = sentences;
    this.currentIndex = Math.max(0, Math.min(sentences.length - 1, startIndex));
  }

  public setCallbacks(callbacks: WebSpeechCallbacks) {
    this.callbacks = callbacks;
  }

  public play(index?: number) {
    if (!this.synth) {
      this.callbacks.onError?.('Web Speech API no está soportada en este navegador.');
      return;
    }

    if (index !== undefined) {
      this.currentIndex = Math.max(0, Math.min(this.sentences.length - 1, index));
      this.isPlaying = true;
      this.isPaused = false;
      this.speakCurrentSentence();
      return;
    }

    if (this.isPaused && this.synth.paused) {
      this.synth.resume();
      this.isPaused = false;
      this.isPlaying = true;
      this.startKeepAlive();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.speakCurrentSentence();
  }

  public pause() {
    if (!this.synth) return;
    this.synth.pause();
    this.isPlaying = false;
    this.isPaused = true;
    this.clearKeepAlive();
  }

  public resume() {
    if (!this.synth) return;
    if (this.synth.paused) {
      this.synth.resume();
      this.isPlaying = true;
      this.isPaused = false;
      this.startKeepAlive();
    } else {
      this.play(this.currentIndex);
    }
  }

  public stop() {
    this.clearKeepAlive();
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;
    (window as any).__vozpdf_active_utterance = null;
  }

  public nextSentence() {
    if (this.currentIndex < this.sentences.length - 1) {
      this.currentIndex++;
      if (this.isPlaying) {
        this.speakCurrentSentence();
      } else {
        this.callbacks.onSentenceStart?.(this.currentIndex);
      }
    }
  }

  public prevSentence() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      if (this.isPlaying) {
        this.speakCurrentSentence();
      } else {
        this.callbacks.onSentenceStart?.(this.currentIndex);
      }
    }
  }

  public jumpToSentence(index: number) {
    this.currentIndex = Math.max(0, Math.min(this.sentences.length - 1, index));
    if (this.isPlaying) {
      this.speakCurrentSentence();
    } else {
      this.callbacks.onSentenceStart?.(this.currentIndex);
    }
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

  private speakCurrentSentence() {
    if (!this.synth || this.sentences.length === 0) return;
    if (this.currentIndex >= this.sentences.length) {
      this.stop();
      this.callbacks.onFinishedAll?.();
      return;
    }

    this.synth.cancel();
    const sentence = this.sentences[this.currentIndex];
    const utterance = new SpeechSynthesisUtterance(sentence.text);

    // Ensure freshest voice object from browser for Android Chrome / iOS
    const freshVoices = this.synth.getVoices();
    let voiceToUse = this.selectedVoice;

    if (freshVoices.length > 0 && this.selectedVoiceId) {
      const match =
        freshVoices.find((v) => v.voiceURI === this.selectedVoiceId) ||
        freshVoices.find((v) => v.name === this.selectedVoiceId);
      if (match) {
        voiceToUse = match;
        this.selectedVoice = match;
      }
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
      utterance.lang = voiceToUse.lang;
    }

    utterance.rate = this.speed;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    utterance.onstart = () => {
      this.callbacks.onSentenceStart?.(this.currentIndex);
      this.startKeepAlive();
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this.callbacks.onBoundary?.(event.charIndex);
      }
    };

    utterance.onend = () => {
      this.clearKeepAlive();
      this.callbacks.onSentenceEnd?.(this.currentIndex);
      if (this.isPlaying && !this.isPaused) {
        if (this.currentIndex < this.sentences.length - 1) {
          this.currentIndex++;
          this.speakCurrentSentence();
        } else {
          this.stop();
          this.callbacks.onFinishedAll?.();
        }
      }
    };

    utterance.onerror = (e) => {
      this.clearKeepAlive();
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        this.callbacks.onError?.(`Error de síntesis: ${e.error}`);
      }
    };

    this.currentUtterance = utterance;
    // Prevent garbage collection on mobile browsers
    (window as any).__vozpdf_active_utterance = utterance;

    this.synth.speak(utterance);
  }

  // Workaround for Chrome/Android bug where speech freezes after 10-15 seconds
  private startKeepAlive() {
    this.clearKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      if (this.synth && this.isPlaying && !this.isPaused) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10000);
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer !== null) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
