import { KokoroTTS } from 'kokoro-js';

let ttsInstance: KokoroTTS | null = null;
let isLoading = false;

interface InitMessage {
  type: 'INIT';
  preferredDevice?: 'webgpu' | 'wasm';
}

interface GenerateMessage {
  type: 'GENERATE';
  id: string;
  text: string;
  voice: string;
  speed: number;
}

self.onmessage = async (e: MessageEvent<InitMessage | GenerateMessage>) => {
  const msg = e.data;

  if (msg.type === 'INIT') {
    if (ttsInstance) {
      self.postMessage({ type: 'READY', cached: true });
      return;
    }
    if (isLoading) return;

    isLoading = true;
    try {
      let device: 'webgpu' | 'wasm' = 'wasm';
      // Detect WebGPU in worker if available
      if (typeof navigator !== 'undefined' && 'gpu' in navigator && msg.preferredDevice !== 'wasm') {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
          }
        } catch {
          device = 'wasm';
        }
      }

      self.postMessage({
        type: 'PROGRESS',
        status: 'downloading',
        progress: 0,
        message: `Iniciando modelo Kokoro-82M (${device.toUpperCase()})...`,
        device,
      });

      // Load quantized q8 model for fast browser execution and minimal memory footprint
      ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device,
        progress_callback: (report: any) => {
          if (report.status === 'progress') {
            const progress = Math.round(report.progress || 0);
            self.postMessage({
              type: 'PROGRESS',
              status: 'downloading',
              progress,
              file: report.file,
              message: `Descargando componentes del modelo: ${progress}% (${report.file || 'pesos'})`,
              device,
            });
          } else if (report.status === 'initiate') {
            self.postMessage({
              type: 'PROGRESS',
              status: 'loading',
              progress: 10,
              file: report.file,
              message: `Verificando caché / descargando: ${report.file || 'modelo'}`,
              device,
            });
          }
        },
      });

      isLoading = false;
      self.postMessage({
        type: 'READY',
        device,
        message: `Modelo Kokoro-82M listo (${device.toUpperCase()})`,
      });
    } catch (err: any) {
      isLoading = false;
      // If WebGPU failed, fallback to WASM automatically
      self.postMessage({
        type: 'ERROR',
        error: err?.message || 'Error al inicializar Kokoro-82M en el navegador.',
      });
    }
    return;
  }

  if (msg.type === 'GENERATE') {
    const { id, text, voice, speed } = msg;
    try {
      if (!ttsInstance) {
        throw new Error('El modelo Kokoro no está inicializado.');
      }

      const audio = await ttsInstance.generate(text, {
        voice: (voice as any) || 'af_heart',
        speed: speed || 1.0,
      });

      // audio.data or audio.audio contains Float32Array PCM samples
      const raw = audio as any;
      const floatArray: Float32Array = raw.data || raw.audio || new Float32Array(0);
      const sampleRate = audio.sampling_rate || 24000;

      // Transfer the underlying ArrayBuffer for high performance
      (self as any).postMessage(
        {
          type: 'CHUNK_GENERATED',
          id,
          sampleRate,
          audioData: floatArray.buffer,
          durationSec: floatArray.length / sampleRate,
        },
        [floatArray.buffer]
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
