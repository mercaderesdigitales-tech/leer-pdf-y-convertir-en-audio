import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isNonLatin?: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'Inglés', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Francés', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Alemán', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portugués', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ca', name: 'Catalán', nativeName: 'Català', flag: '🏴' },
  { code: 'gl', name: 'Gallego', nativeName: 'Galego', flag: '🏴' },
  { code: 'eu', name: 'Euskera', nativeName: 'Euskara', flag: '🏴' },
  { code: 'nl', name: 'Neerlandés', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Ruso', nativeName: 'Русский', flag: '🇷🇺', isNonLatin: true },
  { code: 'zh-CN', name: 'Chino Simplificado', nativeName: '简体中文', flag: '🇨🇳', isNonLatin: true },
  { code: 'ja', name: 'Japonés', nativeName: '日本語', flag: '🇯🇵', isNonLatin: true },
  { code: 'ar', name: 'Árabe', nativeName: 'العربية', flag: '🇸🇦', isNonLatin: true },
];

export interface LineBox {
  x: number;
  pdfBottomY: number;
  topY: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface LayoutTextBlock {
  id: string;
  x: number;
  topY: number;
  pdfBottomY: number;
  width: number;
  height: number;
  maxAvailableHeight: number;
  maxAvailableWidth: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isSerif: boolean;
  align: 'left' | 'center' | 'right';
  bgColor: { r: number; g: number; b: number };
  textColor: { r: number; g: number; b: number };
  lineBoxes: LineBox[];
  text: string;
}

export interface ExtractedPageLayout {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  blocks: LayoutTextBlock[];
  paragraphs: string[];
  rawText: string;
}

export interface ExtractedPdfForTranslation {
  totalPages: number;
  pages: ExtractedPageLayout[];
  sampleText: string;
  detectedLangCode: string;
  detectedLangName: string;
  detectedConfidence: number;
}

export interface TranslatedPageResult {
  pageNumber: number;
  originalParagraphs: string[];
  translatedParagraphs: string[];
  translatedBlocks: {
    block: LayoutTextBlock;
    translatedText: string;
  }[];
}

export interface TranslationProgress {
  currentPage: number;
  totalPagesToTranslate: number;
  percent: number;
  stage: 'extracting' | 'translating' | 'generating';
}

const STOPWORDS_BY_LANG: Record<string, string[]> = {
  es: ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'que', 'por', 'con', 'para', 'como', 'más', 'pero', 'sus', 'este', 'esta', 'entre', 'cuando', 'todo', 'también', 'fue', 'había'],
  en: ['the', 'and', 'to', 'of', 'in', 'is', 'that', 'for', 'it', 'with', 'as', 'was', 'on', 'are', 'be', 'by', 'this', 'from', 'or', 'have', 'an', 'which', 'their', 'has', 'would'],
  fr: ['le', 'la', 'les', 'de', 'des', 'du', 'en', 'un', 'une', 'que', 'est', 'pour', 'dans', 'qui', 'sur', 'au', 'aux', 'avec', 'par', 'pas', 'plus', 'ce', 'cette', 'sont', 'nous'],
  de: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er'],
  it: ['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'della', 'in', 'un', 'una', 'che', 'per', 'con', 'non', 'sono', 'come', 'più', 'ma', 'questo', 'questa', 'anche', 'dal', 'nel'],
  pt: ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'em', 'um', 'uma', 'que', 'para', 'com', 'não', 'por', 'mais', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu'],
  ca: ['el', 'la', 'els', 'les', 'de', 'del', 'dels', 'en', 'un', 'una', 'que', 'per', 'amb', 'com', 'més', 'però', 'aquest', 'aquesta', 'són', 'també', 'va', 'seva', 'entre', 'quan'],
  gl: ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'en', 'un', 'unha', 'que', 'para', 'con', 'non', 'por', 'máis', 'como', 'pero', 'foi', 'ao', 'súa', 'pola', 'este', 'esta'],
  eu: ['eta', 'zen', 'ere', 'batean', 'baina', 'dira', 'ziren', 'zuen', 'du', 'dute', 'bat', 'ez', 'bere', 'hori', 'hura', 'alde', 'arabera', 'artean'],
  nl: ['de', 'het', 'een', 'en', 'van', 'in', 'is', 'dat', 'op', 'te', 'voor', 'met', 'als', 'zijn', 'er', 'maar', 'om', 'door', 'over', 'ze', 'bij', 'ook', 'tot', 'uit'],
};

/**
 * Detects language from sample text using script ranges + stopword frequency
 * and refines via remote translation API detector when available.
 */
export async function detectTextLanguage(sampleText: string): Promise<{
  code: string;
  name: string;
  confidence: number;
}> {
  const clean = (sampleText || '').trim();
  if (!clean) {
    return { code: 'es', name: 'Español', confidence: 50 };
  }

  if (/[\u4E00-\u9FFF]/.test(clean)) {
    return { code: 'zh-CN', name: 'Chino Simplificado', confidence: 98 };
  }
  if (/[\u3040-\u30FF]/.test(clean)) {
    return { code: 'ja', name: 'Japonés', confidence: 98 };
  }
  if (/[\u0600-\u06FF]/.test(clean)) {
    return { code: 'ar', name: 'Árabe', confidence: 98 };
  }
  if (/[\u0400-\u04FF]/.test(clean)) {
    return { code: 'ru', name: 'Ruso', confidence: 96 };
  }

  try {
    const snippet = clean.slice(0, 260);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(
      snippet
    )}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const detectedIso = typeof data?.[2] === 'string' ? data[2] : '';
      if (detectedIso) {
        const normalizedCode = detectedIso.startsWith('zh')
          ? 'zh-CN'
          : detectedIso.split('-')[0].toLowerCase();
        const found = SUPPORTED_LANGUAGES.find(
          (l) =>
            l.code.toLowerCase() === normalizedCode ||
            l.code.toLowerCase() === detectedIso.toLowerCase()
        );
        if (found) {
          return { code: found.code, name: found.name, confidence: 96 };
        }
      }
    }
  } catch {
    // Fallback to local stopword analyzer
  }

  const words = clean
    .toLowerCase()
    .replace(/[^a-záéíóúàèìòùâêîôûäëïöüãõñç\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  let bestLang = 'es';
  let bestScore = -1;
  let secondBest = 0;

  for (const [langCode, stopwords] of Object.entries(STOPWORDS_BY_LANG)) {
    const stopSet = new Set(stopwords);
    let matches = 0;
    for (const w of words) {
      if (stopSet.has(w)) matches++;
    }
    if (matches > bestScore) {
      secondBest = Math.max(0, bestScore);
      bestScore = matches;
      bestLang = langCode;
    } else if (matches > secondBest) {
      secondBest = matches;
    }
  }

  const foundLang = SUPPORTED_LANGUAGES.find((l) => l.code === bestLang) || SUPPORTED_LANGUAGES[0];
  const confidence =
    words.length > 0 && bestScore > 0
      ? Math.min(
          98,
          Math.max(68, Math.round(75 + ((bestScore - secondBest) / Math.max(1, bestScore)) * 22))
        )
      : 72;

  return {
    code: foundLang.code,
    name: foundLang.name,
    confidence,
  };
}

interface RawSpan {
  str: string;
  x: number;
  pdfBaselineY: number;
  pdfBottomY: number;
  topY: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isSerif: boolean;
}

interface MergedLine {
  text: string;
  x: number;
  pdfBottomY: number;
  topY: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isSerif: boolean;
}

/**
 * Samples background color and foreground text color for a block from a rendered page canvas
 */
function sampleBlockColors(
  ctx: CanvasRenderingContext2D | null,
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  topY: number,
  width: number,
  height: number
): {
  bgColor: { r: number; g: number; b: number };
  textColor: { r: number; g: number; b: number };
} {
  const defaultColors = {
    bgColor: { r: 1, g: 1, b: 1 },
    textColor: { r: 0.08, g: 0.1, b: 0.15 },
  };
  if (!ctx) return defaultColors;

  try {
    const sx = Math.max(0, Math.floor(x - 2));
    const sy = Math.max(0, Math.floor(topY - 2));
    const sw = Math.min(canvasWidth - sx, Math.max(4, Math.ceil(width + 4)));
    const sh = Math.min(canvasHeight - sy, Math.max(4, Math.ceil(height + 4)));

    if (sw <= 0 || sh <= 0) return defaultColors;

    const imgData = ctx.getImageData(sx, sy, sw, sh).data;

    // Sample perimeter pixels to estimate background color
    const perimeterSamples: [number, number, number][] = [];
    for (let px = 0; px < sw; px += Math.max(1, Math.floor(sw / 12))) {
      const topIdx = px * 4;
      const botIdx = ((sh - 1) * sw + px) * 4;
      perimeterSamples.push([imgData[topIdx], imgData[topIdx + 1], imgData[topIdx + 2]]);
      perimeterSamples.push([imgData[botIdx], imgData[botIdx + 1], imgData[botIdx + 2]]);
    }
    for (let py = 0; py < sh; py += Math.max(1, Math.floor(sh / 6))) {
      const leftIdx = py * sw * 4;
      const rightIdx = (py * sw + (sw - 1)) * 4;
      perimeterSamples.push([imgData[leftIdx], imgData[leftIdx + 1], imgData[leftIdx + 2]]);
      perimeterSamples.push([imgData[rightIdx], imgData[rightIdx + 1], imgData[rightIdx + 2]]);
    }

    // Sort by luminance and pick median for robust background color
    perimeterSamples.sort(
      (a, b) => 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2] - (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2])
    );
    const mid = perimeterSamples[Math.floor(perimeterSamples.length * 0.65)] || [255, 255, 255];
    const bgR = mid[0] / 255;
    const bgG = mid[1] / 255;
    const bgB = mid[2] / 255;
    const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

    // Find most contrasting interior pixels for foreground text color
    let bestContrast = -1;
    let fgR = bgLum > 0.5 ? 0.08 : 0.96;
    let fgG = bgLum > 0.5 ? 0.1 : 0.96;
    let fgB = bgLum > 0.5 ? 0.14 : 0.96;

    const step = Math.max(4, Math.floor((sw * sh) / 180) * 4);
    for (let i = 0; i < imgData.length; i += step) {
      const r = imgData[i] / 255;
      const g = imgData[i + 1] / 255;
      const b = imgData[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const diff = Math.abs(lum - bgLum);
      if (diff > bestContrast && diff > 0.25) {
        bestContrast = diff;
        fgR = r;
        fgG = g;
        fgB = b;
      }
    }

    return {
      bgColor: { r: bgR, g: bgG, b: bgB },
      textColor: { r: fgR, g: fgG, b: fgB },
    };
  } catch {
    return defaultColors;
  }
}

/**
 * Extracts spatial layout blocks (preserving exact coordinates, font sizes, bold/italic, colors, and columns)
 * from each page of the PDF, and detects its language.
 */
export async function extractPdfForTranslation(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedPdfForTranslation> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.5.207/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pages: ExtractedPageLayout[] = [];
  let sampleBuffer = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    // Render page at 1x offscreen to sample true background & text colors
    let pageCtx: CanvasRenderingContext2D | null = null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(pageWidth));
      canvas.height = Math.max(1, Math.floor(pageHeight));
      pageCtx = canvas.getContext('2d', { willReadFrequently: true });
      if (pageCtx) {
        await page.render({ canvasContext: pageCtx, viewport, canvas }).promise;
      }
    } catch {
      pageCtx = null;
    }

    const textContent = await page.getTextContent();
    const styles = (textContent.styles || {}) as Record<string, { fontFamily?: string }>;

    const spans: RawSpan[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const rawStr = item.str;
      if (!rawStr || !rawStr.trim()) continue;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.max(
        6,
        Math.min(72, Math.hypot(item.transform[2], item.transform[3]) || Math.abs(item.transform[0]) || 11)
      );

      const x = Math.max(0, tx[4]);
      const viewportBaselineY = tx[5];
      const pdfBaselineY = pageHeight - viewportBaselineY;
      const pdfBottomY = pdfBaselineY - fontSize * 0.22;
      const height = Math.max(fontSize * 1.15, item.height || fontSize);
      const topY = viewportBaselineY - fontSize * 0.88;
      const width = Math.max(fontSize * 0.4, item.width > 0 ? item.width : rawStr.length * fontSize * 0.5);

      const fontNameLower = `${item.fontName || ''} ${styles[item.fontName]?.fontFamily || ''}`.toLowerCase();
      const isBold = /bold|black|heavy|demi|semibold|medi/.test(fontNameLower);
      const isItalic = /italic|oblique|slant/.test(fontNameLower);
      const isSerif = /times|serif|georgia|garamond|cambria|minion|palatino/.test(fontNameLower);

      spans.push({
        str: rawStr,
        x,
        pdfBaselineY,
        pdfBottomY,
        topY,
        width,
        height,
        fontSize,
        isBold,
        isItalic,
        isSerif,
      });
    }

    // Sort spans top-to-bottom, then left-to-right on the same line
    spans.sort((a, b) => {
      const sameLineThreshold = Math.min(a.fontSize, b.fontSize) * 0.45;
      if (Math.abs(a.topY - b.topY) <= sameLineThreshold) {
        return a.x - b.x;
      }
      return a.topY - b.topY;
    });

    // Step 1: Merge spans into distinct horizontal lines (preserving multi-column gaps!)
    const mergedLines: MergedLine[] = [];
    for (const sp of spans) {
      if (mergedLines.length === 0) {
        mergedLines.push({
          text: sp.str,
          x: sp.x,
          pdfBottomY: sp.pdfBottomY,
          topY: sp.topY,
          width: sp.width,
          height: sp.height,
          fontSize: sp.fontSize,
          isBold: sp.isBold,
          isItalic: sp.isItalic,
          isSerif: sp.isSerif,
        });
        continue;
      }

      const prev = mergedLines[mergedLines.length - 1];
      const sameVerticalLine =
        Math.abs(sp.topY - prev.topY) <= Math.min(sp.fontSize, prev.fontSize) * 0.48;
      const horizontalGap = sp.x - (prev.x + prev.width);

      // Only merge if on the same vertical line AND horizontal gap is not a column/table jump (< 2.6 * fontSize)
      if (sameVerticalLine && horizontalGap >= -sp.fontSize * 0.8 && horizontalGap <= sp.fontSize * 2.6) {
        const needsSpace =
          horizontalGap > sp.fontSize * 0.16 &&
          !prev.text.endsWith(' ') &&
          !sp.str.startsWith(' ') &&
          !prev.text.endsWith('-');

        prev.text = prev.text + (needsSpace ? ' ' : '') + sp.str;
        const rightEdge = Math.max(prev.x + prev.width, sp.x + sp.width);
        prev.x = Math.min(prev.x, sp.x);
        prev.width = rightEdge - prev.x;
        prev.height = Math.max(prev.height, sp.height);
        prev.fontSize = Math.max(prev.fontSize, sp.fontSize);
        prev.pdfBottomY = Math.min(prev.pdfBottomY, sp.pdfBottomY);
        prev.topY = Math.min(prev.topY, sp.topY);
        prev.isBold = prev.isBold || sp.isBold;
      } else {
        mergedLines.push({
          text: sp.str,
          x: sp.x,
          pdfBottomY: sp.pdfBottomY,
          topY: sp.topY,
          width: sp.width,
          height: sp.height,
          fontSize: sp.fontSize,
          isBold: sp.isBold,
          isItalic: sp.isItalic,
          isSerif: sp.isSerif,
        });
      }
    }

    // Step 2: Group lines into logical spatial blocks (paragraphs, headings, table cells)
    const rawBlocks: {
      lines: MergedLine[];
      x: number;
      topY: number;
      pdfBottomY: number;
      width: number;
      height: number;
      fontSize: number;
      isBold: boolean;
      isItalic: boolean;
      isSerif: boolean;
    }[] = [];

    for (const ln of mergedLines) {
      const cleanLineText = ln.text.trim();
      if (!cleanLineText) continue;

      let attached = false;
      // Look back at the most recent blocks to find one in the same column right above this line
      for (let bIdx = rawBlocks.length - 1; bIdx >= Math.max(0, rawBlocks.length - 4); bIdx--) {
        const blk = rawBlocks[bIdx];
        const lastLine = blk.lines[blk.lines.length - 1];

        const verticalDist = ln.topY - (lastLine.topY + lastLine.height);
        const fontSizeDiff = Math.abs(ln.fontSize - blk.fontSize);

        // Check horizontal alignment (same left margin within 36pt, or centered in same column)
        const leftDiff = Math.abs(ln.x - blk.x);
        const blkCenter = blk.x + blk.width / 2;
        const lnCenter = ln.x + ln.width / 2;
        const centerDiff = Math.abs(lnCenter - blkCenter);
        const horizOverlap =
          Math.min(blk.x + blk.width, ln.x + ln.width) - Math.max(blk.x, ln.x);

        const sameColumn =
          (leftDiff <= 36 || (centerDiff <= 28 && horizOverlap > 0)) &&
          horizOverlap >= -10;

        // Avoid merging a bold heading with normal body text, or across large paragraph gaps
        const maxGap = blk.fontSize * 0.72;
        const styleMatches = ln.isBold === blk.isBold && fontSizeDiff <= 1.6;

        if (sameColumn && styleMatches && verticalDist >= -blk.fontSize * 0.35 && verticalDist <= maxGap) {
          blk.lines.push(ln);
          const rightEdge = Math.max(blk.x + blk.width, ln.x + ln.width);
          blk.x = Math.min(blk.x, ln.x);
          blk.width = rightEdge - blk.x;
          blk.topY = Math.min(blk.topY, ln.topY);
          blk.pdfBottomY = Math.min(blk.pdfBottomY, ln.pdfBottomY);
          blk.height = pageHeight - blk.pdfBottomY - blk.topY;
          attached = true;
          break;
        }
      }

      if (!attached) {
        rawBlocks.push({
          lines: [ln],
          x: ln.x,
          topY: ln.topY,
          pdfBottomY: ln.pdfBottomY,
          width: ln.width,
          height: ln.height,
          fontSize: ln.fontSize,
          isBold: ln.isBold,
          isItalic: ln.isItalic,
          isSerif: ln.isSerif,
        });
      }
    }

    // Step 3: Build final LayoutTextBlocks with available width/height and sampled colors
    const blocks: LayoutTextBlock[] = rawBlocks.map((rb, idx) => {
      // Combine lines into clean paragraph text
      let combinedText = '';
      for (const ln of rb.lines) {
        const t = ln.text.trim();
        if (!combinedText) {
          combinedText = t;
        } else if (combinedText.endsWith('-') && /^[a-záéíóúñü]/i.test(t)) {
          combinedText = combinedText.slice(0, -1) + t;
        } else {
          combinedText += ' ' + t;
        }
      }

      // Detect alignment (centered vs left)
      let align: 'left' | 'center' | 'right' = 'left';
      const pageCenter = pageWidth / 2;
      const blockCenter = rb.x + rb.width / 2;
      if (Math.abs(blockCenter - pageCenter) < 28 && rb.x > 65) {
        align = 'center';
      }

      // Compute how much vertical space exists before the next block directly below in the same X range
      let nextBlockTopY = pageHeight - 24;
      for (let otherIdx = 0; otherIdx < rawBlocks.length; otherIdx++) {
        if (otherIdx === idx) continue;
        const other = rawBlocks[otherIdx];
        if (other.topY > rb.topY + rb.height * 0.5) {
          const xOverlap =
            Math.min(rb.x + rb.width, other.x + other.width) - Math.max(rb.x, other.x);
          if (xOverlap > 8 && other.topY < nextBlockTopY) {
            nextBlockTopY = other.topY;
          }
        }
      }

      const maxAvailableHeight = Math.max(
        rb.height + 4,
        Math.min(rb.height * 1.45, nextBlockTopY - rb.topY - 2)
      );

      // Compute available width before any block to the right on the same horizontal band
      let rightLimitX = pageWidth - Math.min(36, rb.x);
      for (let otherIdx = 0; otherIdx < rawBlocks.length; otherIdx++) {
        if (otherIdx === idx) continue;
        const other = rawBlocks[otherIdx];
        const yOverlap =
          Math.min(rb.topY + rb.height, other.topY + other.height) -
          Math.max(rb.topY, other.topY);
        if (yOverlap > 2 && other.x >= rb.x + rb.width - 4 && other.x < rightLimitX) {
          rightLimitX = other.x - 8;
        }
      }

      const maxAvailableWidth = Math.max(
        rb.width + 6,
        Math.min(rightLimitX - rb.x, Math.max(rb.width * 1.18, rb.width + 24))
      );

      const { bgColor, textColor } = sampleBlockColors(
        pageCtx,
        Math.floor(pageWidth),
        Math.floor(pageHeight),
        rb.x,
        rb.topY,
        rb.width,
        rb.height
      );

      return {
        id: `p${pageNum}_b${idx}`,
        x: rb.x,
        topY: rb.topY,
        pdfBottomY: rb.pdfBottomY,
        width: rb.width,
        height: rb.height,
        maxAvailableHeight,
        maxAvailableWidth,
        fontSize: rb.fontSize,
        isBold: rb.isBold,
        isItalic: rb.isItalic,
        isSerif: rb.isSerif,
        align,
        bgColor,
        textColor,
        lineBoxes: rb.lines.map((l) => ({
          x: l.x,
          pdfBottomY: l.pdfBottomY,
          topY: l.topY,
          width: l.width,
          height: l.height,
          fontSize: l.fontSize,
        })),
        text: combinedText,
      };
    });

    const paragraphs = blocks.map((b) => b.text).filter(Boolean);
    const rawText = paragraphs.join('\n\n');

    if (sampleBuffer.length < 900 && rawText.trim()) {
      sampleBuffer += ' ' + rawText.slice(0, 900 - sampleBuffer.length);
    }

    pages.push({
      pageNumber: pageNum,
      pageWidth,
      pageHeight,
      blocks,
      paragraphs,
      rawText,
    });
  }

  const detected = await detectTextLanguage(sampleBuffer);

  return {
    totalPages,
    pages,
    sampleText: sampleBuffer.trim(),
    detectedLangCode: detected.code,
    detectedLangName: detected.name,
    detectedConfidence: detected.confidence,
  };
}

/**
 * Checks if a text block is purely numeric/symbolic (e.g. page numbers, dates, codes) and doesn't need translation
 */
function shouldSkipTranslation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  // If it contains no letters in any alphabet, keep as-is
  if (!/[a-zA-ZáéíóúàèìòùâêîôûäëïöüãõñçÁÉÍÓÚÑÜ\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\u0600-\u06FF]/.test(trimmed)) {
    return true;
  }
  // URLs or email addresses
  if (/^(https?:\/\/|www\.|\S+@\S+\.\S+)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Translates a single text string reliably with automatic retry and fallback so it NEVER returns blank text.
 */
async function translateSingleBlockText(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || sourceLang === targetLang || shouldSkipTranslation(trimmed)) {
    return trimmed;
  }

  const sl = sourceLang || 'auto';

  // Attempt 1 & 2: Google GTX endpoint (using POST or chunked GET for long strings)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;

      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.[0])) {
          const joined = data[0]
            .map((part: any) => (typeof part?.[0] === 'string' ? part[0] : ''))
            .join('');
          if (joined && joined.trim().length > 0) {
            return joined.trim();
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // Fallback: MyMemory API
  try {
    const pairSl = sl === 'auto' ? 'en' : sl;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed.slice(0, 490)
    )}&langpair=${encodeURIComponent(`${pairSl}|${targetLang}`)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      const candidate = data?.responseData?.translatedText;
      if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // Guaranteed non-blank fallback: return original text rather than leaving a blank space
  return trimmed;
}

/**
 * Translates all spatial blocks of a page with 1-to-1 block mapping and controlled concurrency
 */
async function translatePageLayoutBlocks(
  blocks: LayoutTextBlock[],
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<{ block: LayoutTextBlock; translatedText: string }[]> {
  if (blocks.length === 0) return [];

  const results: { block: LayoutTextBlock; translatedText: string }[] = new Array(blocks.length);
  const CONCURRENCY = 5;
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < blocks.length) {
      if (signal?.aborted) return;
      const idx = currentIndex++;
      const block = blocks[idx];
      const translatedText = await translateSingleBlockText(
        block.text,
        sourceLang,
        targetLang,
        signal
      );
      results[idx] = {
        block,
        translatedText: translatedText || block.text,
      };
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, blocks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Sanitizes Unicode punctuation into WinAnsi-compatible characters for StandardFonts in pdf-lib
 */
function sanitizeForWinAnsi(text: string): string {
  return (text || '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F«»]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/•/g, '-')
    // Keep strictly printable ASCII + Latin-1 Supplement (0xA0-0xFF) which are 100% supported by WinAnsi
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * Wraps text into lines that fit within `maxWidth` for a given PDFFont and `fontSize`.
 */
function wrapTextForFont(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const clean = sanitizeForWinAnsi(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    let testW = 0;
    try {
      testW = font.widthOfTextAtSize(testLine, fontSize);
    } catch {
      testW = testLine.length * fontSize * 0.52;
    }

    if (testW > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Renders a non-Latin translated page by drawing the original PDF page onto a high-DPI canvas,
 * covering original text boxes with their sampled background color, and typesetting translated text in-place.
 */
async function renderInPlaceCanvasPage(
  sourceArrayBuffer: ArrayBuffer,
  pageNumber: number,
  translatedBlocks: { block: LayoutTextBlock; translatedText: string }[],
  isRtl: boolean
): Promise<{ jpgBytes: ArrayBuffer; width: number; height: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: sourceArrayBuffer.slice(0),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.5.207/cmaps/',
    cMapPacked: true,
  });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);
  const scale = 2.0;
  const viewport = page.getViewport({ scale });
  const pageWidth = viewport.width / scale;
  const pageHeight = viewport.height / scale;

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  ctx.scale(scale, scale);

  // 1. Cover original text lines with their sampled background color
  for (const { block } of translatedBlocks) {
    const r = Math.round(block.bgColor.r * 255);
    const g = Math.round(block.bgColor.g * 255);
    const b = Math.round(block.bgColor.b * 255);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    for (const lb of block.lineBoxes) {
      ctx.fillRect(lb.x - 1, lb.topY - 1, lb.width + 2, lb.height + 2);
    }
  }

  // 2. Draw translated text inside each block's exact bounding box
  for (const { block, translatedText } of translatedBlocks) {
    const text = (translatedText || block.text).trim();
    if (!text) continue;

    const r = Math.round(block.textColor.r * 255);
    const g = Math.round(block.textColor.g * 255);
    const b = Math.round(block.textColor.b * 255);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    const boxWidth = block.maxAvailableWidth;
    const boxHeight = block.maxAvailableHeight;

    let fitSize = block.fontSize;
    const minSize = Math.max(6, block.fontSize * 0.62);
    let wrappedLines: string[] = [];

    while (fitSize >= minSize) {
      ctx.font = `${block.isItalic ? 'italic ' : ''}${block.isBold ? 'bold ' : ''}${fitSize}px ${
        block.isSerif ? 'serif' : 'sans-serif'
      }`;
      const tokens = text.includes(' ') ? text.split(/\s+/) : Array.from(text);
      const joiner = text.includes(' ') ? ' ' : '';
      wrappedLines = [];
      let line = '';
      for (const tok of tokens) {
        const test = line ? line + joiner + tok : tok;
        if (ctx.measureText(test).width > boxWidth && line) {
          wrappedLines.push(line);
          line = tok;
        } else {
          line = test;
        }
      }
      if (line) wrappedLines.push(line);

      if (wrappedLines.length * fitSize * 1.18 <= boxHeight || fitSize <= minSize) {
        break;
      }
      fitSize -= 0.5;
    }

    const lineHeight = fitSize * 1.16;
    let cursorY = block.topY + fitSize * 0.88;

    for (const ln of wrappedLines) {
      if (cursorY > block.topY + boxHeight + fitSize * 0.4) break;
      let drawX = block.x;
      if (isRtl) {
        ctx.textAlign = 'right';
        drawX = block.x + boxWidth;
      } else if (block.align === 'center') {
        ctx.textAlign = 'center';
        drawX = block.x + block.width / 2;
      } else {
        ctx.textAlign = 'left';
      }
      ctx.fillText(ln, drawX, cursorY);
      cursorY += lineHeight;
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpgBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  return { jpgBytes, width: pageWidth, height: pageHeight };
}

/**
 * Generates a layout-preserving translated PDF document by copying the original PDF pages
 * and replacing each text block in-place at its exact coordinates, preserving all original images,
 * graphics, tables, font sizes, bold weights, and colors.
 */
export async function generateTranslatedPdfDocument(
  sourceFile: File,
  translatedPages: TranslatedPageResult[],
  sourceFileName: string,
  targetLang: SupportedLanguage,
  customFileName?: string
): Promise<{ blob: Blob; file: File; fileName: string; pageCount: number }> {
  const sourceArrayBuffer = await sourceFile.arrayBuffer();
  const srcPdfDoc = await PDFDocument.load(sourceArrayBuffer, { ignoreEncryption: true });
  const outPdfDoc = await PDFDocument.create();

  outPdfDoc.setCreator('VozPDF - Traductor de PDF con Preservación de Diseño');
  outPdfDoc.setCreationDate(new Date());

  const baseName = sourceFileName.replace(/\.pdf$/i, '').trim() || 'documento';
  let finalFileName = (customFileName || '').trim();
  if (!finalFileName) {
    finalFileName = `${baseName}_${targetLang.code}.pdf`;
  } else if (!finalFileName.toLowerCase().endsWith('.pdf')) {
    finalFileName = `${finalFileName}.pdf`;
  }
  outPdfDoc.setTitle(finalFileName.replace(/\.pdf$/i, ''));

  // Embed standard font families (Sans-Serif & Serif in Regular, Bold, Italic, BoldItalic)
  const fonts = {
    sansRegular: await outPdfDoc.embedFont(StandardFonts.Helvetica),
    sansBold: await outPdfDoc.embedFont(StandardFonts.HelveticaBold),
    sansItalic: await outPdfDoc.embedFont(StandardFonts.HelveticaOblique),
    sansBoldItalic: await outPdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    serifRegular: await outPdfDoc.embedFont(StandardFonts.TimesRoman),
    serifBold: await outPdfDoc.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await outPdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    serifBoldItalic: await outPdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
  };

  const selectFont = (block: LayoutTextBlock): PDFFont => {
    if (block.isSerif) {
      if (block.isBold && block.isItalic) return fonts.serifBoldItalic;
      if (block.isBold) return fonts.serifBold;
      if (block.isItalic) return fonts.serifItalic;
      return fonts.serifRegular;
    } else {
      if (block.isBold && block.isItalic) return fonts.sansBoldItalic;
      if (block.isBold) return fonts.sansBold;
      if (block.isItalic) return fonts.sansItalic;
      return fonts.sansRegular;
    }
  };

  for (const tPage of translatedPages) {
    // Non-Latin scripts use the in-place high-DPI canvas renderer
    if (targetLang.isNonLatin) {
      const rendered = await renderInPlaceCanvasPage(
        sourceArrayBuffer,
        tPage.pageNumber,
        tPage.translatedBlocks,
        targetLang.code === 'ar'
      );
      const jpgImage = await outPdfDoc.embedJpg(rendered.jpgBytes);
      const page = outPdfDoc.addPage([rendered.width, rendered.height]);
      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: rendered.width,
        height: rendered.height,
      });
      continue;
    }

    // Copy the exact original vector page from srcPdfDoc
    const pageIndexZeroBased = tPage.pageNumber - 1;
    const [copiedPage] = await outPdfDoc.copyPages(srcPdfDoc, [pageIndexZeroBased]);
    const page = outPdfDoc.addPage(copiedPage);
    const { height: pageHeight } = page.getSize();

    // Pass 1: Cover each original text line tightly with its sampled background color
    // so all surrounding images, vector graphics, and table borders stay intact
    for (const { block } of tPage.translatedBlocks) {
      const bg = rgb(
        Math.max(0, Math.min(1, block.bgColor.r)),
        Math.max(0, Math.min(1, block.bgColor.g)),
        Math.max(0, Math.min(1, block.bgColor.b))
      );

      for (const lb of block.lineBoxes) {
        const rectY = pageHeight - lb.topY - lb.height;
        page.drawRectangle({
          x: Math.max(0, lb.x - 1),
          y: Math.max(0, rectY - 1),
          width: lb.width + 2,
          height: lb.height + 2,
          color: bg,
          borderWidth: 0,
        });
      }
    }

    // Pass 2: Typeset the translated text inside each block's exact coordinates with auto-fit font sizing
    for (const { block, translatedText } of tPage.translatedBlocks) {
      const rawText = (translatedText || block.text).trim();
      if (!rawText) continue;

      const font = selectFont(block);
      const fgColor = rgb(
        Math.max(0, Math.min(1, block.textColor.r)),
        Math.max(0, Math.min(1, block.textColor.g)),
        Math.max(0, Math.min(1, block.textColor.b))
      );

      const targetWidth = block.maxAvailableWidth;
      const targetHeight = block.maxAvailableHeight;

      // Auto-fit font size so translated text fits inside the original block bounding box
      let fitFontSize = block.fontSize;
      const minFontSize = Math.max(6, block.fontSize * 0.62);
      let wrappedLines = wrapTextForFont(rawText, font, fitFontSize, targetWidth);

      while (fitFontSize > minFontSize) {
        const lineHeight = fitFontSize * 1.16;
        const requiredHeight = wrappedLines.length * lineHeight;
        if (requiredHeight <= targetHeight) {
          break;
        }
        fitFontSize = Math.max(minFontSize, fitFontSize - 0.5);
        wrappedLines = wrapTextForFont(rawText, font, fitFontSize, targetWidth);
      }

      if (wrappedLines.length === 0) continue;

      const lineHeight = fitFontSize * 1.16;
      const totalRenderedHeight = wrappedLines.length * lineHeight;

      // Ensure background rectangle also covers the translated text footprint if it expanded slightly
      const blockTopPdfY = pageHeight - block.topY;
      const bg = rgb(
        Math.max(0, Math.min(1, block.bgColor.r)),
        Math.max(0, Math.min(1, block.bgColor.g)),
        Math.max(0, Math.min(1, block.bgColor.b))
      );
      let maxLineW = 0;
      for (const ln of wrappedLines) {
        try {
          maxLineW = Math.max(maxLineW, font.widthOfTextAtSize(ln, fitFontSize));
        } catch {
          maxLineW = Math.max(maxLineW, ln.length * fitFontSize * 0.52);
        }
      }

      const bgX =
        block.align === 'center'
          ? Math.max(0, block.x + block.width / 2 - maxLineW / 2 - 1)
          : Math.max(0, block.x - 1);

      page.drawRectangle({
        x: bgX,
        y: Math.max(0, blockTopPdfY - totalRenderedHeight - 1),
        width: maxLineW + 2,
        height: totalRenderedHeight + 2,
        color: bg,
        borderWidth: 0,
      });

      // Draw each line at its exact vertical position from the top of the block
      let currentBaselinePdfY = blockTopPdfY - fitFontSize * 0.88;

      for (const ln of wrappedLines) {
        if (currentBaselinePdfY < 10) break;

        let lineX = block.x;
        if (block.align === 'center') {
          let lnW = 0;
          try {
            lnW = font.widthOfTextAtSize(ln, fitFontSize);
          } catch {
            lnW = ln.length * fitFontSize * 0.52;
          }
          lineX = Math.max(12, block.x + block.width / 2 - lnW / 2);
        }

        try {
          page.drawText(ln, {
            x: lineX,
            y: currentBaselinePdfY,
            size: fitFontSize,
            font,
            color: fgColor,
          });
        } catch {
          // Safe fallback if any exotic character slipped through
          const asciiFallback = ln.replace(/[^\x20-\x7E]/g, '');
          if (asciiFallback) {
            page.drawText(asciiFallback, {
              x: lineX,
              y: currentBaselinePdfY,
              size: fitFontSize,
              font,
              color: fgColor,
            });
          }
        }

        currentBaselinePdfY -= lineHeight;
      }
    }
  }

  const pdfBytes = await outPdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const file = new File([blob], finalFileName, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    blob,
    file,
    fileName: finalFileName,
    pageCount: outPdfDoc.getPageCount(),
  };
}

/**
 * Full pipeline: translates selected pages from an extracted PDF while preserving original layout,
 * images, fonts, and design, and returns the translated pages + generated PDF.
 */
export async function translatePdfAndBuildDocument(
  sourceFile: File,
  extracted: ExtractedPdfForTranslation,
  sourceFileName: string,
  sourceLangCode: string,
  targetLangCode: string,
  startPage: number,
  endPage: number,
  customFileName?: string,
  onProgress?: (progress: TranslationProgress, partialPages: TranslatedPageResult[]) => void,
  signal?: AbortSignal
): Promise<{
  translatedPages: TranslatedPageResult[];
  blob: Blob;
  file: File;
  fileName: string;
  pageCount: number;
}> {
  const pagesToTranslate = extracted.pages.filter(
    (p) => p.pageNumber >= startPage && p.pageNumber <= endPage
  );

  if (pagesToTranslate.length === 0) {
    throw new Error('No hay páginas seleccionadas en el rango indicado.');
  }

  const targetLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLangCode) || SUPPORTED_LANGUAGES[0];

  const translatedPages: TranslatedPageResult[] = [];

  for (let i = 0; i < pagesToTranslate.length; i++) {
    if (signal?.aborted) {
      throw new Error('Traducción cancelada por el usuario.');
    }

    const pageItem = pagesToTranslate[i];
    onProgress?.(
      {
        currentPage: i + 1,
        totalPagesToTranslate: pagesToTranslate.length,
        percent: Math.round((i / pagesToTranslate.length) * 85),
        stage: 'translating',
      },
      translatedPages
    );

    const translatedBlocks = await translatePageLayoutBlocks(
      pageItem.blocks,
      sourceLangCode,
      targetLangCode,
      signal
    );

    const pageResult: TranslatedPageResult = {
      pageNumber: pageItem.pageNumber,
      originalParagraphs: pageItem.paragraphs,
      translatedParagraphs: translatedBlocks.map((tb) => tb.translatedText).filter(Boolean),
      translatedBlocks,
    };

    translatedPages.push(pageResult);

    onProgress?.(
      {
        currentPage: i + 1,
        totalPagesToTranslate: pagesToTranslate.length,
        percent: Math.round(((i + 1) / pagesToTranslate.length) * 88),
        stage: 'translating',
      },
      [...translatedPages]
    );
  }

  onProgress?.(
    {
      currentPage: pagesToTranslate.length,
      totalPagesToTranslate: pagesToTranslate.length,
      percent: 95,
      stage: 'generating',
    },
    translatedPages
  );

  const pdfResult = await generateTranslatedPdfDocument(
    sourceFile,
    translatedPages,
    sourceFileName,
    targetLang,
    customFileName
  );

  onProgress?.(
    {
      currentPage: pagesToTranslate.length,
      totalPagesToTranslate: pagesToTranslate.length,
      percent: 100,
      stage: 'generating',
    },
    translatedPages
  );

  return {
    translatedPages,
    ...pdfResult,
  };
}
