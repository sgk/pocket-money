import type { Transaction } from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { compareTransactionsInDay } from "@/lib/transaction-order";

type BalanceMode =
  | { type: "all" }
  | { type: "asset"; assetName: string };

const sortAsc = (transactions: Transaction[]) => {
  const withIndex = transactions.map((tx, index) => ({ tx, index }));
  withIndex.sort((a, b) => {
    const dateA = toDateKey(a.tx.occurredAt);
    const dateB = toDateKey(b.tx.occurredAt);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const sameDayCmp = compareTransactionsInDay(a.tx, b.tx, "asc");
    if (sameDayCmp !== 0) {
      return sameDayCmp;
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
    running = openingBalances[mode.assetName] ?? 0;
  }

  const ordered = sortAsc(transactions);
  ordered.forEach((tx) => {
    if (tx.pendingOperation === "delete") {
      balancesById[tx.id] = running;
      return;
    }
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

    const assetName = mode.assetName;
    if (tx.type === "expense" && tx.assetName === assetName) {
      running -= tx.amount;
      balancesById[tx.id] = running;
      return;
    }
    if (tx.type === "income" && tx.assetName === assetName) {
      running += tx.amount;
      balancesById[tx.id] = running;
      return;
    }
    if (tx.type === "transfer") {
      if (tx.fromAssetName === assetName) {
        running -= tx.amount + (tx.fee ?? 0);
        balancesById[tx.id] = running;
        return;
      }
      if (tx.toAssetName === assetName) {
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
    running = openingBalances[mode.assetName] ?? 0;
  }

  const ordered = sortAsc(transactions);
  ordered.forEach((tx) => {
    if (tx.pendingOperation === "delete") {
      return;
    }
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

    const assetName = mode.assetName;
    if (tx.type === "expense" && tx.assetName === assetName) {
      running -= tx.amount;
      return;
    }
    if (tx.type === "income" && tx.assetName === assetName) {
      running += tx.amount;
      return;
    }
    if (tx.type === "transfer") {
      if (tx.fromAssetName === assetName) {
        running -= tx.amount + (tx.fee ?? 0);
        return;
      }
      if (tx.toAssetName === assetName) {
        running += tx.amount;
        return;
      }
    }
  });

  return running;
};
