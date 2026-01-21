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
export type LedgerFiltersState = {
  from: string;
  to: string;
  search: string;
};

const presets = [
  { value: "this-month", label: "こんげつ" },
  { value: "last-month", label: "せんげつ" },
  { value: "last-30", label: "さいきん30にち" },
  { value: "custom", label: "えらぶ" },
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
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            className="w-full sm:w-40 md:w-44"
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            className="w-full sm:w-40 md:w-44"
          />
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
