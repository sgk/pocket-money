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
import { formatDate, startOfCurrentMonth, startOfPrevMonth } from "@/lib/date";
import { endOfMonth } from "date-fns";
export type LedgerFiltersState = {
  from: string;
  to: string;
  search: string;
  order: "desc" | "asc";
};

const presets = [
  { value: "this-month", label: "こんげつ" },
  { value: "last-month", label: "せんげつ" },
  { value: "last-30", label: "30にち" },
  { value: "custom", label: "そのた" },
] as const;

type PresetValue = (typeof presets)[number]["value"];

export const Filters = ({
  filters,
  setFilters,
}: {
  filters: LedgerFiltersState;
  setFilters: Dispatch<SetStateAction<LedgerFiltersState>>;
}) => {
  const [preset, setPreset] = useState<PresetValue>("this-month");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      return;
    }
    const stored = localStorage.getItem("ledgerOrder");
    if (stored === "asc" || stored === "desc") {
      setFilters((prev) => ({ ...prev, order: stored }));
    }
    setIsInitialized(true);
  }, [isInitialized, setFilters]);

  useEffect(() => {
    if (preset === "custom") {
      return;
    }
    let nextFrom = filters.from;
    let nextTo = filters.to;
    if (preset === "this-month") {
      nextFrom = formatDate(startOfCurrentMonth());
      nextTo = formatDate(endOfMonth(new Date()));
    }
    if (preset === "last-month") {
      nextFrom = formatDate(startOfPrevMonth());
      nextTo = formatDate(endOfMonth(startOfPrevMonth()));
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

  useEffect(() => {
    localStorage.setItem("ledgerOrder", filters.order);
  }, [filters.order]);

  return (
    <div className="grid gap-3">
      {/* md 未満は縦積みレイアウトで幅不足によるはみ出しを防ぐ */}
      <div className="grid gap-3 md:hidden">
        {/* 530px未満では日付を折返し、530px以上で1行維持 */}
        <div className="flex flex-nowrap max-[530px]:flex-wrap items-center gap-1">
          <Select value={preset} onValueChange={(value) => setPreset(value as PresetValue)}>
            <SelectTrigger className="!w-auto min-w-[84px] flex-shrink-0">
              <SelectValue placeholder="きかん" />
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
            onChange={(event) => {
              setFilters({ ...filters, from: event.target.value });
              setPreset("custom");
            }}
            className="flex-1 min-w-[100px] max-[530px]:min-w-[140px]"
          />
          <span className="text-sm text-muted-foreground flex-shrink-0">～</span>
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => {
              setFilters({ ...filters, to: event.target.value });
              setPreset("custom");
            }}
            className="flex-1 min-w-[100px] max-[530px]:min-w-[140px]"
          />
        </div>
        <div className="flex flex-nowrap max-[400px]:flex-wrap items-center gap-2">
          <Input
            placeholder="さがす（あいて/メモ）"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            className="flex-1 min-w-[180px] w-full max-[400px]:min-w-0"
          />
          <Select
            value={filters.order}
            onValueChange={(value) =>
              setFilters({ ...filters, order: value as "desc" | "asc" })
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="ならび" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">あたらしい</SelectItem>
              <SelectItem value="asc">ふるい</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-4">
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(value) => setPreset(value as PresetValue)}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="きかん" />
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
            onChange={(event) => {
              setFilters({ ...filters, from: event.target.value });
              setPreset("custom");
            }}
            className="w-32 md:w-36"
          />
          <span className="text-sm text-muted-foreground">～</span>
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => {
              setFilters({ ...filters, to: event.target.value });
              setPreset("custom");
            }}
            className="w-32 md:w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="さがす（あいて/メモ）"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            className="min-w-[220px] w-[320px]"
          />
          <Select
            value={filters.order}
            onValueChange={(value) =>
              setFilters({ ...filters, order: value as "desc" | "asc" })
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="ならび" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">あたらしい</SelectItem>
              <SelectItem value="asc">ふるい</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
