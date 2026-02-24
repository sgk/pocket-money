const DB_NAME = "pocket-money-offline";
const DB_VERSION = 2;
const CACHE_STORE = "apiCache";
const OPERATIONS_STORE = "operations";

type CacheRecord = {
  key: string;
  value: unknown;
  updatedAt: number;
};

export type TransactionOperationKind =
  | "createExpense"
  | "createIncome"
  | "createTransfer"
  | "updateTransaction"
  | "deleteTransaction";

export type TransactionOperationRecord = {
  id: string;
  idempotencyKey: string;
  kind: TransactionOperationKind;
  token: string;
  childId: string | null;
  txId?: string;
  localId?: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

export type CacheEnvelope = {
  scope: string;
  token: string;
  childId: string;
  params?: Record<string, unknown>;
};

export type CacheEntry<T> = {
  key: string;
  envelope: CacheEnvelope;
  value: T;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(OPERATIONS_STORE)) {
        const store = db.createObjectStore(OPERATIONS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

const runRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTx = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const parseEnvelope = (key: string): CacheEnvelope | null => {
  try {
    const parsed = JSON.parse(key) as Partial<CacheEnvelope>;
    if (
      typeof parsed.scope === "string" &&
      typeof parsed.token === "string" &&
      typeof parsed.childId === "string"
    ) {
      return {
        scope: parsed.scope,
        token: parsed.token,
        childId: parsed.childId,
        params: parsed.params ?? {},
      };
    }
    return null;
  } catch {
    return null;
  }
};

const readCacheRaw = async (key: string): Promise<CacheRecord | null> => {
  const db = await openDb();
  const tx = db.transaction(CACHE_STORE, "readonly");
  const store = tx.objectStore(CACHE_STORE);
  const result = await runRequest(store.get(key));
  return (result as CacheRecord | undefined) ?? null;
};

export const readCache = async <T>(key: string): Promise<T | null> => {
  const result = await readCacheRaw(key);
  if (!result) {
    return null;
  }
  return result.value as T;
};

export const writeCache = async (key: string, value: unknown): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction(CACHE_STORE, "readwrite");
  const store = tx.objectStore(CACHE_STORE);
  await runRequest(
    store.put({
      key,
      value,
      updatedAt: Date.now(),
    } as CacheRecord)
  );
  await runTx(tx);
};

export const listCacheEntries = async <T>(
  scope: string,
  token: string,
  childId?: string | null
): Promise<Array<CacheEntry<T>>> => {
  const db = await openDb();
  const tx = db.transaction(CACHE_STORE, "readonly");
  const store = tx.objectStore(CACHE_STORE);
  const all = (await runRequest(store.getAll())) as CacheRecord[];
  const normalizedChildId = childId ?? "";
  return all
    .map((item) => {
      const envelope = parseEnvelope(item.key);
      if (!envelope) {
        return null;
      }
      if (envelope.scope !== scope) {
        return null;
      }
      if (envelope.token !== token) {
        return null;
      }
      if (envelope.childId !== normalizedChildId) {
        return null;
      }
      return {
        key: item.key,
        envelope,
        value: item.value as T,
        updatedAt: item.updatedAt,
      } as CacheEntry<T>;
    })
    .filter((item): item is CacheEntry<T> => item !== null);
};

export const addOperation = async (record: TransactionOperationRecord): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction(OPERATIONS_STORE, "readwrite");
  const store = tx.objectStore(OPERATIONS_STORE);
  await runRequest(store.put(record));
  await runTx(tx);
};

export const deleteOperation = async (id: string): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction(OPERATIONS_STORE, "readwrite");
  const store = tx.objectStore(OPERATIONS_STORE);
  await runRequest(store.delete(id));
  await runTx(tx);
};

export const listOperations = async (): Promise<TransactionOperationRecord[]> => {
  const db = await openDb();
  const tx = db.transaction(OPERATIONS_STORE, "readonly");
  const store = tx.objectStore(OPERATIONS_STORE);
  const all = (await runRequest(store.getAll())) as TransactionOperationRecord[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
};

export const countOperations = async (): Promise<number> => {
  const db = await openDb();
  const tx = db.transaction(OPERATIONS_STORE, "readonly");
  const store = tx.objectStore(OPERATIONS_STORE);
  const count = await runRequest(store.count());
  return Number(count);
};

export const replaceOperationTxId = async (
  token: string,
  childId: string | null,
  oldTxId: string,
  newTxId: string
): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction(OPERATIONS_STORE, "readwrite");
  const store = tx.objectStore(OPERATIONS_STORE);
  const all = (await runRequest(store.getAll())) as TransactionOperationRecord[];
  const normalizedChildId = childId ?? null;
  for (const item of all) {
    if (item.token !== token) {
      continue;
    }
    if ((item.childId ?? null) !== normalizedChildId) {
      continue;
    }
    if (item.txId === oldTxId) {
      await runRequest(
        store.put({
          ...item,
          txId: newTxId,
        })
      );
    }
  }
  await runTx(tx);
};
