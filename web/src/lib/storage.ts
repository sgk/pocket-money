const LAST_ASSET_KEY = "ledger.lastAsset";
const LAST_CATEGORY_KEY = "ledger.lastCategoryName";
const LAST_ASSET_ID_KEY = "ledger.lastAssetId";
const LAST_CATEGORY_ID_KEY = "ledger.lastCategoryId";
const USER_GRADE_KEY = "user.grade";
const USER_LAST_ACCESS_KEY = "user.lastAccessAt";

export const STORAGE_KEYS = {
  lastAsset: LAST_ASSET_KEY,
  lastCategory: LAST_CATEGORY_KEY,
  lastAssetId: LAST_ASSET_ID_KEY,
  lastCategoryId: LAST_CATEGORY_ID_KEY,
  grade: USER_GRADE_KEY,
  lastAccessAt: USER_LAST_ACCESS_KEY,
};

export const storage = {
  getLastAssetName() {
    return localStorage.getItem(LAST_ASSET_KEY);
  },
  setLastAssetName(value: string) {
    localStorage.setItem(LAST_ASSET_KEY, value);
  },
  getLastAssetId() {
    return localStorage.getItem(LAST_ASSET_ID_KEY);
  },
  setLastAssetId(value: string) {
    localStorage.setItem(LAST_ASSET_ID_KEY, value);
  },
  getLastCategoryName() {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  },
  setLastCategoryName(value: string) {
    localStorage.setItem(LAST_CATEGORY_KEY, value);
  },
  getLastCategoryId() {
    return localStorage.getItem(LAST_CATEGORY_ID_KEY);
  },
  setLastCategoryId(value: string) {
    localStorage.setItem(LAST_CATEGORY_ID_KEY, value);
  },
  getGrade() {
    return localStorage.getItem(USER_GRADE_KEY);
  },
  setGrade(value: string) {
    localStorage.setItem(USER_GRADE_KEY, value);
  },
  getLastAccessAt() {
    return localStorage.getItem(USER_LAST_ACCESS_KEY);
  },
  setLastAccessAt(value: string) {
    localStorage.setItem(USER_LAST_ACCESS_KEY, value);
  },
};
