import type { Asset, Category, MonthlySummary, Transaction, TransactionsResponse } from "@/lib/types";

const API_BASE_URL = window.location.origin;

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
  const res = await fetch(buildUrl(path, params), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "API エラーが発生しました");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};

export const api = {
  bootstrap: (token: string) => fetchJson<{ ok: boolean }>(token, "/api/bootstrap", { method: "POST" }),
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
  getTransactions: (
    token: string,
    params: {
      from?: string;
      to?: string;
      type?: string;
      assetId?: string;
      categoryName?: string;
      limit?: number;
      cursor?: string;
    }
  ) => fetchJson<TransactionsResponse>(token, "/api/transactions", {}, params),
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
};
