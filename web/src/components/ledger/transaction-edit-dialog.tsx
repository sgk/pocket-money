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
      toast.error("ログインが必要です");
      return;
    }
    if (!form.amount || Number(form.amount) < 1) {
      toast.error("金額は1円以上で入力してください");
      return;
    }
    if (transaction.type === "expense" || transaction.type === "income") {
      if (!form.assetId) {
        toast.error("資産を選択してください");
        return;
      }
      if (!form.categoryId) {
        toast.error("費目を選択してください");
        return;
      }
    }
    if (transaction.type === "transfer") {
      if (!form.fromAssetId || !form.toAssetId) {
        toast.error("振替元と振替先を選択してください");
        return;
      }
      if (form.fromAssetId === form.toAssetId) {
        toast.error("振替元と振替先は同じにできません");
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
      toast.success("取引を更新しました");
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    const ok = window.confirm("この取引を削除しますか？");
    if (!ok) {
      return;
    }
    try {
      await api.deleteTransaction(token, transaction.id);
      toast.success("取引を削除しました");
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
          <DialogTitle>取引を編集</DialogTitle>
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
                  <SelectValue placeholder="資産" />
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
                  <SelectValue placeholder="費目" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
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
                  <SelectValue placeholder="振替元" />
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
                  <SelectValue placeholder="振替先" />
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
              placeholder="相手"
              value={form.merchant ?? ""}
              onChange={(event) => setForm({ ...form, merchant: event.target.value })}
            />
          ) : null}
          {transaction.type === "income" ? (
            <Input
              placeholder="相手"
              value={form.source ?? ""}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            />
          ) : null}
          {transaction.type === "transfer" ? (
            <Input
              type="number"
              min={0}
              placeholder="手数料"
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
            削除
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
