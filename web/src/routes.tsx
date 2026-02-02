import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";

const LoginPage = lazy(() =>
  import("@/pages/login-page").then((module) => ({ default: module.LoginPage }))
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((module) => ({ default: module.DashboardPage }))
);
const LedgerPage = lazy(() =>
  import("@/components/ledger/ledger-page").then((module) => ({
    default: module.LedgerPage,
  }))
);
const AssetsPage = lazy(() =>
  import("@/components/assets/assets-page").then((module) => ({ default: module.AssetsPage }))
);
const AssetLedgerPage = lazy(() =>
  import("@/components/assets/asset-ledger-page").then((module) => ({
    default: module.AssetLedgerPage,
  }))
);
const AssetsSettingsPage = lazy(() =>
  import("@/components/settings/assets-settings-page").then((module) => ({
    default: module.AssetsSettingsPage,
  }))
);
const CategoriesSettingsPage = lazy(() =>
  import("@/components/settings/categories-settings-page").then((module) => ({
    default: module.CategoriesSettingsPage,
  }))
);
const DataSettingsPage = lazy(() =>
  import("@/components/settings/data-settings-page").then((module) => ({
    default: module.DataSettingsPage,
  }))
);
const TermsPage = lazy(() =>
  import("@/pages/terms-page").then((module) => ({
    default: module.TermsPage,
  }))
);
const SettingsPage = lazy(() =>
  import("@/components/settings/settings-page").then((module) => ({
    default: module.SettingsPage,
  }))
);

const withSuspense = (node: JSX.Element) => (
  <Suspense fallback={null}>{node}</Suspense>
);

export const RoutesConfig = () => (
  <Routes>
    <Route path="/login" element={withSuspense(<LoginPage />)} />
    <Route path="/" element={<AppLayout />}>
      <Route index element={withSuspense(<DashboardPage />)} />
      <Route path="ledger" element={withSuspense(<LedgerPage />)} />
      <Route path="assets" element={withSuspense(<AssetsPage />)} />
      <Route path="assets/:assetId/ledger" element={withSuspense(<AssetLedgerPage />)} />
      <Route path="settings" element={withSuspense(<SettingsPage />)} />
      <Route path="settings/assets" element={withSuspense(<AssetsSettingsPage />)} />
      <Route path="settings/categories" element={withSuspense(<CategoriesSettingsPage />)} />
      <Route path="settings/terms" element={withSuspense(<TermsPage />)} />
      <Route path="settings/data" element={withSuspense(<DataSettingsPage />)} />
    </Route>
  </Routes>
);
