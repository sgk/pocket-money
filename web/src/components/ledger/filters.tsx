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
  { value: "last-30", label: "さいきん30にち" },
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">きかん</span>
        <Select value={preset} onValueChange={(value) => setPreset(value as PresetValue)}>
          <SelectTrigger className="w-full sm:w-32">
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
          className="w-full sm:w-40 md:w-44"
        />
        <Input
          type="date"
          value={filters.to}
          onChange={(event) => {
            setFilters({ ...filters, to: event.target.value });
            setPreset("custom");
          }}
          className="w-full sm:w-40 md:w-44"
        />
        <span className="text-sm text-muted-foreground">ならび</span>
        <Select
          value={filters.order}
          onValueChange={(value) =>
            setFilters({ ...filters, order: value as "desc" | "asc" })
          }
        >
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="ならび" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">あたらしい</SelectItem>
            <SelectItem value="asc">ふるい</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">さがす</span>
        <Input
          placeholder="さがす（あいて/メモ）"
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          className="w-full sm:w-80"
        />
      </div>
    </div>
  );
};
