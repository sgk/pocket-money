import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TransactionType, TransactionsResponse } from "@/lib/types";

export const useBootstrap = (enabled = true) => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["bootstrap", childId],
    queryFn: () => api.bootstrap(token ?? "", childId),
    enabled: Boolean(token) && enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

export const useOnboardingStatus = () => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["onboarding"],
    queryFn: () => api.getOnboardingStatus(token ?? ""),
    enabled: Boolean(token),
    retry: false,
  });
};

export const useInvites = (enabled = true) => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["invites"],
    queryFn: () => api.getInvites(token ?? ""),
    enabled: Boolean(token) && enabled,
    retry: false,
  });
};

export const useAssets = () => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["assets", childId],
    queryFn: () => api.getAssets(token ?? "", childId),
    enabled: Boolean(token),
  });
};

export const useCategories = () => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["categories", childId],
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

export const useTransactions = (filters: TransactionsFilters) => {
  const { token, childId } = useAuth();
  return useQuery<TransactionsResponse>({
    queryKey: ["transactions", filters, childId],
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
};

export const useMonthlySummary = (year: number, month: number) => {
  const { token, childId } = useAuth();
  return useQuery({
    queryKey: ["summary", year, month, childId],
    queryFn: () => api.getMonthlySummary(token ?? "", year, month, childId),
    enabled: Boolean(token),
  });
};

export const useInvalidateLedger = () => {
  const queryClient = useQueryClient();
  return (deletedTxId?: string) => {
    api.clearTransactionsCache();
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
    void queryClient.invalidateQueries({
      queryKey: ["transactions"],
      exact: false,
      refetchType: "active",
    });
    void queryClient.invalidateQueries({ queryKey: ["summary"] });
    void queryClient.invalidateQueries({ queryKey: ["assets"] });
  };
};
