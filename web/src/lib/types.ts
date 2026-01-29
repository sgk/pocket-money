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

export type UserProfile = {
  displayName?: string;
  email?: string;
  photoUrl?: string;
};

export type BootstrapResponse = {
  profile?: UserProfile;
  assets?: Asset[];
  categories?: Category[];
};

export type TxBase = {
  id: string;
  type: "expense" | "income" | "transfer";
  occurredAt: string;
  amount: number;
  memo?: string;
  dayOrder?: number;
};

export type TxExpense = TxBase & {
  type: "expense";
  assetId?: string;
  assetName: string;
  categoryId?: string;
  categoryName: string;
  merchant?: string;
};

export type TxIncome = TxBase & {
  type: "income";
  assetId?: string;
  assetName: string;
  categoryId?: string;
  categoryName: string;
  source?: string;
};

export type TxTransfer = TxBase & {
  type: "transfer";
  fromAssetId?: string;
  fromAssetName: string;
  toAssetId?: string;
  toAssetName: string;
  fee: number;
  feeCategoryId?: string;
  feeCategoryName?: string;
  counterparty?: string;
};

export type Transaction = TxExpense | TxIncome | TxTransfer;

export type MonthlySummary = {
  incomeTotal: number;
  expenseTotal: number;
  net: number;
  byCategory: Record<string, { expense: number; income: number }>;
};

export type TransactionType = Transaction["type"] | "all";

export type TransactionsResponse = {
  items: Transaction[];
  nextCursor?: string | null;
  openingBalances?: Record<string, number>;
};
