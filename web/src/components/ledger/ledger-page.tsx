import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, startOfCurrentMonth, startOfNextMonth, toDateKey } from "@/lib/date";
import { computeRunningBalances } from "@/lib/balance";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useMonthlySummary, useTransactions } from "@/lib/query";

export const LedgerPage = () => {
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const [filters, setFilters] = useState<LedgerFiltersState>({
    from: formatDate(startOfCurrentMonth()),
    to: formatDate(startOfNextMonth()),
    search: "",
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
    <div>
      <Topbar title="いれもの（ぜんぶ）" subtitle="ぜんぶまとめて みよう">
        <Filters filters={filters} setFilters={setFilters} />
      </Topbar>

      <LedgerTable
        transactions={filtered}
        assets={assets}
        categories={categories}
        balancesById={balancesById}
      />

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">こんげつのまとめ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">いれた</p>
              <p className="text-lg font-semibold text-emerald-600">
                {formatJPY(summary?.incomeTotal ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">だした</p>
              <p className="text-lg font-semibold text-rose-600">
                {formatJPY(summary?.expenseTotal ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">のこり</p>
              <p className="text-lg font-semibold">{formatJPY(summary?.net ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
