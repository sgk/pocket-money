import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Check, Trash2, X } from "lucide-react";
import type { Asset, Category, Transaction } from "@/lib/types";
import { formatDateSlash } from "@/lib/date";
import { formatJPYPlain } from "@/lib/money";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInvalidateLedger } from "@/lib/query";
import { NewEntryRow } from "@/components/ledger/new-entry-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

const EditableRow = ({
  transaction,
  assets,
  categories,
  fixedAssetId,
  onCancel,
}: {
  transaction: Transaction;
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
  onCancel: () => void;
}) => {
  const { token } = useAuth();
  const invalidate = useInvalidateLedger();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<{
    occurredAt: string;
    amount: string;
    memo: string;
    assetId?: string;
    categoryName?: string;
    merchant?: string;
    source?: string;
    fromAssetId?: string;
    toAssetId?: string;
  }>({
    occurredAt: transaction.occurredAt.slice(0, 10),
    amount: String(transaction.amount),
    memo: transaction.memo ?? "",
    assetId: transaction.type === "transfer" ? undefined : transaction.assetId,
    categoryName: transaction.type === "transfer" ? undefined : transaction.categoryName,
    merchant: transaction.type === "expense" ? transaction.merchant ?? "" : undefined,
    source: transaction.type === "income" ? transaction.source ?? "" : undefined,
    fromAssetId: transaction.type === "transfer" ? transaction.fromAssetId : undefined,
    toAssetId: transaction.type === "transfer" ? transaction.toAssetId : undefined,
  });

  const expenseCategories = categories.filter(
    (category) => category.kind !== "income" && category.name !== "その他"
  );
  const incomeCategories = categories.filter(
    (category) => category.kind === "income" && category.name !== "その他"
  );

  const categoryOptions =
    transaction.type === "income" ? incomeCategories : expenseCategories;
  const availableCategories =
    form.categoryName && form.categoryName !== "その他"
      ? categoryOptions.some((category) => category.name === form.categoryName)
        ? categoryOptions
        : [
            {
              id: "custom",
              name: form.categoryName,
              isActive: true,
              sortOrder: 0,
              kind: transaction.type === "income" ? "income" : "expense",
            },
            ...categoryOptions,
          ]
      : categoryOptions;

  const handleSave = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (!form.amount || Number(form.amount) < 1) {
      toast.error("きんがくは 1えん いじょうで いれてね");
      return;
    }
    if (transaction.type === "expense" || transaction.type === "income") {
      if (!form.assetId) {
        toast.error("いれものを えらんでね");
        return;
      }
      if (!form.categoryName) {
        toast.error("つかいみちを えらんでね");
        return;
      }
    }
    if (transaction.type === "transfer") {
      if (!form.fromAssetId || !form.toAssetId) {
        toast.error("うつす いれものを えらんでね");
        return;
      }
      if (form.fromAssetId === form.toAssetId) {
        toast.error("おなじ いれものには うつせないよ");
        return;
      }
    }
    try {
      setIsSaving(true);
      let payload: Record<string, unknown> = {
        occurredAt: form.occurredAt,
        amount: Number(form.amount),
        memo: form.memo || undefined,
      };
      if (transaction.type === "expense") {
        payload = {
          ...payload,
          assetId: form.assetId,
          categoryName: form.categoryName,
          merchant: form.merchant || undefined,
        };
      }
      if (transaction.type === "income") {
        payload = {
          ...payload,
          assetId: form.assetId,
          categoryName: form.categoryName,
          source: form.source || undefined,
        };
      }
      if (transaction.type === "transfer") {
        payload = {
          ...payload,
          fromAssetId: form.fromAssetId,
          toAssetId: form.toAssetId,
        };
      }
      await api.updateTransaction(token, transaction.id, payload);
      toast.success("きろくを なおしたよ");
      invalidate();
      onCancel();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    const ok = window.confirm("この きろくを けす？");
    if (!ok) {
      return;
    }
    try {
      setIsSaving(true);
      await api.deleteTransaction(token, transaction.id);
      toast.success("きろくを けしたよ");
      invalidate();
      onCancel();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const disableAsset =
    Boolean(fixedAssetId) &&
    (transaction.type !== "transfer" ? form.assetId === fixedAssetId : false);
  const disableFrom =
    Boolean(fixedAssetId) && form.fromAssetId === fixedAssetId;
  const disableTo = Boolean(fixedAssetId) && form.toAssetId === fixedAssetId;

  return (
    <tr
      onKeyDown={handleKeyDown}
      className="border-t bg-secondary/30"
    >
      <td className="p-2">
        <Input
          type="date"
          value={form.occurredAt}
          onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
        />
      </td>
      <td className="p-2">
        {transaction.type === "transfer" ? (
          <Select
            value={form.fromAssetId ?? ""}
            onValueChange={(value) =>
              setForm({ ...form, fromAssetId: value })
            }
            disabled={disableFrom}
          >
            <SelectTrigger>
              <SelectValue placeholder="いれもの" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={form.assetId ?? ""}
            onValueChange={(value) => setForm({ ...form, assetId: value })}
            disabled={disableAsset}
          >
            <SelectTrigger>
              <SelectValue placeholder="いれもの" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-2">
        {transaction.type === "expense" ? (
          <Input
            list="merchant-suggest"
            placeholder="あいて"
            value={form.merchant ?? ""}
            onChange={(event) => setForm({ ...form, merchant: event.target.value })}
          />
        ) : transaction.type === "income" ? (
          <Input
            list="source-suggest"
            placeholder="あいて"
            value={form.source ?? ""}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
          />
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-2">
        {transaction.type === "transfer" ? (
          <Select
            value={form.toAssetId ?? ""}
            onValueChange={(value) =>
              setForm({ ...form, toAssetId: value })
            }
            disabled={disableTo}
          >
            <SelectTrigger>
              <SelectValue placeholder="うつすさき" />
            </SelectTrigger>
            <SelectContent>
              {assets
                .filter((asset) => asset.id !== form.fromAssetId)
                .map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    いどう: {asset.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={form.categoryName ?? ""}
            onValueChange={(value) =>
              setForm({ ...form, categoryName: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="うごき" />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.map((category) => (
                <SelectItem key={category.name} value={category.name}>
                  {transaction.type === "income" ? "もらった" : "つかった"}:{" "}
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value="その他">
                {transaction.type === "income" ? "もらった" : "つかった"}: その他
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-2">
        <Input
          list="memo-suggest"
          placeholder="メモ"
          value={form.memo}
          onChange={(event) => setForm({ ...form, memo: event.target.value })}
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          min={1}
          placeholder="きんがく"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
        />
      </td>
      <td className="p-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={isSaving}
            aria-label="ほぞん"
          >
            <Check className="h-4 w-4 text-emerald-600" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="キャンセル"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isSaving}
            aria-label="きろくを けす"
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets]
  );
  const assetName = (assetId: string) => assetMap.get(assetId) ?? "";

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
        cell: ({ row }) => formatDateSlash(row.original.occurredAt),
        meta: {
          headerClassName: "min-w-[120px] whitespace-nowrap",
          cellClassName: "min-w-[120px] whitespace-nowrap",
        },
      },
      {
        header: "いれもの",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            return `${assetName(tx.fromAssetId)} → ${assetName(tx.toAssetId)}`;
          }
          return assetName(tx.assetId);
        },
        meta: {
          headerClassName: "min-w-[180px] whitespace-nowrap",
          cellClassName: "min-w-[180px] whitespace-nowrap",
        },
      },
      {
        header: "あいて",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "expense") {
            return tx.merchant ?? "";
          }
          if (tx.type === "income") {
            return tx.source ?? "";
          }
          return "-";
        },
        meta: {
          headerClassName: "min-w-[160px] whitespace-nowrap",
          cellClassName: "min-w-[160px] whitespace-nowrap",
        },
      },
      {
        header: "うごき",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "expense") {
            return `つかった: ${tx.categoryName ?? ""}`;
          }
          if (tx.type === "income") {
            return `もらった: ${tx.categoryName ?? ""}`;
          }
          return `いどう: ${assetName(tx.toAssetId)}`;
        },
        meta: {
          headerClassName: "min-w-[200px] whitespace-nowrap",
          cellClassName: "min-w-[200px] whitespace-nowrap",
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
        header: "きんがく",
        cell: ({ row }) => formatJPYPlain(row.original.amount),
        meta: {
          headerClassName: "min-w-[120px] whitespace-nowrap",
          cellClassName: "min-w-[120px] whitespace-nowrap text-right",
        },
      },
      {
        header: "ざんだか",
        cell: () => "-",
        meta: {
          headerClassName: "min-w-[120px] whitespace-nowrap",
          cellClassName: "min-w-[120px] whitespace-nowrap text-right",
        },
      },
    ],
    [assetMap]
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
      <table className="ledger-table min-w-[1100px] w-full border-collapse text-sm">
        <thead className="bg-secondary/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`p-3 text-center font-medium ${
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
            editingId === row.original.id ? (
              <EditableRow
                key={row.id}
                transaction={row.original}
                assets={assets}
                categories={categories}
                fixedAssetId={fixedAssetId}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <tr
                key={row.id}
                className={`border-t hover:bg-secondary/30 ${
                  selectedId === row.original.id ? "bg-secondary/40" : ""
                }`}
                onClick={() => {
                  setSelectedId(row.original.id);
                  setEditingId(row.original.id);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`p-3 align-top ${
                      (cell.column.columnDef.meta as ColumnMeta | undefined)
                        ?.cellClassName ?? ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          ))}
        </tbody>
      </table>
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
