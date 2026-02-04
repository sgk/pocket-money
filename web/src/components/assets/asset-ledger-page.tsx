import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LedgerLayout } from "@/components/ledger/ledger-layout";
import { type LedgerFiltersState } from "@/components/ledger/filters";
import { formatDate, startOfCurrentMonth, toDateKey } from "@/lib/date";
import { endOfMonth } from "date-fns";
import { computeEndingBalance, computeRunningBalances } from "@/lib/balance";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useTransactions } from "@/lib/query";
import { useText } from "@/lib/text";

export const AssetLedgerPage = () => {
  const { t } = useText();
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { data: assets = [], isLoading: isAssetsLoading } = useAssets();
  const { data: categories = [] } = useCategories();
  const asset = assets.find((item) => item.id === assetId);
  const assetName = asset?.name;
  const resolvedAssetId = asset?.id;

  useEffect(() => {
    console.log("AssetLedgerPage state:", { isAssetsLoading, assetsCount: assets.length, assetFound: !!asset, assetId });
    if (!isAssetsLoading && !asset && assetId) {
      console.log("Redirecting to dashboard...");
      navigate("/", { replace: true });
    }
  }, [isAssetsLoading, assets, asset, assetId, navigate]);

  const [filters, setFilters] = useState<LedgerFiltersState>({
    from: formatDate(startOfCurrentMonth()),
    to: formatDate(endOfMonth(new Date())),
    search: "",
    order: "desc",
  });

  const { data } = useTransactions({
    from: filters.from,
    to: filters.to,
    assetId: resolvedAssetId,
    includeOpeningBalances: true,
    limit: 1000,
  });
  const transactions = data?.items ?? [];
  const openingBalances = data?.openingBalances ?? {};

  const balancesById = useMemo(() => {
    if (!assetName) {
      return {};
    }
    return computeRunningBalances(transactions, openingBalances, {
      type: "asset",
      assetName,
    });
  }, [transactions, openingBalances, assetName]);

  const endingBalance = useMemo(() => {
    if (!assetName) {
      return 0;
    }
    return computeEndingBalance(transactions, openingBalances, {
      type: "asset",
      assetName,
    });
  }, [transactions, openingBalances, assetName]);

  const filtered = useMemo(() => {
    if (!resolvedAssetId || !assetName) {
      return [];
    }
    const keyword = filters.search.trim().toLowerCase();
    const from = filters.from ? toDateKey(filters.from) : null;
    const to = filters.to ? toDateKey(filters.to) : null;
    return transactions.filter((tx) => {
      const belongs =
        tx.type === "transfer"
          ? tx.fromAssetId === resolvedAssetId || tx.toAssetId === resolvedAssetId
          : tx.assetId === resolvedAssetId || tx.assetName === assetName;
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
  }, [transactions, filters.search, filters.from, filters.to, assetName, resolvedAssetId]);

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

  const summaryContent = (
    <div className="flex flex-nowrap items-center gap-2 text-xs sm:text-sm">
      <span className="shrink-0 text-muted-foreground">{t("summaryLabel")}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
          <span className="text-muted-foreground">{t("summaryIncome")}</span>
          <span className="font-semibold text-emerald-600 whitespace-nowrap">
            {formatJPY(assetSummary.incomeTotal)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
          <span className="text-muted-foreground">{t("summaryExpense")}</span>
          <span className="font-semibold text-rose-600 whitespace-nowrap">
            {formatJPY(assetSummary.expenseTotal)}
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
      title={t("assetLedgerTitle", { assetName: asset?.name })}
      subtitle={
        asset ? t("assetLedgerSubtitle", { balance: formatJPY(asset.currentBalance) }) : undefined
      }
      filters={filters}
      setFilters={setFilters}
      transactions={filtered}
      assets={assets}
      categories={categories}
      fixedAssetId={resolvedAssetId}
      fixedAssetName={assetName}
      balancesById={balancesById}
      openingBalances={openingBalances}
      openingDate={filters.from}
      summaryContent={summaryContent}
      onEditingChange={() => {}}
    />
  );
};
