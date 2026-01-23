import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { formatDate, startOfCurrentMonth, toDateKey } from "@/lib/date";
import { endOfMonth } from "date-fns";
import { computeRunningBalances } from "@/lib/balance";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useMonthlySummary, useTransactions } from "@/lib/query";

export const LedgerPage = () => {
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
  });
  const transactions = data?.items ?? [];
  const openingBalances = data?.openingBalances ?? {};

  const balancesById = useMemo(
    () => computeRunningBalances(transactions, openingBalances, { type: "all" }),
    [transactions, openingBalances]
  );

  const now = new Date();
  const { data: summary } = useMonthlySummary(now.getFullYear(), now.getMonth() + 1);

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

  return (
    <div className="pb-24 md:pb-28">
      <Topbar title="いれもの（ぜんぶ）" subtitle="ぜんぶまとめて みよう">
        <Filters filters={filters} setFilters={setFilters} />
      </Topbar>

      <LedgerTable
        transactions={filtered}
        assets={assets}
        categories={categories}
        balancesById={balancesById}
        openingBalances={openingBalances}
        openingDate={filters.from}
        order={filters.order}
      />

      <section className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-2 md:px-6">
          <div className="flex flex-nowrap items-center gap-2 text-xs sm:text-sm">
            <span className="shrink-0 text-muted-foreground">まとめ</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                <span className="text-muted-foreground">いれた</span>
                <span className="font-semibold text-emerald-600 whitespace-nowrap">
                  {formatJPY(summary?.incomeTotal ?? 0)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                <span className="text-muted-foreground">だした</span>
                <span className="font-semibold text-rose-600 whitespace-nowrap">
                  {formatJPY(summary?.expenseTotal ?? 0)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                <span className="text-muted-foreground">のこり</span>
                <span className="font-semibold whitespace-nowrap">
                  {formatJPY(summary?.net ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
