import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

export interface OcrProgressCallback {
  (progress: number, status: string): void;
}

/**
 * Performs client-side OCR on a specific PDF page using Tesseract.js
 */
export async function performOcrOnPdfPage(
  pdfFile: File | ArrayBuffer,
  pageNumber: number,
  onProgress?: OcrProgressCallback
): Promise<string> {
  const data = pdfFile instanceof File ? await pdfFile.arrayBuffer() : pdfFile;
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  // Render to offscreen canvas at high DPI for OCR accuracy
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D para OCR.');
  }

  onProgress?.(10, 'Renderizando página para OCR...');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  onProgress?.(25, 'Inicializando motor OCR Tesseract...');
  const worker = await createWorker('spa+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(25 + (m.progress || 0) * 70);
        onProgress?.(pct, `Reconociendo caracteres: ${Math.round((m.progress || 0) * 100)}%`);
      }
    },
  });

  const { data: ocrData } = await worker.recognize(canvas);
  await worker.terminate();

  onProgress?.(100, 'OCR completado.');
  return ocrData.text || '';
}
