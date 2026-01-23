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
  label?: string;
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
    type: Transaction["type"];
    occurredAt: string;
    amount: string;
    memo: string;
    assetId?: string;
    categoryName?: string;
    merchant?: string;
    source?: string;
    counterparty?: string;
    fromAssetId?: string;
    toAssetId?: string;
    transferDirection?: "out" | "in";
  }>({
    type: transaction.type,
    occurredAt: transaction.occurredAt.slice(0, 10),
    amount: String(transaction.amount),
    memo: transaction.memo ?? "",
    assetId: transaction.type === "transfer" ? undefined : transaction.assetId,
    categoryName: transaction.type === "transfer" ? undefined : transaction.categoryName,
    merchant: transaction.type === "expense" ? transaction.merchant ?? "" : undefined,
    source: transaction.type === "income" ? transaction.source ?? "" : undefined,
    counterparty: transaction.type === "transfer" ? transaction.counterparty ?? "" : undefined,
    fromAssetId: transaction.type === "transfer" ? transaction.fromAssetId : undefined,
    toAssetId: transaction.type === "transfer" ? transaction.toAssetId : undefined,
    transferDirection:
      transaction.type === "transfer"
        ? fixedAssetId && transaction.toAssetId === fixedAssetId
          ? "in"
          : "out"
        : undefined,
  });

  const expenseCategories = categories.filter(
    (category) => category.kind !== "income" && category.name !== "その他"
  );
  const incomeCategories = categories.filter(
    (category) => category.kind === "income" && category.name !== "その他"
  );

  const withCustomCategory = (
    base: Category[],
    kind: "expense" | "income"
  ) => {
    if (form.type !== kind) {
      return base;
    }
    if (!form.categoryName || form.categoryName === "その他") {
      return base;
    }
    if (base.some((category) => category.name === form.categoryName)) {
      return base;
    }
    return [
      {
        id: "custom",
        name: form.categoryName,
        isActive: true,
        sortOrder: 0,
        kind,
      },
      ...base,
    ];
  };

  const availableExpenseCategories = withCustomCategory(expenseCategories, "expense");
  const availableIncomeCategories = withCustomCategory(incomeCategories, "income");
  const categoryValue =
    form.type === "expense" || form.type === "income"
      ? form.categoryName
        ? `${form.type}::${form.categoryName}`
        : ""
      : "";

  const handleSave = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (form.amount === "" || Number.isNaN(Number(form.amount))) {
      toast.error("きんがくを いれてね");
      return;
    }
    if (form.type === "expense" || form.type === "income") {
      if (!form.assetId) {
        toast.error("いれものを えらんでね");
        return;
      }
      if (!form.categoryName) {
        toast.error("つかいみちを えらんでね");
        return;
      }
    }
    if (form.type === "transfer") {
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
      if (form.type === "expense") {
        payload = {
          ...payload,
          type: "expense",
          assetId: form.assetId,
          categoryName: form.categoryName,
          merchant: form.merchant || undefined,
        };
      }
      if (form.type === "income") {
        payload = {
          ...payload,
          type: "income",
          assetId: form.assetId,
          categoryName: form.categoryName,
          source: form.source || undefined,
        };
      }
      if (form.type === "transfer") {
        payload = {
          ...payload,
          type: "transfer",
          fromAssetId: form.fromAssetId,
          toAssetId: form.toAssetId,
          counterparty: form.counterparty || undefined,
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
    form.type !== "transfer" &&
    form.assetId === fixedAssetId;
  const disableTransferAsset = Boolean(fixedAssetId) && form.type === "transfer";

  const transferDirection = form.transferDirection ?? "out";
  const transferBaseAssetId = fixedAssetId
    ? fixedAssetId
    : transferDirection === "out"
      ? form.fromAssetId
      : form.toAssetId;
  const transferValue =
    transferDirection === "out"
      ? form.toAssetId
        ? `transfer-out::${form.toAssetId}`
        : ""
      : form.fromAssetId
        ? `transfer-in::${form.fromAssetId}`
        : "";

  return (
    <tr
      onKeyDown={handleKeyDown}
      className="border-t bg-secondary/30 ledger-row ledger-row--edit"
    >
      <td className="p-2" data-label="ひづけ">
        <Input
          type="date"
          value={form.occurredAt}
          onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
        />
      </td>
      <td className="p-2" data-label="いれもの">
        {form.type === "transfer" ? (
          <Select
            value={fixedAssetId ?? (transferDirection === "out"
              ? form.fromAssetId ?? ""
              : form.toAssetId ?? "")}
            onValueChange={(value) =>
              transferDirection === "out"
                ? setForm({ ...form, fromAssetId: value })
                : setForm({ ...form, toAssetId: value })
            }
            disabled={disableTransferAsset}
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
      <td className="p-2" data-label="あいて">
        {form.type === "expense" ? (
          <Input
            list="merchant-suggest"
            placeholder="あいて"
            value={form.merchant ?? ""}
            onChange={(event) => setForm({ ...form, merchant: event.target.value })}
          />
        ) : form.type === "income" ? (
          <Input
            list="source-suggest"
            placeholder="あいて"
            value={form.source ?? ""}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
          />
        ) : (
          <Input
            placeholder="あいて"
            value={form.counterparty ?? ""}
            onChange={(event) =>
              setForm({ ...form, counterparty: event.target.value })
            }
          />
        )}
      </td>
      <td className="p-2" data-label="うごき">
        {form.type === "transfer" ? (
          <Select
            value={transferValue}
            onValueChange={(value) => {
              const [type, ...rest] = value.split("::");
              const id = rest.join("::");
              const baseAssetId = transferBaseAssetId ?? "";
              if (type === "transfer-out") {
                setForm({
                  ...form,
                  transferDirection: "out",
                  fromAssetId: baseAssetId,
                  toAssetId: id ?? "",
                });
              }
              if (type === "transfer-in") {
                setForm({
                  ...form,
                  transferDirection: "in",
                  fromAssetId: id ?? "",
                  toAssetId: baseAssetId,
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="うごき" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 pt-2 text-xs text-muted-foreground">だした</div>
              {assets
                .filter((asset) => asset.id !== transferBaseAssetId)
                .map((asset) => (
                  <SelectItem
                    key={`transfer-out:${asset.id}`}
                    value={`transfer-out::${asset.id}`}
                  >
                    →{asset.name} へ
                  </SelectItem>
                ))}
              <div className="px-2 pt-2 text-xs text-muted-foreground">いれた</div>
              {assets
                .filter((asset) => asset.id !== transferBaseAssetId)
                .map((asset) => (
                  <SelectItem
                    key={`transfer-in:${asset.id}`}
                    value={`transfer-in::${asset.id}`}
                  >
                    ←{asset.name} から
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={categoryValue}
            onValueChange={(value) => {
              const [type, ...rest] = value.split("::");
              const name = rest.join("::");
              if (type === "expense" || type === "income") {
                setForm({
                  ...form,
                  type,
                  categoryName: name ?? "",
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="うごき" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 pt-2 text-xs text-muted-foreground">だした</div>
              {availableExpenseCategories.map((category) => (
                <SelectItem
                  key={`expense:${category.name}`}
                  value={`expense::${category.name}`}
                >
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value="expense::その他">その他</SelectItem>
              <div className="px-2 pt-2 text-xs text-muted-foreground">いれた</div>
              {availableIncomeCategories.map((category) => (
                <SelectItem
                  key={`income:${category.name}`}
                  value={`income::${category.name}`}
                >
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value="income::その他">その他</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-2" data-label="メモ">
        <Input
          list="memo-suggest"
          placeholder="メモ"
          value={form.memo}
          onChange={(event) => setForm({ ...form, memo: event.target.value })}
        />
      </td>
      <td className="p-2" data-label="きんがく">
        <Input
          type="number"
          placeholder="きんがく"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
        />
      </td>
      <td
        className="p-2 text-right w-[120px] min-w-[120px] max-w-[120px]"
        data-label=""
      >
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={isSaving}
            aria-label="ほぞん"
            className="h-7 w-7"
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
            className="h-7 w-7"
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
            className="h-7 w-7"
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
  balancesById,
  openingBalances,
  openingDate,
  order,
}: {
  transactions: Transaction[];
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
  balancesById?: Record<string, number>;
  openingBalances?: Record<string, number>;
  openingDate?: string;
  order: "desc" | "asc";
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

  const openingBalanceValue = useMemo(() => {
    if (!openingBalances) {
      return null;
    }
    if (fixedAssetId) {
      return openingBalances[fixedAssetId] ?? 0;
    }
    return Object.values(openingBalances).reduce((sum, value) => sum + value, 0);
  }, [openingBalances, fixedAssetId]);

  const openingBalanceText =
    openingBalanceValue === null ? "-" : formatJPYPlain(openingBalanceValue);
  const openingDateText = openingDate ? formatDateSlash(openingDate) : "-";
  const isDesc = order === "desc";

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
          label: "ひづけ",
          headerClassName: "min-w-[120px] whitespace-nowrap",
          cellClassName: "min-w-[120px] whitespace-nowrap",
        },
      },
      {
        header: "いれもの",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            if (fixedAssetId) {
              return assetName(fixedAssetId);
            }
            return assetName(tx.fromAssetId);
          }
          return assetName(tx.assetId);
        },
        meta: {
          label: "いれもの",
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
          return tx.counterparty ?? "";
        },
        meta: {
          label: "あいて",
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
          if (fixedAssetId && tx.toAssetId === fixedAssetId) {
            return `いれた: ←${assetName(tx.fromAssetId)} から`;
          }
          return `だした: →${assetName(tx.toAssetId)} へ`;
        },
        meta: {
          label: "うごき",
          headerClassName: "min-w-[200px] whitespace-nowrap",
          cellClassName: "min-w-[200px] whitespace-nowrap",
        },
      },
      {
        header: "メモ",
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            if (tx.memo) {
              return tx.memo;
            }
            return tx.fee ? `てすうりょう ${formatJPYPlain(tx.fee)}` : "";
          }
          return tx.memo ?? "";
        },
        meta: {
          label: "メモ",
          headerClassName: "min-w-[160px] whitespace-nowrap",
          cellClassName: "min-w-[160px] whitespace-nowrap",
        },
      },
      {
        header: "きんがく",
        cell: ({ row }) => formatJPYPlain(row.original.amount),
        meta: {
          label: "きんがく",
          headerClassName: "min-w-[120px] whitespace-nowrap",
          cellClassName: "min-w-[120px] whitespace-nowrap text-right",
        },
      },
      {
        header: "ざんだか",
        cell: ({ row }) => {
          if (!balancesById) {
            return "-";
          }
          const value = balancesById[row.original.id];
          if (value === undefined) {
            return "-";
          }
          return formatJPYPlain(value);
        },
        meta: {
          label: "ざんだか",
          headerClassName:
            "min-w-[120px] w-[120px] max-w-[120px] whitespace-nowrap",
          cellClassName:
            "min-w-[120px] w-[120px] max-w-[120px] whitespace-nowrap text-right",
        },
      },
    ],
    [assetMap, balancesById, fixedAssetId]
  );

  const sorted = useMemo(() => {
    const withIndex = transactions.map((tx, index) => ({ tx, index }));
    withIndex.sort((a, b) => {
      const dateA = toDateKey(a.tx.occurredAt);
      const dateB = toDateKey(b.tx.occurredAt);
      if (dateA !== dateB) {
        return order === "desc"
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB);
      }
      const orderA = a.tx.dayOrder ?? 0;
      const orderB = b.tx.dayOrder ?? 0;
      if (orderA !== orderB) {
        return order === "desc" ? orderB - orderA : orderA - orderB;
      }
      return a.index - b.index;
    });
    return withIndex.map((item) => item.tx);
  }, [transactions, order]);

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
      dayOrder: order === "desc" ? items.length - index : index + 1,
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
    <div className="rounded-lg border bg-card/80 shadow-sm">
      <div className="max-h-[65vh] overflow-auto p-2 md:p-0">
        <table className="ledger-table w-full border-collapse text-sm md:min-w-[1100px]">
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
          {isDesc ? (
            <NewEntryRow
              assets={assets}
              categories={categories}
              fixedAssetId={fixedAssetId}
            />
          ) : null}
          {!isDesc ? (
            <tr className="border-t bg-secondary/10 ledger-row">
              <td className="p-3" data-label="ひづけ">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground opacity-0" aria-hidden>
                    ≡
                  </span>
                  <span>{openingDateText}</span>
                </div>
              </td>
              <td
                colSpan={table.getAllLeafColumns().length - 2}
                className="p-3 ledger-spacer"
                data-label=""
              />
              <td
                className="p-3 text-right w-[120px] min-w-[120px] max-w-[120px]"
                data-label="ざんだか"
              >
                {openingBalanceText}
              </td>
            </tr>
          ) : null}
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

            const dropClass = showTopIndicator
              ? "ledger-drop-top"
              : showBottomIndicator
                ? "ledger-drop-bottom"
                : "";
            return (
              <tr
                key={row.id}
                className={`border-t hover:bg-secondary/30 ledger-row ${dropClass} ${
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
                  const label =
                    (cell.column.columnDef.meta as ColumnMeta | undefined)
                      ?.label ?? "";
                  return (
                    <td
                      key={cell.id}
                      className={`p-3 align-top ${
                        (cell.column.columnDef.meta as ColumnMeta | undefined)
                          ?.cellClassName ?? ""
                      }`}
                      data-label={label}
                    >
                      {isDateCell ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="ledger-handle cursor-grab text-muted-foreground"
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
          {isDesc ? (
            <tr className="border-t bg-secondary/10 ledger-row">
              <td className="p-3" data-label="ひづけ">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground opacity-0" aria-hidden>
                    ≡
                  </span>
                  <span>{openingDateText}</span>
                </div>
              </td>
              <td
                colSpan={table.getAllLeafColumns().length - 2}
                className="p-3 ledger-spacer"
                data-label=""
              />
              <td
                className="p-3 text-right w-[120px] min-w-[120px] max-w-[120px]"
                data-label="ざんだか"
              >
                {openingBalanceText}
              </td>
            </tr>
          ) : null}
          {!isDesc ? (
            <NewEntryRow
              assets={assets}
              categories={categories}
              fixedAssetId={fixedAssetId}
            />
          ) : null}
        </tbody>
        </table>
      </div>
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
