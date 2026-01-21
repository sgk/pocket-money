import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, startOfCurrentMonth, startOfNextMonth } from "@/lib/date";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useMonthlySummary, useTransactions } from "@/lib/query";

export const LedgerPage = () => {
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const [filters, setFilters] = useState<LedgerFiltersState>({
    from: formatDate(startOfCurrentMonth()),
    to: formatDate(startOfNextMonth()),
    type: "all",
    search: "",
    assetId: undefined,
    categoryId: undefined,
  });

  const { data } = useTransactions({
    from: filters.from,
    to: filters.to,
    type: filters.type,
    assetId: filters.assetId,
    categoryId: filters.categoryId,
  });
  const transactions = data.items;

  const now = new Date();
  const { data: summary } = useMonthlySummary(now.getFullYear(), now.getMonth() + 1);

  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    if (!keyword) {
      return transactions;
    }
    return transactions.filter((tx) => {
      const target = [tx.memo];
      if (tx.type === "expense") {
        target.push(tx.merchant);
      }
      if (tx.type === "income") {
        target.push(tx.source);
      }
      return target.filter(Boolean).some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [transactions, filters.search]);

  return (
    <div>
      <Topbar title="全資産元帳" subtitle="すべての資産の動きを一覧で確認">
        <Filters
          filters={filters}
          setFilters={setFilters}
          assets={assets}
          categories={categories}
          showAssetFilter
        />
      </Topbar>

      <LedgerTable transactions={filtered} assets={assets} categories={categories} />

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">今月のサマリー</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">収入</p>
              <p className="text-lg font-semibold text-emerald-600">
                {formatJPY(summary?.incomeTotal ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">支出</p>
              <p className="text-lg font-semibold text-rose-600">
                {formatJPY(summary?.expenseTotal ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">差引</p>
              <p className="text-lg font-semibold">{formatJPY(summary?.net ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
