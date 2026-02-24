import type { Transaction } from "@/lib/types";

const parseTimeMs = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

export const getTransactionDayOrder = (tx: Transaction): number => {
  if (typeof tx.dayOrder === "number" && Number.isFinite(tx.dayOrder)) {
    return tx.dayOrder;
  }
  const createdAtMs = parseTimeMs(tx.createdAt);
  if (createdAtMs !== null) {
    return createdAtMs;
  }
  const updatedAtMs = parseTimeMs(tx.updatedAt);
  if (updatedAtMs !== null) {
    return updatedAtMs;
  }
  return 0;
};

const getCreatedOrderMs = (tx: Transaction): number => {
  const createdAtMs = parseTimeMs(tx.createdAt);
  if (createdAtMs !== null) {
    return createdAtMs;
  }
  const updatedAtMs = parseTimeMs(tx.updatedAt);
  if (updatedAtMs !== null) {
    return updatedAtMs;
  }
  return 0;
};

const compareIsoText = (
  a: string | undefined,
  b: string | undefined,
  order: "asc" | "desc"
): number => {
  const aa = a ?? "";
  const bb = b ?? "";
  if (aa === bb) {
    return 0;
  }
  return order === "desc" ? bb.localeCompare(aa) : aa.localeCompare(bb);
};

export const compareTransactionsInDay = (
  a: Transaction,
  b: Transaction,
  order: "asc" | "desc"
): number => {
  const dayOrderA = getTransactionDayOrder(a);
  const dayOrderB = getTransactionDayOrder(b);
  if (dayOrderA !== dayOrderB) {
    return order === "desc" ? dayOrderB - dayOrderA : dayOrderA - dayOrderB;
  }

  const createdA = getCreatedOrderMs(a);
  const createdB = getCreatedOrderMs(b);
  if (createdA !== createdB) {
    return order === "desc" ? createdB - createdA : createdA - createdB;
  }

  const createdTextCmp = compareIsoText(a.createdAt, b.createdAt, order);
  if (createdTextCmp !== 0) {
    return createdTextCmp;
  }

  const updatedTextCmp = compareIsoText(a.updatedAt, b.updatedAt, order);
  if (updatedTextCmp !== 0) {
    return updatedTextCmp;
  }

  return order === "desc"
    ? String(b.id ?? "").localeCompare(String(a.id ?? ""))
    : String(a.id ?? "").localeCompare(String(b.id ?? ""));
};
