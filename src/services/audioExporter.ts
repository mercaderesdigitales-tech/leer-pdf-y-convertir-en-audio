import { Mp3Encoder } from '@breezystack/lamejs';
import * as piper from '@mintplex-labs/piper-tts-web';
import { ExportProgress, SentenceItem } from '../types';
import { kokoroService } from './kokoroService';

export interface ExportVoiceOption {
  id: string;
  name: string;
  lang: string;
  engine: 'piper' | 'kokoro';
  flag: string;
  description: string;
  recommended?: boolean;
}

export const EXPORT_VOICES: ExportVoiceOption[] = [
  {
    id: 'es_ES-carlfm-x_low',
    name: 'Español (España) - Carlfm',
    lang: 'es-ES',
    engine: 'piper',
    flag: '🇪🇸',
    description: 'Ligero y rápido (~15 MB). Pronunciación natural en castellano.',
    recommended: true,
  },
  {
    id: 'es_ES-davefx-medium',
    name: 'Español (España) - Dave',
    lang: 'es-ES',
    engine: 'piper',
    flag: '🇪🇸',
    description: 'Voz masculina con alta fidelidad y cadencia neutra.',
  },
  {
    id: 'es_MX-ald-medium',
    name: 'Español (México) - Ald',
    lang: 'es-MX',
    engine: 'piper',
    flag: '🇲🇽',
    description: 'Acento latinoamericano suave y natural.',
  },
  {
    id: 'en_US-lessac-low',
    name: 'English (US) - Lessac',
    lang: 'en-US',
    engine: 'piper',
    flag: '🇺🇸',
    description: 'Clear American English narrator.',
  },
  {
    id: 'af_heart',
    name: 'English (US) - Kokoro Heart',
    lang: 'en-US',
    engine: 'kokoro',
    flag: '🇺🇸',
    description: 'Kokoro neural model for English text.',
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

/**
 * Extracts raw 16-bit PCM and sample rate from a standard WAV Blob
 */
async function wavBlobToInt16(blob: Blob): Promise<{ pcm: Int16Array; sampleRate: number; channels: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const view = new DataView(arrayBuffer);

  const channels = view.getUint16(22, true) || 1;
  const sampleRate = view.getUint32(24, true) || 22050;

  // Search for the 'data' subchunk to extract PCM
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'data') {
      const sampleCount = Math.floor(chunkSize / 2);
      const pcmBytes = new Int16Array(sampleCount);
      let pcmOffset = offset + 8;
      for (let i = 0; i < sampleCount; i++) {
        if (pcmOffset + 2 <= view.byteLength) {
          pcmBytes[i] = view.getInt16(pcmOffset, true);
          pcmOffset += 2;
        }
      }
      return { pcm: pcmBytes, sampleRate, channels };
    }
    offset += 8 + chunkSize;
  }

  // Fallback: assume header is 44 bytes
  const fallbackBytes = new Int16Array(arrayBuffer.slice(44));
  return { pcm: fallbackBytes, sampleRate, channels };
}

/**
 * Concatenates multiple Int16Array PCM buffers inserting brief silence between sentences
 */
function concatInt16Arrays(arrays: Int16Array[], silenceSamples: number = 2200): Int16Array {
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
 * Builds a WAV file Blob with valid header from 16-bit PCM samples
 */
function createWavBlobFromInt16(pcm: Int16Array, sampleRate: number = 22050, channels: number = 1): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
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
 * Encodes 16-bit PCM samples directly to MP3 using lamejs
 */
function encodeInt16ToMp3(pcm: Int16Array, sampleRate: number = 22050, kbps: number = 128): Blob {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];
  const blockSize = 1152;

  for (let i = 0; i < pcm.length; i += blockSize) {
    const chunk = pcm.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(endBuf);
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Generates an audio preview for 1 sentence so the user can verify pronunciation before full export
 */
export async function previewSentenceAudio(text: string, voiceId: string = 'es_ES-carlfm-x_low'): Promise<Blob> {
  const selectedVoice = EXPORT_VOICES.find(v => v.id === voiceId) || EXPORT_VOICES[0];

  if (selectedVoice.engine === 'piper') {
    // Generate with Piper in Spanish
    return await piper.predict({
      text,
      voiceId: (voiceId as any),
    });
  } else {
    // Fallback to Kokoro
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
 * Exports sentences to an audio file (MP3 or WAV) using authentic Spanish Piper neural TTS or Kokoro
 */
export async function exportSentencesToAudio(options: ExportAudioOptions): Promise<{ blob: Blob; fileName: string }> {
  const {
    sentences,
    format,
    voiceId = 'es_ES-carlfm-x_low',
    kbps = 128,
    fileName = 'audiolibro',
    onProgress,
    signal,
  } = options;

  if (sentences.length === 0) {
    throw new Error('No hay frases seleccionadas para exportar.');
  }

  const selectedVoice = EXPORT_VOICES.find(v => v.id === voiceId) || EXPORT_VOICES[0];
  const pcmList: Int16Array[] = [];
  let masterSampleRate = 22050;
  let masterChannels = 1;

  onProgress?.({
    isExporting: true,
    currentSentence: 0,
    totalSentences: sentences.length,
    percent: 5,
    format,
    statusText: `Preparando voz ${selectedVoice.name}...`,
  });

  if (selectedVoice.engine === 'piper') {
    // Piper Spanish / Multilingual Neural TTS
    for (let i = 0; i < sentences.length; i++) {
      if (signal?.aborted) {
        throw new Error('Exportación cancelada por el usuario.');
      }

      const s = sentences[i];
      const percent = Math.round(5 + ((i) / sentences.length) * 80);

      onProgress?.({
        isExporting: true,
        currentSentence: i + 1,
        totalSentences: sentences.length,
        percent,
        format,
        statusText: `Sintetizando frase ${i + 1} de ${sentences.length}: "${s.text.slice(0, 30)}..."`,
      });

      try {
        const wavBlob = await piper.predict(
          {
            text: s.text,
            voiceId: (voiceId as any),
          },
          (progress) => {
            if (progress && progress.total > 0) {
              const dlPercent = Math.round((progress.loaded / progress.total) * 100);
              onProgress?.({
                isExporting: true,
                currentSentence: i + 1,
                totalSentences: sentences.length,
                percent: Math.min(25, dlPercent),
                format,
                statusText: `Descargando componentes de voz: ${dlPercent}%`,
              });
            }
          }
        );

        const { pcm, sampleRate, channels } = await wavBlobToInt16(wavBlob);
        masterSampleRate = sampleRate;
        masterChannels = channels;
        pcmList.push(pcm);
      } catch (err: any) {
        console.warn(`Error en frase ${i + 1}, omitiendo o reintentando:`, err);
      }
    }
  } else {
    // Kokoro engine
    for (let i = 0; i < sentences.length; i++) {
      if (signal?.aborted) {
        throw new Error('Exportación cancelada por el usuario.');
      }

      const s = sentences[i];
      const percent = Math.round(5 + ((i) / sentences.length) * 80);

      onProgress?.({
        isExporting: true,
        currentSentence: i + 1,
        totalSentences: sentences.length,
        percent,
        format,
        statusText: `Sintetizando frase ${i + 1} de ${sentences.length}...`,
      });

      const buf = await kokoroService.getOrGenerateAudio(s);
      const channelData = buf.getChannelData(0);
      masterSampleRate = buf.sampleRate;
      const pcm = new Int16Array(channelData.length);
      for (let j = 0; j < channelData.length; j++) {
        const sample = Math.max(-1, Math.min(1, channelData[j]));
        pcm[j] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      pcmList.push(pcm);
    }
  }

  if (signal?.aborted) {
    throw new Error('Exportación cancelada por el usuario.');
  }

  if (pcmList.length === 0) {
    throw new Error('No se pudo generar audio para las frases seleccionadas.');
  }

  onProgress?.({
    isExporting: true,
    currentSentence: sentences.length,
    totalSentences: sentences.length,
    percent: 88,
    format,
    statusText: 'Uniendo segmentos de audio...',
  });

  const fullPcm = concatInt16Arrays(pcmList, Math.floor(masterSampleRate * 0.25));

  onProgress?.({
    isExporting: true,
    currentSentence: sentences.length,
    totalSentences: sentences.length,
    percent: 94,
    format,
    statusText: `Codificando formato ${format.toUpperCase()}...`,
  });

  let blob: Blob;
  const ext = format === 'mp3' ? 'mp3' : 'wav';
  const outFileName = `${fileName.replace(/\.pdf$/i, '')}_audio.${ext}`;

  if (format === 'mp3') {
    blob = encodeInt16ToMp3(fullPcm, masterSampleRate, kbps);
  } else {
    blob = createWavBlobFromInt16(fullPcm, masterSampleRate, masterChannels);
  }

  onProgress?.({
    isExporting: false,
    currentSentence: sentences.length,
    totalSentences: sentences.length,
    percent: 100,
    format,
    statusText: '¡Audiolibro generado exitosamente!',
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
