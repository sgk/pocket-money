import type { Transaction } from "@/lib/types";
import { toDateKey } from "@/lib/date";

type BalanceMode =
  | { type: "all" }
  | { type: "asset"; assetId: string };

const sortAsc = (transactions: Transaction[]) => {
  const withIndex = transactions.map((tx, index) => ({ tx, index }));
  withIndex.sort((a, b) => {
    const dateA = toDateKey(a.tx.occurredAt);
    const dateB = toDateKey(b.tx.occurredAt);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const orderA = a.tx.dayOrder ?? 0;
    const orderB = b.tx.dayOrder ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.index - b.index;
  });
  return withIndex.map((item) => item.tx);
};

export const computeRunningBalances = (
  transactions: Transaction[],
  openingBalances: Record<string, number>,
  mode: BalanceMode
) => {
  const balancesById: Record<string, number> = {};
  let running = 0;
  if (mode.type === "all") {
    running = Object.values(openingBalances).reduce((sum, value) => sum + value, 0);
  } else {
    running = openingBalances[mode.assetId] ?? 0;
  }

  const ordered = sortAsc(transactions);
  ordered.forEach((tx) => {
    if (mode.type === "all") {
      if (tx.type === "expense") {
        running -= tx.amount;
      } else if (tx.type === "income") {
        running += tx.amount;
      } else if (tx.type === "transfer") {
        running -= tx.fee ?? 0;
      }
      balancesById[tx.id] = running;
      return;
    }

    const assetId = mode.assetId;
    if (tx.type === "expense" && tx.assetId === assetId) {
      running -= tx.amount;
      balancesById[tx.id] = running;
      return;
    }
    if (tx.type === "income" && tx.assetId === assetId) {
      running += tx.amount;
      balancesById[tx.id] = running;
      return;
    }
    if (tx.type === "transfer") {
      if (tx.fromAssetId === assetId) {
        running -= tx.amount + (tx.fee ?? 0);
        balancesById[tx.id] = running;
        return;
      }
      if (tx.toAssetId === assetId) {
        running += tx.amount;
        balancesById[tx.id] = running;
        return;
      }
    }
  });

  return balancesById;
};

export const computeEndingBalance = (
  transactions: Transaction[],
  openingBalances: Record<string, number>,
  mode: BalanceMode
) => {
  let running = 0;
  if (mode.type === "all") {
    running = Object.values(openingBalances).reduce((sum, value) => sum + value, 0);
  } else {
    running = openingBalances[mode.assetId] ?? 0;
  }

  const ordered = sortAsc(transactions);
  ordered.forEach((tx) => {
    if (mode.type === "all") {
      if (tx.type === "expense") {
        running -= tx.amount;
      } else if (tx.type === "income") {
        running += tx.amount;
      } else if (tx.type === "transfer") {
        running -= tx.fee ?? 0;
      }
      return;
    }

    const assetId = mode.assetId;
    if (tx.type === "expense" && tx.assetId === assetId) {
      running -= tx.amount;
      return;
    }
    if (tx.type === "income" && tx.assetId === assetId) {
      running += tx.amount;
      return;
    }
    if (tx.type === "transfer") {
      if (tx.fromAssetId === assetId) {
        running -= tx.amount + (tx.fee ?? 0);
        return;
      }
      if (tx.toAssetId === assetId) {
        running += tx.amount;
        return;
      }
    }
  });

  return running;
};
