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

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  getOnboardingStatus: (token: string) =>
    fetchJson<OnboardingStatus>(token, "/api/onboarding/status"),
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
  bootstrap: (token: string, childId?: string | null) =>
    fetchJson<BootstrapResponse>(token, "/api/bootstrap", { method: "POST" }, {}, childId),
  getAssets: (token: string, childId?: string | null) =>
    fetchJson<Asset[]>(token, "/api/assets", {}, {}, childId),
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
    fetchJson<Category[]>(token, "/api/categories", {}, {}, childId),
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
    const key = transactionsCacheKey(token, { ...params, childId });
    const cached = transactionsCache.get(key);

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
  createExpense: (token: string, payload: Record<string, unknown>, childId?: string | null) =>
    fetchJson<Transaction>(token, "/api/transactions/expense", {
      method: "POST",
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
      body: JSON.stringify(payload),
    }, {}, childId),
  createIncome: (token: string, payload: Record<string, unknown>, childId?: string | null) =>
    fetchJson<Transaction>(token, "/api/transactions/income", {
      method: "POST",
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
      body: JSON.stringify(payload),
    }, {}, childId),
  createTransfer: (token: string, payload: Record<string, unknown>, childId?: string | null) =>
    fetchJson<Transaction>(token, "/api/transactions/transfer", {
      method: "POST",
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
      body: JSON.stringify(payload),
    }, {}, childId),
  updateTransaction: (token: string, txId: string, payload: Record<string, unknown>, childId?: string | null) =>
    fetchJson<Transaction>(token, `/api/transactions/${txId}`, {
      method: "PATCH",
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
      body: JSON.stringify(payload),
    }, {}, childId),
  deleteTransaction: (token: string, txId: string, childId?: string | null) =>
    fetchJson<void>(token, `/api/transactions/${txId}`, {
      method: "DELETE",
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
    }, {}, childId),
  getMonthlySummary: (token: string, year: number, month: number, childId?: string | null) =>
    fetchJson<MonthlySummary>(token, "/api/summary/monthly", {}, { year, month }, childId),
  clearTransactionsCache,
};
