import { useEffect, useMemo, useRef, useState } from "react";
import { api, isNetworkError } from "@/lib/api";
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
import { useText } from "@/lib/text";

const emptyEntry = () => ({
  date: todayISO(),
  type: "expense" as TransactionType,
  transferDirection: "out" as "out" | "in",
  amount: "",
  fee: "0",
  assetId: storage.getLastAssetId() ?? "",
  assetName: storage.getLastAssetName() ?? "",
  categoryId: storage.getLastCategoryId() ?? "",
  categoryName: storage.getLastCategoryName() ?? "",
  merchant: "",
  source: "",
  counterparty: "",
  memo: "",
  fromAssetId: storage.getLastAssetId() ?? "",
  fromAssetName: storage.getLastAssetName() ?? "",
  toAssetId: "",
  toAssetName: "",
});

const OTHER_CATEGORY_NAME = "その他";

export const NewEntryRow = ({
  assets,
  categories,
  fixedAssetId,
  fixedAssetName,
  disabled,
}: {
  assets: Asset[];
  categories: Category[];
  fixedAssetId?: string;
  fixedAssetName?: string;
  disabled?: boolean;
}) => {
  const { t } = useText();
  const isDisabled = Boolean(disabled);
  const buildInitialEntry = (assetId?: string, assetName?: string) => {
    const base = emptyEntry();
    if (assetName || assetId) {
      return {
        ...base,
        assetId: assetId ?? base.assetId,
        assetName: assetName ?? base.assetName,
        fromAssetId: assetId ?? base.fromAssetId,
        fromAssetName: assetName ?? base.fromAssetName,
      };
    }
    return {
      ...base,
      assetId: "",
      assetName: "",
      fromAssetId: "",
      fromAssetName: "",
      toAssetId: "",
      toAssetName: "",
    };
  };
  const { token } = useAuth();
  const invalidate = useInvalidateLedger();
  const [entry, setEntry] = useState(() =>
    buildInitialEntry(fixedAssetId, fixedAssetName)
  );
  const [isSaving, setIsSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  const assetOptions = useMemo(
    () => assets.filter((asset) => asset.isActive),
    [assets]
  );
  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (category) => category.isActive && category.name !== OTHER_CATEGORY_NAME
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
  const findAssetByName = (name: string) =>
    assetOptions.find((asset) => asset.name === name);
  const findCategoryByName = (name: string, kind: "expense" | "income") =>
    categories.find((category) => category.name === name && category.kind === kind);
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
  const transferBaseAssetId = fixedAssetId
    ? fixedAssetId
    : entry.type === "transfer"
      ? entry.transferDirection === "out"
        ? entry.fromAssetId
        : entry.toAssetId
      : entry.assetId;

  const hasAmount = entry.amount.trim() !== "" && !Number.isNaN(Number(entry.amount));
  const isEntryValid =
    entry.type === "transfer"
      ? Boolean(entry.fromAssetName?.trim()) &&
        Boolean(entry.toAssetName?.trim()) &&
        hasAmount
      : Boolean(entry.assetName?.trim()) && Boolean(entry.categoryName?.trim()) && hasAmount;

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
    setEntry(buildInitialEntry(fixedAssetId, fixedAssetName));
  }, [fixedAssetId, fixedAssetName]);

  const resetEntry = () => {
    setEntry(buildInitialEntry(fixedAssetId, fixedAssetName));
  };

  const validateEntry = () => {
    const amount = Number(entry.amount);
    if (Number.isNaN(amount) || entry.amount === "") {
      toast.error(t("toastAmountRequired"));
      return false;
    }
    if (entry.type === "expense" || entry.type === "income") {
      if (!entry.assetName) {
        toast.error(t("toastAssetRequired"));
        return false;
      }
      if (!entry.categoryName) {
        toast.error(t("toastCategoryRequired"));
        return false;
      }
    }
    if (entry.type === "transfer") {
      if (!entry.fromAssetName || !entry.toAssetName) {
        toast.error(t("toastTransferAssetRequired"));
        return false;
      }
      if (
        (entry.fromAssetId && entry.toAssetId && entry.fromAssetId === entry.toAssetId) ||
        entry.fromAssetName === entry.toAssetName
      ) {
        toast.error(t("toastTransferSameAsset"));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
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
        const resolvedAssetId =
          entry.assetId || findAssetByName(entry.assetName)?.id;
        const resolvedCategoryId =
          entry.categoryId || findCategoryByName(entry.categoryName, "expense")?.id;
        const payload = {
          ...payloadBase,
          assetId: resolvedAssetId,
          assetName: entry.assetName,
          categoryId: resolvedCategoryId,
          categoryName: entry.categoryName,
          merchant: entry.merchant || undefined,
        };
        created = await api.createExpense(token, payload);
        storage.setLastAssetName(entry.assetName);
        storage.setLastCategoryName(entry.categoryName);
        if (resolvedAssetId) {
          storage.setLastAssetId(resolvedAssetId);
        }
        if (resolvedCategoryId) {
          storage.setLastCategoryId(resolvedCategoryId);
        }
      }
      if (entry.type === "income") {
        const resolvedAssetId =
          entry.assetId || findAssetByName(entry.assetName)?.id;
        const resolvedCategoryId =
          entry.categoryId || findCategoryByName(entry.categoryName, "income")?.id;
        const payload = {
          ...payloadBase,
          assetId: resolvedAssetId,
          assetName: entry.assetName,
          categoryId: resolvedCategoryId,
          categoryName: entry.categoryName,
          source: entry.source || undefined,
        };
        created = await api.createIncome(token, payload);
        storage.setLastAssetName(entry.assetName);
        storage.setLastCategoryName(entry.categoryName);
        if (resolvedAssetId) {
          storage.setLastAssetId(resolvedAssetId);
        }
        if (resolvedCategoryId) {
          storage.setLastCategoryId(resolvedCategoryId);
        }
      }
      if (entry.type === "transfer") {
        const resolvedFromId =
          entry.fromAssetId || findAssetByName(entry.fromAssetName)?.id;
        const resolvedToId =
          entry.toAssetId || findAssetByName(entry.toAssetName)?.id;
        const payload = {
          ...payloadBase,
          fromAssetId: resolvedFromId,
          fromAssetName: entry.fromAssetName,
          toAssetId: resolvedToId,
          toAssetName: entry.toAssetName,
          fee: Number(entry.fee || 0),
          counterparty: entry.counterparty || undefined,
        };
        created = await api.createTransfer(token, payload);
        storage.setLastAssetName(entry.fromAssetName);
        if (resolvedFromId) {
          storage.setLastAssetId(resolvedFromId);
        }
      }
      if (created) {
        toast.success(t("toastEntryAdded"));
        invalidate();
        resetEntry();
      }
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
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
      <td className="p-3 whitespace-nowrap" data-label={t("labelDate")} data-col="date">
        <Input
          ref={dateRef}
          type="date"
          value={entry.date}
          onChange={(event) => setEntry({ ...entry, date: event.target.value })}
          disabled={isDisabled}
        />
      </td>
      <td
        className="p-3 whitespace-normal break-words"
        data-label={t("labelAsset")}
        data-col="asset"
      >
        {entry.type === "transfer" ? (
          <div>
            <Select
              value={fixedAssetName ?? (entry.transferDirection === "out"
                ? entry.fromAssetName
                : entry.toAssetName)}
              onValueChange={(value) => {
                if (value === assetPlaceholderValue) {
                  if (entry.transferDirection === "out") {
                    setEntry({ ...entry, fromAssetId: "", fromAssetName: "" });
                  } else {
                    setEntry({ ...entry, toAssetId: "", toAssetName: "" });
                  }
                  return;
                }
                const selected = findAssetByName(value);
                if (entry.transferDirection === "out") {
                  setEntry({
                    ...entry,
                    fromAssetId: selected?.id ?? "",
                    fromAssetName: value,
                  });
                } else {
                  setEntry({
                    ...entry,
                    toAssetId: selected?.id ?? "",
                    toAssetName: value,
                  });
                }
              }}
              disabled={Boolean(fixedAssetName) || isDisabled}
            >
              <SelectTrigger className={(fixedAssetName ?? (entry.transferDirection === "out" ? entry.fromAssetName : entry.toAssetName)) === "" || (fixedAssetName ?? (entry.transferDirection === "out" ? entry.fromAssetName : entry.toAssetName)) === assetPlaceholderValue ? "text-muted-foreground/40" : ""}>
                <SelectValue placeholder={t("placeholderAsset")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={assetPlaceholderValue}
                  className="text-muted-foreground"
                >
                  {t("placeholderAsset")}
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
                setEntry({ ...entry, assetId: "", assetName: "" });
                return;
              }
              const selected = findAssetByName(value);
              setEntry({
                ...entry,
                assetId: selected?.id ?? "",
                assetName: value,
              });
            }}
            disabled={Boolean(fixedAssetName) || isDisabled}
          >
            <SelectTrigger className={(fixedAssetName ?? entry.assetName) === "" || (fixedAssetName ?? entry.assetName) === assetPlaceholderValue ? "text-muted-foreground/40" : ""}>
              <SelectValue placeholder={t("placeholderAsset")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={assetPlaceholderValue}
                className="text-muted-foreground"
              >
                {t("placeholderAsset")}
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
      <td className="p-3" data-label={t("labelCounterparty")} data-col="counterparty">
        {entry.type === "expense" ? (
          <Input
            list="merchant-suggest"
            placeholder={t("placeholderCounterparty")}
            value={entry.merchant}
            onChange={(event) => setEntry({ ...entry, merchant: event.target.value })}
            disabled={isDisabled}
          />
        ) : entry.type === "income" ? (
          <Input
            list="source-suggest"
            placeholder={t("placeholderCounterparty")}
            value={entry.source}
            onChange={(event) => setEntry({ ...entry, source: event.target.value })}
            disabled={isDisabled}
          />
        ) : (
          <Input
            placeholder={t("placeholderCounterparty")}
            value={entry.counterparty}
            onChange={(event) =>
              setEntry({ ...entry, counterparty: event.target.value })
            }
            disabled={isDisabled}
          />
        )}
      </td>
      <td
        className="p-3 whitespace-normal break-words"
        data-label={t("labelCategory")}
        data-col="category"
      >
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
                const baseAssetId =
                  fixedAssetId ??
                  entry.assetId ??
                  entry.fromAssetId ??
                  entry.toAssetId ??
                  "";
                setEntry({
                  ...entry,
                  type: "expense",
                  assetId: baseAssetId,
                  assetName: baseAssetName,
                  categoryId: "",
                  categoryName: "",
                  transferDirection: "out",
                  fromAssetId: baseAssetId,
                  fromAssetName: baseAssetName,
                  toAssetId: "",
                  toAssetName: "",
                });
                return;
              }
              setEntry({ ...entry, categoryId: "", categoryName: "" });
              return;
            }
            const [type, ...rest] = value.split("::");
            const id = rest.join("::");
            if (type === "transfer-out") {
              const baseAssetName = transferBaseAssetName ?? "";
              const baseAssetId = transferBaseAssetId ?? "";
              const selected = findAssetByName(id);
              setEntry({
                ...entry,
                type: "transfer",
                transferDirection: "out",
                fromAssetId: baseAssetId,
                fromAssetName: baseAssetName,
                toAssetId: selected?.id ?? "",
                toAssetName: id ?? "",
                categoryName: "",
                categoryId: "",
              });
            } else if (type === "transfer-in") {
              const baseAssetName = transferBaseAssetName ?? "";
              const baseAssetId = transferBaseAssetId ?? "";
              const selected = findAssetByName(id);
              setEntry({
                ...entry,
                type: "transfer",
                transferDirection: "in",
                fromAssetId: selected?.id ?? "",
                fromAssetName: id ?? "",
                toAssetId: baseAssetId,
                toAssetName: baseAssetName,
                categoryName: "",
                categoryId: "",
              });
            } else if (type === "expense" || type === "income") {
              const selected = findCategoryByName(id ?? "", type);
              setEntry({
                ...entry,
                type: type as TransactionType,
                categoryId: selected?.id ?? "",
                categoryName: id ?? "",
                assetId: entry.assetId,
                toAssetName: "",
              });
            }
          }}
          disabled={isDisabled}
        >
          <SelectTrigger className={categoryValue === "" || categoryValue === placeholderValue ? "text-muted-foreground/40" : ""}>
            <SelectValue placeholder={t("placeholderCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={placeholderValue} className="text-muted-foreground">
              {t("placeholderCategory")}
            </SelectItem>
            <div className="px-2 pt-2 text-xs text-muted-foreground">
              {t("labelExpense")}
            </div>
            {expenseCategories.map((category) => (
              <SelectItem
                key={`expense:${category.name}`}
                value={`expense::${category.name}`}
              >
                {category.name}
              </SelectItem>
            ))}
            <SelectItem
              key={`expense:${OTHER_CATEGORY_NAME}`}
              value={`expense::${OTHER_CATEGORY_NAME}`}
            >
              {t("labelOther")}
            </SelectItem>
            {assetOptions
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
            {incomeCategories.map((category) => (
              <SelectItem
                key={`income:${category.name}`}
                value={`income::${category.name}`}
              >
                {category.name}
              </SelectItem>
            ))}
            <SelectItem
              key={`income:${OTHER_CATEGORY_NAME}`}
              value={`income::${OTHER_CATEGORY_NAME}`}
            >
              {t("labelOther")}
            </SelectItem>
            {assetOptions
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
      </td>
      <td
        className="p-3 whitespace-normal break-words"
        data-label={t("labelMemo")}
        data-col="memo"
      >
        <Input
          list="memo-suggest"
          placeholder={t("placeholderMemo")}
          value={entry.memo}
          onChange={(event) => setEntry({ ...entry, memo: event.target.value })}
          disabled={isDisabled}
        />
      </td>
      <td
        className="p-3 whitespace-nowrap text-right"
        data-label={t("labelAmount")}
        data-col="amount"
      >
        <div className="ledger-amount-inline">
          <Input
            type="number"
            placeholder={t("placeholderAmount")}
            value={entry.amount}
            onChange={(event) => setEntry({ ...entry, amount: event.target.value })}
            disabled={isDisabled}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || isDisabled || !isEntryValid}
            className="ledger-inline-action"
          >
            {t("actionAdd")}
          </Button>
        </div>
      </td>
      <td
        className="ledger-action-cell p-3 text-center"
        data-label=""
        data-col="action"
      >
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || isDisabled || !isEntryValid}
        >
          {t("actionAdd")}
        </Button>
      </td>
    </tr>
  );
};
