import { ExportProgress, SentenceItem } from '../types';
import { kokoroService } from './kokoroService';

export interface ExportVoiceOption {
  id: string;
  name: string;
  lang: string;
  engine: 'neural' | 'kokoro';
  modelId?: string;
  flag: string;
  tag?: string;
  description: string;
  estimatedSecondsPerSentence: number;
}

export const EXPORT_VOICES: ExportVoiceOption[] = [
  {
    id: 'mms-spa',
    name: 'Español (Voz Natural Humana) - Meta VITS',
    lang: 'es-ES',
    engine: 'neural',
    modelId: 'Xenova/mms-tts-spa',
    flag: '🇪🇸',
    tag: 'Recomendada en Español (Web Worker)',
    description: 'Voz humana cálida y natural basada en red neuronal VITS. Síntesis y codificación 100% en Web Worker sin congelar la pantalla.',
    estimatedSecondsPerSentence: 0.7,
  },
  {
    id: 'af_heart',
    name: 'Kokoro-82M Heart (Voz Neuronal de Estudio)',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '⭐',
    tag: 'Estudio Cálida',
    description: 'Voz de estudio de altísima fidelidad, suave y profesional (modelo Kokoro-82M).',
    estimatedSecondsPerSentence: 0.7,
  },
  {
    id: 'af_bella',
    name: 'Kokoro-82M Bella (Voz Neuronal Expresiva)',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '✨',
    tag: 'Expresiva y Clara',
    description: 'Voz femenina natural, clara y melódica.',
    estimatedSecondsPerSentence: 0.7,
  },
  {
    id: 'am_michael',
    name: 'Kokoro-82M Michael (Voz Masculina)',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '🎙️',
    tag: 'Voz Masculina',
    description: 'Locución masculina profunda, natural y serena.',
    estimatedSecondsPerSentence: 0.7,
  },
  {
    id: 'mms-cat',
    name: 'Català (Veu Natural Humana) - Meta VITS',
    lang: 'ca-ES',
    engine: 'neural',
    modelId: 'Xenova/mms-tts-cat',
    flag: '🇦🇩',
    tag: 'Català Natural',
    description: 'Veu humana d’alta fidelitat en català sintetitzada per xarxa neuronal.',
    estimatedSecondsPerSentence: 0.7,
  },
];

export interface ExportAudioJobOptions {
  sentences: SentenceItem[];
  format: 'mp3' | 'wav';
  voiceId?: string;
  kbps?: number;
  fileName?: string;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

class AudioExportQueueManager {
  private activeWorker: Worker | null = null;
  private currentJobId: string | null = null;

  public async exportAudio(options: ExportAudioJobOptions): Promise<{ blob: Blob; fileName: string }> {
    const {
      sentences,
      format,
      voiceId = 'mms-spa',
      kbps = 128,
      fileName = 'audiolibro',
      onProgress,
      signal,
    } = options;

    if (sentences.length === 0) {
      throw new Error('No hay frases seleccionadas para exportar.');
    }

    const selectedVoice = EXPORT_VOICES.find((v) => v.id === voiceId) || EXPORT_VOICES[0];

    // If Kokoro engine is chosen, use Kokoro's worker pipeline
    if (selectedVoice.engine === 'kokoro') {
      return this.exportWithKokoro(sentences, format, kbps, fileName, onProgress, signal);
    }

    // Terminate any previous export worker
    this.cancelCurrentJob();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.currentJobId = jobId;

    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(new URL('../workers/audioExportWorker.ts', import.meta.url), {
          type: 'module',
        });
        this.activeWorker = worker;

        const cleanup = () => {
          if (this.activeWorker === worker) {
            this.activeWorker.terminate();
            this.activeWorker = null;
            this.currentJobId = null;
          }
        };

        const abortHandler = () => {
          worker.postMessage({ type: 'CANCEL', jobId });
          cleanup();
          reject(new Error('Exportación cancelada por el usuario.'));
        };

        if (signal) {
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.jobId !== jobId) return;

          if (msg.type === 'JOB_PROGRESS') {
            onProgress?.({
              isExporting: true,
              currentSentence: msg.currentChunk || 0,
              totalSentences: msg.totalChunks || sentences.length,
              percent: msg.percent,
              format,
              statusText: msg.statusText,
            });
          } else if (msg.type === 'JOB_COMPLETE') {
            if (signal) signal.removeEventListener('abort', abortHandler);
            const mimeType = msg.format === 'mp3' ? 'audio/mp3' : 'audio/wav';
            const blob = new Blob([msg.audioBuffer], { type: mimeType });
            cleanup();
            resolve({ blob, fileName: msg.fileName });
          } else if (msg.type === 'JOB_CANCELED') {
            if (signal) signal.removeEventListener('abort', abortHandler);
            cleanup();
            reject(new Error('Exportación cancelada por el usuario.'));
          } else if (msg.type === 'JOB_ERROR') {
            if (signal) signal.removeEventListener('abort', abortHandler);
            cleanup();
            reject(new Error(msg.error || 'Error en el procesamiento del archivo de audio.'));
          }
        };

        worker.onerror = (err) => {
          if (signal) signal.removeEventListener('abort', abortHandler);
          cleanup();
          reject(new Error(`Error del worker de audio: ${err.message}`));
        };

        // Transfer input sentences payload to start off-thread queue
        worker.postMessage({
          type: 'START_EXPORT',
          jobId,
          sentences: sentences.map((s) => ({
            id: s.id,
            text: s.text,
            pageIndex: s.pageIndex,
          })),
          format,
          modelId: selectedVoice.modelId || 'Xenova/mms-tts-spa',
          voiceName: selectedVoice.name,
          kbps,
          fileName,
        });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private async exportWithKokoro(
    sentences: SentenceItem[],
    format: 'mp3' | 'wav',
    _kbps: number,
    fileName: string,
    onProgress?: (progress: ExportProgress) => void,
    signal?: AbortSignal
  ): Promise<{ blob: Blob; fileName: string }> {
    const pcmList: Int16Array[] = [];
    let sampleRate = 24000;

    for (let i = 0; i < sentences.length; i++) {
      if (signal?.aborted) throw new Error('Exportación cancelada por el usuario.');

      const s = sentences[i];
      const pct = Math.round(5 + ((i + 1) / sentences.length) * 82);

      onProgress?.({
        isExporting: true,
        currentSentence: i + 1,
        totalSentences: sentences.length,
        percent: pct,
        format,
        statusText: `Sintetizando con Kokoro: frase ${i + 1} de ${sentences.length}...`,
      });

      const buf = await kokoroService.getOrGenerateAudio(s);
      const channelData = buf.getChannelData(0);
      sampleRate = buf.sampleRate;
      const pcm = new Int16Array(channelData.length);
      for (let j = 0; j < channelData.length; j++) {
        const sample = Math.max(-1, Math.min(1, channelData[j]));
        pcm[j] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      pcmList.push(pcm);
      // Yield to event loop
      await new Promise((r) => setTimeout(r, 0));
    }

    let totalLength = 0;
    for (const p of pcmList) totalLength += p.length;
    const fullPcm = new Int16Array(totalLength);
    let offset = 0;
    for (const p of pcmList) {
      fullPcm.set(p, offset);
      offset += p.length;
    }

    const cleanDocName = fileName.replace(/\.pdf$/i, '').trim() || 'audiolibro';
    const outFileName = `${cleanDocName}_audio.wav`;
    const wavBlob = this.createWavBlob(fullPcm, sampleRate);

    onProgress?.({
      isExporting: true,
      currentSentence: sentences.length,
      totalSentences: sentences.length,
      percent: 100,
      format,
      statusText: '¡Audiolibro generado exitosamente!',
    });

    return { blob: wavBlob, fileName: outFileName };
  }

  private createWavBlob(pcm: Int16Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);

    const writeStr = (off: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 1 channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, pcm.length * 2, true);

    let offset = 44;
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(offset, pcm[i], true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  public cancelCurrentJob() {
    if (this.activeWorker) {
      this.activeWorker.terminate();
      this.activeWorker = null;
      this.currentJobId = null;
    }
  }
}

export const audioExportQueueManager = new AudioExportQueueManager();

/**
 * Generates an audio preview for 1 sentence off the main thread
 */
export async function previewSentenceAudio(text: string, voiceId: string = 'mms-spa'): Promise<Blob> {
  const selectedVoice = EXPORT_VOICES.find((v) => v.id === voiceId) || EXPORT_VOICES[0];

  if (selectedVoice.engine === 'neural') {
    // Run preview via audioExportQueue with 1 sentence
    const singleSentence: SentenceItem = {
      id: 'preview',
      pageIndex: 0,
      paragraphIndex: 0,
      sentenceIndex: 0,
      text,
      startChar: 0,
      endChar: text.length,
      estimatedDurationSec: 3,
    };

    const res = await audioExportQueueManager.exportAudio({
      sentences: [singleSentence],
      format: 'wav',
      voiceId,
      fileName: 'preview',
    });

    return res.blob;
  } else {
    // Kokoro preview
    const buf = await kokoroService.getOrGenerateAudio({
      id: 'preview',
      pageIndex: 0,
      paragraphIndex: 0,
      sentenceIndex: 0,
      text,
      startChar: 0,
      endChar: text.length,
      estimatedDurationSec: 3,
    });
    const channelData = buf.getChannelData(0);
    const pcm = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const writeStr = (off: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buf.sampleRate, true);
    view.setUint32(28, buf.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, pcm.length * 2, true);

    let offset = 44;
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(offset, pcm[i], true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }
}

/**
 * Triggers browser file download from Blob
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
