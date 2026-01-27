import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { NewEntryRow } from "@/components/ledger/new-entry-row";
import { formatDate, startOfCurrentMonth, toDateKey } from "@/lib/date";
import { endOfMonth } from "date-fns";
import { computeEndingBalance, computeRunningBalances } from "@/lib/balance";
import { formatJPY } from "@/lib/money";
import { useAssets, useCategories, useMonthlySummary, useTransactions } from "@/lib/query";

export const LedgerPage = () => {
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const topbarRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
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
  const endingBalance = useMemo(
    () => computeEndingBalance(transactions, openingBalances, { type: "all" }),
    [transactions, openingBalances]
  );

  const now = new Date();
  const { data: summary } = useMonthlySummary(now.getFullYear(), now.getMonth() + 1);

  useEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) {
      return;
    }
    const update = () => {
      const styles = window.getComputedStyle(topbar);
      const marginBottom = Number.parseFloat(styles.marginBottom) || 0;
      setTopbarHeight(topbar.getBoundingClientRect().height + marginBottom);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const summaryEl = summaryRef.current;
    if (!summaryEl) {
      return;
    }
    const update = () => {
      setSummaryHeight(summaryEl.getBoundingClientRect().height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(summaryEl);
    return () => observer.disconnect();
  }, []);

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

  const entryRow = (
    <NewEntryRow assets={assets} categories={categories} disabled={isEditing} />
  );

  return (
    <div
      className="flex h-full flex-col"
      style={
        {
          "--ledger-top-offset": `${topbarHeight}px`,
          "--ledger-bottom-offset": `${summaryHeight}px`,
        } as CSSProperties
      }
    >
      <Topbar
        ref={topbarRef}
        title="いれもの（ぜんぶ）"
        subtitle="ぜんぶまとめて みよう"
        dense
      >
        <Filters filters={filters} setFilters={setFilters} />
      </Topbar>

      {filters.order === "desc" && (
        <div className="bg-card border-b border-border -mx-4 px-4 py-[0.4rem] md:-mx-6 md:px-6">
          <table className="ledger-table w-full">
            <tbody>{entryRow}</tbody>
          </table>
        </div>
      )}

      {filters.order === "asc" && <div className="h-0 min-[901px]:hidden" />}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          style={{ paddingBottom: filters.order === "desc" ? summaryHeight : 0 }}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-clip max-[900px]:-mx-4 min-[901px]:-mx-4 min-[1200px]:-mx-6"
        >
          <div className="max-[900px]:px-4 min-[901px]:px-0">
            <LedgerTable
              transactions={filtered}
              assets={assets}
              categories={categories}
              balancesById={balancesById}
              openingBalances={openingBalances}
              openingDate={filters.from}
              order={filters.order}
              onEditingChange={setIsEditing}
              entryRow={undefined}
              entryPosition={filters.order === "desc" ? "top" : "bottom"}
            />
          </div>
        </div>

        {filters.order === "asc" && (
          <div className="bg-card border-t border-border -mx-4 px-4 py-[0.4rem] md:-mx-6 md:px-6">
            <table className="ledger-table w-full">
              <tbody>{entryRow}</tbody>
            </table>
          </div>
        )}
      </div>

      <section
        ref={summaryRef}
        className="sticky bottom-0 z-20 shrink-0 border-t bg-card/95 backdrop-blur -mx-4 md:-mx-6"
        style={{ marginBottom: "-1px" }}
      >
        <div className="w-full px-4 py-2 md:px-6">
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
                  {formatJPY(endingBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
