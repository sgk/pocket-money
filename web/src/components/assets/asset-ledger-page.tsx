import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { formatDate, startOfCurrentMonth, toDateKey } from "@/lib/date";
import { endOfMonth } from "date-fns";
import { computeRunningBalances } from "@/lib/balance";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useTransactions } from "@/lib/query";

export const AssetLedgerPage = () => {
  const { assetId } = useParams();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const asset = assets.find((item) => item.id === assetId);

  const [filters, setFilters] = useState<LedgerFiltersState>({
    from: formatDate(startOfCurrentMonth()),
    to: formatDate(endOfMonth(new Date())),
    search: "",
    order: "desc",
  });

  const { data } = useTransactions({
    from: filters.from,
    to: filters.to,
    type: filters.type,
    assetId,
    includeOpeningBalances: true,
  });
  const transactions = data?.items ?? [];
  const openingBalances = data?.openingBalances ?? {};

  const balancesById = useMemo(() => {
    if (!assetId) {
      return {};
    }
    return computeRunningBalances(transactions, openingBalances, {
      type: "asset",
      assetId,
    });
  }, [transactions, openingBalances, assetId]);

  const filtered = useMemo(() => {
    if (!assetId) {
      return [];
    }
    const keyword = filters.search.trim().toLowerCase();
    const from = filters.from ? toDateKey(filters.from) : null;
    const to = filters.to ? toDateKey(filters.to) : null;
    return transactions.filter((tx) => {
      const belongs =
        tx.type === "transfer"
          ? tx.fromAssetId === assetId || tx.toAssetId === assetId
          : tx.assetId === assetId;
      if (!belongs) {
        return false;
      }
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
  }, [transactions, filters.search, filters.from, filters.to, assetId]);

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
    <div className="pb-24 md:pb-28">
      <Topbar
        title={asset?.name ? `いれもの（${asset.name}）` : "いれもの"}
        subtitle={asset ? `のこり ${formatJPY(asset.currentBalance)}` : undefined}
      >
        <Filters filters={filters} setFilters={setFilters} />
      </Topbar>

      <LedgerTable
        transactions={filtered}
        assets={assets}
        categories={categories}
        fixedAssetId={assetId}
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
                  {formatJPY(assetSummary.incomeTotal)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                <span className="text-muted-foreground">だした</span>
                <span className="font-semibold text-rose-600 whitespace-nowrap">
                  {formatJPY(assetSummary.expenseTotal)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                <span className="text-muted-foreground">のこり</span>
                <span className="font-semibold whitespace-nowrap">
                  {formatJPY(assetSummary.net)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
