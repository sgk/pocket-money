import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInvalidateLedger } from "@/lib/query";
import { todayISO } from "@/lib/date";
import { storage } from "@/lib/storage";
import type { Asset, Category, Transaction, TransactionType } from "@/lib/types";
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

const emptyEntry = () => ({
  date: todayISO(),
  type: "expense" as TransactionType,
  amount: "",
  fee: "0",
  assetId: storage.getLastAssetId() ?? "",
  categoryId: storage.getLastCategoryId() ?? "",
  merchant: "",
  source: "",
  memo: "",
  fromAssetId: storage.getLastAssetId() ?? "",
  toAssetId: "",
});

export const NewEntryRow = ({
  assets,
  categories,
  fixedAssetId,
}: {
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
}) => {
  const { token } = useAuth();
  const invalidate = useInvalidateLedger();
  const [entry, setEntry] = useState(() => {
    const base = emptyEntry();
    if (fixedAssetId) {
      return {
        ...base,
        assetId: fixedAssetId,
        fromAssetId: fixedAssetId,
      };
    }
    return base;
  });
  const [isSaving, setIsSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  const assetOptions = useMemo(
    () => assets.filter((asset) => asset.isActive),
    [assets]
  );
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  );

  const categoryValue =
    entry.type === "transfer"
      ? entry.toAssetId
        ? `transfer:${entry.toAssetId}`
        : ""
      : entry.categoryId
        ? `${entry.type}:${entry.categoryId}`
        : "";

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (event.key === "e" || event.key === "E") {
        setEntry((prev) => ({ ...prev, type: "expense" }));
      }
      if (event.key === "i" || event.key === "I") {
        setEntry((prev) => ({ ...prev, type: "income" }));
      }
      if (event.key === "t" || event.key === "T") {
        setEntry((prev) => ({ ...prev, type: "transfer" }));
      }
      if (event.key === "n" || event.key === "N") {
        dateRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const resetEntry = () => {
    const base = emptyEntry();
    const next = fixedAssetId
      ? { ...base, assetId: fixedAssetId, fromAssetId: fixedAssetId }
      : base;
    setEntry(next);
  };

  const validateEntry = () => {
    const amount = Number(entry.amount);
    if (!amount || amount < 1) {
      toast.error("きんがくは 1えん いじょうで いれてね");
      return false;
    }
    if (entry.type === "expense" || entry.type === "income") {
      if (!entry.assetId) {
        toast.error("いれものを えらんでね");
        return false;
      }
      if (!entry.categoryId) {
        toast.error("つかいみちを えらんでね");
        return false;
      }
    }
    if (entry.type === "transfer") {
      if (!entry.fromAssetId || !entry.toAssetId) {
        toast.error("うつす いれものを えらんでね");
        return false;
      }
      if (entry.fromAssetId === entry.toAssetId) {
        toast.error("おなじ いれものには うつせないよ");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (!validateEntry()) {
      return;
    }
    setIsSaving(true);
    try {
      const payloadBase = {
        occurredAt: entry.date,
        amount: Number(entry.amount),
        memo: entry.memo || undefined,
      };
      let created: Transaction | undefined;
      if (entry.type === "expense") {
        const payload = {
          ...payloadBase,
          assetId: entry.assetId,
          categoryId: entry.categoryId,
          merchant: entry.merchant || undefined,
        };
        created = await api.createExpense(token, payload);
        storage.setLastAssetId(entry.assetId);
        storage.setLastCategoryId(entry.categoryId);
      }
      if (entry.type === "income") {
        const payload = {
          ...payloadBase,
          assetId: entry.assetId,
          categoryId: entry.categoryId,
          source: entry.source || undefined,
        };
        created = await api.createIncome(token, payload);
        storage.setLastAssetId(entry.assetId);
        storage.setLastCategoryId(entry.categoryId);
      }
      if (entry.type === "transfer") {
        const payload = {
          ...payloadBase,
          fromAssetId: entry.fromAssetId,
          toAssetId: entry.toAssetId,
          fee: Number(entry.fee || 0),
        };
        created = await api.createTransfer(token, payload);
        storage.setLastAssetId(entry.fromAssetId);
      }
      if (created) {
        toast.success("きろくを たしたよ");
        invalidate();
        resetEntry();
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      resetEntry();
    }
  };

  return (
    <tr onKeyDown={handleKeyDown} className="bg-secondary/30">
      <td className="p-2">
        <Input
          ref={dateRef}
          type="date"
          value={entry.date}
          onChange={(event) => setEntry({ ...entry, date: event.target.value })}
        />
      </td>
      <td className="p-2">
        {entry.type === "transfer" ? (
          <div>
            <Select
              value={entry.fromAssetId}
              onValueChange={(value) => setEntry({ ...entry, fromAssetId: value })}
              disabled={Boolean(fixedAssetId)}
            >
              <SelectTrigger>
                <SelectValue placeholder="いれもの" />
              </SelectTrigger>
              <SelectContent>
                {assetOptions.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Select
            value={entry.assetId}
            onValueChange={(value) => setEntry({ ...entry, assetId: value })}
            disabled={Boolean(fixedAssetId)}
          >
            <SelectTrigger>
              <SelectValue placeholder="いれもの" />
            </SelectTrigger>
            <SelectContent>
              {assetOptions.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-2">
        {entry.type === "expense" ? (
          <Input
            list="merchant-suggest"
            placeholder="あいて"
            value={entry.merchant}
            onChange={(event) => setEntry({ ...entry, merchant: event.target.value })}
          />
        ) : entry.type === "income" ? (
          <Input
            list="source-suggest"
            placeholder="あいて"
            value={entry.source}
            onChange={(event) => setEntry({ ...entry, source: event.target.value })}
          />
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-2">
        <Select
          value={categoryValue}
          onValueChange={(value) => {
            const [type, id] = value.split(":");
            if (type === "transfer") {
              setEntry({
                ...entry,
                type: "transfer",
                toAssetId: id ?? "",
                categoryId: "",
              });
            } else if (type === "expense" || type === "income") {
              setEntry({
                ...entry,
                type: type as TransactionType,
                categoryId: id ?? "",
                toAssetId: "",
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="うごき" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((category) => (
              <SelectItem key={`expense:${category.id}`} value={`expense:${category.id}`}>
                つかった: {category.name}
              </SelectItem>
            ))}
            {categoryOptions.map((category) => (
              <SelectItem key={`income:${category.id}`} value={`income:${category.id}`}>
                もらった: {category.name}
              </SelectItem>
            ))}
            {assetOptions
              .filter((asset) => asset.id !== entry.fromAssetId)
              .map((asset) => (
                <SelectItem key={`transfer:${asset.id}`} value={`transfer:${asset.id}`}>
                  いどう: {asset.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Input
          list="memo-suggest"
          placeholder="メモ"
          value={entry.memo}
          onChange={(event) => setEntry({ ...entry, memo: event.target.value })}
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          min={1}
          placeholder="きんがく"
          value={entry.amount}
          onChange={(event) => setEntry({ ...entry, amount: event.target.value })}
        />
      </td>
      <td className="p-2">
        <Button type="button" onClick={handleSubmit} disabled={isSaving}>
          たす
        </Button>
      </td>
    </tr>
  );
};
