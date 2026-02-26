import React, { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Check, RefreshCw, Trash2, X } from "lucide-react";
import type { Asset, Category, Transaction } from "@/lib/types";
import { formatDateSlash, toDateKey } from "@/lib/date";
import { formatJPYPlain } from "@/lib/money";
import { compareTransactionsInDay } from "@/lib/transaction-order";
import {
  api,
  getOfflineSyncStatus,
  isNetworkError,
  OFFLINE_SYNC_STATUS_CHANGED_EVENT,
  type OfflineSyncStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInvalidateLedger } from "@/lib/query";
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
import { useText } from "@/lib/text";
import {
  MAX_AMOUNT,
  MAX_MEMO_LENGTH,
  MAX_NAME_LENGTH,
  MIN_AMOUNT,
} from "@/lib/limits";

type ColumnMeta = {
  label?: string;
  colKey?: string;
  headerClassName?: string;
  cellClassName?: string;
};

const OTHER_CATEGORY_NAME = "その他";

const EditableRow = ({
  transaction,
  assets,
  categories,
  fixedAssetId,
  fixedAssetName,
  onCancel,
  onDeleted,
}: {
  transaction: Transaction;
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
  fixedAssetName?: string;
  onCancel: () => void;
  onDeleted?: (txId: string) => void;
}) => {
  const { t } = useText();
  const { token, childId } = useAuth();
  const invalidate = useInvalidateLedger();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<{
    type: Transaction["type"];
    occurredAt: string;
    amount: string;
    memo: string;
    assetId?: string;
    assetName?: string;
    categoryId?: string;
    categoryName?: string;
    merchant?: string;
    source?: string;
    counterparty?: string;
    fromAssetId?: string;
    fromAssetName?: string;
    toAssetId?: string;
    toAssetName?: string;
    transferDirection?: "out" | "in";
  }>({
    type: transaction.type,
    occurredAt: transaction.occurredAt.slice(0, 10),
    amount: String(transaction.amount),
    memo: transaction.memo ?? "",
    assetId: transaction.type === "transfer" ? undefined : transaction.assetId,
    assetName: transaction.type === "transfer" ? undefined : transaction.assetName,
    categoryId: transaction.type === "transfer" ? undefined : transaction.categoryId,
    categoryName: transaction.type === "transfer" ? undefined : transaction.categoryName,
    merchant: transaction.type === "expense" ? transaction.merchant ?? "" : undefined,
    source: transaction.type === "income" ? transaction.source ?? "" : undefined,
    counterparty: transaction.type === "transfer" ? transaction.counterparty ?? "" : undefined,
    fromAssetId: transaction.type === "transfer" ? transaction.fromAssetId : undefined,
    fromAssetName: transaction.type === "transfer" ? transaction.fromAssetName : undefined,
    toAssetId: transaction.type === "transfer" ? transaction.toAssetId : undefined,
    toAssetName: transaction.type === "transfer" ? transaction.toAssetName : undefined,
    transferDirection:
      transaction.type === "transfer"
        ? (fixedAssetId
            ? transaction.toAssetId === fixedAssetId
            : fixedAssetName
              ? transaction.toAssetName === fixedAssetName
              : false)
          ? "in"
          : "out"
        : undefined,
  });

  const expenseCategories = categories.filter(
    (category) => category.kind !== "income" && category.name !== OTHER_CATEGORY_NAME
  );
  const incomeCategories = categories.filter(
    (category) => category.kind === "income" && category.name !== OTHER_CATEGORY_NAME
  );

  const withCustomCategory = (
    base: Category[],
    kind: "expense" | "income"
  ) => {
    if (form.type !== kind) {
      return base;
    }
    if (!form.categoryName || form.categoryName === OTHER_CATEGORY_NAME) {
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
  const findAssetByName = (name: string) =>
    assets.find((asset) => asset.name === name);
  const findCategoryByName = (name: string, kind: "expense" | "income") =>
    categories.find((category) => category.name === name && category.kind === kind);
  const categoryValue =
    form.type === "expense" || form.type === "income"
      ? form.categoryName
        ? `${form.type}::${form.categoryName}`
        : ""
      : "";

  const hasAmount = form.amount.trim() !== "" && !Number.isNaN(Number(form.amount));
  const initialDate = transaction.occurredAt.slice(0, 10);
  const initialMemo = transaction.memo ?? "";
  const initialAmount = transaction.amount;
  const normalizedAmount = Number(form.amount);
  const isAmountInRange =
    hasAmount && normalizedAmount >= MIN_AMOUNT && normalizedAmount <= MAX_AMOUNT;
  const isDirty = (() => {
    if (form.type !== transaction.type) {
      return true;
    }
    if (form.occurredAt !== initialDate) {
      return true;
    }
    if (Number.isNaN(normalizedAmount) || normalizedAmount !== initialAmount) {
      return true;
    }
    if ((form.memo ?? "") !== initialMemo) {
      return true;
    }
    if (form.type === "expense" && transaction.type === "expense") {
      return (
        (form.assetName ?? "") !== (transaction.assetName ?? "") ||
        (form.categoryName ?? "") !== (transaction.categoryName ?? "") ||
        (form.merchant ?? "") !== (transaction.merchant ?? "")
      );
    }
    if (form.type === "income" && transaction.type === "income") {
      return (
        (form.assetName ?? "") !== (transaction.assetName ?? "") ||
        (form.categoryName ?? "") !== (transaction.categoryName ?? "") ||
        (form.source ?? "") !== (transaction.source ?? "")
      );
    }
    if (form.type === "transfer" && transaction.type === "transfer") {
      return (
        (form.fromAssetName ?? "") !== (transaction.fromAssetName ?? "") ||
        (form.toAssetName ?? "") !== (transaction.toAssetName ?? "") ||
        (form.counterparty ?? "") !== (transaction.counterparty ?? "")
      );
    }
    return true;
  })();
  const isSaveDisabled =
    (form.type === "transfer"
      ? !form.fromAssetName?.trim() || !form.toAssetName?.trim() || !isAmountInRange
      : !form.assetName?.trim() || !form.categoryName?.trim() || !isAmountInRange) ||
    !isDirty;
  const isSaveButtonDisabled = isSaving || isSaveDisabled;
  const saveIconClass = isSaveButtonDisabled ? "text-muted-foreground/40" : "text-emerald-600";

  const selectableAssets = useMemo(() => {
    const existing = new Set(assets.map((asset) => asset.name));
    const extraAssets: Asset[] = [];
    const addIfMissing = (name?: string) => {
      if (!name || existing.has(name)) {
        return;
      }
      existing.add(name);
      extraAssets.push({
        id: `missing-${name}`,
        name,
        type: undefined,
        currency: "JPY",
        isActive: true,
        initialBalance: 0,
        currentBalance: 0,
        note: undefined,
        sortOrder: 0,
      });
    };
    addIfMissing(form.assetName);
    addIfMissing(form.fromAssetName);
    addIfMissing(form.toAssetName);
    return [...extraAssets, ...assets];
  }, [assets, form.assetName, form.fromAssetName, form.toAssetName]);

  const handleSave = async () => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
      return;
    }
    if (!isDirty) {
      return;
    }
    if (form.amount === "" || Number.isNaN(Number(form.amount))) {
      toast.error(t("toastAmountRequired"));
      return;
    }
    if (normalizedAmount < MIN_AMOUNT || normalizedAmount > MAX_AMOUNT) {
      toast.error(t("toastAmountRange"));
      return;
    }
    if (form.type === "expense" || form.type === "income") {
      if (!form.assetName) {
        toast.error(t("toastAssetRequired"));
        return;
      }
      if (!form.categoryName) {
        toast.error(t("toastCategoryRequired"));
        return;
      }
    }
    if (form.type === "transfer") {
      if (!form.fromAssetName || !form.toAssetName) {
        toast.error(t("toastTransferAssetRequired"));
        return;
      }
      if (
        (form.fromAssetId && form.toAssetId && form.fromAssetId === form.toAssetId) ||
        form.fromAssetName === form.toAssetName
      ) {
        toast.error(t("toastTransferSameAsset"));
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
        const resolvedAssetId =
          form.assetId ?? findAssetByName(form.assetName ?? "")?.id;
        const resolvedCategoryId =
          form.categoryId ?? findCategoryByName(form.categoryName ?? "", "expense")?.id;
        payload = {
          ...payload,
          type: "expense",
          assetId: resolvedAssetId,
          assetName: form.assetName,
          categoryId: resolvedCategoryId,
          categoryName: form.categoryName,
          merchant: form.merchant || undefined,
        };
      }
      if (form.type === "income") {
        const resolvedAssetId =
          form.assetId ?? findAssetByName(form.assetName ?? "")?.id;
        const resolvedCategoryId =
          form.categoryId ?? findCategoryByName(form.categoryName ?? "", "income")?.id;
        payload = {
          ...payload,
          type: "income",
          assetId: resolvedAssetId,
          assetName: form.assetName,
          categoryId: resolvedCategoryId,
          categoryName: form.categoryName,
          source: form.source || undefined,
        };
      }
      if (form.type === "transfer") {
        const resolvedFromId =
          form.fromAssetId ?? findAssetByName(form.fromAssetName ?? "")?.id;
        const resolvedToId =
          form.toAssetId ?? findAssetByName(form.toAssetName ?? "")?.id;
        payload = {
          ...payload,
          type: "transfer",
          fromAssetId: resolvedFromId,
          fromAssetName: form.fromAssetName,
          toAssetId: resolvedToId,
          toAssetName: form.toAssetName,
          counterparty: form.counterparty || undefined,
        };
      }
      await api.updateTransaction(token, transaction.id, payload, childId);
      toast.success(t("toastEntryUpdated"));
      invalidate();
      onCancel();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
      return;
    }
    const ok = window.confirm(t("confirmDeleteEntry"));
    if (!ok) {
      return;
    }
    try {
      setIsSaving(true);
      await api.deleteTransaction(token, transaction.id, childId);
      toast.success(t("toastEntryDeleted"));
      onDeleted?.(transaction.id);
      invalidate(transaction.id);
      onCancel();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
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

  const disableAsset = Boolean(
    Boolean(fixedAssetId || fixedAssetName) &&
      form.type !== "transfer" &&
      ((fixedAssetId && form.assetId === fixedAssetId) ||
        (!form.assetId && fixedAssetName && form.assetName === fixedAssetName))
  );
  const disableTransferAsset = Boolean(fixedAssetId || fixedAssetName) && form.type === "transfer";

  const transferDirection = form.transferDirection ?? "out";
  const placeholderValue = "__placeholder__";
  const assetPlaceholderValue = "__asset_placeholder__";
  const transferBaseAssetName = fixedAssetName
    ? fixedAssetName
    : transferDirection === "out"
      ? form.fromAssetName
      : form.toAssetName;
  const transferBaseAssetId = fixedAssetId
    ? fixedAssetId
    : transferDirection === "out"
      ? form.fromAssetId
      : form.toAssetId;
  const transferValue =
    transferDirection === "out"
      ? form.toAssetName
        ? `transfer-out::${form.toAssetName}`
        : ""
      : form.fromAssetName
        ? `transfer-in::${form.fromAssetName}`
        : "";

  return (
    <tr
      onKeyDown={handleKeyDown}
      className="border-t bg-card ledger-row ledger-row--edit"
    >
      <td className="p-2" data-label={t("labelDate")} data-col="date">
        <Input
          type="date"
          value={form.occurredAt}
          onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
        />
      </td>
      <td className="p-2" data-label={t("labelAsset")} data-col="asset">
        {form.type === "transfer" ? (
          <Select
            value={fixedAssetName ?? (transferDirection === "out"
              ? form.fromAssetName ?? ""
              : form.toAssetName ?? "")}
            onValueChange={(value) => {
              if (value === assetPlaceholderValue) {
                if (transferDirection === "out") {
                  setForm({ ...form, fromAssetId: "", fromAssetName: "" });
                } else {
                  setForm({ ...form, toAssetId: "", toAssetName: "" });
                }
                return;
              }
              const selected = findAssetByName(value);
              transferDirection === "out"
                ? setForm({ ...form, fromAssetId: selected?.id, fromAssetName: value })
                : setForm({ ...form, toAssetId: selected?.id, toAssetName: value });
            }}
            disabled={disableTransferAsset}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("placeholderAsset")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={assetPlaceholderValue}
                className="text-muted-foreground"
              >
                {t("placeholderAsset")}
              </SelectItem>
              {selectableAssets.map((asset) => (
                <SelectItem key={asset.id} value={asset.name}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={form.assetName ?? ""}
            onValueChange={(value) => {
              if (value === assetPlaceholderValue) {
                setForm({ ...form, assetId: "", assetName: "" });
                return;
              }
              const selected = findAssetByName(value);
              setForm({ ...form, assetId: selected?.id, assetName: value });
            }}
            disabled={disableAsset}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("placeholderAsset")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={assetPlaceholderValue}
                className="text-muted-foreground"
              >
                {t("placeholderAsset")}
              </SelectItem>
              {selectableAssets.map((asset) => (
                <SelectItem key={asset.id} value={asset.name}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-2" data-label={t("labelCounterparty")} data-col="counterparty">
        {form.type === "expense" ? (
          <Input
            list="merchant-suggest"
            placeholder={t("placeholderCounterparty")}
            value={form.merchant ?? ""}
            onChange={(event) => setForm({ ...form, merchant: event.target.value })}
            maxLength={MAX_NAME_LENGTH}
          />
        ) : form.type === "income" ? (
          <Input
            list="source-suggest"
            placeholder={t("placeholderCounterparty")}
            value={form.source ?? ""}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
            maxLength={MAX_NAME_LENGTH}
          />
        ) : (
          <Input
            placeholder={t("placeholderCounterparty")}
            value={form.counterparty ?? ""}
            onChange={(event) =>
              setForm({ ...form, counterparty: event.target.value })
            }
            maxLength={MAX_NAME_LENGTH}
          />
        )}
      </td>
      <td className="p-2" data-label={t("labelCategory")} data-col="category">
        {form.type === "transfer" ? (
          <Select
            value={transferValue}
            onValueChange={(value) => {
              if (value === placeholderValue) {
                const baseAssetName = fixedAssetName ?? form.assetName ?? "";
                const baseAssetId = fixedAssetId ?? form.assetId ?? "";
                setForm({
                  ...form,
                  type: "expense",
                  assetId: baseAssetId,
                  assetName: baseAssetName,
                  categoryId: "",
                  categoryName: "",
                  transferDirection: "out",
                  fromAssetId: undefined,
                  fromAssetName: undefined,
                  toAssetId: undefined,
                  toAssetName: undefined,
                });
                return;
              }
              const [type, ...rest] = value.split("::");
              const id = rest.join("::");
              const baseAssetName = transferBaseAssetName ?? "";
              const baseAssetId = transferBaseAssetId ?? "";
              const selected = findAssetByName(id);
              if (type === "transfer-out") {
                setForm({
                  ...form,
                  transferDirection: "out",
                  fromAssetId: baseAssetId,
                  fromAssetName: baseAssetName,
                  toAssetId: selected?.id,
                  toAssetName: id ?? "",
                  categoryId: "",
                  categoryName: "",
                });
              }
              if (type === "transfer-in") {
                setForm({
                  ...form,
                  transferDirection: "in",
                  fromAssetId: selected?.id,
                  fromAssetName: id ?? "",
                  toAssetId: baseAssetId,
                  toAssetName: baseAssetName,
                  categoryId: "",
                  categoryName: "",
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("placeholderCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={placeholderValue} className="text-muted-foreground">
                {t("placeholderCategory")}
              </SelectItem>
              <div className="px-2 pt-2 text-xs text-muted-foreground">
                {t("labelExpense")}
              </div>
              {selectableAssets
                .filter((asset) => asset.id !== transferBaseAssetId)
                .map((asset) => (
                  <SelectItem
                    key={`transfer-out:${asset.id}`}
                    value={`transfer-out::${asset.name}`}
                  >
                    {t("transferToOption", { assetName: asset.name })}
                  </SelectItem>
                ))}
              <div className="px-2 pt-2 text-xs text-muted-foreground">
                {t("labelIncome")}
              </div>
              {selectableAssets
                .filter((asset) => asset.id !== transferBaseAssetId)
                .map((asset) => (
                  <SelectItem
                    key={`transfer-in:${asset.id}`}
                    value={`transfer-in::${asset.name}`}
                  >
                    {t("transferFromOption", { assetName: asset.name })}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={categoryValue}
            onValueChange={(value) => {
              if (value === placeholderValue) {
                setForm({ ...form, categoryId: "", categoryName: "" });
                return;
              }
              const [type, ...rest] = value.split("::");
              const name = rest.join("::");
              if (type === "expense" || type === "income") {
                const selected = findCategoryByName(name ?? "", type);
                setForm({
                  ...form,
                  type,
                  categoryId: selected?.id,
                  categoryName: name ?? "",
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("placeholderCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={placeholderValue} className="text-muted-foreground">
                {t("placeholderCategory")}
              </SelectItem>
              <div className="px-2 pt-2 text-xs text-muted-foreground">
                {t("labelExpense")}
              </div>
              {availableExpenseCategories.map((category) => (
                <SelectItem
                  key={`expense:${category.name}`}
                  value={`expense::${category.name}`}
                >
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value={`expense::${OTHER_CATEGORY_NAME}`}>
                {t("labelOther")}
              </SelectItem>
              <div className="px-2 pt-2 text-xs text-muted-foreground">
                {t("labelIncome")}
              </div>
              {availableIncomeCategories.map((category) => (
                <SelectItem
                  key={`income:${category.name}`}
                  value={`income::${category.name}`}
                >
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value={`income::${OTHER_CATEGORY_NAME}`}>
                {t("labelOther")}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-2" data-label={t("labelMemo")} data-col="memo">
        <Input
          list="memo-suggest"
          placeholder={t("placeholderMemo")}
          value={form.memo}
          onChange={(event) => setForm({ ...form, memo: event.target.value })}
          maxLength={MAX_MEMO_LENGTH}
        />
      </td>
      <td className="p-2" data-label={t("labelAmount")} data-col="amount">
        <div className="ledger-amount-inline">
          <Input
            type="number"
            placeholder={t("placeholderAmount")}
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
          />
          <div className="ledger-inline-actions">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={isSaveButtonDisabled}
              aria-label={t("actionSave")}
              className="h-7 w-7"
            >
              <Check className={`h-4 w-4 ${saveIconClass}`} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancel}
              disabled={isSaving}
              aria-label={t("actionCancel")}
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
              aria-label={t("actionDelete")}
              className="h-7 w-7"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </div>
        </div>
      </td>
      <td
        className="ledger-action-cell p-2 text-right"
        data-label=""
        data-col="action"
      >
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={isSaveButtonDisabled}
            aria-label={t("actionSave")}
            className="h-7 w-7"
          >
            <Check className={`h-4 w-4 ${saveIconClass}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSaving}
            aria-label={t("actionCancel")}
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
            aria-label={t("actionDelete")}
            className="h-7 w-7"
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return matches;
};

export const LedgerTable = ({
  transactions,
  assets,
  categories,
  fixedAssetId,
  fixedAssetName,
  balancesById,
  openingBalances,
  openingDate,
  order,
  onEditingChange,
  renderMode = "full",
  entryRow,
  entryPosition,
}: {
  transactions: Transaction[];
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
  fixedAssetName?: string;
  balancesById?: Record<string, number>;
  openingBalances?: Record<string, number>;
  openingDate?: string;
  order: "desc" | "asc";
  onEditingChange?: (isEditing: boolean) => void;
  renderMode?: "full" | "header-only" | "body-only";
  entryRow?: React.ReactNode;
  entryPosition?: "top" | "bottom";
}) => {
  const { t } = useText();
  const { token, childId } = useAuth();
  const invalidate = useInvalidateLedger();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [indicator, setIndicator] = useState<{ dateKey: string; index: number } | null>(
    null
  );
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>(() =>
    getOfflineSyncStatus()
  );
  const isMobile = useMediaQuery("(max-width: 900px)");

  const openingBalanceValue = useMemo(() => {
    if (!openingBalances) {
      return null;
    }
    if (fixedAssetName) {
      return openingBalances[fixedAssetName] ?? 0;
    }
    return Object.values(openingBalances).reduce((sum, value) => sum + value, 0);
  }, [openingBalances, fixedAssetName]);

  const openingBalanceText =
    openingBalanceValue === null ? "-" : formatJPYPlain(openingBalanceValue);
  const openingDateText = openingDate ? formatDateSlash(openingDate) : "-";
  const isDesc = order === "desc";
  const actualEntryPosition = entryPosition ?? (isDesc ? "top" : "bottom");

  const isIncomingTransfer = (tx: Transaction) => {
    if (tx.type !== "transfer") return false;
    if (fixedAssetId) {
      return tx.toAssetId === fixedAssetId;
    }
    if (fixedAssetName) {
      return tx.toAssetName === fixedAssetName;
    }
    return false;
  };

  const entryRowNode = useMemo(() => {
    if (!entryRow) return null;
    return React.isValidElement(entryRow)
      ? React.cloneElement(entryRow, { key: "entry-row" })
      : entryRow;
  }, [entryRow]);

  useEffect(() => {
    onEditingChange?.(editingId !== null);
  }, [editingId, onEditingChange]);

  useEffect(() => {
    setSyncStatus(getOfflineSyncStatus());
    const handleSyncStatusChanged = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSyncStatus>).detail;
      setSyncStatus(detail);
    };
    window.addEventListener(
      OFFLINE_SYNC_STATUS_CHANGED_EVENT,
      handleSyncStatusChanged
    );
    return () => {
      window.removeEventListener(
        OFFLINE_SYNC_STATUS_CHANGED_EVENT,
        handleSyncStatusChanged
      );
    };
  }, []);

  const visibleTransactions = useMemo(
    () => transactions.filter((tx) => !deletedIds.has(tx.id)),
    [transactions, deletedIds]
  );

  const suggestions = useMemo(() => {
    const merchants = new Set<string>();
    const sources = new Set<string>();
    const memos = new Set<string>();
    visibleTransactions.forEach((tx) => {
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
  }, [visibleTransactions]);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        header: t("labelDate"),
        accessorKey: "occurredAt",
        cell: ({ row }) => formatDateSlash(row.original.occurredAt),
        meta: {
          label: t("labelDate"),
          colKey: "date",
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
      },
      {
        header: t("labelAsset"),
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            if (isIncomingTransfer(tx)) {
              return tx.toAssetName ?? "";
            }
            return tx.fromAssetName ?? "";
          }
          return tx.assetName ?? "";
        },
        meta: {
          label: t("labelAsset"),
          colKey: "asset",
          headerClassName: "whitespace-normal break-words",
          cellClassName: "whitespace-normal break-words",
        },
      },
      {
        header: t("labelCounterparty"),
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
          label: t("labelCounterparty"),
          colKey: "counterparty",
          headerClassName: "whitespace-normal break-words",
          cellClassName: "whitespace-normal break-words",
        },
      },
      {
        header: t("labelCategory"),
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "expense") {
            return `${t("labelExpense")}: ${tx.categoryName ?? ""}`;
          }
          if (tx.type === "income") {
            return `${t("labelIncome")}: ${tx.categoryName ?? ""}`;
          }
          if (isIncomingTransfer(tx)) {
            return `${t("labelIncome")}: ${t("transferFromOption", {
              assetName: tx.fromAssetName ?? "",
            })}`;
          }
          return `${t("labelExpense")}: ${t("transferToOption", {
            assetName: tx.toAssetName ?? "",
          })}`;
        },
        meta: {
          label: t("labelCategory"),
          colKey: "category",
          headerClassName: "whitespace-normal break-words",
          cellClassName: "whitespace-normal break-words",
        },
      },
      {
        header: t("labelMemo"),
        cell: ({ row }) => {
          const tx = row.original;
          if (tx.type === "transfer") {
            if (tx.memo) {
              return tx.memo;
            }
            return tx.fee
              ? `${t("labelTransferFee")} ${formatJPYPlain(tx.fee)}`
              : "";
          }
          return tx.memo ?? "";
        },
        meta: {
          label: t("labelMemo"),
          colKey: "memo",
          headerClassName: "whitespace-normal break-words",
          cellClassName: "whitespace-normal break-words",
        },
      },
      {
        header: t("labelAmount"),
        accessorKey: "amount",
        cell: ({ row }) => formatJPYPlain(row.original.amount),
        meta: {
          label: t("labelAmount"),
          colKey: "amount",
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap text-right",
        },
      },
      {
        header: t("labelBalance"),
        cell: ({ row }) => {
          if (!balancesById) {
            return "-";
          }
          const value = balancesById[row.original.id];
          if (value === undefined) {
            return "-";
          }
          const isPending =
            Boolean(row.original.pendingSync || row.original.pendingOperation);
          const isSyncingThisRow =
            isPending &&
            syncStatus.isSyncing &&
            syncStatus.syncingTxId === row.original.id;
          return (
            <span className="inline-flex w-full items-center justify-end gap-1.5">
              {isPending ? (
                <span
                  className="inline-flex items-center text-amber-700"
                  title="同期待ち"
                  aria-label="同期待ち"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      isSyncingThisRow ? "animate-spin" : ""
                    }`}
                  />
                </span>
              ) : null}
              <span>{formatJPYPlain(value)}</span>
            </span>
          );
        },
        meta: {
          label: t("labelBalance"),
          colKey: "balance",
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap text-right",
        },
      },
    ],
    [balancesById, fixedAssetId, fixedAssetName, syncStatus, t]
  );

  const sorted = useMemo(() => {
    const withIndex = visibleTransactions.map((tx, index) => ({ tx, index }));
    withIndex.sort((a, b) => {
      const dateA = toDateKey(a.tx.occurredAt);
      const dateB = toDateKey(b.tx.occurredAt);
      if (dateA !== dateB) {
        return order === "desc"
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB);
      }
      const sameDayCmp = compareTransactionsInDay(a.tx, b.tx, order);
      if (sameDayCmp !== 0) {
        return sameDayCmp;
      }
      return a.index - b.index;
    });
    return withIndex.map((item) => item.tx);
  }, [visibleTransactions, order]);

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
    getRowId: (row) => row.id,
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
      toast.error(t("toastLoginRequired"));
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
          api.updateTransaction(token, update.id, update.payload, childId)
        )
      );
      invalidate();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    } finally {
      setIndicator(null);
      setDraggingId(null);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLElement>,
    txId: string
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest("input, textarea, select, button, a")) {
      event.preventDefault();
      return;
    }
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
    <div
      className="ledger-table-wrap flex flex-col bg-transparent shadow-none min-w-0 max-w-full"
      data-order={isDesc ? "desc" : "asc"}
    >
      <div className="overflow-x-visible p-0 max-w-full">
        <table className="ledger-table w-full border-collapse text-sm m-0">
        <colgroup>
          <col style={{ width: '160px' }} />
          <col />
          <col />
          <col />
          <col />
          <col style={{ width: '120px' }} />
          <col style={{ width: '120px' }} />
        </colgroup>
        {renderMode !== "body-only" ? (
          <thead className="">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="ledger-table-header-row">
                {headerGroup.headers.map((header) => {
                  return (
                    <th
                      key={header.id}
                      className={`p-3 text-center font-medium ${
                        (header.column.columnDef.meta as ColumnMeta | undefined)?.headerClassName ??
                        ""
                      }`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
            {actualEntryPosition === "top" ? entryRowNode : null}
          </thead>
        ) : null}
        {renderMode !== "header-only" ? (
          <tbody className="ledger-grid">
          {!isDesc ? (
            <tr className="border-t bg-secondary/10 ledger-row ledger-row--opening">
              <td className="p-3" data-label={t("labelDate")} data-col="date">
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
                className="p-3 text-right"
                data-label={t("labelBalance")}
                data-col="balance"
              >
                <span className="ledger-opening-label">{t("labelBalance")}</span>
                <span className="ledger-opening-value">{openingBalanceText}</span>
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
                  fixedAssetName={fixedAssetName}
                  onDeleted={(txId) => {
                    setDeletedIds((prev) => {
                      const next = new Set(prev);
                      next.add(txId);
                      return next;
                    });
                    setSelectedId((prev) => (prev === txId ? null : prev));
                  }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const dropClass = showTopIndicator
              ? "ledger-drop-top"
              : showBottomIndicator
                ? "ledger-drop-bottom"
                : "";
            const cellMap = new Map<string, ReturnType<typeof flexRender>>();
            row.getVisibleCells().forEach((cell) => {
              const colKey =
                (cell.column.columnDef.meta as ColumnMeta | undefined)?.colKey ?? "";
              cellMap.set(colKey, flexRender(cell.column.columnDef.cell, cell.getContext()));
            });
            const dateValue = cellMap.get("date") ?? "-";
            const assetValue = cellMap.get("asset") ?? "-";
            const counterpartyValue = cellMap.get("counterparty") ?? "-";
            const actionValue = cellMap.get("category") ?? "-";
            const memoValue = cellMap.get("memo") ?? "";
            const rawMemo = typeof row.original.memo === "string" ? row.original.memo : "";
            const hasMemo = rawMemo.trim() !== "";
            const amountValue = cellMap.get("amount") ?? "-";
            const balanceValue = cellMap.get("balance") ?? "-";

            if (isMobile) {
              return (
                <tr
                  key={row.id}
                  className={`border-t hover:bg-secondary/30 ledger-row ledger-row--mobile ${dropClass} ${
                    selectedId === row.original.id ? "bg-secondary/40" : ""
                  } ${draggingId === row.original.id ? "opacity-40" : ""}`}
                  onClick={() => {
                    setSelectedId(row.original.id);
                    setEditingId(row.original.id);
                  }}
                  draggable
                  onDragStart={(event) =>
                    handleDragStart(event, row.original.id)
                  }
                  onDragOver={(event) =>
                    handleDragOverRow(event, dateKey, indexInGroup)
                  }
                  onDrop={(event) =>
                    handleDropOnRow(event, dateKey, indexInGroup)
                  }
                  onDragEnd={handleDragEnd}
                >
                  <td colSpan={table.getAllLeafColumns().length} className="p-0">
                    <div className="ledger-mobile-card">
                      <div className="ledger-mobile-row">
                        <div className="ledger-mobile-item ledger-mobile-date">
                          <span
                            className="ledger-handle cursor-grab text-muted-foreground"
                            onDragStart={(event) =>
                              handleDragStart(event, row.original.id)
                            }
                            onDragEnd={handleDragEnd}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("actionReorder")}
                          >
                            ≡
                          </span>
                          <div className="flex flex-col">
                            <span className="ledger-mobile-value ledger-mobile-value--date ledger-mobile-value--nowrap">
                              {dateValue}
                            </span>
                          </div>
                        </div>
                        <div className="ledger-mobile-item">
                          <span className="ledger-mobile-label">{t("labelAsset")}</span>
                          <span className="ledger-mobile-value">{assetValue}</span>
                        </div>
                        <div className="ledger-mobile-item">
                          <span className="ledger-mobile-label">{t("labelCounterparty")}</span>
                          <span className="ledger-mobile-value">{counterpartyValue}</span>
                        </div>
                      </div>
                      <div className="ledger-mobile-row">
                        <div className="ledger-mobile-item">
                          <span className="ledger-mobile-label">{t("labelCategory")}</span>
                          <span className="ledger-mobile-value">{actionValue}</span>
                        </div>
                        <div className="ledger-mobile-item">
                          <span className="ledger-mobile-label">{t("labelAmount")}</span>
                          <span className="ledger-mobile-value ledger-mobile-value--right ledger-mobile-value--nowrap">
                            {amountValue}
                          </span>
                        </div>
                        <div className="ledger-mobile-item">
                          <span className="ledger-mobile-label">{t("labelBalance")}</span>
                          <span className="ledger-mobile-value ledger-mobile-value--right ledger-mobile-value--nowrap">
                            {balanceValue}
                          </span>
                        </div>
                      </div>
                      {hasMemo ? (
                        <div className="ledger-mobile-row ledger-mobile-row--full">
                          <div className="ledger-mobile-item ledger-mobile-item--full">
                            <span className="ledger-mobile-label">{t("labelMemo")}</span>
                            <span className="ledger-mobile-value">{memoValue}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            }

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
                draggable
                onDragStart={(event) =>
                  handleDragStart(event, row.original.id)
                }
                onDragOver={(event) =>
                  handleDragOverRow(event, dateKey, indexInGroup)
                }
                onDrop={(event) =>
                  handleDropOnRow(event, dateKey, indexInGroup)
                }
                onDragEnd={handleDragEnd}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  const label = meta?.label ?? "";
                  const colKey = meta?.colKey ?? "";
                  const isDateCell = colKey === "date";
                  const isAmountCell = colKey === "amount";
                  const balanceValue = balancesById?.[row.original.id];
                  const balanceText =
                    balanceValue === undefined || balanceValue === null
                      ? "-"
                      : formatJPYPlain(balanceValue);
                  return (
                    <td
                      key={cell.id}
                      className={`p-3 align-top ${
                        (cell.column.columnDef.meta as ColumnMeta | undefined)
                          ?.cellClassName ?? ""
                      }`}
                      data-label={label}
                      data-col={colKey}
                    >
                      {isDateCell ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="ledger-handle cursor-grab text-muted-foreground"
                            onDragStart={(event) =>
                              handleDragStart(event, row.original.id)
                            }
                            onDragEnd={handleDragEnd}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("actionReorder")}
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
                      ) : isAmountCell ? (
                        <div className="ledger-amount-block">
                          <span className="ledger-amount-value">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </span>
                          <span className="ledger-amount-balance text-xs text-muted-foreground">
                            {balanceText}
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
          {actualEntryPosition === "bottom" ? entryRowNode : null}
          {isDesc ? (
            <tr className="border-t bg-secondary/10 ledger-row ledger-row--opening">
              <td className="p-3" data-label={t("labelDate")} data-col="date">
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
                className="p-3 text-right"
                data-label={t("labelBalance")}
                data-col="balance"
              >
                <span className="ledger-opening-label">{t("labelBalance")}</span>
                <span className="ledger-opening-value">{openingBalanceText}</span>
              </td>
            </tr>
          ) : null}
        </tbody>
        ) : null}
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
