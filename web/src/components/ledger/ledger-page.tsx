import { useMemo, useState } from "react";
import { LedgerLayout } from "@/components/ledger/ledger-layout";
import { type LedgerFiltersState } from "@/components/ledger/filters";
import { formatDate, startOfCurrentMonth, toDateKey } from "@/lib/date";
import { endOfMonth } from "date-fns";
import { computeEndingBalance, computeRunningBalances } from "@/lib/balance";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useMonthlySummary, useTransactions } from "@/lib/query";
import { useText } from "@/lib/text";

export const LedgerPage = () => {
  const { t } = useText();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const [filters, setFilters] = useState<LedgerFiltersState>({
    from: formatDate(startOfCurrentMonth()),
    to: formatDate(endOfMonth(new Date())),
    search: "",
    order: "desc",
  });

  const { data } = useTransactions({
    from: filters.from,
    to: filters.to,
    includeOpeningBalances: true,
    limit: 1000,
  });
  const transactions = data?.items ?? [];
  const openingBalances = data?.openingBalances ?? {};

  const balancesById = useMemo(
    () => computeRunningBalances(transactions, openingBalances, { type: "all" }),
    [transactions, openingBalances]
  );
  const endingBalance = useMemo(
    () => computeEndingBalance(transactions, openingBalances, { type: "all" }),
    [transactions, openingBalances]
  );

  const filterDate = new Date(filters.from);
  const { data: summary } = useMonthlySummary(
    filterDate.getFullYear(),
    filterDate.getMonth() + 1
  );

  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    const from = filters.from ? toDateKey(filters.from) : null;
    const to = filters.to ? toDateKey(filters.to) : null;
    return transactions.filter((tx) => {
      const txDate = toDateKey(tx.occurredAt);
      if (from && txDate < from) {
        return false;
      }
      if (to && txDate > to) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const target = [tx.memo];
      if (tx.type === "expense") {
        target.push(tx.merchant);
      }
      if (tx.type === "income") {
        target.push(tx.source);
      }
      return target.filter(Boolean).some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [transactions, filters.search, filters.from, filters.to]);

  const summaryContent = (
    <div className="flex flex-nowrap items-center gap-2 text-xs sm:text-sm">
      <span className="shrink-0 text-muted-foreground">{t("summaryLabel")}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
          <span className="text-muted-foreground">{t("summaryIncome")}</span>
          <span className="font-semibold text-emerald-600 whitespace-nowrap">
            {formatJPY(summary?.incomeTotal ?? 0)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
          <span className="text-muted-foreground">{t("summaryExpense")}</span>
          <span className="font-semibold text-rose-600 whitespace-nowrap">
            {formatJPY(summary?.expenseTotal ?? 0)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
          <span className="text-muted-foreground">{t("summaryBalance")}</span>
          <span className="font-semibold whitespace-nowrap">
            {formatJPY(endingBalance)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <LedgerLayout
      title={t("ledgerTitleAll")}
      subtitle={t("ledgerSubtitleAll")}
      filters={filters}
      setFilters={setFilters}
      transactions={filtered}
      assets={assets}
      categories={categories}
      balancesById={balancesById}
      openingBalances={openingBalances}
      openingDate={filters.from}
      summaryContent={summaryContent}
      onEditingChange={() => {}}
    />
  );
};
