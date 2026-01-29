import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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
  const { token } = useAuth();
  const invalidate = useInvalidateLedger();
  const [form, setForm] = useState<{
    occurredAt: string;
    amount: string;
    memo: string;
    assetName?: string;
    categoryName?: string;
    merchant?: string;
    source?: string;
    fromAssetName?: string;
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
        fromAssetName: transaction.fromAssetName,
        toAssetName: transaction.toAssetName,
        fee: String(transaction.fee ?? 0),
      });
    } else {
      setForm({
        occurredAt: transaction.occurredAt.slice(0, 10),
        amount: String(transaction.amount),
        memo: transaction.memo ?? "",
        assetName: transaction.assetName,
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
      ? !form.fromAssetName?.trim() || !form.toAssetName?.trim() || !hasAmount
      : !form.assetName?.trim() || !form.categoryName?.trim() || !hasAmount) ||
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
      if (form.fromAssetName === form.toAssetName) {
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
        payload = {
          ...payload,
          assetName: form.assetName,
          categoryName: form.categoryName,
          merchant: form.merchant || undefined,
        };
      }
      if (transaction.type === "income") {
        payload = {
          ...payload,
          assetName: form.assetName,
          categoryName: form.categoryName,
          source: form.source || undefined,
        };
      }
      if (transaction.type === "transfer") {
        payload = {
          ...payload,
          fromAssetName: form.fromAssetName,
          toAssetName: form.toAssetName,
          fee: Number(form.fee || 0),
        };
      }
      await api.updateTransaction(token, transaction.id, payload);
      toast.success(t("toastEntryUpdated"));
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
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
      await api.deleteTransaction(token, transaction.id);
      toast.success(t("toastEntryDeleted"));
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
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
          />
          {transaction.type === "expense" || transaction.type === "income" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={form.assetName ?? ""}
                onValueChange={(value) => setForm({ ...form, assetName: value })}
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
                onValueChange={(value) => setForm({ ...form, categoryName: value })}
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
                onValueChange={(value) => setForm({ ...form, fromAssetName: value })}
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
                onValueChange={(value) => setForm({ ...form, toAssetName: value })}
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
            />
          ) : null}
          {transaction.type === "income" ? (
            <Input
              placeholder={t("placeholderCounterparty")}
              value={form.source ?? ""}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            />
          ) : null}
          {transaction.type === "transfer" ? (
            <Input
              type="number"
              min={0}
              placeholder={t("placeholderTransferFee")}
              value={form.fee ?? "0"}
              onChange={(event) => setForm({ ...form, fee: event.target.value })}
            />
          ) : null}
          <Textarea
            placeholder={t("placeholderMemo")}
            value={form.memo}
            onChange={(event) => setForm({ ...form, memo: event.target.value })}
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
