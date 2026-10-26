import { HistoryItem, PDFDocumentData } from '../types';

const DB_NAME = 'vozpdf_history_db';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

interface StoredDocumentRecord {
  id: string;
  name: string;
  author?: string;
  creationDate?: string;
  fileSize: number;
  totalPages: number;
  totalWords: number;
  lastSentenceIndex: number;
  lastSentenceText: string;
  lastReadTimestamp: number;
  progressPercent: number;
  documentData: PDFDocumentData;
}

export function generateDocId(name: string, fileSize: number, totalPages: number): string {
  // Simple deterministic key based on name, size and pages
  return `${name.trim().toLowerCase()}_${fileSize}_${totalPages}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no soportado en este entorno'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastReadTimestamp', 'lastReadTimestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves or updates a document in local IndexedDB storage
 */
export async function saveDocumentToHistory(
  doc: PDFDocumentData,
  lastSentenceIndex: number = 0
): Promise<string> {
  const id = generateDocId(doc.name, doc.fileSize, doc.totalPages);
  const totalSentences = doc.allSentences.length;
  const clampedIndex = Math.max(0, Math.min(totalSentences - 1, lastSentenceIndex));
  const currentSentence = doc.allSentences[clampedIndex];
  const progressPercent = totalSentences > 0 ? Math.round(((clampedIndex + 1) / totalSentences) * 100) : 0;

  const record: StoredDocumentRecord = {
    id,
    name: doc.name,
    author: doc.author,
    creationDate: doc.creationDate,
    fileSize: doc.fileSize,
    totalPages: doc.totalPages,
    totalWords: doc.totalWords,
    lastSentenceIndex: clampedIndex,
    lastSentenceText: currentSentence ? currentSentence.text.slice(0, 80) : '',
    lastReadTimestamp: Date.now(),
    progressPercent,
    documentData: doc,
  };

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(record);

      putRequest.onsuccess = () => resolve(id);
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Error al guardar en IndexedDB, usando fallback:', err);
    return id;
  }
}

/**
 * Updates reading progress for an existing document without re-writing full payload
 */
export async function updateReadingProgress(
  id: string,
  lastSentenceIndex: number,
  totalSentences: number,
  sentenceText: string
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result as StoredDocumentRecord | undefined;
        if (record) {
          record.lastSentenceIndex = lastSentenceIndex;
          record.lastSentenceText = sentenceText.slice(0, 80);
          record.lastReadTimestamp = Date.now();
          record.progressPercent = totalSentences > 0 ? Math.round(((lastSentenceIndex + 1) / totalSentences) * 100) : 0;
          store.put(record);
        }
        resolve();
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('No se pudo actualizar progreso en IndexedDB:', err);
  }
}

/**
 * Returns summary list of all recent documents ordered by most recently opened
 */
export async function getRecentDocuments(): Promise<HistoryItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result as StoredDocumentRecord[]) || [];
        const items: HistoryItem[] = records.map((r) => ({
          id: r.id,
          name: r.name,
          author: r.author || r.documentData?.author || undefined,
          creationDate: r.creationDate || r.documentData?.creationDate || undefined,
          fileSize: r.fileSize,
          totalPages: r.totalPages,
          totalWords: r.totalWords,
          lastSentenceIndex: r.lastSentenceIndex,
          lastSentenceText: r.lastSentenceText,
          lastReadTimestamp: r.lastReadTimestamp,
          progressPercent: r.progressPercent,
        }));

        // Sort descending by timestamp
        items.sort((a, b) => b.lastReadTimestamp - a.lastReadTimestamp);
        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error al leer historial de IndexedDB:', err);
    return [];
  }
}

/**
 * Retrieves a document and its saved progress by its ID
 */
export async function getDocumentFromHistory(
  id: string
): Promise<{ doc: PDFDocumentData; lastSentenceIndex: number } | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as StoredDocumentRecord | undefined;
        if (record && record.documentData) {
          resolve({
            doc: record.documentData,
            lastSentenceIndex: record.lastSentenceIndex,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error al cargar documento desde IndexedDB:', err);
    return null;
  }
}

/**
 * Checks if a document already exists in history and returns its progress
 */
export async function checkExistingProgress(
  name: string,
  fileSize: number,
  totalPages: number
): Promise<{ id: string; lastSentenceIndex: number; progressPercent: number } | null> {
  const id = generateDocId(name, fileSize, totalPages);
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as StoredDocumentRecord | undefined;
        if (record && record.lastSentenceIndex > 0) {
          resolve({
            id: record.id,
            lastSentenceIndex: record.lastSentenceIndex,
            progressPercent: record.progressPercent,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Removes a document from history
 */
export async function deleteDocumentFromHistory(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error al eliminar de IndexedDB:', err);
  }
}
