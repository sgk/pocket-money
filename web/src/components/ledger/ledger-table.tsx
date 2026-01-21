import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Check, Trash2, X } from "lucide-react";
import type { Asset, Category, Transaction } from "@/lib/types";
import { formatDateSlash, toDateKey } from "@/lib/date";
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
                  {transaction.type === "income" ? "いれた" : "だした"}:{" "}
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value="その他">
                {transaction.type === "income" ? "いれた" : "だした"}: その他
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
  const { token } = useAuth();
  const invalidate = useInvalidateLedger();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<{ dateKey: string; index: number } | null>(
    null
  );

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
            return `だした: ${tx.categoryName ?? ""}`;
          }
          if (tx.type === "income") {
            return `いれた: ${tx.categoryName ?? ""}`;
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

  const sorted = useMemo(() => {
    const withIndex = transactions.map((tx, index) => ({ tx, index }));
    withIndex.sort((a, b) => {
      const dateA = toDateKey(a.tx.occurredAt);
      const dateB = toDateKey(b.tx.occurredAt);
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const orderA = a.tx.dayOrder ?? 0;
      const orderB = b.tx.dayOrder ?? 0;
      if (orderA !== orderB) {
        return orderB - orderA;
      }
      return a.index - b.index;
    });
    return withIndex.map((item) => item.tx);
  }, [transactions]);

  const groupData = useMemo(() => {
    const groups: Array<{ dateKey: string; items: Transaction[] }> = [];
    const idMap = new Map<string, { dateKey: string; index: number }>();
    let current: { dateKey: string; items: Transaction[] } | null = null;
    sorted.forEach((tx) => {
      const dateKey = toDateKey(tx.occurredAt);
      if (!current || current.dateKey !== dateKey) {
        current = { dateKey, items: [] };
        groups.push(current);
      }
      const index = current.items.length;
      current.items.push(tx);
      idMap.set(tx.id, { dateKey, index });
    });
    const dateMap = new Map(groups.map((group) => [group.dateKey, group]));
    return { groups, idMap, dateMap };
  }, [sorted]);

  const table = useReactTable({
    data: sorted,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const dragInfo = draggingId ? groupData.idMap.get(draggingId) : null;

  const canDropToPosition = (targetDateKey: string, insertIndex: number) => {
    if (!dragInfo) {
      return false;
    }
    const targetGroup = groupData.dateMap.get(targetDateKey);
    if (!targetGroup) {
      return false;
    }
    if (dragInfo.dateKey === targetDateKey) {
      return true;
    }
    if (targetGroup.items.length < 2) {
      return false;
    }
    if (insertIndex === 0 || insertIndex === targetGroup.items.length) {
      return false;
    }
    return true;
  };

  const buildDayOrders = (items: Transaction[]) =>
    items.map((tx, index) => ({
      tx,
      dayOrder: items.length - index,
    }));

  const handleDropAt = async (targetDateKey: string, insertIndex: number) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (!draggingId || !dragInfo) {
      return;
    }
    const sourceGroup = groupData.dateMap.get(dragInfo.dateKey);
    const targetGroup = groupData.dateMap.get(targetDateKey);
    if (!sourceGroup || !targetGroup) {
      return;
    }
    const sameDay = dragInfo.dateKey === targetDateKey;
    if (
      !sameDay &&
      (targetGroup.items.length < 2 ||
        insertIndex === 0 ||
        insertIndex === targetGroup.items.length)
    ) {
      return;
    }
    const moved = sourceGroup.items[dragInfo.index];
    if (!moved) {
      return;
    }
    const sourceItems = sourceGroup.items.filter((tx) => tx.id !== moved.id);
    let targetItems = sameDay ? [...sourceItems] : [...targetGroup.items];
    let clampedIndex = Math.max(
      0,
      Math.min(insertIndex, sourceGroup.items.length)
    );
    if (sameDay && dragInfo.index < insertIndex) {
      clampedIndex = clampedIndex - 1;
    }
    if (clampedIndex < 0) {
      clampedIndex = 0;
    }
    if (clampedIndex > targetItems.length) {
      clampedIndex = targetItems.length;
    }
    targetItems.splice(clampedIndex, 0, moved);

    if (
      sameDay &&
      targetItems.every(
        (tx, index) => tx.id === sourceGroup.items[index]?.id
      )
    ) {
      setIndicator(null);
      setDraggingId(null);
      return;
    }

    const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];
    const pushUpdate = (tx: Transaction, payload: Record<string, unknown>) => {
      if (Object.keys(payload).length > 0) {
        updates.push({ id: tx.id, payload });
      }
    };

    if (sameDay) {
      buildDayOrders(targetItems).forEach(({ tx, dayOrder }) => {
        if (tx.dayOrder !== dayOrder) {
          pushUpdate(tx, { dayOrder });
        }
      });
    } else {
      const targetDateValue = targetDateKey;
      buildDayOrders(targetItems).forEach(({ tx, dayOrder }) => {
        const payload: Record<string, unknown> = {};
        if (tx.dayOrder !== dayOrder) {
          payload.dayOrder = dayOrder;
        }
        if (tx.id === moved.id) {
          payload.occurredAt = targetDateValue;
        }
        pushUpdate(tx, payload);
      });
      buildDayOrders(sourceItems).forEach(({ tx, dayOrder }) => {
        if (tx.dayOrder !== dayOrder) {
          pushUpdate(tx, { dayOrder });
        }
      });
    }

    if (updates.length === 0) {
      setIndicator(null);
      setDraggingId(null);
      return;
    }

    try {
      await Promise.all(
        updates.map((update) =>
          api.updateTransaction(token, update.id, update.payload)
        )
      );
      invalidate();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIndicator(null);
      setDraggingId(null);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLSpanElement>,
    txId: string
  ) => {
    event.dataTransfer.setData("text/plain", txId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(txId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setIndicator(null);
  };

  const handleDragOverRow = (
    event: React.DragEvent<HTMLTableRowElement>,
    dateKey: string,
    index: number
  ) => {
    if (!draggingId) {
      if (indicator) {
        setIndicator(null);
      }
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const before = event.clientY - bounds.top < bounds.height / 2;
    const insertIndex = before ? index : index + 1;
    if (!canDropToPosition(dateKey, insertIndex)) {
      if (indicator) {
        setIndicator(null);
      }
      return;
    }
    if (
      dragInfo &&
      dragInfo.dateKey === dateKey &&
      (insertIndex === dragInfo.index || insertIndex === dragInfo.index + 1)
    ) {
      if (indicator) {
        setIndicator(null);
      }
      return;
    }
    event.preventDefault();
    setIndicator({ dateKey, index: insertIndex });
  };

  const handleDropOnRow = async (
    event: React.DragEvent<HTMLTableRowElement>,
    dateKey: string,
    index: number
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const before = event.clientY - bounds.top < bounds.height / 2;
    const insertIndex = before ? index : index + 1;
    if (
      dragInfo &&
      dragInfo.dateKey === dateKey &&
      (insertIndex === dragInfo.index || insertIndex === dragInfo.index + 1)
    ) {
      return;
    }
    if (!canDropToPosition(dateKey, insertIndex)) {
      return;
    }
    event.preventDefault();
    await handleDropAt(dateKey, insertIndex);
  };

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
          {table.getRowModel().rows.map((row) => {
            const info = groupData.idMap.get(row.original.id);
            const dateKey = info?.dateKey ?? toDateKey(row.original.occurredAt);
            const indexInGroup = info?.index ?? 0;
            const groupLength =
              groupData.dateMap.get(dateKey)?.items.length ?? 1;
            const showTopIndicator =
              indicator?.dateKey === dateKey && indicator.index === indexInGroup;
            const showBottomIndicator =
              indicator?.dateKey === dateKey &&
              indicator.index === groupLength &&
              indexInGroup === groupLength - 1;

            if (editingId === row.original.id) {
              return (
                <EditableRow
                  key={row.id}
                  transaction={row.original}
                  assets={assets}
                  categories={categories}
                  fixedAssetId={fixedAssetId}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const indicatorStyle =
              showTopIndicator
                ? { boxShadow: "inset 0 2px 0 0 rgb(56 189 248)" }
                : showBottomIndicator
                  ? { boxShadow: "inset 0 -2px 0 0 rgb(56 189 248)" }
                  : undefined;
            return (
              <tr
                key={row.id}
                className={`border-t hover:bg-secondary/30 ${
                  selectedId === row.original.id ? "bg-secondary/40" : ""
                } ${draggingId === row.original.id ? "opacity-40" : ""}`}
                onClick={() => {
                  setSelectedId(row.original.id);
                  setEditingId(row.original.id);
                }}
                onDragOver={(event) =>
                  handleDragOverRow(event, dateKey, indexInGroup)
                }
                onDrop={(event) =>
                  handleDropOnRow(event, dateKey, indexInGroup)
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const isDateCell = cell.column.id === "occurredAt";
                  return (
                    <td
                      key={cell.id}
                      className={`p-3 align-top ${
                        (cell.column.columnDef.meta as ColumnMeta | undefined)
                          ?.cellClassName ?? ""
                      }`}
                      style={indicatorStyle}
                    >
                      {isDateCell ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="cursor-grab text-muted-foreground"
                            draggable
                            onDragStart={(event) =>
                              handleDragStart(event, row.original.id)
                            }
                            onDragEnd={handleDragEnd}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="ならびかえ"
                          >
                            ≡
                          </span>
                          <span>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </span>
                        </div>
                      ) : (
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
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
