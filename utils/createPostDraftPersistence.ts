export interface PersistedCreatePostDraft {
  schemaVersion: number;
  files: File[];
  layout: string;
  updatedAt: number;
}

const DB_NAME = 'jutpai-create-post';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'active-create-post-draft';
const CURRENT_SCHEMA_VERSION = 1;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openCreatePostDraftDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCreatePostDraft(): Promise<PersistedCreatePostDraft | null> {
  const db = await openCreatePostDraftDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(DRAFT_KEY);

    request.onsuccess = () => {
      const result = request.result as PersistedCreatePostDraft | undefined;
      if (!result || !Array.isArray(result.files)) {
        resolve(null);
        return;
      }

      const isExpired = !result.updatedAt || Date.now() - result.updatedAt > DRAFT_TTL_MS;
      const hasValidSchema = result.schemaVersion === CURRENT_SCHEMA_VERSION;

      if (!hasValidSchema || isExpired) {
        void clearCreatePostDraft();
        resolve(null);
        return;
      }

      resolve({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        files: result.files.slice(0, 30),
        layout: result.layout || 'default',
        updatedAt: result.updatedAt,
      });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveCreatePostDraft(files: File[], layout: string): Promise<void> {
  const db = await openCreatePostDraftDb();
  if (!db) return;

  const payload: PersistedCreatePostDraft = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    files: files.slice(0, 30),
    layout: layout || 'default',
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(payload, DRAFT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearCreatePostDraft(): Promise<void> {
  const db = await openCreatePostDraftDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(DRAFT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}