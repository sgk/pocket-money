import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TransactionType, TransactionsResponse } from "@/lib/types";

export const useBootstrap = (enabled = true) => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api.bootstrap(token ?? ""),
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
  const { token } = useAuth();
  return useQuery({
    queryKey: ["assets"],
    queryFn: () => api.getAssets(token ?? ""),
    enabled: Boolean(token),
  });
};

export const useCategories = () => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(token ?? ""),
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
  const { token } = useAuth();
  return useQuery<TransactionsResponse>({
    queryKey: ["transactions", filters],
    queryFn: () =>
      api.getTransactions(token ?? "", {
        from: filters.from,
        to: filters.to,
        type: filters.type,
        assetId: filters.assetId,
        categoryId: filters.categoryId,
        includeOpeningBalances: filters.includeOpeningBalances,
        limit: filters.limit ?? 200,
      }),
    enabled: Boolean(token),
    placeholderData: { items: [], nextCursor: null },
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
};

export const useMonthlySummary = (year: number, month: number) => {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["summary", year, month],
    queryFn: () => api.getMonthlySummary(token ?? "", year, month),
    enabled: Boolean(token),
  });
};

export const useInvalidateLedger = () => {
  const queryClient = useQueryClient();
  return () => {
    api.clearTransactionsCache();
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.refetchQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
  };
};
