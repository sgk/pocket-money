import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Asset, Category, Transaction } from "@/lib/types";
import { formatDate } from "@/lib/date";
import { formatJPYPlain } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewEntryRow } from "@/components/ledger/new-entry-row";
import { TransactionEditDialog } from "@/components/ledger/transaction-edit-dialog";

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

const typeLabel = {
  expense: "つかった",
  income: "もらった",
  transfer: "うつす",
} as const;

export const LedgerTable = ({
  transactions,
  assets,
  categories,
  fixedAssetId,
}: {
  transactions: Transaction[];
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const suggestions = useMemo(() => {
    const merchants = new Set<string>();
    const sources = new Set<string>();
    const memos = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.type === "expense" && tx.merchant) {
        merchants.add(tx.merchant);
      }
      if (tx.type === "income" && tx.source) {
        sources.add(tx.source);
      }
      if (tx.memo) {
        memos.add(tx.memo);
      }
    });
    return {
      merchants: Array.from(merchants),
      sources: Array.from(sources),
      memos: Array.from(memos),
    };
  }, [transactions]);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        header: "ひづけ",
        accessorKey: "occurredAt",
        cell: ({ row }) => formatDate(row.original.occurredAt),
        meta: {
          headerClassName: "min-w-[120px] whitespace-nowrap",
          cellClassName: "min-w-[120px] whitespace-nowrap",
        },
      },
      {
        header: "ばしょ",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            return `${assetMap.get(tx.fromAssetId) ?? ""} → ${
              assetMap.get(tx.toAssetId) ?? ""
            }`;
          }
          return assetMap.get(tx.assetId) ?? "";
        },
        meta: {
          headerClassName: "min-w-[180px] whitespace-nowrap",
          cellClassName: "min-w-[180px] whitespace-nowrap",
        },
      },
      {
        header: "しゅるい",
        cell: ({ row }) => (
          <Badge variant={row.original.type}>{typeLabel[row.original.type]}</Badge>
        ),
        meta: {
          headerClassName: "min-w-[110px] whitespace-nowrap",
          cellClassName: "min-w-[110px] whitespace-nowrap",
        },
      },
      {
        header: "あいて/ないよう",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "expense") {
            return tx.merchant ?? "";
          }
          if (tx.type === "income") {
            return tx.source ?? "";
          }
          return tx.memo ?? "";
        },
        meta: {
          headerClassName: "min-w-[180px] whitespace-nowrap",
          cellClassName: "min-w-[180px] whitespace-nowrap",
        },
      },
      {
        header: "つかいみち",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            return "-";
          }
          return categoryMap.get(tx.categoryId) ?? "";
        },
        meta: {
          headerClassName: "min-w-[160px] whitespace-nowrap",
          cellClassName: "min-w-[160px] whitespace-nowrap",
        },
      },
      {
        header: "つかった",
        cell: ({ row }) =>
          row.original.type === "expense"
            ? formatJPYPlain(row.original.amount)
            : "",
        meta: {
          headerClassName: "min-w-[120px] whitespace-nowrap text-right",
          cellClassName: "min-w-[120px] whitespace-nowrap text-right",
        },
      },
      {
        header: "もらった",
        cell: ({ row }) =>
          row.original.type === "income"
            ? formatJPYPlain(row.original.amount)
            : "",
        meta: {
          headerClassName: "min-w-[120px] whitespace-nowrap text-right",
          cellClassName: "min-w-[120px] whitespace-nowrap text-right",
        },
      },
      {
        header: "メモ",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            return tx.fee ? `てすうりょう ${formatJPYPlain(tx.fee)}` : "-";
          }
          return tx.memo ?? "";
        },
        meta: {
          headerClassName: "min-w-[160px] whitespace-nowrap",
          cellClassName: "min-w-[160px] whitespace-nowrap",
        },
      },
      {
        header: "ボタン",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(row.original)}>
              なおす
            </Button>
          </div>
        ),
        meta: {
          headerClassName: "min-w-[110px] whitespace-nowrap",
          cellClassName: "min-w-[110px] whitespace-nowrap",
        },
      },
    ],
    [assetMap, categoryMap]
  );

  const sorted = useMemo(
    () =>
      [...transactions].sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt)
      ),
    [transactions]
  );

  const table = useReactTable({
    data: sorted,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border bg-card/80 shadow-sm">
      <table className="min-w-[1100px] w-full border-collapse text-sm">
        <thead className="bg-secondary/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`p-3 text-left font-medium ${
                    (header.column.columnDef.meta as ColumnMeta | undefined)?.headerClassName ??
                    ""
                  }`}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="ledger-grid">
          <NewEntryRow
            assets={assets}
            categories={categories}
            fixedAssetId={fixedAssetId}
          />
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-t hover:bg-secondary/30 ${
                selectedId === row.original.id ? "bg-secondary/40" : ""
              }`}
              onClick={() => setSelectedId(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`p-3 align-top ${
                    (cell.column.columnDef.meta as ColumnMeta | undefined)?.cellClassName ?? ""
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <TransactionEditDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        transaction={editing}
        assets={assets}
        categories={categories}
      />
      <datalist id="merchant-suggest">
        {suggestions.merchants.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="source-suggest">
        {suggestions.sources.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="memo-suggest">
        {suggestions.memos.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
};
