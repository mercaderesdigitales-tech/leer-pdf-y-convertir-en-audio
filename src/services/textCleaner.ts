import { CleaningOptions, PageData, ParagraphItem, SentenceItem } from '../types';

export const DEFAULT_CLEANING_OPTIONS: CleaningOptions = {
  removeHyphenation: true,
  removePageNumbers: true,
  removeRepetitiveHeaders: true,
  normalizeWhitespace: true,
};

// Common Spanish and English abbreviations that do NOT terminate sentences
const ABBREVIATIONS = new Set([
  'dr', 'dra', 'sr', 'sra', 'srta', 'prof', 'profra', 'd', 'dña',
  'ej', 'pág', 'págs', 'art', 'cap', 'núm', 'no', 'vol', 'etc',
  'avda', 'av', 'apdo', 'gob', 'cia', 'mr', 'mrs', 'ms', 'dr', 'prof',
  'inc', 'ltd', 'dept', 'vs', 'e.g', 'i.e', 'al', 'op. cit', 'ibid'
]);

/**
 * Removes hyphenated words split across line breaks
 * e.g. "desarro-\nllo" -> "desarrollo"
 */
export function removeHyphensAtLineEnds(text: string): string {
  // Matches word followed by hyphen, optional spaces, single newline, optional spaces, next word
  return text.replace(/(\p{L}+)-\s*\r?\n\s*(\p{L}+)/gu, '$1$2');
}

/**
 * Detects headers/footers appearing frequently across pages
 */
export function detectRepetitiveHeadersFooters(rawPages: string[]): { headers: Set<string>; footers: Set<string> } {
  if (rawPages.length < 2) return { headers: new Set(), footers: new Set() };

  const firstLines: string[] = [];
  const lastLines: string[] = [];

  for (const page of rawPages) {
    const lines = page.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      firstLines.push(lines[0]);
      lastLines.push(lines[lines.length - 1]);
    }
  }

  const countOccurrences = (arr: string[]) => {
    const counts = new Map<string, number>();
    for (const item of arr) {
      if (item.length < 3 || item.length > 120) continue;
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    const repetitive = new Set<string>();
    const threshold = Math.max(2, Math.floor(rawPages.length * 0.4));
    for (const [line, count] of counts.entries()) {
      if (count >= threshold) {
        repetitive.add(line);
      }
    }
    return repetitive;
  };

  return {
    headers: countOccurrences(firstLines),
    footers: countOccurrences(lastLines),
  };
}

/**
 * Cleans lines representing page numbers
 * e.g. "Página 12", "Pág. 12", "- 12 -", "12 of 30", isolated numbers
 */
export function isPageNumberLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\d{1,4}$/.test(trimmed)) return true;
  if (/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(trimmed)) return true;
  if (/^(?:página|pág\.?|page)\s*\d{1,4}(?:\s*(?:de|\/)\s*\d{1,4})?$/i.test(trimmed)) return true;
  if (/^\d{1,4}\s*(?:\/|de|of)\s*\d{1,4}$/i.test(trimmed)) return true;
  return false;
}

/**
 * Splits raw text into paragraphs and cleans intra-paragraph soft newlines
 */
export function cleanPageText(
  rawText: string,
  options: CleaningOptions = DEFAULT_CLEANING_OPTIONS,
  repetitiveHeadersFooters?: { headers: Set<string>; footers: Set<string> }
): string {
  let text = rawText;

  if (options.removeHyphenation) {
    text = removeHyphensAtLineEnds(text);
  }

  // Split into raw lines to filter out repetitive headers/footers and page numbers
  let lines = text.split(/\r?\n/);

  if (repetitiveHeadersFooters) {
    lines = lines.filter(line => {
      const trimmed = line.trim();
      if (repetitiveHeadersFooters.headers.has(trimmed)) return false;
      if (repetitiveHeadersFooters.footers.has(trimmed)) return false;
      return true;
    });
  }

  if (options.removePageNumbers) {
    lines = lines.filter(line => !isPageNumberLine(line));
  }

  text = lines.join('\n');

  // Normalize Unicode spaces
  text = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

  // Identify double newlines as paragraphs, single newlines as line breaks to be joined
  // Protect markdown/bullet points
  const rawParagraphs = text.split(/\n\s*\n+/);

  const cleanedParagraphs = rawParagraphs.map(p => {
    // Join single line breaks unless it looks like a list item or title
    const pLines = p.split(/\n/).map(l => l.trim()).filter(Boolean);
    const joined = pLines.join(' ');
    // Collapse multiple spaces
    return joined.replace(/\s{2,}/g, ' ').trim();
  }).filter(p => p.length > 0);

  return cleanedParagraphs.join('\n\n');
}

/**
 * Splits text into individual sentences with robust boundary detection
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Match sentence ending punctuation: . ! ? … followed by space/quote/end, or Spanish opening ¿ ¡
  // We use a regex tokenizer that inspects abbreviations
  const rawTokens = text.split(/([.!?…]+["'»”]?\s+)/g);
  const sentences: string[] = [];
  let buffer = '';

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    buffer += token;

    // If it's a delimiter token
    if (i % 2 === 1) {
      // Check if previous buffer ended in an abbreviation
      const words = buffer.trim().split(/\s+/);
      const lastWord = words[words.length - 1]?.toLowerCase().replace(/[.!?…]/g, '');

      if (lastWord && ABBREVIATIONS.has(lastWord)) {
        // Continue buffering, don't break sentence
        continue;
      }

      // Check if it's a decimal number like "3.14" or "art. 4"
      if (/^\d+\s*$/i.test(buffer.trim().slice(-2))) {
        continue;
      }

      const trimmed = buffer.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
      buffer = '';
    }
  }

  const remaining = buffer.trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences;
}

/**
 * Processes raw extracted page text and produces structured PageData
 */
export function processPageData(
  rawText: string,
  pageNumber: number,
  options: CleaningOptions = DEFAULT_CLEANING_OPTIONS,
  repetitiveHeadersFooters?: { headers: Set<string>; footers: Set<string> }
): PageData {
  const cleanedText = cleanPageText(rawText, options, repetitiveHeadersFooters);
  const rawParagraphs = cleanedText.split(/\n\n+/).filter(p => p.trim().length > 0);

  let globalSentenceCounter = 0;
  const paragraphs: ParagraphItem[] = [];

  rawParagraphs.forEach((pText, pIndex) => {
    const rawSentences = splitIntoSentences(pText);
    const sentences: SentenceItem[] = rawSentences.map((sText, sIndex) => {
      const wordCount = sText.trim().split(/\s+/).filter(Boolean).length;
      // Estimate ~140 words per minute (2.33 words/sec) + punctuation pauses
      const estimatedDurationSec = Math.max(1.2, (wordCount / 2.33) + 0.3);

      return {
        id: `p${pageNumber}-s${globalSentenceCounter++}`,
        pageIndex: pageNumber - 1,
        paragraphIndex: pIndex,
        sentenceIndex: sIndex,
        text: sText,
        startChar: 0,
        endChar: sText.length,
        estimatedDurationSec,
      };
    });

    paragraphs.push({
      id: `p${pageNumber}-para${pIndex}`,
      pageIndex: pageNumber - 1,
      paragraphIndex: pIndex,
      text: pText,
      sentences,
    });
  });

  const charCount = cleanedText.replace(/\s/g, '').length;
  // If fewer than 20 characters on a page, it's likely scanned or empty image
  const isScannedLikely = charCount < 25;

  return {
    pageNumber,
    text: cleanedText,
    paragraphs,
    hasText: charCount >= 10,
    charCount,
    isScannedLikely,
    originalRawText: rawText,
  };
}
