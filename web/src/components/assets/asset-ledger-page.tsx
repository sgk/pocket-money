import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, startOfCurrentMonth, startOfNextMonth } from "@/lib/date";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useTransactions } from "@/lib/query";

export const AssetLedgerPage = () => {
  const { assetId } = useParams();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const asset = assets.find((item) => item.id === assetId);

  const [filters, setFilters] = useState<LedgerFiltersState>({
    from: formatDate(startOfCurrentMonth()),
    to: formatDate(startOfNextMonth()),
    search: "",
  });

  const { data } = useTransactions({
    from: filters.from,
    to: filters.to,
    type: filters.type,
  });
  const transactions = data.items;

  const filtered = useMemo(() => {
    if (!assetId) {
      return [];
    }
    const keyword = filters.search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const belongs =
        tx.type === "transfer"
          ? tx.fromAssetId === assetId || tx.toAssetId === assetId
          : tx.assetId === assetId;
      if (!belongs) {
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
  }, [transactions, filters.search, assetId]);

  const assetSummary = useMemo(() => {
    return filtered.reduce(
      (acc, tx) => {
        if (tx.type === "expense") {
          acc.expenseTotal += tx.amount;
          acc.net -= tx.amount;
        }
        if (tx.type === "income") {
          acc.incomeTotal += tx.amount;
          acc.net += tx.amount;
        }
        return acc;
      },
      { incomeTotal: 0, expenseTotal: 0, net: 0 }
    );
  }, [filtered]);

  return (
    <div>
      <Topbar
        title={asset?.name ? `${asset.name} のノート` : "おかねノート"}
        subtitle={asset ? `のこり ${formatJPY(asset.currentBalance)}` : undefined}
      >
        <Filters filters={filters} setFilters={setFilters} />
      </Topbar>

      <LedgerTable
        transactions={filtered}
        assets={assets}
        categories={categories}
        fixedAssetId={assetId}
      />

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">こんげつのまとめ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">もらった</p>
              <p className="text-lg font-semibold text-emerald-600">
                {formatJPY(assetSummary.incomeTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">つかった</p>
              <p className="text-lg font-semibold text-rose-600">
                {formatJPY(assetSummary.expenseTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">のこり</p>
              <p className="text-lg font-semibold">{formatJPY(assetSummary.net)}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
