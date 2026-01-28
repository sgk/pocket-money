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
  transferDirection: "out" as "out" | "in",
  amount: "",
  fee: "0",
  assetName: storage.getLastAssetName() ?? "",
  categoryName: "",
  merchant: "",
  source: "",
  counterparty: "",
  memo: "",
  fromAssetName: storage.getLastAssetName() ?? "",
  toAssetName: "",
});

export const NewEntryRow = ({
  assets,
  categories,
  fixedAssetName,
  disabled,
}: {
  assets: Asset[];
  categories: Category[];
  fixedAssetName?: string;
  disabled?: boolean;
}) => {
  const isDisabled = Boolean(disabled);
  const buildInitialEntry = (assetName?: string) => {
    const base = emptyEntry();
    if (assetName) {
      return {
        ...base,
        assetName,
        fromAssetName: assetName,
      };
    }
    return {
      ...base,
      assetName: "",
      fromAssetName: "",
      toAssetName: "",
    };
  };
  const { token } = useAuth();
  const invalidate = useInvalidateLedger();
  const [entry, setEntry] = useState(() => buildInitialEntry(fixedAssetName));
  const [isSaving, setIsSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  const assetOptions = useMemo(
    () => assets.filter((asset) => asset.isActive),
    [assets]
  );
  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (category) => category.isActive && category.name !== "その他"
      ),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categoryOptions.filter((category) => category.kind !== "income"),
    [categoryOptions]
  );
  const incomeCategories = useMemo(
    () => categoryOptions.filter((category) => category.kind === "income"),
    [categoryOptions]
  );
  const placeholderValue = "__placeholder__";
  const assetPlaceholderValue = "__asset_placeholder__";

  const categoryValue =
    entry.type === "transfer"
      ? entry.transferDirection === "out"
        ? entry.toAssetName
          ? `transfer-out::${entry.toAssetName}`
          : ""
        : entry.fromAssetName
          ? `transfer-in::${entry.fromAssetName}`
          : ""
      : entry.categoryName
        ? `${entry.type}::${entry.categoryName}`
        : "";

  const transferBaseAssetName = fixedAssetName
    ? fixedAssetName
    : entry.type === "transfer"
      ? entry.transferDirection === "out"
        ? entry.fromAssetName
        : entry.toAssetName
      : entry.assetName;

  useEffect(() => {
    if (isDisabled) {
      return;
    }
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
        setEntry((prev) => ({
          ...prev,
          type: "transfer",
          transferDirection: "out",
        }));
      }
      if (event.key === "n" || event.key === "N") {
        dateRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDisabled]);

  useEffect(() => {
    setEntry(buildInitialEntry(fixedAssetName));
  }, [fixedAssetName]);

  const resetEntry = () => {
    setEntry(buildInitialEntry(fixedAssetName));
  };

  const validateEntry = () => {
    const amount = Number(entry.amount);
    if (Number.isNaN(amount) || entry.amount === "") {
      toast.error("きんがくを いれてね");
      return false;
    }
    if (entry.type === "expense" || entry.type === "income") {
      if (!entry.assetName) {
        toast.error("いれものを えらんでね");
        return false;
      }
      if (!entry.categoryName) {
        toast.error("つかいみちを えらんでね");
        return false;
      }
    }
    if (entry.type === "transfer") {
      if (!entry.fromAssetName || !entry.toAssetName) {
        toast.error("うつす いれものを えらんでね");
        return false;
      }
      if (entry.fromAssetName === entry.toAssetName) {
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
          assetName: entry.assetName,
          categoryName: entry.categoryName,
          merchant: entry.merchant || undefined,
        };
        created = await api.createExpense(token, payload);
        storage.setLastAssetName(entry.assetName);
        storage.setLastCategoryName(entry.categoryName);
      }
      if (entry.type === "income") {
        const payload = {
          ...payloadBase,
          assetName: entry.assetName,
          categoryName: entry.categoryName,
          source: entry.source || undefined,
        };
        created = await api.createIncome(token, payload);
        storage.setLastAssetName(entry.assetName);
        storage.setLastCategoryName(entry.categoryName);
      }
      if (entry.type === "transfer") {
        const payload = {
          ...payloadBase,
          fromAssetName: entry.fromAssetName,
          toAssetName: entry.toAssetName,
          fee: Number(entry.fee || 0),
          counterparty: entry.counterparty || undefined,
        };
        created = await api.createTransfer(token, payload);
        storage.setLastAssetName(entry.fromAssetName);
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
    <tr
      onKeyDown={handleKeyDown}
      className={`bg-secondary/30 ledger-row ledger-row--edit ledger-row--new ${
        isDisabled ? "opacity-50 pointer-events-none" : ""
      }`}
      aria-disabled={isDisabled}
    >
      <td className="p-3 whitespace-nowrap" data-label="ひづけ">
        <Input
          ref={dateRef}
          type="date"
          value={entry.date}
          onChange={(event) => setEntry({ ...entry, date: event.target.value })}
          disabled={isDisabled}
        />
      </td>
      <td className="p-3 whitespace-normal break-words" data-label="いれもの">
        {entry.type === "transfer" ? (
          <div>
            <Select
              value={fixedAssetName ?? (entry.transferDirection === "out"
                ? entry.fromAssetName
                : entry.toAssetName)}
              onValueChange={(value) => {
                if (value === assetPlaceholderValue) {
                  if (entry.transferDirection === "out") {
                    setEntry({ ...entry, fromAssetName: "" });
                  } else {
                    setEntry({ ...entry, toAssetName: "" });
                  }
                  return;
                }
                if (entry.transferDirection === "out") {
                  setEntry({ ...entry, fromAssetName: value });
                } else {
                  setEntry({ ...entry, toAssetName: value });
                }
              }}
              disabled={Boolean(fixedAssetName) || isDisabled}
            >
              <SelectTrigger className={(fixedAssetName ?? (entry.transferDirection === "out" ? entry.fromAssetName : entry.toAssetName)) === "" || (fixedAssetName ?? (entry.transferDirection === "out" ? entry.fromAssetName : entry.toAssetName)) === assetPlaceholderValue ? "text-muted-foreground/40" : ""}>
                <SelectValue placeholder="いれもの" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={assetPlaceholderValue}
                  className="text-muted-foreground"
                >
                  いれもの
                </SelectItem>
                {assetOptions.map((asset) => (
                  <SelectItem key={asset.id} value={asset.name}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Select
            value={entry.assetName}
            onValueChange={(value) => {
              if (value === assetPlaceholderValue) {
                setEntry({ ...entry, assetName: "" });
                return;
              }
              setEntry({ ...entry, assetName: value });
            }}
            disabled={Boolean(fixedAssetName) || isDisabled}
          >
            <SelectTrigger className={(fixedAssetName ?? entry.assetName) === "" || (fixedAssetName ?? entry.assetName) === assetPlaceholderValue ? "text-muted-foreground/40" : ""}>
              <SelectValue placeholder="いれもの" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={assetPlaceholderValue}
                className="text-muted-foreground"
              >
                いれもの
              </SelectItem>
              {assetOptions.map((asset) => (
                <SelectItem key={asset.id} value={asset.name}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-3" data-label="あいて">
        {entry.type === "expense" ? (
          <Input
            list="merchant-suggest"
            placeholder="あいて"
            value={entry.merchant}
            onChange={(event) => setEntry({ ...entry, merchant: event.target.value })}
            disabled={isDisabled}
          />
        ) : entry.type === "income" ? (
          <Input
            list="source-suggest"
            placeholder="あいて"
            value={entry.source}
            onChange={(event) => setEntry({ ...entry, source: event.target.value })}
            disabled={isDisabled}
          />
        ) : (
          <Input
            placeholder="あいて"
            value={entry.counterparty}
            onChange={(event) =>
              setEntry({ ...entry, counterparty: event.target.value })
            }
            disabled={isDisabled}
          />
        )}
      </td>
      <td className="p-3 whitespace-normal break-words" data-label="うごき">
        <Select
          value={categoryValue}
          onValueChange={(value) => {
            if (value === placeholderValue) {
              if (entry.type === "transfer") {
                const baseAssetName =
                  fixedAssetName ??
                  entry.assetName ??
                  entry.fromAssetName ??
                  entry.toAssetName ??
                  "";
                setEntry({
                  ...entry,
                  type: "expense",
                  categoryName: "",
                  transferDirection: "out",
                  fromAssetName: baseAssetName,
                  toAssetName: "",
                });
                return;
              }
              setEntry({ ...entry, categoryName: "" });
              return;
            }
            const [type, ...rest] = value.split("::");
            const id = rest.join("::");
            if (type === "transfer-out") {
              const baseAssetName = transferBaseAssetName ?? "";
              setEntry({
                ...entry,
                type: "transfer",
                transferDirection: "out",
                fromAssetName: baseAssetName,
                toAssetName: id ?? "",
                categoryName: "",
              });
            } else if (type === "transfer-in") {
              const baseAssetName = transferBaseAssetName ?? "";
              setEntry({
                ...entry,
                type: "transfer",
                transferDirection: "in",
                fromAssetName: id ?? "",
                toAssetName: baseAssetName,
                categoryName: "",
              });
            } else if (type === "expense" || type === "income") {
              setEntry({
                ...entry,
                type: type as TransactionType,
                categoryName: id ?? "",
                toAssetName: "",
              });
            }
          }}
          disabled={isDisabled}
        >
          <SelectTrigger className={categoryValue === "" || categoryValue === placeholderValue ? "text-muted-foreground/40" : ""}>
            <SelectValue placeholder="うごき" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={placeholderValue} className="text-muted-foreground">
              うごき
            </SelectItem>
            <div className="px-2 pt-2 text-xs text-muted-foreground">だした</div>
            {expenseCategories.map((category) => (
              <SelectItem
                key={`expense:${category.name}`}
                value={`expense::${category.name}`}
              >
                {category.name}
              </SelectItem>
            ))}
            <SelectItem key="expense:その他" value="expense::その他">
              その他
            </SelectItem>
            {assetOptions
              .filter((asset) => asset.name !== transferBaseAssetName)
              .map((asset) => (
                <SelectItem
                  key={`transfer-out:${asset.id}`}
                  value={`transfer-out::${asset.name}`}
                >
                  →{asset.name} へ
                </SelectItem>
              ))}
            <div className="px-2 pt-2 text-xs text-muted-foreground">いれた</div>
            {incomeCategories.map((category) => (
              <SelectItem
                key={`income:${category.name}`}
                value={`income::${category.name}`}
              >
                {category.name}
              </SelectItem>
            ))}
            <SelectItem key="income:その他" value="income::その他">
              その他
            </SelectItem>
            {assetOptions
              .filter((asset) => asset.name !== transferBaseAssetName)
              .map((asset) => (
                <SelectItem
                  key={`transfer-in:${asset.id}`}
                  value={`transfer-in::${asset.name}`}
                >
                  ←{asset.name} から
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3 whitespace-normal break-words" data-label="メモ">
        <Input
          list="memo-suggest"
          placeholder="メモ"
          value={entry.memo}
          onChange={(event) => setEntry({ ...entry, memo: event.target.value })}
          disabled={isDisabled}
        />
      </td>
      <td className="p-3 whitespace-nowrap text-right" data-label="きんがく">
        <div className="ledger-amount-inline">
          <Input
            type="number"
            placeholder="きんがく"
            value={entry.amount}
            onChange={(event) => setEntry({ ...entry, amount: event.target.value })}
            disabled={isDisabled}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || isDisabled}
            className="ledger-inline-action"
          >
            ついか
          </Button>
        </div>
      </td>
      <td
        className="ledger-action-cell p-3 text-center"
        data-label=""
      >
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || isDisabled}
        >
          ついか
        </Button>
      </td>
    </tr>
  );
};
