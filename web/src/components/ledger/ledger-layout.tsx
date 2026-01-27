import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Filters, type LedgerFiltersState } from "@/components/ledger/filters";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { NewEntryRow } from "@/components/ledger/new-entry-row";
import type { Asset, Category, Transaction } from "@/lib/types";

type LedgerLayoutProps = {
  title: string;
  subtitle?: string;
  filters: LedgerFiltersState;
  setFilters: (filters: LedgerFiltersState) => void;
  transactions: Transaction[];
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
  balancesById: Record<string, number>;
  openingBalances: Record<string, number>;
  openingDate: string;
  summaryContent: ReactNode;
  onEditingChange: (isEditing: boolean) => void;
};

export const LedgerLayout = ({
  title,
  subtitle,
  filters,
  setFilters,
  transactions,
  assets,
  categories,
  fixedAssetId,
  balancesById,
  openingBalances,
  openingDate,
  summaryContent,
  onEditingChange,
}: LedgerLayoutProps) => {
  const topbarRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

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

  useEffect(() => {
    onEditingChange(isEditing);
  }, [isEditing, onEditingChange]);

  const entryRow = (
    <NewEntryRow
      assets={assets}
      categories={categories}
      fixedAssetId={fixedAssetId}
      disabled={isEditing}
    />
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
      <Topbar ref={topbarRef} title={title} subtitle={subtitle} dense>
        <Filters filters={filters} setFilters={setFilters} />
      </Topbar>

      {filters.order === "desc" && (
        <div className="bg-card border-b border-border -mx-4 py-[0.4rem] md:-mx-6">
          <table className="ledger-table w-full">
            <colgroup>
              <col style={{ width: '120px' }} />
              <col />
              <col />
              <col />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
            </colgroup>
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
              transactions={transactions}
              assets={assets}
              categories={categories}
              fixedAssetId={fixedAssetId}
              balancesById={balancesById}
              openingBalances={openingBalances}
              openingDate={openingDate}
              order={filters.order}
              onEditingChange={setIsEditing}
              entryRow={undefined}
              entryPosition={filters.order === "desc" ? "top" : "bottom"}
            />
          </div>
        </div>

        {filters.order === "asc" && (
          <div className="bg-card border-t border-border -mx-4 py-[0.4rem] md:-mx-6">
            <table className="ledger-table w-full">
              <colgroup>
                <col style={{ width: '120px' }} />
                <col />
                <col />
                <col />
                <col />
                <col style={{ width: '120px' }} />
                <col style={{ width: '120px' }} />
              </colgroup>
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
          {summaryContent}
        </div>
      </section>
    </div>
  );
};
