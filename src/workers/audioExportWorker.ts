import { pipeline, env } from '@huggingface/transformers';
import { Mp3Encoder } from '@breezystack/lamejs';

// Configure WebAssembly execution inside the dedicated Export Worker
if (typeof env !== 'undefined') {
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.simd = true;
    env.backends.onnx.wasm.numThreads = Math.min(
      4,
      typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
    );
  }
}

let activePipeline: any = null;
let activeModelId: string | null = null;
let currentJobId: string | null = null;
let isJobCanceled = false;

interface ExportSentenceInput {
  id: string;
  text: string;
  pageIndex: number;
}

interface ExportStartMessage {
  type: 'START_EXPORT';
  jobId: string;
  sentences: ExportSentenceInput[];
  format: 'mp3' | 'wav';
  modelId: string;
  voiceName: string;
  kbps?: number;
  fileName: string;
}

interface ExportCancelMessage {
  type: 'CANCEL';
  jobId: string;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function createWavArrayBuffer(pcm: Int16Array, sampleRate: number = 16000, channels: number = 1): ArrayBuffer {
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

  return buffer;
}

function encodeInt16ToMp3Buffer(pcm: Int16Array, sampleRate: number = 16000, kbps: number = 128): ArrayBuffer {
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

  let totalLength = 0;
  for (const part of mp3Data) totalLength += part.byteLength;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of mp3Data) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged.buffer;
}

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

interface QueuedChunk {
  text: string;
  sentenceCount: number;
}

function createTextChunks(sentences: ExportSentenceInput[], maxChars: number = 140): QueuedChunk[] {
  const chunks: QueuedChunk[] = [];
  let currentText = '';
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
      });
      currentText = textToAdd;
      currentCount = 1;
      lastPageIndex = s.pageIndex;
    } else {
      if (currentText.length === 0) {
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
    });
  }

  return chunks;
}

self.onmessage = async (e: MessageEvent<ExportStartMessage | ExportCancelMessage>) => {
  const msg = e.data;

  if (msg.type === 'CANCEL') {
    if (currentJobId === msg.jobId) {
      isJobCanceled = true;
      self.postMessage({
        type: 'JOB_CANCELED',
        jobId: msg.jobId,
      });
    }
    return;
  }

  if (msg.type === 'START_EXPORT') {
    const { jobId, sentences, format, modelId, voiceName, kbps = 128, fileName } = msg;
    currentJobId = jobId;
    isJobCanceled = false;

    try {
      // Step 1: Preload / connect model
      self.postMessage({
        type: 'JOB_PROGRESS',
        jobId,
        stage: 'init',
        percent: 5,
        statusText: `Iniciando sintetizador neuronal (${voiceName})...`,
      });

      if (!activePipeline || activeModelId !== modelId) {
        activePipeline = await pipeline('text-to-speech', modelId, {
          device: 'wasm',
          progress_callback: (report: any) => {
            if (isJobCanceled) return;
            if (report.status === 'progress') {
              const pct = Math.max(5, Math.min(20, Math.round((report.progress || 0) * 0.2)));
              self.postMessage({
                type: 'JOB_PROGRESS',
                jobId,
                stage: 'downloading',
                percent: pct,
                statusText: `Cargando red neuronal: ${Math.round(report.progress || 0)}%`,
              });
            }
          },
        });
        activeModelId = modelId;
      }

      if (isJobCanceled) return;

      self.postMessage({
        type: 'JOB_PROGRESS',
        jobId,
        stage: 'queue_ready',
        percent: 22,
        statusText: 'Cola de procesamiento preparada. Iniciando síntesis...',
      });

      // Step 2: Build Processing Queue
      const queue = createTextChunks(sentences, 140);
      const pcmList: Int16Array[] = [];
      let masterSampleRate = 16000;
      let completedSentences = 0;

      for (let i = 0; i < queue.length; i++) {
        if (isJobCanceled) {
          self.postMessage({ type: 'JOB_CANCELED', jobId });
          return;
        }

        const chunk = queue[i];
        const progressPercent = Math.round(22 + ((i + 1) / queue.length) * 65);

        self.postMessage({
          type: 'JOB_PROGRESS',
          jobId,
          stage: 'synthesizing',
          percent: progressPercent,
          currentChunk: i + 1,
          totalChunks: queue.length,
          statusText: `Sintetizando bloque ${i + 1} de ${queue.length} (${completedSentences + chunk.sentenceCount}/${sentences.length} frases)...`,
        });

        // Generate audio for this chunk
        const out = await activePipeline(chunk.text);
        const float32: Float32Array = out.audio || new Float32Array(0);
        masterSampleRate = out.sampling_rate || 16000;

        const pcm = new Int16Array(float32.length);
        for (let j = 0; j < float32.length; j++) {
          const s = Math.max(-1, Math.min(1, float32[j]));
          pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        if (pcm.length > 0) {
          pcmList.push(pcm);
        }

        completedSentences += chunk.sentenceCount;
      }

      if (isJobCanceled) return;

      if (pcmList.length === 0) {
        throw new Error('No se generaron muestras de audio para las frases seleccionadas.');
      }

      // Step 3: Stitching / Concatenation in worker (zero main-thread load)
      self.postMessage({
        type: 'JOB_PROGRESS',
        jobId,
        stage: 'stitching',
        percent: 88,
        statusText: 'Uniendo segmentos de audio en segundo plano...',
      });

      const fullPcm = concatInt16Arrays(pcmList, Math.floor(masterSampleRate * 0.25));

      if (isJobCanceled) return;

      // Step 4: Off-thread Encoding (zero UI freezing during MP3 / WAV compilation)
      self.postMessage({
        type: 'JOB_PROGRESS',
        jobId,
        stage: 'encoding',
        percent: 92,
        statusText: `Codificando a ${format.toUpperCase()} (${format === 'mp3' ? `${kbps} kbps` : 'WAV PCM 16-bit'})...`,
      });

      let audioBuffer: ArrayBuffer;
      const cleanDocName = fileName.replace(/\.pdf$/i, '').trim() || 'audiolibro';
      const outFileName = `${cleanDocName}_audio.${format}`;

      if (format === 'mp3') {
        audioBuffer = encodeInt16ToMp3Buffer(fullPcm, masterSampleRate, kbps);
      } else {
        audioBuffer = createWavArrayBuffer(fullPcm, masterSampleRate, 1);
      }

      if (isJobCanceled) return;

      self.postMessage({
        type: 'JOB_PROGRESS',
        jobId,
        stage: 'complete',
        percent: 100,
        statusText: '¡Archivo de audio generado exitosamente!',
      });

      // Transfer the buffer with zero copy memory transfer
      (self as any).postMessage(
        {
          type: 'JOB_COMPLETE',
          jobId,
          audioBuffer,
          format,
          fileName: outFileName,
        },
        [audioBuffer]
      );
    } catch (err: any) {
      if (isJobCanceled) return;
      self.postMessage({
        type: 'JOB_ERROR',
        jobId,
        error: err?.message || 'Error durante el procesamiento del archivo de audio.',
      });
    }
  }
};
