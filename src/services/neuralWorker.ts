import { pipeline, env } from '@huggingface/transformers';

// Configure environment for high-speed multi-threaded WebAssembly execution
if (typeof env !== 'undefined') {
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  // Enable SIMD vector instructions and configure multi-threading
  if (env.backends && env.backends.onnx) {
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.simd = true;
      env.backends.onnx.wasm.numThreads = Math.min(
        4,
        typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
      );
    }
  }
}

let currentPipeline: any = null;
let currentModelId: string | null = null;
let isLoading = false;

interface InitMessage {
  type: 'INIT';
  modelId: string;
}

interface GenerateMessage {
  type: 'GENERATE';
  id: string;
  text: string;
  modelId: string;
}

self.onmessage = async (e: MessageEvent<InitMessage | GenerateMessage>) => {
  const msg = e.data;

  if (msg.type === 'INIT') {
    const { modelId } = msg;

    if (currentPipeline && currentModelId === modelId) {
      self.postMessage({ type: 'READY', modelId, cached: true });
      return;
    }

    if (isLoading) return;
    isLoading = true;

    try {
      self.postMessage({
        type: 'PROGRESS',
        status: 'downloading',
        progress: 10,
        message: 'Preparando motor de voz natural (SIMD multi-hilo)...',
      });

      const makeProgressCallback = (report: any) => {
        if (report.status === 'progress') {
          const pct = Math.round(report.progress || 0);
          self.postMessage({
            type: 'PROGRESS',
            status: 'downloading',
            progress: pct,
            file: report.file,
            message: `Descargando componentes: ${pct}%`,
          });
        } else if (report.status === 'initiate') {
          self.postMessage({
            type: 'PROGRESS',
            status: 'loading',
            progress: 15,
            message: 'Verificando pesos neurales en caché...',
          });
        }
      };

      currentPipeline = await pipeline('text-to-speech', modelId, {
        device: 'wasm',
        progress_callback: makeProgressCallback,
      });

      currentModelId = modelId;
      isLoading = false;

      self.postMessage({
        type: 'READY',
        modelId,
        message: 'Motor de voz natural listo.',
      });
    } catch (err: any) {
      isLoading = false;
      self.postMessage({
        type: 'ERROR',
        error: err?.message || 'Error al inicializar el modelo neural de voz.',
      });
    }
    return;
  }

  if (msg.type === 'GENERATE') {
    const { id, text, modelId } = msg;

    try {
      if (!currentPipeline || currentModelId !== modelId) {
        currentPipeline = await pipeline('text-to-speech', modelId, {
          device: 'wasm',
        });
        currentModelId = modelId;
      }

      const cleanText = text.trim();
      if (!cleanText) {
        const emptyPcm = new Int16Array(1600);
        (self as any).postMessage(
          {
            type: 'CHUNK_GENERATED',
            id,
            sampleRate: 16000,
            audioData: emptyPcm.buffer,
          },
          [emptyPcm.buffer]
        );
        return;
      }

      // Generate natural neural speech
      const out = await currentPipeline(cleanText);
      const float32: Float32Array = out.audio || new Float32Array(0);
      const sampleRate = out.sampling_rate || 16000;

      // Convert Float32 to 16-bit PCM Int16
      const pcm = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Zero-copy transfer of the ArrayBuffer
      (self as any).postMessage(
        {
          type: 'CHUNK_GENERATED',
          id,
          sampleRate,
          audioData: pcm.buffer,
        },
        [pcm.buffer]
      );
    } catch (err: any) {
      self.postMessage({
        type: 'CHUNK_ERROR',
        id,
        error: err?.message || 'Error al sintetizar el fragmento de audio.',
      });
    }
  }
};
