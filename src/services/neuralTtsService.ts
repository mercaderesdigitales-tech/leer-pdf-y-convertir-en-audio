export interface NeuralProgressReport {
  status: 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
  progress: number;
  message?: string;
  file?: string;
}

interface PendingRequest {
  resolve: (data: { pcm: Int16Array; sampleRate: number }) => void;
  reject: (err: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

class NeuralTtsService {
  private workers: Worker[] = [];
  private poolSize: number = 2; // 2 concurrent background workers for 2x parallel processing
  private workerReady: boolean[] = [];
  private busyCount: number[] = [];
  private currentModel: string | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private onProgressCallback?: (report: NeuralProgressReport) => void;

  private initWorker(index: number) {
    if (this.workers[index]) return;

    try {
      const worker = new Worker(new URL('./neuralWorker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;

        if (msg.type === 'PROGRESS') {
          if (index === 0) {
            this.onProgressCallback?.({
              status: msg.status,
              progress: msg.progress,
              message: msg.message,
              file: msg.file,
            });
          }
        } else if (msg.type === 'READY') {
          this.workerReady[index] = true;
          this.currentModel = msg.modelId;
          if (this.workerReady.every((r) => r)) {
            this.onProgressCallback?.({
              status: 'ready',
              progress: 100,
              message: 'Motores neuronales paralelos listos.',
            });
          }
        } else if (msg.type === 'CHUNK_GENERATED') {
          const { id, sampleRate, audioData } = msg;
          this.busyCount[index] = Math.max(0, (this.busyCount[index] || 1) - 1);
          const pending = this.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            const pcm = new Int16Array(audioData);
            pending.resolve({ pcm, sampleRate });
            this.pendingRequests.delete(id);
          }
        } else if (msg.type === 'CHUNK_ERROR') {
          const { id, error } = msg;
          this.busyCount[index] = Math.max(0, (this.busyCount[index] || 1) - 1);
          const pending = this.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error(error));
            this.pendingRequests.delete(id);
          }
        } else if (msg.type === 'ERROR') {
          this.workerReady[index] = false;
          this.onProgressCallback?.({
            status: 'error',
            progress: 0,
            message: msg.error,
          });
        }
      };

      worker.onerror = (err) => {
        console.error(`Neural worker ${index} error:`, err);
        this.workerReady[index] = false;
      };

      this.workers[index] = worker;
      this.workerReady[index] = false;
      this.busyCount[index] = 0;
    } catch (err) {
      console.error(`Could not instantiate Neural worker ${index}:`, err);
    }
  }

  private ensurePool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.initWorker(i);
    }
  }

  public async preloadModel(
    modelId: string,
    onProgress?: (report: NeuralProgressReport) => void
  ): Promise<void> {
    this.ensurePool();
    this.onProgressCallback = onProgress;

    if (this.workerReady.length === this.poolSize && this.workerReady.every(Boolean) && this.currentModel === modelId) {
      onProgress?.({
        status: 'ready',
        progress: 100,
        message: 'Motores neuronales en memoria.',
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tiempo de espera agotado al descargar los componentes de voz.'));
      }, 60000);

      const originalCallback = this.onProgressCallback;
      this.onProgressCallback = (report) => {
        originalCallback?.(report);
        if (report.status === 'ready') {
          clearTimeout(timeout);
          resolve();
        } else if (report.status === 'error') {
          clearTimeout(timeout);
          reject(new Error(report.message || 'Error al descargar modelo de voz'));
        }
      };

      // Send INIT to all workers in the pool so both are pre-warmed
      for (const w of this.workers) {
        w?.postMessage({
          type: 'INIT',
          modelId,
        });
      }
    });
  }

  public async generateSentenceAudio(
    text: string,
    modelId: string = 'Xenova/mms-tts-spa',
    signal?: AbortSignal
  ): Promise<{ pcm: Int16Array; sampleRate: number }> {
    this.ensurePool();

    if (signal?.aborted) {
      throw new Error('Cancelado por el usuario');
    }

    // Pick the least busy worker from the pool
    let bestWorkerIndex = 0;
    let minBusy = this.busyCount[0] || 0;
    for (let i = 1; i < this.poolSize; i++) {
      const busy = this.busyCount[i] || 0;
      if (busy < minBusy) {
        minBusy = busy;
        bestWorkerIndex = i;
      }
    }

    this.busyCount[bestWorkerIndex] = (this.busyCount[bestWorkerIndex] || 0) + 1;
    const worker = this.workers[bestWorkerIndex];

    const id = `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.busyCount[bestWorkerIndex] = Math.max(0, (this.busyCount[bestWorkerIndex] || 1) - 1);
        this.pendingRequests.delete(id);
        reject(new Error('Tiempo de espera excedido en el fragmento de audio.'));
      }, 35000);

      const abortHandler = () => {
        clearTimeout(timer);
        this.busyCount[bestWorkerIndex] = Math.max(0, (this.busyCount[bestWorkerIndex] || 1) - 1);
        this.pendingRequests.delete(id);
        reject(new Error('Cancelado por el usuario'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      this.pendingRequests.set(id, {
        timer,
        resolve: (data) => {
          if (signal) signal.removeEventListener('abort', abortHandler);
          resolve(data);
        },
        reject: (err) => {
          if (signal) signal.removeEventListener('abort', abortHandler);
          reject(err);
        },
      });

      worker?.postMessage({
        type: 'GENERATE',
        id,
        text,
        modelId,
      });
    });
  }

  public terminate() {
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
    }
    this.pendingRequests.clear();

    for (const w of this.workers) {
      w?.terminate();
    }
    this.workers = [];
    this.workerReady = [];
    this.busyCount = [];
    this.currentModel = null;
  }
}

export const neuralTtsService = new NeuralTtsService();
