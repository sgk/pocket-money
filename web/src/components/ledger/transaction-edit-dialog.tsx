import { useEffect, useState } from "react";
import { api, isNetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInvalidateLedger } from "@/lib/query";
import type { Asset, Category, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const OTHER_CATEGORY_NAME = "その他";

export const TransactionEditDialog = ({
  open,
  onOpenChange,
  transaction,
  assets,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  assets: Asset[];
  categories: Category[];
}) => {
  const { t } = useText();
  const { token, childId } = useAuth();
  const invalidate = useInvalidateLedger();
  const [form, setForm] = useState<{
    occurredAt: string;
    amount: string;
    memo: string;
    assetId?: string;
    assetName?: string;
    categoryId?: string;
    categoryName?: string;
    merchant?: string;
    source?: string;
    fromAssetId?: string;
    fromAssetName?: string;
    toAssetId?: string;
    toAssetName?: string;
    fee?: string;
  } | null>(null);

  const expenseCategories = categories.filter(
    (category) => category.kind !== "income" && category.name !== OTHER_CATEGORY_NAME
  );
  const incomeCategories = categories.filter(
    (category) => category.kind === "income" && category.name !== OTHER_CATEGORY_NAME
  );
  const baseCategoryOptions =
    transaction?.type === "income" ? incomeCategories : expenseCategories;
  const categoryOptions =
    form?.categoryName && form.categoryName !== OTHER_CATEGORY_NAME
      ? baseCategoryOptions.some((category) => category.name === form.categoryName)
        ? baseCategoryOptions
        : [
            { id: "custom", name: form.categoryName, isActive: true, sortOrder: 0 },
            ...baseCategoryOptions,
          ]
      : baseCategoryOptions;

  const findAssetByName = (name: string) =>
    assets.find((asset) => asset.name === name);
  const findCategoryByName = (name: string, kind: "expense" | "income") =>
    categories.find((category) => category.name === name && category.kind === kind);

  const selectableAssets = (() => {
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
    addIfMissing(form?.assetName);
    addIfMissing(form?.fromAssetName);
    addIfMissing(form?.toAssetName);
    return [...extraAssets, ...assets];
  })();

  useEffect(() => {
    if (!transaction) {
      setForm(null);
      return;
    }
    if (transaction.type === "transfer") {
      setForm({
        occurredAt: transaction.occurredAt.slice(0, 10),
        amount: String(transaction.amount),
        memo: transaction.memo ?? "",
        fromAssetId: transaction.fromAssetId,
        fromAssetName: transaction.fromAssetName,
        toAssetId: transaction.toAssetId,
        toAssetName: transaction.toAssetName,
        fee: String(transaction.fee ?? 0),
      });
    } else {
      setForm({
        occurredAt: transaction.occurredAt.slice(0, 10),
        amount: String(transaction.amount),
        memo: transaction.memo ?? "",
        assetId: transaction.assetId,
        assetName: transaction.assetName,
        categoryId: transaction.categoryId,
        categoryName: transaction.categoryName,
        merchant: transaction.type === "expense" ? transaction.merchant ?? "" : undefined,
        source: transaction.type === "income" ? transaction.source ?? "" : undefined,
      });
    }
  }, [transaction]);

  if (!transaction || !form) {
    return null;
  }

  const hasAmount = form.amount.trim() !== "" && !Number.isNaN(Number(form.amount));
  const initialDate = transaction.occurredAt.slice(0, 10);
  const initialMemo = transaction.memo ?? "";
  const initialAmount = transaction.amount;
  const normalizedAmount = Number(form.amount);
  const normalizedFee = Number(form.fee ?? 0);
  const isAmountInRange =
    hasAmount && normalizedAmount >= MIN_AMOUNT && normalizedAmount <= MAX_AMOUNT;
  const isFeeInRange =
    !Number.isNaN(normalizedFee) &&
    normalizedFee >= MIN_AMOUNT &&
    normalizedFee <= MAX_AMOUNT;
  const isDirty = (() => {
    if (form.occurredAt !== initialDate) {
      return true;
    }
    if (Number.isNaN(normalizedAmount) || normalizedAmount !== initialAmount) {
      return true;
    }
    if ((form.memo ?? "") !== initialMemo) {
      return true;
    }
    if (transaction.type === "expense") {
      return (
        (form.assetName ?? "") !== (transaction.assetName ?? "") ||
        (form.categoryName ?? "") !== (transaction.categoryName ?? "") ||
        (form.merchant ?? "") !== (transaction.merchant ?? "")
      );
    }
    if (transaction.type === "income") {
      return (
        (form.assetName ?? "") !== (transaction.assetName ?? "") ||
        (form.categoryName ?? "") !== (transaction.categoryName ?? "") ||
        (form.source ?? "") !== (transaction.source ?? "")
      );
    }
    return (
      (form.fromAssetName ?? "") !== (transaction.fromAssetName ?? "") ||
      (form.toAssetName ?? "") !== (transaction.toAssetName ?? "") ||
      Number(form.fee ?? 0) !== Number(transaction.fee ?? 0)
    );
  })();
  const isSaveDisabled =
    (transaction.type === "transfer"
      ? !form.fromAssetName?.trim() ||
        !form.toAssetName?.trim() ||
        !isAmountInRange ||
        !isFeeInRange
      : !form.assetName?.trim() || !form.categoryName?.trim() || !isAmountInRange) ||
    !isDirty;

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
    if (transaction.type === "transfer") {
      if (Number.isNaN(normalizedFee)) {
        toast.error(t("toastAmountRange"));
        return;
      }
      if (normalizedFee < MIN_AMOUNT || normalizedFee > MAX_AMOUNT) {
        toast.error(t("toastAmountRange"));
        return;
      }
    }
    if (transaction.type === "expense" || transaction.type === "income") {
      if (!form.assetName) {
        toast.error(t("toastAssetRequired"));
        return;
      }
      if (!form.categoryName) {
      toast.error(t("toastCategoryRequired"));
        return;
      }
    }
    if (transaction.type === "transfer") {
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
      let payload: Record<string, unknown> = {
        occurredAt: form.occurredAt,
        amount: Number(form.amount),
        memo: form.memo || undefined,
      };
    if (transaction.type === "expense") {
        const resolvedAssetId =
          form.assetId ?? findAssetByName(form.assetName ?? "")?.id;
        const resolvedCategoryId =
          form.categoryId ?? findCategoryByName(form.categoryName ?? "", "expense")?.id;
        payload = {
          ...payload,
          assetId: resolvedAssetId,
          assetName: form.assetName,
          categoryId: resolvedCategoryId,
          categoryName: form.categoryName,
          merchant: form.merchant || undefined,
        };
      }
      if (transaction.type === "income") {
        const resolvedAssetId =
          form.assetId ?? findAssetByName(form.assetName ?? "")?.id;
        const resolvedCategoryId =
          form.categoryId ?? findCategoryByName(form.categoryName ?? "", "income")?.id;
        payload = {
          ...payload,
          assetId: resolvedAssetId,
          assetName: form.assetName,
          categoryId: resolvedCategoryId,
          categoryName: form.categoryName,
          source: form.source || undefined,
        };
      }
      if (transaction.type === "transfer") {
        const resolvedFromId =
          form.fromAssetId ?? findAssetByName(form.fromAssetName ?? "")?.id;
        const resolvedToId =
          form.toAssetId ?? findAssetByName(form.toAssetName ?? "")?.id;
        payload = {
          ...payload,
          fromAssetId: resolvedFromId,
          fromAssetName: form.fromAssetName,
          toAssetId: resolvedToId,
          toAssetName: form.toAssetName,
          fee: Number(form.fee || 0),
        };
      }
      await api.updateTransaction(token, transaction.id, payload, childId);
      toast.success(t("toastEntryUpdated"));
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
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
      await api.deleteTransaction(token, transaction.id, childId);
      toast.success(t("toastEntryDeleted"));
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogEditEntryTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Input
            type="date"
            value={form.occurredAt}
            onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
          />
          <Input
            type="number"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
          />
          {transaction.type === "expense" || transaction.type === "income" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={form.assetName ?? ""}
                onValueChange={(value) => {
                  const selected = findAssetByName(value);
                  setForm({ ...form, assetId: selected?.id, assetName: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholderAsset")} />
                </SelectTrigger>
                <SelectContent>
                  {selectableAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.name}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.categoryName ?? ""}
                onValueChange={(value) => {
                  const kind = transaction.type === "income" ? "income" : "expense";
                  const selected = findCategoryByName(value, kind);
                  setForm({
                    ...form,
                    categoryId: selected?.id,
                    categoryName: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholderCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_CATEGORY_NAME}>{t("labelOther")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={form.fromAssetName ?? ""}
                onValueChange={(value) => {
                  const selected = findAssetByName(value);
                  setForm({
                    ...form,
                    fromAssetId: selected?.id,
                    fromAssetName: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholderTransferFrom")} />
                </SelectTrigger>
                <SelectContent>
                  {selectableAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.name}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.toAssetName ?? ""}
                onValueChange={(value) => {
                  const selected = findAssetByName(value);
                  setForm({
                    ...form,
                    toAssetId: selected?.id,
                    toAssetName: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholderTransferTo")} />
                </SelectTrigger>
                <SelectContent>
                  {selectableAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.name}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {transaction.type === "expense" ? (
            <Input
              placeholder={t("placeholderCounterparty")}
              value={form.merchant ?? ""}
              onChange={(event) => setForm({ ...form, merchant: event.target.value })}
              maxLength={MAX_NAME_LENGTH}
            />
          ) : null}
          {transaction.type === "income" ? (
            <Input
              placeholder={t("placeholderCounterparty")}
              value={form.source ?? ""}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
              maxLength={MAX_NAME_LENGTH}
            />
          ) : null}
          {transaction.type === "transfer" ? (
            <Input
              type="number"
              placeholder={t("placeholderTransferFee")}
              value={form.fee ?? "0"}
              onChange={(event) => setForm({ ...form, fee: event.target.value })}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
            />
          ) : null}
          <Textarea
            placeholder={t("placeholderMemo")}
            value={form.memo}
            onChange={(event) => setForm({ ...form, memo: event.target.value })}
            maxLength={MAX_MEMO_LENGTH}
          />
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete}>
            {t("actionDelete")}
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            {t("actionSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
