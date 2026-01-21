export type Asset = {
  id: string;
  name: string;
  type?: string;
  currency: string;
  isActive: boolean;
  initialBalance: number;
  currentBalance: number;
  note?: string;
  sortOrder: number;
};

export type Category = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  kind?: "expense" | "income";
};

export type TxBase = {
  id: string;
  type: "expense" | "income" | "transfer";
  occurredAt: string;
  amount: number;
  memo?: string;
};

export type TxExpense = TxBase & {
  type: "expense";
  assetId: string;
  categoryId: string;
  merchant?: string;
};

export type TxIncome = TxBase & {
  type: "income";
  assetId: string;
  categoryId: string;
  source?: string;
};

export type TxTransfer = TxBase & {
  type: "transfer";
  fromAssetId: string;
  toAssetId: string;
  fee: number;
};

export type Transaction = TxExpense | TxIncome | TxTransfer;

export type MonthlySummary = {
  incomeTotal: number;
  expenseTotal: number;
  net: number;
  byCategory: Array<{ categoryId: string; amount: number }>;
};

export type TransactionType = Transaction["type"] | "all";

export type TransactionsResponse = {
  items: Transaction[];
  nextCursor?: string | null;
};
