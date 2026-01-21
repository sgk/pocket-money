const LAST_ASSET_KEY = "ledger.lastAsset";
const LAST_CATEGORY_KEY = "ledger.lastCategoryName";

export const storage = {
  getLastAssetId() {
    return localStorage.getItem(LAST_ASSET_KEY);
  },
  setLastAssetId(value: string) {
    localStorage.setItem(LAST_ASSET_KEY, value);
  },
  getLastCategoryName() {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  },
  setLastCategoryName(value: string) {
    localStorage.setItem(LAST_CATEGORY_KEY, value);
  },
};
