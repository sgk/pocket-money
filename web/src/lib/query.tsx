import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OFFLINE_OPERATIONS_CHANGED_EVENT, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toDateKey } from "@/lib/date";
import { compareTransactionsInDay } from "@/lib/transaction-order";
import type { Transaction, TransactionType, TransactionsResponse } from "@/lib/types";

export const useBootstrap = (enabled = true) => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["bootstrap", token, childId],
    queryFn: () => api.bootstrap(token ?? "", childId),
    enabled: Boolean(token) && enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

export const useOnboardingStatus = () => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["onboarding", token],
    queryFn: () => api.getOnboardingStatus(token ?? ""),
    enabled: Boolean(token),
    retry: false,
  });
};

export const useInvites = (enabled = true) => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["invites", token],
    queryFn: () => api.getInvites(token ?? ""),
    enabled: Boolean(token) && enabled,
    retry: false,
  });
};

export const useAssets = () => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["assets", token, childId],
    queryFn: () => api.getAssets(token ?? "", childId),
    enabled: Boolean(token),
  });
};

export const useCategories = () => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["categories", token, childId],
    queryFn: () => api.getCategories(token ?? "", childId),
    enabled: Boolean(token),
  });
};

type TransactionsFilters = {
  from?: string;
  to?: string;
  type?: TransactionType;
  assetId?: string;
  categoryId?: string;
  limit?: number;
  includeOpeningBalances?: boolean;
};

const sortTransactionsDesc = (items: Transaction[]): Transaction[] =>
  [...items].sort((a, b) => {
    const dateCmp = toDateKey(b.occurredAt).localeCompare(toDateKey(a.occurredAt));
    if (dateCmp !== 0) {
      return dateCmp;
    }
    return compareTransactionsInDay(a, b, "desc");
  });

const matchesTransactionsFilters = (
  tx: Transaction,
  filters?: TransactionsFilters
): boolean => {
  if (!filters) {
    return true;
  }
  if (filters.type && filters.type !== "all" && tx.type !== filters.type) {
    return false;
  }
  const txDate = toDateKey(tx.occurredAt);
  if (filters.from && txDate < filters.from) {
    return false;
  }
  if (filters.to && txDate > filters.to) {
    return false;
  }
  if (filters.assetId) {
    if (tx.type === "transfer") {
      if (tx.fromAssetId !== filters.assetId && tx.toAssetId !== filters.assetId) {
        return false;
      }
    } else if (tx.assetId !== filters.assetId) {
      return false;
    }
  }
  if (filters.categoryId) {
    if (tx.type === "transfer" || tx.categoryId !== filters.categoryId) {
      return false;
    }
  }
  return true;
};

export const useTransactions = (filters: TransactionsFilters) => {
  const { token, childId } = useAuth();
  const query = useQuery<TransactionsResponse>({
    queryKey: ["transactions", token, filters, childId],
    queryFn: () =>
      api.getTransactions(
        token ?? "",
        {
          from: filters.from,
          to: filters.to,
          type: filters.type,
          assetId: filters.assetId,
          categoryId: filters.categoryId,
          includeOpeningBalances: filters.includeOpeningBalances,
          limit: filters.limit ?? 200,
        },
        childId
      ),
    enabled: Boolean(token),
    placeholderData: { items: [], nextCursor: null },
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    const handler = () => {
      void query.refetch();
    };
    window.addEventListener(OFFLINE_OPERATIONS_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(OFFLINE_OPERATIONS_CHANGED_EVENT, handler);
    };
  }, [token, query.refetch]);

  return query;
};

export const useMonthlySummary = (year: number, month: number) => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["summary", token, year, month, childId],
    queryFn: () => api.getMonthlySummary(token ?? "", year, month, childId),
    enabled: Boolean(token),
  });
};

export const useInvalidateLedger = () => {
  const queryClient = useQueryClient();
  return (deletedTxId?: string, createdTx?: Transaction) => {
    api.clearTransactionsCache();
    if (createdTx) {
      const queries = queryClient.getQueriesData<TransactionsResponse>({
        queryKey: ["transactions"],
      });
      queries.forEach(([queryKey, current]) => {
        if (!current || !Array.isArray(queryKey)) {
          return;
        }
        const filters =
          queryKey.length > 1 && typeof queryKey[1] === "object" && queryKey[1] !== null
            ? (queryKey[1] as TransactionsFilters)
            : undefined;
        if (!matchesTransactionsFilters(createdTx, filters)) {
          return;
        }
        const deduped = current.items.filter((tx) => tx.id !== createdTx.id);
        const sorted = sortTransactionsDesc([createdTx, ...deduped]);
        const limit = typeof filters?.limit === "number" ? filters.limit : undefined;
        queryClient.setQueryData<TransactionsResponse>(queryKey, {
          ...current,
          items: limit ? sorted.slice(0, limit) : sorted,
        });
      });
    }
    if (deletedTxId) {
      queryClient.setQueriesData<TransactionsResponse>(
        { queryKey: ["transactions"] },
        (current) =>
          current
            ? {
                ...current,
                items: current.items.filter((tx) => tx.id !== deletedTxId),
              }
            : current
      );
    }
    if (createdTx) {
      void queryClient.invalidateQueries({
        queryKey: ["transactions"],
        exact: false,
        refetchType: "none",
      });
    } else {
      void queryClient.invalidateQueries({
        queryKey: ["transactions"],
        exact: false,
        refetchType: "active",
      });
    }
    void queryClient.invalidateQueries({ queryKey: ["summary"] });
    void queryClient.invalidateQueries({ queryKey: ["assets"] });
  };
};
