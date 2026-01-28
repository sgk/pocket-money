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
    (category) => category.kind !== "income" && category.name !== "その他"
  );
  const incomeCategories = categories.filter(
    (category) => category.kind === "income" && category.name !== "その他"
  );
  const baseCategoryOptions =
    transaction?.type === "income" ? incomeCategories : expenseCategories;
  const categoryOptions =
    form?.categoryName && form.categoryName !== "その他"
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
  const isSaveDisabled =
    transaction.type === "transfer"
      ? !form.fromAssetName?.trim() || !form.toAssetName?.trim() || !hasAmount
      : !form.assetName?.trim() || !form.categoryName?.trim() || !hasAmount;

  const handleSave = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (form.amount === "" || Number.isNaN(Number(form.amount))) {
      toast.error("きんがくを いれてね");
      return;
    }
    if (transaction.type === "expense" || transaction.type === "income") {
      if (!form.assetName) {
        toast.error("いれものを えらんでね");
        return;
      }
      if (!form.categoryName) {
      toast.error("うごきを えらんでね");
        return;
      }
    }
    if (transaction.type === "transfer") {
      if (!form.fromAssetName || !form.toAssetName) {
        toast.error("うつす いれものを えらんでね");
        return;
      }
      if (form.fromAssetName === form.toAssetName) {
        toast.error("おなじ いれものには うつせないよ");
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
      toast.success("きろくを なおしたよ");
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
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
      await api.deleteTransaction(token, transaction.id);
      toast.success("きろくを けしたよ");
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
          <DialogTitle>きろくを なおす</DialogTitle>
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
                  <SelectValue placeholder="いれもの" />
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
                  <SelectValue placeholder="うごき" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="その他">その他</SelectItem>
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
                  <SelectValue placeholder="うつすまえ" />
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
                  <SelectValue placeholder="うつしたい" />
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
              placeholder="あいて"
              value={form.merchant ?? ""}
              onChange={(event) => setForm({ ...form, merchant: event.target.value })}
            />
          ) : null}
          {transaction.type === "income" ? (
            <Input
              placeholder="あいて"
              value={form.source ?? ""}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            />
          ) : null}
          {transaction.type === "transfer" ? (
            <Input
              type="number"
              min={0}
              placeholder="てすうりょう"
              value={form.fee ?? "0"}
              onChange={(event) => setForm({ ...form, fee: event.target.value })}
            />
          ) : null}
          <Textarea
            placeholder="メモ"
            value={form.memo}
            onChange={(event) => setForm({ ...form, memo: event.target.value })}
          />
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete}>
            けす
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            ほぞん
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
