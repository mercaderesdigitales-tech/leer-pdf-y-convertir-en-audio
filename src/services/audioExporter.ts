import { Mp3Encoder } from '@breezystack/lamejs';
import { ExportProgress, SentenceItem } from '../types';
import { neuralTtsService } from './neuralTtsService';
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
  speedRating: 'neural';
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
    tag: 'Recomendada en Español (Multi-hilo)',
    description: 'Voz humana cálida y natural basada en red neuronal VITS. Pronunciación auténtica en castellano sin tonos robóticos.',
    speedRating: 'neural',
    estimatedSecondsPerSentence: 0.45, // Reduced thanks to 2x parallel worker pool
  },
  {
    id: 'af_heart',
    name: 'Kokoro-82M Heart (Voz Neuronal de Estudio)',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '⭐',
    tag: 'Estudio Cálida',
    description: 'Voz de estudio de altísima fidelidad, suave y profesional (modelo Kokoro-82M).',
    speedRating: 'neural',
    estimatedSecondsPerSentence: 0.5,
  },
  {
    id: 'af_bella',
    name: 'Kokoro-82M Bella (Voz Neuronal Expresiva)',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '✨',
    tag: 'Expresiva y Clara',
    description: 'Voz femenina natural, clara y melódica.',
    speedRating: 'neural',
    estimatedSecondsPerSentence: 0.5,
  },
  {
    id: 'am_michael',
    name: 'Kokoro-82M Michael (Voz Masculina)',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '🎙️',
    tag: 'Voz Masculina',
    description: 'Locución masculina profunda, natural y serena.',
    speedRating: 'neural',
    estimatedSecondsPerSentence: 0.5,
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
    speedRating: 'neural',
    estimatedSecondsPerSentence: 0.45,
  },
];

export interface ExportAudioOptions {
  sentences: SentenceItem[];
  format: 'mp3' | 'wav';
  voiceId?: string;
  kbps?: number;
  fileName?: string;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

interface TextChunk {
  text: string;
  sentenceCount: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Groups consecutive sentences into optimal chunks for fluid neural narration
 */
function groupSentencesIntoOptimalChunks(sentences: SentenceItem[], maxChars: number = 150): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentText = '';
  let currentStart = 0;
  let currentCount = 0;
  let lastPageIndex = sentences[0]?.pageIndex ?? 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const textToAdd = s.text.trim();
    if (!textToAdd) continue;

    const wouldExceed = currentText.length > 0 && currentText.length + textToAdd.length > maxChars;
    const pageChanged = s.pageIndex !== lastPageIndex;

    if ((wouldExceed || pageChanged) && currentText.length > 0) {
      chunks.push({
        text: currentText.trim(),
        sentenceCount: currentCount,
        startIndex: currentStart,
        endIndex: i - 1,
      });
      currentText = textToAdd;
      currentStart = i;
      currentCount = 1;
      lastPageIndex = s.pageIndex;
    } else {
      if (currentText.length === 0) {
        currentStart = i;
        currentCount = 1;
        currentText = textToAdd;
      } else {
        currentText += ' ' + textToAdd;
        currentCount++;
      }
      lastPageIndex = s.pageIndex;
    }
  }

  if (currentText.trim().length > 0) {
    chunks.push({
      text: currentText.trim(),
      sentenceCount: currentCount,
      startIndex: currentStart,
      endIndex: sentences.length - 1,
    });
  }

  return chunks;
}

/**
 * Encodes 16-bit PCM samples directly to MP3 using lamejs with large buffer blocks for speed
 */
function encodeInt16ToMp3(pcm: Int16Array, sampleRate: number = 16000, kbps: number = 128): Blob {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];
  const blockSize = 1152 * 8;

  for (let i = 0; i < pcm.length; i += blockSize) {
    const chunk = pcm.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.byteLength));
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf.buffer, endBuf.byteOffset, endBuf.byteLength));
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Builds a WAV file Blob with valid header from 16-bit PCM samples
 */
export function createWavBlobFromInt16(pcm: Int16Array, sampleRate: number = 16000, channels: number = 1): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, pcm.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i], true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Concatenates multiple Int16Array PCM buffers inserting natural silence between segments
 */
function concatInt16Arrays(arrays: Int16Array[], silenceSamples: number = 2400): Int16Array {
  if (arrays.length === 0) return new Int16Array(0);

  let totalSamples = 0;
  for (let i = 0; i < arrays.length; i++) {
    totalSamples += arrays[i].length;
    if (i < arrays.length - 1) totalSamples += silenceSamples;
  }

  const result = new Int16Array(totalSamples);
  let currentOffset = 0;

  for (let i = 0; i < arrays.length; i++) {
    result.set(arrays[i], currentOffset);
    currentOffset += arrays[i].length;
    if (i < arrays.length - 1) {
      currentOffset += silenceSamples;
    }
  }

  return result;
}

/**
 * Generates an audio preview for 1 sentence so the user can verify pronunciation before full export
 */
export async function previewSentenceAudio(text: string, voiceId: string = 'mms-spa'): Promise<Blob> {
  const selectedVoice = EXPORT_VOICES.find((v) => v.id === voiceId) || EXPORT_VOICES[0];

  if (selectedVoice.engine === 'neural') {
    const modelId = selectedVoice.modelId || 'Xenova/mms-tts-spa';
    const { pcm, sampleRate } = await neuralTtsService.generateSentenceAudio(text, modelId);
    return createWavBlobFromInt16(pcm, sampleRate, 1);
  } else {
    // Kokoro engine
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
    return createWavBlobFromInt16(pcm, buf.sampleRate, 1);
  }
}

/**
 * Exports sentences to an audio file (MP3 or WAV) using natural neural voices with parallel acceleration
 */
export async function exportSentencesToAudio(options: ExportAudioOptions): Promise<{ blob: Blob; fileName: string }> {
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
  const pcmList: Int16Array[] = [];
  let masterSampleRate = 16000;

  onProgress?.({
    isExporting: true,
    currentSentence: 0,
    totalSentences: sentences.length,
    percent: 5,
    format,
    statusText: `Preparando motor neural (${selectedVoice.name})...`,
  });

  if (selectedVoice.engine === 'neural') {
    // Mode A: Meta VITS Neural Engine with 2x Parallel Worker Pipeline
    const modelId = selectedVoice.modelId || 'Xenova/mms-tts-spa';

    await neuralTtsService.preloadModel(modelId, (report) => {
      const pct = Math.max(5, Math.min(20, Math.round((report.progress || 0) * 0.2)));
      onProgress?.({
        isExporting: true,
        currentSentence: 0,
        totalSentences: sentences.length,
        percent: pct,
        format,
        statusText: report.message || `Cargando componentes de voz: ${report.progress}%`,
      });
    });

    if (signal?.aborted) {
      throw new Error('Exportación cancelada por el usuario.');
    }

    onProgress?.({
      isExporting: true,
      currentSentence: 0,
      totalSentences: sentences.length,
      percent: 22,
      format,
      statusText: 'Motores listos. Iniciando síntesis paralela...',
    });

    const chunks = groupSentencesIntoOptimalChunks(sentences, 150);
    const pcmResults: (Int16Array | null)[] = new Array(chunks.length).fill(null);
    let completedChunks = 0;

    // Concurrent pipeline with 2 parallel workers running on separate CPU cores
    const CONCURRENCY = 2;
    let nextIndex = 0;

    const workerTask = async () => {
      while (nextIndex < chunks.length) {
        if (signal?.aborted) {
          throw new Error('Exportación cancelada por el usuario.');
        }

        const index = nextIndex++;
        const chunk = chunks[index];

        try {
          const { pcm, sampleRate } = await neuralTtsService.generateSentenceAudio(chunk.text, modelId, signal);
          masterSampleRate = sampleRate;
          pcmResults[index] = pcm;
        } catch (err: any) {
          if (signal?.aborted) throw err;
          console.warn(`Error en bloque ${index + 1}:`, err);
        }

        completedChunks++;
        const progressPercent = Math.round(22 + (completedChunks / chunks.length) * 65);

        onProgress?.({
          isExporting: true,
          currentSentence: Math.min(
            sentences.length,
            Math.round((completedChunks / chunks.length) * sentences.length)
          ),
          totalSentences: sentences.length,
          percent: progressPercent,
          format,
          statusText: `Sintetizando en paralelo: bloque ${completedChunks} de ${chunks.length} (${progressPercent}%)...`,
        });
      }
    };

    // Execute parallel workers
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => workerTask())
    );

    for (const pcm of pcmResults) {
      if (pcm && pcm.length > 0) {
        pcmList.push(pcm);
      }
    }
  } else {
    // Mode B: Kokoro-82M Neural Engine
    for (let i = 0; i < sentences.length; i++) {
      if (signal?.aborted) {
        throw new Error('Exportación cancelada por el usuario.');
      }

      const s = sentences[i];
      const percent = Math.round(5 + ((i + 1) / sentences.length) * 82);

      onProgress?.({
        isExporting: true,
        currentSentence: i + 1,
        totalSentences: sentences.length,
        percent,
        format,
        statusText: `Sintetizando con Kokoro: frase ${i + 1} de ${sentences.length}...`,
      });

      try {
        const buf = await kokoroService.getOrGenerateAudio(s);
        const channelData = buf.getChannelData(0);
        masterSampleRate = buf.sampleRate;
        const pcm = new Int16Array(channelData.length);
        for (let j = 0; j < channelData.length; j++) {
          const sample = Math.max(-1, Math.min(1, channelData[j]));
          pcm[j] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        pcmList.push(pcm);
      } catch (err: any) {
        console.warn(`Error Kokoro en frase ${i + 1}:`, err);
      }

      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (signal?.aborted) {
    throw new Error('Exportación cancelada por el usuario.');
  }

  if (pcmList.length === 0) {
    throw new Error('No se pudo generar audio para las frases seleccionadas. Por favor, selecciona un rango de páginas menor.');
  }

  // Step 3: Concat PCM buffers
  onProgress?.({
    isExporting: true,
    currentSentence: sentences.length,
    totalSentences: sentences.length,
    percent: 88,
    format,
    statusText: 'Uniendo segmentos con pausas naturales...',
  });

  const fullPcm = concatInt16Arrays(pcmList, Math.floor(masterSampleRate * 0.25));

  // Step 4: Encode to MP3 or WAV
  onProgress?.({
    isExporting: true,
    currentSentence: sentences.length,
    totalSentences: sentences.length,
    percent: 93,
    format,
    statusText: `Codificando archivo ${format.toUpperCase()} (${format === 'mp3' ? `${kbps} kbps` : 'WAV PCM'})...`,
  });

  let blob: Blob;
  const ext = format === 'mp3' ? 'mp3' : 'wav';
  const cleanDocName = fileName.replace(/\.pdf$/i, '').trim() || 'audiolibro';
  const outFileName = `${cleanDocName}_audio.${ext}`;

  if (format === 'mp3') {
    blob = encodeInt16ToMp3(fullPcm, masterSampleRate, kbps);
  } else {
    blob = createWavBlobFromInt16(fullPcm, masterSampleRate, 1);
  }

  onProgress?.({
    isExporting: true,
    currentSentence: sentences.length,
    totalSentences: sentences.length,
    percent: 100,
    format,
    statusText: '¡Audiolibro generado exitosamente con voz natural!',
  });

  return { blob, fileName: outFileName };
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
