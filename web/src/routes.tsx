import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { LedgerPage } from "@/components/ledger/ledger-page";
import { AssetsPage } from "@/components/assets/assets-page";
import { AssetLedgerPage } from "@/components/assets/asset-ledger-page";
import { AssetsSettingsPage } from "@/components/settings/assets-settings-page";
import { CategoriesSettingsPage } from "@/components/settings/categories-settings-page";
import { DataSettingsPage } from "@/components/settings/data-settings-page";
import { PersonalSettingsPage } from "@/components/settings/personal-settings-page";

export const RoutesConfig = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<AppLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="ledger" element={<LedgerPage />} />
      <Route path="assets" element={<AssetsPage />} />
      <Route path="assets/:assetId/ledger" element={<AssetLedgerPage />} />
      <Route path="settings/assets" element={<AssetsSettingsPage />} />
      <Route path="settings/categories" element={<CategoriesSettingsPage />} />
      <Route path="settings/personal" element={<PersonalSettingsPage />} />
      <Route path="settings/data" element={<DataSettingsPage />} />
    </Route>
  </Routes>
);
