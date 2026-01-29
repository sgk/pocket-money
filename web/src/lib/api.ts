import type {
  Asset,
  BootstrapResponse,
  Category,
  MonthlySummary,
  Transaction,
  TransactionsResponse,
} from "@/lib/types";

const API_BASE_URL = window.location.origin;

export class ApiError extends Error {
  code: "network" | "http";

  constructor(code: "network" | "http", message: string) {
    super(message);
    this.code = code;
  }
}

export const isNetworkError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "network";

const buildUrl = (path: string, params?: Record<string, string | number | undefined>) => {
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
  params?: Record<string, string | number | undefined>
): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError("network", "NETWORK_ERROR");
  }

  if (!res.ok) {
    const message = await res.text();
    throw new ApiError("http", message || "API エラーが発生しました");
  }

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
  };
  return JSON.stringify(normalized);
};

const clearTransactionsCache = () => {
  transactionsCache.clear();
};

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
      throw new ApiError("network", "NETWORK_ERROR");
    }

    if (!res.ok) {
      const message = await res.text();
      throw new ApiError("http", message || "ログインに失敗しました");
    }

    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      throw new ApiError("http", "ログインに失敗しました");
    }
    return data.token;
  },
  bootstrap: (token: string) =>
    fetchJson<BootstrapResponse>(token, "/api/bootstrap", { method: "POST" }),
  getAssets: (token: string) => fetchJson<Asset[]>(token, "/api/assets"),
  createAsset: (token: string, payload: Partial<Asset>) =>
    fetchJson<Asset>(token, "/api/assets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAsset: (token: string, assetId: string, payload: Partial<Asset>) =>
    fetchJson<Asset>(token, `/api/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAsset: (token: string, assetId: string) =>
    fetchJson<void>(token, `/api/assets/${assetId}`, { method: "DELETE" }),
  getCategories: (token: string) => fetchJson<Category[]>(token, "/api/categories"),
  createCategory: (token: string, payload: Partial<Category>) =>
    fetchJson<Category>(token, "/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (token: string, categoryId: string, payload: Partial<Category>) =>
    fetchJson<Category>(token, `/api/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (token: string, categoryId: string) =>
    fetchJson<void>(token, `/api/categories/${categoryId}`, { method: "DELETE" }),
  getTransactions: async (token: string, params: TransactionsParams) => {
    const key = transactionsCacheKey(token, params);
    const cached = transactionsCache.get(key);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (cached) {
      headers["If-Modified-Since"] = cached.lastModified;
    }

    let res: Response;
    try {
      res = await fetch(buildUrl("/api/transactions", params), {
        headers,
      });
    } catch (error) {
      throw new ApiError("network", "NETWORK_ERROR");
    }

    if (res.status === 304) {
      if (!cached) {
        throw new Error("取引キャッシュがありません");
      }
      return cached.data;
    }

    if (!res.ok) {
      const message = await res.text();
      throw new ApiError("http", message || "API エラーが発生しました");
    }

    const data = (await res.json()) as TransactionsResponse;
    const lastModified = res.headers.get("Last-Modified");
    if (lastModified) {
      transactionsCache.set(key, { lastModified, data });
    }
    return data;
  },
  exportTransactions: (token: string) => fetchJson<Transaction[]>(token, "/api/transactions/export"),
  importTransactions: (token: string, transactions: Transaction[]) =>
    fetchJson<void>(token, "/api/transactions/import", {
      method: "POST",
      body: JSON.stringify(transactions),
    }),
  deleteAllTransactions: (token: string) =>
    fetchJson<void>(token, "/api/transactions/all", { method: "DELETE" }),
  deleteAccount: (token: string) =>
    fetchJson<void>(token, "/api/auth/me", { method: "DELETE" }),
  createExpense: (token: string, payload: Record<string, unknown>) =>
    fetchJson<Transaction>(token, "/api/transactions/expense", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createIncome: (token: string, payload: Record<string, unknown>) =>
    fetchJson<Transaction>(token, "/api/transactions/income", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createTransfer: (token: string, payload: Record<string, unknown>) =>
    fetchJson<Transaction>(token, "/api/transactions/transfer", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTransaction: (token: string, txId: string, payload: Record<string, unknown>) =>
    fetchJson<Transaction>(token, `/api/transactions/${txId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTransaction: (token: string, txId: string) =>
    fetchJson<void>(token, `/api/transactions/${txId}`, { method: "DELETE" }),
  getMonthlySummary: (token: string, year: number, month: number) =>
    fetchJson<MonthlySummary>(token, "/api/summary/monthly", {}, { year, month }),
  clearTransactionsCache,
};
