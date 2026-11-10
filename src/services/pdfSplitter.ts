import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

export interface SplitPdfMetadata {
  totalPages: number;
  title?: string;
  author?: string;
}

export interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
}

/**
 * Reads the total page count and basic info from a PDF file using pdf-lib
 */
export async function getPdfInfo(file: File): Promise<SplitPdfMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return {
    totalPages: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle() || undefined,
    author: pdfDoc.getAuthor() || undefined,
  };
}

/**
 * Renders low-overhead visual thumbnails for PDF pages using PDF.js so the user
 * can visually inspect and click pages when choosing the split range.
 */
export async function renderPdfPageThumbnails(
  file: File,
  maxPagesToRender: number = 60,
  onThumbnailReady?: (thumb: PageThumbnail) => void,
  signal?: AbortSignal
): Promise<PageThumbnail[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.5.207/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const count = Math.min(pdfDoc.numPages, maxPagesToRender);
  const thumbnails: PageThumbnail[] = [];

  for (let pageNum = 1; pageNum <= count; pageNum++) {
    if (signal?.aborted) break;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      if (ctx) {
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        const item: PageThumbnail = { pageNumber: pageNum, dataUrl };
        thumbnails.push(item);
        onThumbnailReady?.(item);
      }
    } catch (err) {
      console.warn(`No se pudo generar miniatura de la página ${pageNum}:`, err);
    }
  }

  return thumbnails;
}

/**
 * Extracts a specific list of 1-based page numbers from the source PDF and creates a new PDF Blob & File.
 * Uses pdf-lib for lossless vector extraction (preserves text, fonts, images, and links).
 */
export async function splitPdfByPages(
  sourceFile: File,
  selectedPagesOneBased: number[],
  customFileName: string
): Promise<{ blob: Blob; file: File; fileName: string; pageCount: number }> {
  if (!selectedPagesOneBased || selectedPagesOneBased.length === 0) {
    throw new Error('Debes seleccionar al menos una página para crear el nuevo PDF.');
  }

  const arrayBuffer = await sourceFile.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  // Convert 1-based page numbers to valid 0-based indices
  const validIndices = selectedPagesOneBased
    .map((p) => p - 1)
    .filter((idx) => idx >= 0 && idx < totalPages);

  if (validIndices.length === 0) {
    throw new Error('Las páginas seleccionadas están fuera del rango del documento.');
  }

  const newDoc = await PDFDocument.create();

  // Preserve original metadata where applicable
  const origAuthor = srcDoc.getAuthor();
  if (origAuthor) newDoc.setAuthor(origAuthor);
  newDoc.setCreator('VozPDF - Divisor de PDF');
  newDoc.setCreationDate(new Date());

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  // Ensure file name ends with .pdf
  let cleanName = (customFileName || '').trim();
  if (!cleanName) {
    const base = sourceFile.name.replace(/\.pdf$/i, '');
    const first = validIndices[0] + 1;
    const last = validIndices[validIndices.length - 1] + 1;
    cleanName = first === last ? `${base}_pagina_${first}.pdf` : `${base}_paginas_${first}_a_${last}.pdf`;
  } else if (!cleanName.toLowerCase().endsWith('.pdf')) {
    cleanName = `${cleanName}.pdf`;
  }

  newDoc.setTitle(cleanName.replace(/\.pdf$/i, ''));

  const pdfBytes = await newDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const file = new File([blob], cleanName, { type: 'application/pdf', lastModified: Date.now() });

  return {
    blob,
    file,
    fileName: cleanName,
    pageCount: validIndices.length,
  };
}

/**
 * Triggers a direct browser download for a Blob
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
