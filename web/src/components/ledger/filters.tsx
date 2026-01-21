import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { addDays } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, startOfCurrentMonth, startOfNextMonth, startOfPrevMonth } from "@/lib/date";
import type { Asset, Category, TransactionType } from "@/lib/types";

export type LedgerFiltersState = {
  from: string;
  to: string;
  type: TransactionType;
  search: string;
  assetId?: string;
  categoryId?: string;
};

const presets = [
  { value: "this-month", label: "今月" },
  { value: "last-month", label: "先月" },
  { value: "last-30", label: "過去30日" },
  { value: "custom", label: "任意" },
] as const;

type PresetValue = (typeof presets)[number]["value"];

export const Filters = ({
  filters,
  setFilters,
  assets,
  categories,
  showAssetFilter,
}: {
  filters: LedgerFiltersState;
  setFilters: Dispatch<SetStateAction<LedgerFiltersState>>;
  assets: Asset[];
  categories: Category[];
  showAssetFilter?: boolean;
}) => {
  const [preset, setPreset] = useState<PresetValue>("this-month");

  useEffect(() => {
    if (preset === "custom") {
      return;
    }
    let nextFrom = filters.from;
    let nextTo = filters.to;
    if (preset === "this-month") {
      nextFrom = formatDate(startOfCurrentMonth());
      nextTo = formatDate(startOfNextMonth());
    }
    if (preset === "last-month") {
      nextFrom = formatDate(startOfPrevMonth());
      nextTo = formatDate(startOfCurrentMonth());
    }
    if (preset === "last-30") {
      nextFrom = formatDate(addDays(new Date(), -30));
      nextTo = formatDate(new Date());
    }
    if (nextFrom === filters.from && nextTo === filters.to) {
      return;
    }
    setFilters({ ...filters, from: nextFrom, to: nextTo });
  }, [preset, filters, setFilters]);

  const isCategoryEnabled = filters.type === "expense" || filters.type === "income" || filters.type === "all";

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={preset} onValueChange={(value) => setPreset(value as PresetValue)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="期間" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={filters.from}
        onChange={(event) => setFilters({ ...filters, from: event.target.value })}
      />
      <Input
        type="date"
        value={filters.to}
        onChange={(event) => setFilters({ ...filters, to: event.target.value })}
      />

      <Select
        value={filters.type}
        onValueChange={(value) => setFilters({ ...filters, type: value as TransactionType })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="種別" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべて</SelectItem>
          <SelectItem value="expense">支出</SelectItem>
          <SelectItem value="income">収入</SelectItem>
          <SelectItem value="transfer">振替</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="検索（相手/メモ）"
        value={filters.search}
        onChange={(event) => setFilters({ ...filters, search: event.target.value })}
      />

      {showAssetFilter ? (
        <Select
          value={filters.assetId ?? "all"}
          onValueChange={(value) =>
            setFilters({ ...filters, assetId: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="資産" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての資産</SelectItem>
            {assets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={filters.categoryId ?? "all"}
        onValueChange={(value) =>
          setFilters({ ...filters, categoryId: value === "all" ? undefined : value })
        }
        disabled={!isCategoryEnabled}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="費目" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての費目</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
