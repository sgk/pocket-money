import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export const formatDate = (value: string | Date) =>
  format(new Date(value), "yyyy-MM-dd");

export const formatDateSlash = (value: string | Date) =>
  format(new Date(value), "yyyy/MM/dd");

export const toDateKey = (value: string | Date) => {
  if (value instanceof Date) {
    return format(value, "yyyy-MM-dd");
  }
  const text = String(value);
  const base = text.includes("T") || text.includes(" ")
    ? text.slice(0, 10)
    : text;
  return base.replace(/\//g, "-");
};

export const startOfCurrentMonth = () => startOfMonth(new Date());

export const startOfNextMonth = () => startOfMonth(addMonths(new Date(), 1));

export const startOfPrevMonth = () => startOfMonth(subMonths(new Date(), 1));

export const endOfPrevMonth = () => endOfMonth(subMonths(new Date(), 1));

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

const hasTimePart = (value: string) => value.includes("T");

export const toStartOfDay = (value: string) =>
  hasTimePart(value) ? value : `${value}T00:00:00Z`;

export const toEndOfDay = (value: string) =>
  hasTimePart(value) ? value : `${value}T23:59:59Z`;
