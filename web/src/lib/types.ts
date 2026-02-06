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
  uid?: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
  ageGroup?: "adult" | "child";
  parent?: ParentInfo;
  parents?: ParentInfo[];
  parentUid?: string;
  parentUids?: string[];
  termsAgreement?: TermsAgreement;
  grade?: string;
  colorTheme?: "cream" | "mint" | "sky" | "pink";
};

export type ParentInfo = {
  uid?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
};

export type TermsAgreement = {
  termId?: string;
  agreedAt?: string;
  agreedByUid?: string;
};

export type TermsPayload = {
  termId: string;
  title: string;
  body: string;
  displayStartAt: string;
  graceEndsAt: string;
};

export type OnboardingState = "ready" | "needsAge" | "needsTerms" | "needsParentConsent";

export type OnboardingStatus = {
  state: OnboardingState;
  terms: TermsPayload;
  profile?: UserProfile;
  agreedTerms?: TermsPayload | null;
  effectiveDeadline?: string | null;
};

export type InviteItem = {
  id: string;
  childEmail?: string;
  createdAt?: string;
  usedAt?: string | null;
  childUid?: string;
  childName?: string;
  childPhotoUrl?: string;
};

export type InvitesResponse = {
  items: InviteItem[];
  limit: number;
};

export type BootstrapResponse = {
  profile?: UserProfile;
  assets?: Asset[];
  categories?: Category[];
  children?: UserProfile[];
  isParent?: boolean;
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
