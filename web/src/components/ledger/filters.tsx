import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, startOfCurrentMonth, startOfPrevMonth } from "@/lib/date";
import { useText } from "@/lib/text";

const LEDGER_ORDER_STORAGE_KEY = "ledgerOrder";
const LEDGER_PERIOD_STORAGE_KEY = "ledgerPeriod";

const isValidDateString = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
};

export type LedgerFiltersState = {
  from: string;
  to: string;
  search: string;
  order: "desc" | "asc";
};

type PresetValue = "this-month" | "last-month" | "last-year" | "custom";

const getPresetRange = (preset: Exclude<PresetValue, "custom">) => {
  if (preset === "this-month") {
    return {
      from: formatDate(startOfCurrentMonth()),
      to: formatDate(endOfMonth(new Date())),
    };
  }
  if (preset === "last-month") {
    return {
      from: formatDate(startOfPrevMonth()),
      to: formatDate(endOfMonth(startOfPrevMonth())),
    };
  }
  return {
    from: formatDate(startOfMonth(subMonths(new Date(), 11))),
    to: formatDate(endOfMonth(new Date())),
  };
};

const detectPreset = (from: string, to: string): PresetValue => {
  const thisMonth = getPresetRange("this-month");
  if (from === thisMonth.from && to === thisMonth.to) {
    return "this-month";
  }
  const lastMonth = getPresetRange("last-month");
  if (from === lastMonth.from && to === lastMonth.to) {
    return "last-month";
  }
  const lastYear = getPresetRange("last-year");
  if (from === lastYear.from && to === lastYear.to) {
    return "last-year";
  }
  return "custom";
};

export const Filters = ({
  filters,
  setFilters,
}: {
  filters: LedgerFiltersState;
  setFilters: Dispatch<SetStateAction<LedgerFiltersState>>;
}) => {
  const { t } = useText();
  const presets = [
    { value: "this-month", label: t("filterPresetThisMonth") },
    { value: "last-month", label: t("filterPresetLastMonth") },
    { value: "last-year", label: t("filterPresetLastYear") },
    { value: "custom", label: t("filterPresetCustom") },
  ] as const;
  const [isInitialized, setIsInitialized] = useState(false);
  const fromMonthValue = filters.from ? filters.from.slice(0, 7) : "";
  const toMonthValue = filters.to ? filters.to.slice(0, 7) : "";
  const preset = detectPreset(filters.from, filters.to);

  useEffect(() => {
    if (isInitialized) {
      return;
    }
    const stored = localStorage.getItem(LEDGER_ORDER_STORAGE_KEY);
    if (stored === "asc" || stored === "desc") {
      setFilters((prev) => ({ ...prev, order: stored }));
    }
    const storedPeriod = localStorage.getItem(LEDGER_PERIOD_STORAGE_KEY);
    if (storedPeriod) {
      try {
        const parsed = JSON.parse(storedPeriod) as { from?: unknown; to?: unknown };
        if (isValidDateString(parsed.from) && isValidDateString(parsed.to)) {
          setFilters((prev) => ({ ...prev, from: parsed.from, to: parsed.to }));
        }
      } catch {
        // 保存データが壊れている場合は無視する
      }
    }
    setIsInitialized(true);
  }, [isInitialized, setFilters]);

  useEffect(() => {
    localStorage.setItem(LEDGER_ORDER_STORAGE_KEY, filters.order);
  }, [filters.order]);

  useEffect(() => {
    localStorage.setItem(
      LEDGER_PERIOD_STORAGE_KEY,
      JSON.stringify({ from: filters.from, to: filters.to })
    );
  }, [filters.from, filters.to]);

  return (
    <div className="grid gap-3">
      {/* md 未満は縦積みレイアウトで幅不足によるはみ出しを防ぐ */}
      <div className="grid gap-3 md:hidden">
        {/* できるだけ1行に収め、どうしても折れるときはプリセットの後を折り返す */}
        <div className="flex flex-wrap items-center gap-1">
          <Select
            value={preset}
            onValueChange={(value) => {
              const selected = value as PresetValue;
              if (selected === "custom") {
                return;
              }
              const range = getPresetRange(selected);
              setFilters({ ...filters, from: range.from, to: range.to });
            }}
          >
            <SelectTrigger className="!w-auto min-w-[64px] flex-shrink-0 h-8 px-2 text-xs">
              <SelectValue placeholder={t("filterPeriodPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {presets.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-1 min-w-0 items-center gap-1 max-[360px]:basis-full">
            <Input
              type="month"
              value={fromMonthValue}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setFilters({ ...filters, from: "" });
                  return;
                }
                const monthStart = startOfMonth(new Date(`${value}-01T00:00:00`));
                setFilters({ ...filters, from: formatDate(monthStart) });
              }}
              className="flex-1 min-w-0 h-8 px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {t("filterRangeSeparator")}
            </span>
            <Input
              type="month"
              value={toMonthValue}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setFilters({ ...filters, to: "" });
                  return;
                }
                const monthEnd = endOfMonth(new Date(`${value}-01T00:00:00`));
                setFilters({ ...filters, to: formatDate(monthEnd) });
              }}
              className="flex-1 min-w-0 h-8 px-2 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-nowrap max-[400px]:flex-wrap items-center gap-2">
          <Input
            placeholder={t("filterSearchPlaceholder")}
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
              <SelectValue placeholder={t("filterOrderPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">{t("filterOrderNew")}</SelectItem>
              <SelectItem value="asc">{t("filterOrderOld")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-4">
        <div className="flex items-center gap-2">
          <Select
            value={preset}
            onValueChange={(value) => {
              const selected = value as PresetValue;
              if (selected === "custom") {
                return;
              }
              const range = getPresetRange(selected);
              setFilters({ ...filters, from: range.from, to: range.to });
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder={t("filterPeriodPlaceholder")} />
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
            type="month"
            value={fromMonthValue}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                setFilters({ ...filters, from: "" });
                return;
              }
              const monthStart = startOfMonth(new Date(`${value}-01T00:00:00`));
              setFilters({ ...filters, from: formatDate(monthStart) });
            }}
            className="w-32 md:w-36"
          />
          <span className="text-sm text-muted-foreground">
            {t("filterRangeSeparator")}
          </span>
          <Input
            type="month"
            value={toMonthValue}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                setFilters({ ...filters, to: "" });
                return;
              }
              const monthEnd = endOfMonth(new Date(`${value}-01T00:00:00`));
              setFilters({ ...filters, to: formatDate(monthEnd) });
            }}
            className="w-32 md:w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("filterSearchPlaceholder")}
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
              <SelectValue placeholder={t("filterOrderPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">{t("filterOrderNew")}</SelectItem>
              <SelectItem value="asc">{t("filterOrderOld")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
