const LAST_ASSET_KEY = "ledger.lastAsset";
const LAST_CATEGORY_KEY = "ledger.lastCategory";

export const storage = {
  getLastAssetId() {
    return localStorage.getItem(LAST_ASSET_KEY);
  },
  setLastAssetId(value: string) {
    localStorage.setItem(LAST_ASSET_KEY, value);
  },
  getLastCategoryId() {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  },
  setLastCategoryId(value: string) {
    localStorage.setItem(LAST_CATEGORY_KEY, value);
  },
};
