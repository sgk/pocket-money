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
    assetId?: string;
    categoryId?: string;
    merchant?: string;
    source?: string;
    fromAssetId?: string;
    toAssetId?: string;
    fee?: string;
  } | null>(null);

  const expenseCategories = categories.filter((category) => category.kind !== "income");
  const incomeCategories = categories.filter((category) => category.kind === "income");
  const categoryOptions =
    transaction?.type === "income" ? incomeCategories : expenseCategories;

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
        toAssetId: transaction.toAssetId,
        fee: String(transaction.fee ?? 0),
      });
    } else {
      setForm({
        occurredAt: transaction.occurredAt.slice(0, 10),
        amount: String(transaction.amount),
        memo: transaction.memo ?? "",
        assetId: transaction.assetId,
        categoryId: transaction.categoryId,
        merchant: transaction.type === "expense" ? transaction.merchant ?? "" : undefined,
        source: transaction.type === "income" ? transaction.source ?? "" : undefined,
      });
    }
  }, [transaction]);

  if (!transaction || !form) {
    return null;
  }

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
      if (!form.categoryId) {
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
      let payload: Record<string, unknown> = {
        occurredAt: form.occurredAt,
        amount: Number(form.amount),
        memo: form.memo || undefined,
      };
      if (transaction.type === "expense") {
        payload = {
          ...payload,
          assetId: form.assetId,
          categoryId: form.categoryId,
          merchant: form.merchant || undefined,
        };
      }
      if (transaction.type === "income") {
        payload = {
          ...payload,
          assetId: form.assetId,
          categoryId: form.categoryId,
          source: form.source || undefined,
        };
      }
      if (transaction.type === "transfer") {
        payload = {
          ...payload,
          fromAssetId: form.fromAssetId,
          toAssetId: form.toAssetId,
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
            min={1}
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
          {transaction.type === "expense" || transaction.type === "income" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={form.assetId ?? ""}
                onValueChange={(value) => setForm({ ...form, assetId: value })}
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
              <Select
                value={form.categoryId ?? ""}
                onValueChange={(value) => setForm({ ...form, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="つかいみち" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={form.fromAssetId ?? ""}
                onValueChange={(value) => setForm({ ...form, fromAssetId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="うつすまえ" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.toAssetId ?? ""}
                onValueChange={(value) => setForm({ ...form, toAssetId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="うつしたい" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
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
          <Button onClick={handleSave}>ほぞん</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
