import type {
  Asset,
  BootstrapResponse,
  Category,
  InvitesResponse,
  MonthlySummary,
  OnboardingStatus,
  Transaction,
  TransactionsResponse,
} from "@/lib/types";
import { compareTransactionsInDay } from "@/lib/transaction-order";
import { reportNetworkFailure, reportNetworkSuccess } from "@/lib/network-status";
import {
  addOperation,
  countOperations,
  deleteOperation,
  listCacheEntries,
  listOperations,
  readCache,
  replaceOperationTxId,
  type TransactionOperationRecord,
  writeCache,
} from "@/lib/offline-cache";

const API_BASE_URL = window.location.origin;
const AUTH_STORAGE_KEY = "auth.token";

export class ApiError extends Error {
  code: "network" | "http";

  constructor(code: "network" | "http", message: string) {
    super(message);
    this.code = code;
  }
}

export const isNetworkError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "network";

const buildUrl = (
  path: string,
  params?: Record<string, string | number | boolean | undefined>
) => {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const fetchJson = async <T>(
  token: string,
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | boolean | undefined>,
  childId?: string | null
): Promise<T> => {
  if (navigator.onLine) {
    void syncOfflineOperations();
  }
  let res: Response;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> ?? {}),
  };
  const queryParams = { ...params };
  if (childId) {
    headers["X-Child-Id"] = childId;
    queryParams.childId = childId;
  }
  try {
    res = await fetch(buildUrl(path, queryParams), {
      ...options,
      headers,
    });
  } catch (error) {
    reportNetworkFailure();
    throw new ApiError("network", "NETWORK_ERROR");
  }

  if (!res.ok) {
    let message = "";
    let details: any = null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        const payload = await res.json();
        message = payload?.error?.message ?? "";
        details = payload?.error?.details ?? null;
      } catch (error) {
        message = "";
      }
    } else {
      message = await res.text();
    }
    if (res.status === 403 && details?.state === "needsAge") {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = "/login";
    }
    throw new ApiError("http", message || "API エラーが発生しました");
  }

  reportNetworkSuccess();
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};

type TransactionsParams = {
  from?: string;
  to?: string;
  type?: string;
  assetId?: string;
  categoryId?: string;
  limit?: number;
  cursor?: string;
  includeOpeningBalances?: boolean;
  childId?: string | null;
};

type TransactionsCacheEntry = {
  lastModified: string;
  data: TransactionsResponse;
};

const transactionsCache = new Map<string, TransactionsCacheEntry>();

const transactionsCacheKey = (token: string, params: TransactionsParams): string => {
  const normalized = {
    token,
    from: params.from ?? "",
    to: params.to ?? "",
    type: params.type ?? "",
    assetId: params.assetId ?? "",
    categoryId: params.categoryId ?? "",
    limit: params.limit ?? 200,
    cursor: params.cursor ?? "",
    includeOpeningBalances: params.includeOpeningBalances ? "1" : "0",
    childId: params.childId ?? "",
  };
  return JSON.stringify(normalized);
};

const clearTransactionsCache = () => {
  transactionsCache.clear();
};

const buildOfflineCacheKey = (
  scope: string,
  token: string,
  childId?: string | null,
  params?: Record<string, unknown>
): string =>
  JSON.stringify({
    scope,
    token,
    childId: childId ?? "",
    params: params ?? {},
  });

const readOfflineOnly = async <T>(key: string): Promise<T> => {
  try {
    const cached = await readCache<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    throw new ApiError("network", "NETWORK_ERROR");
  }
  throw new ApiError("network", "NETWORK_ERROR");
};

const readOfflineTransactionsOrEmpty = async (
  key: string
): Promise<TransactionsResponse> => {
  try {
    const cached = await readCache<TransactionsResponse>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    throw new ApiError("network", "NETWORK_ERROR");
  }
  return {
    items: [],
    nextCursor: null,
  };
};

const cacheResponse = async (key: string, payload: unknown) => {
  try {
    await writeCache(key, payload);
  } catch (error) {
    console.warn("offline cache write failed", error);
  }
};

const fetchReadModel = async <T>(
  token: string,
  cacheKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  childId?: string | null
): Promise<T> => {
  if (!navigator.onLine) {
    return readOfflineOnly<T>(cacheKey);
  }
  let payload: T;
  try {
    payload = await fetchJson<T>(token, path, {}, params, childId);
  } catch (error) {
    if (isNetworkError(error)) {
      return readOfflineOnly<T>(cacheKey);
    }
    throw error;
  }
  await cacheResponse(cacheKey, payload);
  return payload;
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const OFFLINE_OPERATIONS_CHANGED_EVENT = "offline-operations-changed";

const emitOfflineOperationsChanged = () => {
  window.dispatchEvent(new Event(OFFLINE_OPERATIONS_CHANGED_EVENT));
};

const toDateKey = (value: unknown): string => String(value ?? "").slice(0, 10);

const normalizeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDayOrder = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed);
};

const buildLocalTransaction = (
  kind: "createExpense" | "createIncome" | "createTransfer",
  payload: Record<string, unknown>,
  localId: string
): Transaction => {
  const nowIso = new Date().toISOString();
  const occurredAt = String(payload.occurredAt ?? new Date().toISOString().slice(0, 10));
  const amount = normalizeAmount(payload.amount);
  const dayOrder = normalizeDayOrder(payload.dayOrder) ?? Date.now();
  const memo = typeof payload.memo === "string" ? payload.memo : undefined;
  if (kind === "createExpense") {
    return {
      id: localId,
      type: "expense",
      occurredAt,
      amount,
      memo,
      dayOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
      pendingSync: true,
      pendingOperation: "create",
      assetId: typeof payload.assetId === "string" ? payload.assetId : undefined,
      assetName: String(payload.assetName ?? ""),
      categoryId: typeof payload.categoryId === "string" ? payload.categoryId : undefined,
      categoryName: String(payload.categoryName ?? ""),
      merchant: typeof payload.merchant === "string" ? payload.merchant : undefined,
    };
  }
  if (kind === "createIncome") {
    return {
      id: localId,
      type: "income",
      occurredAt,
      amount,
      memo,
      dayOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
      pendingSync: true,
      pendingOperation: "create",
      assetId: typeof payload.assetId === "string" ? payload.assetId : undefined,
      assetName: String(payload.assetName ?? ""),
      categoryId: typeof payload.categoryId === "string" ? payload.categoryId : undefined,
      categoryName: String(payload.categoryName ?? ""),
      source: typeof payload.source === "string" ? payload.source : undefined,
    };
  }
  return {
    id: localId,
    type: "transfer",
    occurredAt,
    amount,
    memo,
    dayOrder,
    createdAt: nowIso,
    updatedAt: nowIso,
    pendingSync: true,
    pendingOperation: "create",
    fromAssetId: typeof payload.fromAssetId === "string" ? payload.fromAssetId : undefined,
    fromAssetName: String(payload.fromAssetName ?? ""),
    toAssetId: typeof payload.toAssetId === "string" ? payload.toAssetId : undefined,
    toAssetName: String(payload.toAssetName ?? ""),
    fee: normalizeAmount(payload.fee),
    counterparty: typeof payload.counterparty === "string" ? payload.counterparty : undefined,
  };
};

const sortTransactions = (items: Transaction[]): Transaction[] =>
  [...items].sort((a, b) => {
    const dateCmp = String(b.occurredAt).localeCompare(String(a.occurredAt));
    if (dateCmp !== 0) {
      return dateCmp;
    }
    return compareTransactionsInDay(a, b, "desc");
  });

const matchesTransactionParams = (
  tx: Transaction,
  params: Record<string, unknown> | undefined
): boolean => {
  const normalized = params ?? {};
  const txType = String(normalized.type ?? "");
  if (txType && tx.type !== txType) {
    return false;
  }
  const from = String(normalized.from ?? "");
  const to = String(normalized.to ?? "");
  const txDate = toDateKey(tx.occurredAt);
  if (from && txDate < from) {
    return false;
  }
  if (to && txDate > to) {
    return false;
  }
  const assetId = String(normalized.assetId ?? "");
  if (assetId) {
    if (tx.type === "transfer") {
      if (tx.fromAssetId !== assetId && tx.toAssetId !== assetId) {
        return false;
      }
    } else if (tx.assetId !== assetId) {
      return false;
    }
  }
  const categoryId = String(normalized.categoryId ?? "");
  if (categoryId) {
    if (tx.type === "transfer" || tx.categoryId !== categoryId) {
      return false;
    }
  }
  return true;
};

const updateTransactionsCacheEntries = async (
  token: string,
  childId: string | null | undefined,
  updater: (items: Transaction[], params: Record<string, unknown> | undefined) => Transaction[]
): Promise<void> => {
  const entries = await listCacheEntries<TransactionsResponse>(
    "transactions",
    token,
    childId
  );
  for (const entry of entries) {
    const current = entry.value ?? { items: [], nextCursor: null };
    const currentItems = Array.isArray(current.items) ? current.items : [];
    const updatedItems = updater(currentItems, entry.envelope.params);
    await writeCache(entry.key, {
      ...current,
      items: updatedItems,
    });
  }
};

const applyCreateTransactionToOfflineCache = async (
  token: string,
  childId: string | null | undefined,
  tx: Transaction
) => {
  await updateTransactionsCacheEntries(token, childId, (items, params) => {
    if (!matchesTransactionParams(tx, params)) {
      return items;
    }
    return sortTransactions([tx, ...items.filter((item) => item.id !== tx.id)]);
  });
  clearTransactionsCache();
};

const applyUpdateTransactionToOfflineCache = async (
  token: string,
  childId: string | null | undefined,
  txId: string,
  payload: Record<string, unknown>
): Promise<void> => {
  await updateTransactionsCacheEntries(token, childId, (items, params) => {
    const target = items.find((item) => item.id === txId);
    if (!target) {
      return items;
    }
    const merged = {
      ...target,
      ...payload,
      id: txId,
      pendingSync: true,
      pendingOperation: "update",
    } as Transaction;
    const nextItems = items
      .filter((item) => item.id !== txId)
      .concat(matchesTransactionParams(merged, params) ? [merged] : []);
    return sortTransactions(nextItems);
  });
  clearTransactionsCache();
};

const applyDeleteTransactionToOfflineCache = async (
  token: string,
  childId: string | null | undefined,
  txId: string
): Promise<void> => {
  await updateTransactionsCacheEntries(token, childId, (items) =>
    items.filter((item) => item.id !== txId)
  );
  clearTransactionsCache();
};

const replaceTransactionIdInOfflineCache = async (
  token: string,
  childId: string | null | undefined,
  oldId: string,
  newId: string
) => {
  await updateTransactionsCacheEntries(token, childId, (items) =>
    items.map((item) =>
      item.id === oldId
        ? {
            ...item,
            id: newId,
            pendingSync: false,
            pendingOperation: undefined,
          }
        : item
    )
  );
  clearTransactionsCache();
};

const withQueuedTransactionOperations = async (
  token: string,
  childId: string | null | undefined,
  params: Record<string, unknown>,
  base: TransactionsResponse
): Promise<TransactionsResponse> => {
  const sanitizedItems: Transaction[] = (
    Array.isArray(base.items) ? base.items : []
  ).map((item) => ({
    ...item,
    pendingSync: false,
    pendingOperation: undefined,
  }));
  const queue = (await listOperations()).filter(
    (item) => item.token === token && (item.childId ?? null) === (childId ?? null)
  );
  if (queue.length === 0) {
    return {
      ...base,
      items: sanitizedItems,
    };
  }

  let items: Transaction[] = sanitizedItems;
  for (const op of queue) {
    if (
      op.kind === "createExpense" ||
      op.kind === "createIncome" ||
      op.kind === "createTransfer"
    ) {
      const localId = op.localId ?? `local:${op.idempotencyKey}`;
      const tx = buildLocalTransaction(op.kind, op.payload, localId);
      if (!matchesTransactionParams(tx, params)) {
        items = items.filter((item) => item.id !== tx.id);
        continue;
      }
      items = sortTransactions([tx, ...items.filter((item) => item.id !== tx.id)]);
      continue;
    }

    if (op.kind === "updateTransaction") {
      const targetId = op.txId;
      if (!targetId) {
        continue;
      }
      const current = items.find((item) => item.id === targetId);
      if (!current) {
        continue;
      }
      const updated = {
        ...current,
        ...op.payload,
        id: targetId,
        pendingSync: true,
        pendingOperation: "update",
      } as Transaction;
      items = items.filter((item) => item.id !== targetId);
      if (matchesTransactionParams(updated, params)) {
        items = sortTransactions([...items, updated]);
      }
      continue;
    }

    if (op.kind === "deleteTransaction") {
      if (!op.txId) {
        continue;
      }
      items = items.filter((item) => item.id !== op.txId);
    }
  }

  return {
    ...base,
    items,
  };
};

const enqueueTransactionOperation = async (
  record: Omit<TransactionOperationRecord, "createdAt">
) => {
  await addOperation({
    ...record,
    createdAt: Date.now(),
  });
  emitOfflineOperationsChanged();
};

const queueCreateTransactionOperation = async (
  kind: "createExpense" | "createIncome" | "createTransfer",
  token: string,
  payload: Record<string, unknown>,
  childId?: string | null
): Promise<Transaction> => {
  const idempotencyKey = createIdempotencyKey();
  const localId = `local:${idempotencyKey}`;
  const normalizedPayload = {
    ...payload,
    dayOrder: normalizeDayOrder(payload.dayOrder) ?? Date.now(),
  };
  const localTx = buildLocalTransaction(kind, normalizedPayload, localId);
  await enqueueTransactionOperation({
    id: idempotencyKey,
    idempotencyKey,
    kind,
    token,
    childId: childId ?? null,
    localId,
    payload: normalizedPayload,
  });
  await applyCreateTransactionToOfflineCache(token, childId, localTx);
  void syncOfflineOperations();
  return localTx;
};

const queueUpdateTransactionOperation = async (
  token: string,
  txId: string,
  payload: Record<string, unknown>,
  childId?: string | null
): Promise<Transaction> => {
  const idempotencyKey = createIdempotencyKey();
  await enqueueTransactionOperation({
    id: idempotencyKey,
    idempotencyKey,
    kind: "updateTransaction",
    token,
    childId: childId ?? null,
    txId,
    payload,
  });
  await applyUpdateTransactionToOfflineCache(token, childId, txId, payload);
  void syncOfflineOperations();
  return {
    id: txId,
    type: (payload.type as Transaction["type"] | undefined) ?? "expense",
    occurredAt:
      typeof payload.occurredAt === "string"
        ? payload.occurredAt
        : new Date().toISOString().slice(0, 10),
    amount: normalizeAmount(payload.amount),
  } as Transaction;
};

const queueDeleteTransactionOperation = async (
  token: string,
  txId: string,
  childId?: string | null
): Promise<void> => {
  const idempotencyKey = createIdempotencyKey();
  await enqueueTransactionOperation({
    id: idempotencyKey,
    idempotencyKey,
    kind: "deleteTransaction",
    token,
    childId: childId ?? null,
    txId,
    payload: {},
  });
  await applyDeleteTransactionToOfflineCache(token, childId, txId);
  void syncOfflineOperations();
};

const executeQueuedOperation = async (operation: TransactionOperationRecord) => {
  const headers: Record<string, string> = {
    "X-Idempotency-Key": operation.idempotencyKey,
  };
  if (operation.kind === "createExpense") {
    return fetchJson<Transaction>(
      operation.token,
      "/api/transactions/expense",
      { method: "POST", headers, body: JSON.stringify(operation.payload) },
      {},
      operation.childId
    );
  }
  if (operation.kind === "createIncome") {
    return fetchJson<Transaction>(
      operation.token,
      "/api/transactions/income",
      { method: "POST", headers, body: JSON.stringify(operation.payload) },
      {},
      operation.childId
    );
  }
  if (operation.kind === "createTransfer") {
    return fetchJson<Transaction>(
      operation.token,
      "/api/transactions/transfer",
      { method: "POST", headers, body: JSON.stringify(operation.payload) },
      {},
      operation.childId
    );
  }
  if (operation.kind === "updateTransaction") {
    return fetchJson<Transaction>(
      operation.token,
      `/api/transactions/${operation.txId}`,
      { method: "PATCH", headers, body: JSON.stringify(operation.payload) },
      {},
      operation.childId
    );
  }
  await fetchJson<void>(
    operation.token,
    `/api/transactions/${operation.txId}`,
    { method: "DELETE", headers },
    {},
    operation.childId
  );
  return null;
};

let syncInitialized = false;
let syncRunning = false;

const syncOfflineOperations = async (): Promise<void> => {
  if (syncRunning || !navigator.onLine) {
    return;
  }
  syncRunning = true;
  try {
    while (navigator.onLine) {
      const operations = await listOperations();
      const next = operations[0];
      if (!next) {
        break;
      }
      try {
        const result = await executeQueuedOperation(next);
        if (
          next.localId &&
          result &&
          typeof result === "object" &&
          "id" in result &&
          typeof result.id === "string" &&
          result.id !== next.localId
        ) {
          await replaceTransactionIdInOfflineCache(
            next.token,
            next.childId,
            next.localId,
            result.id
          );
          await replaceOperationTxId(
            next.token,
            next.childId,
            next.localId,
            result.id
          );
        }
        await deleteOperation(next.id);
        emitOfflineOperationsChanged();
      } catch (error) {
        if (isNetworkError(error)) {
          break;
        }
        console.error("offline operation sync failed", error);
        break;
      }
    }
  } finally {
    syncRunning = false;
  }
};

export const startOfflineOperationsSync = () => {
  if (syncInitialized) {
    return;
  }
  syncInitialized = true;
  const trigger = () => {
    void syncOfflineOperations();
  };
  window.addEventListener("online", trigger);
  window.setInterval(trigger, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      trigger();
    }
  });
  trigger();
};

export const getOfflineOperationsCount = () => countOperations();
export { OFFLINE_OPERATIONS_CHANGED_EVENT };

export const api = {
  loginWithGoogle: async (credential: string) => {
    let res: Response;
  try {
    res = await fetch(buildUrl("/api/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch (error) {
    reportNetworkFailure();
    throw new ApiError("network", "NETWORK_ERROR");
  }

  if (!res.ok) {
    const message = await res.text();
    throw new ApiError("http", message || "ログインに失敗しました");
  }

  reportNetworkSuccess();

    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      throw new ApiError("http", "ログインに失敗しました");
    }
    return data.token;
  },
  getOnboardingStatus: (token: string) =>
    fetchReadModel<OnboardingStatus>(
      token,
      buildOfflineCacheKey("onboarding", token),
      "/api/onboarding/status"
    ),
  agreeTerms: (token: string, payload: { ageGroup?: string }) =>
    fetchJson<OnboardingStatus>(token, "/api/onboarding/agree-terms", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  acceptInvite: (token: string, payload: { parentEmail: string }, childId?: string | null) =>
    fetchJson<OnboardingStatus>(token, "/api/onboarding/accept-invite", {
      method: "POST",
      body: JSON.stringify(payload),
    }, {}, childId),
  withdrawTerms: (token: string) =>
    fetchJson<void>(token, "/api/onboarding/withdraw-terms", { method: "POST" }),
  getInvites: (token: string) => fetchJson<InvitesResponse>(token, "/api/invites"),
  createInvite: (token: string, payload: { childEmail: string }) =>
    fetchJson<{ inviteId: string }>(token, "/api/invites", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cancelInvite: (token: string, inviteId: string) =>
    fetchJson<void>(token, `/api/invites/${inviteId}`, { method: "DELETE" }),
  bootstrap: async (token: string, childId?: string | null) => {
    const cacheKey = buildOfflineCacheKey("bootstrap", token, childId);
    if (!navigator.onLine) {
      return readOfflineOnly<BootstrapResponse>(cacheKey);
    }
    let payload: BootstrapResponse;
    try {
      payload = await fetchJson<BootstrapResponse>(
        token,
        "/api/bootstrap",
        { method: "POST" },
        {},
        childId
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return readOfflineOnly<BootstrapResponse>(cacheKey);
      }
      throw error;
    }
    await cacheResponse(cacheKey, payload);
    return payload;
  },
  getAssets: (token: string, childId?: string | null) =>
    fetchReadModel<Asset[]>(
      token,
      buildOfflineCacheKey("assets", token, childId),
      "/api/assets",
      {},
      childId
    ),
  createAsset: (token: string, payload: Partial<Asset>, childId?: string | null) =>
    fetchJson<Asset>(token, "/api/assets", {
      method: "POST",
      body: JSON.stringify(payload),
    }, {}, childId),
  updateAsset: (token: string, assetId: string, payload: Partial<Asset>, childId?: string | null) =>
    fetchJson<Asset>(token, `/api/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, {}, childId),
  deleteAsset: (token: string, assetId: string, childId?: string | null) =>
    fetchJson<void>(token, `/api/assets/${assetId}`, { method: "DELETE" }, {}, childId),
  getCategories: (token: string, childId?: string | null) =>
    fetchReadModel<Category[]>(
      token,
      buildOfflineCacheKey("categories", token, childId),
      "/api/categories",
      {},
      childId
    ),
  createCategory: (token: string, payload: Partial<Category>, childId?: string | null) =>
    fetchJson<Category>(token, "/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }, {}, childId),
  updateCategory: (token: string, categoryId: string, payload: Partial<Category>, childId?: string | null) =>
    fetchJson<Category>(token, `/api/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, {}, childId),
  deleteCategory: (token: string, categoryId: string, childId?: string | null) =>
    fetchJson<void>(token, `/api/categories/${categoryId}`, { method: "DELETE" }, {}, childId),
  getTransactions: async (token: string, params: TransactionsParams, childId?: string | null) => {
    if (navigator.onLine) {
      void syncOfflineOperations();
    }
    const key = transactionsCacheKey(token, { ...params, childId });
    const cached = transactionsCache.get(key);
    const offlineKey = buildOfflineCacheKey(
      "transactions",
      token,
      childId,
      {
        from: params.from ?? "",
        to: params.to ?? "",
        type: params.type ?? "",
        assetId: params.assetId ?? "",
        categoryId: params.categoryId ?? "",
        limit: params.limit ?? 200,
        cursor: params.cursor ?? "",
        includeOpeningBalances: params.includeOpeningBalances ? "1" : "0",
      }
    );
    const transactionParams = {
      from: params.from ?? "",
      to: params.to ?? "",
      type: params.type ?? "",
      assetId: params.assetId ?? "",
      categoryId: params.categoryId ?? "",
      limit: params.limit ?? 200,
      cursor: params.cursor ?? "",
      includeOpeningBalances: params.includeOpeningBalances ? "1" : "0",
    };

    if (!navigator.onLine) {
      const cached = await readOfflineTransactionsOrEmpty(offlineKey);
      return withQueuedTransactionOperations(token, childId, transactionParams, cached);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (cached) {
      headers["If-Modified-Since"] = cached.lastModified;
    }
    const queryParams = { ...params };
    if (childId) {
      headers["X-Child-Id"] = childId;
      queryParams.childId = childId;
    }

    let res: Response;
    try {
      res = await fetch(buildUrl("/api/transactions", queryParams as any), {
        headers,
      });
    } catch (error) {
      reportNetworkFailure();
      const cached = await readOfflineTransactionsOrEmpty(offlineKey);
      return withQueuedTransactionOperations(token, childId, transactionParams, cached);
    }

    if (res.status === 304) {
      reportNetworkSuccess();
      if (!cached) {
        throw new Error("取引キャッシュがありません");
      }
      return withQueuedTransactionOperations(
        token,
        childId,
        transactionParams,
        cached.data
      );
    }

    if (!res.ok) {
      const message = await res.text();
      throw new ApiError("http", message || "API エラーが発生しました");
    }

    reportNetworkSuccess();

    const data = (await res.json()) as TransactionsResponse;
    const lastModified = res.headers.get("Last-Modified");
    if (lastModified) {
      transactionsCache.set(key, { lastModified, data });
    }
    await cacheResponse(offlineKey, data);
    return withQueuedTransactionOperations(token, childId, transactionParams, data);
  },
  exportTransactions: (token: string, childId?: string | null) =>
    fetchJson<Transaction[]>(token, "/api/transactions/export", {}, {}, childId),
  importTransactions: (token: string, transactions: Transaction[], childId?: string | null) =>
    fetchJson<void>(token, "/api/transactions/import", {
      method: "POST",
      body: JSON.stringify(transactions),
    }, {}, childId),
  deleteAllTransactions: (token: string, childId?: string | null) =>
    fetchJson<void>(token, "/api/transactions/all", { method: "DELETE" }, {}, childId),
  deleteAccount: (token: string, childId?: string | null) =>
    fetchJson<void>(token, "/api/auth/me", { method: "DELETE" }, {}, childId),
  updateProfile: (
    token: string,
    payload: {
      grade?: string;
      colorTheme?: "cream" | "mint" | "sky" | "pink" | "sunset" | "forest";
      recalculate?: boolean;
    },
    childId?: string | null
  ) =>
    fetchJson<void>(token, "/api/onboarding/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, {}, childId),
  createExpense: async (
    token: string,
    payload: Record<string, unknown>,
    childId?: string | null
  ) => {
    if (!navigator.onLine) {
      return queueCreateTransactionOperation("createExpense", token, payload, childId);
    }
    const idempotencyKey = createIdempotencyKey();
    try {
      return await fetchJson<Transaction>(
        token,
        "/api/transactions/expense",
        {
          method: "POST",
          headers: { "X-Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        },
        {},
        childId
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return queueCreateTransactionOperation("createExpense", token, payload, childId);
      }
      throw error;
    }
  },
  createIncome: async (
    token: string,
    payload: Record<string, unknown>,
    childId?: string | null
  ) => {
    if (!navigator.onLine) {
      return queueCreateTransactionOperation("createIncome", token, payload, childId);
    }
    const idempotencyKey = createIdempotencyKey();
    try {
      return await fetchJson<Transaction>(
        token,
        "/api/transactions/income",
        {
          method: "POST",
          headers: { "X-Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        },
        {},
        childId
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return queueCreateTransactionOperation("createIncome", token, payload, childId);
      }
      throw error;
    }
  },
  createTransfer: async (
    token: string,
    payload: Record<string, unknown>,
    childId?: string | null
  ) => {
    if (!navigator.onLine) {
      return queueCreateTransactionOperation("createTransfer", token, payload, childId);
    }
    const idempotencyKey = createIdempotencyKey();
    try {
      return await fetchJson<Transaction>(
        token,
        "/api/transactions/transfer",
        {
          method: "POST",
          headers: { "X-Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        },
        {},
        childId
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return queueCreateTransactionOperation("createTransfer", token, payload, childId);
      }
      throw error;
    }
  },
  updateTransaction: async (
    token: string,
    txId: string,
    payload: Record<string, unknown>,
    childId?: string | null
  ) => {
    if (!navigator.onLine) {
      return queueUpdateTransactionOperation(token, txId, payload, childId);
    }
    const idempotencyKey = createIdempotencyKey();
    try {
      return await fetchJson<Transaction>(
        token,
        `/api/transactions/${txId}`,
        {
          method: "PATCH",
          headers: { "X-Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        },
        {},
        childId
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return queueUpdateTransactionOperation(token, txId, payload, childId);
      }
      throw error;
    }
  },
  deleteTransaction: async (token: string, txId: string, childId?: string | null) => {
    if (!navigator.onLine) {
      await queueDeleteTransactionOperation(token, txId, childId);
      return;
    }
    const idempotencyKey = createIdempotencyKey();
    try {
      return await fetchJson<void>(
        token,
        `/api/transactions/${txId}`,
        {
          method: "DELETE",
          headers: { "X-Idempotency-Key": idempotencyKey },
        },
        {},
        childId
      );
    } catch (error) {
      if (isNetworkError(error)) {
        await queueDeleteTransactionOperation(token, txId, childId);
        return;
      }
      throw error;
    }
  },
  getMonthlySummary: (token: string, year: number, month: number, childId?: string | null) =>
    fetchReadModel<MonthlySummary>(
      token,
      buildOfflineCacheKey("summary", token, childId, { year, month }),
      "/api/summary/monthly",
      { year, month },
      childId
    ),
  clearTransactionsCache,
};
