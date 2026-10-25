import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { CleaningOptions, PDFDocumentData, SentenceItem } from '../types';
import { DEFAULT_CLEANING_OPTIONS, detectRepetitiveHeadersFooters, processPageData } from './textCleaner';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

export interface ExtractProgressCallback {
  (currentPage: number, totalPages: number, stage: 'reading' | 'cleaning'): void;
}

/**
 * Extracts and cleans text page-by-page from a PDF File or ArrayBuffer
 */
export async function extractPDFData(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string = 'documento.pdf',
  fileSize: number = 0,
  options: CleaningOptions = DEFAULT_CLEANING_OPTIONS,
  onProgress?: ExtractProgressCallback
): Promise<PDFDocumentData> {
  const data = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.5.207/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const rawPageTexts: string[] = [];

  // 1. Extract text from each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages, 'reading');
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    let lastY: number | null = null;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        const currentY = item.transform[5];
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          // New line detected based on vertical shift
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = currentY;
      }
    }

    rawPageTexts.push(pageText);
  }

  // 2. Identify repetitive headers & footers across document
  onProgress?.(totalPages, totalPages, 'cleaning');
  const repetitivePatterns = options.removeRepetitiveHeaders
    ? detectRepetitiveHeadersFooters(rawPageTexts)
    : undefined;

  // 3. Clean and structure each page into paragraphs and sentences
  const processedPages = rawPageTexts.map((rawText, idx) => {
    return processPageData(rawText, idx + 1, options, repetitivePatterns);
  });

  // 4. Flatten all sentences with a sequential global index
  const allSentences: SentenceItem[] = [];
  processedPages.forEach(page => {
    page.paragraphs.forEach(para => {
      para.sentences.forEach(s => {
        allSentences.push(s);
      });
    });
  });

  const totalWords = allSentences.reduce((acc, s) => {
    return acc + s.text.trim().split(/\s+/).filter(Boolean).length;
  }, 0);

  const scannedPagesCount = processedPages.filter(p => p.isScannedLikely).length;

  return {
    name: fileName,
    fileSize,
    totalPages,
    pages: processedPages,
    allSentences,
    totalWords,
    scannedPagesCount,
  };
}

/**
 * Creates a sample Spanish document so the user can test all features in 1 click
 */
export function createSampleDocument(): PDFDocumentData {
  const sampleTextPage1 = `Capítulo Primero: Que trata de la condición y ejercicio del famoso hidalgo don Quijote de la Mancha.

En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.

Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda.

El resto della concluían sayo de velarte, calzas de velludo para las fiestas, con sus pantuflos de lo mesmo, y los días de entresemana se honraba con su vellorí de lo más fino. Tenía en su casa una ama que pasaba de los cuarenta, y una sobrina que no llegaba a los veinte, y un mozo de campo y plaza.`;

  const sampleTextPage2 = `Capítulo Segundo: De la primera salida que de su tierra hizo el ingenioso don Quijote.

Hechas, pues, estas prevenciones, no quiso aguardar más tiempo a poner en efeto su pensamiento, apretándole a ello la falta que él pensaba que hacía en el mundo su tardanza, según eran los agravios que pensaba deshacer, tuertos que enderezar, sinrazones que enmendar y abusos que mejorar.

Y así, sin dar parte a persona alguna de su intención, y sin que nadie le viese, una mañana, antes del día, que era uno de los calurosos del mes de julio, se armó de todas sus armas, subió sobre Rocinante, embrazó su rodela, tomó su lanza y por la puerta falsa de un corral salió al campo.

Con grandísimo contento y alborozo vio con cuánta facilidad había dado principio a su buen deseo. Mas apenas se vio en el campo cuando le asaltó un pensamiento terrible, y tal, que por poco le hiciera dejar la comenzada empresa.`;

  const pages = [
    processPageData(sampleTextPage1, 1),
    processPageData(sampleTextPage2, 2),
  ];

  const allSentences: SentenceItem[] = [];
  pages.forEach(p => p.paragraphs.forEach(pr => pr.sentences.forEach(s => allSentences.push(s))));
  const totalWords = allSentences.reduce((acc, s) => acc + s.text.trim().split(/\s+/).length, 0);

  return {
    name: 'Don_Quijote_Capitulos_1_y_2.pdf',
    fileSize: 45200,
    totalPages: 2,
    pages,
    allSentences,
    totalWords,
    scannedPagesCount: 0,
  };
}
