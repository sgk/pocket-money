import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, isNetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useBootstrap, useOnboardingStatus } from "@/lib/query";
import { RoutesConfig } from "@/routes";
import { useText } from "@/lib/text";
import { OnboardingPage } from "@/pages/onboarding-page";

const LoadingScreen = () => {
  const { t } = useText();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    </div>
  );
};

const OfflineUnavailableScreen = () => {
  const { t } = useText();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
        <p className="mt-2 text-sm">
          オフラインで表示できるキャッシュがありません。通信可能な状態で一度読み込んでください。
        </p>
      </div>
    </div>
  );
};

export const App = () => {
  const { token, childId, setChildId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onboarding = useOnboardingStatus();
  const isReady = onboarding.data?.state === "ready";
  const bootstrap = useBootstrap(isReady);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (onboarding.isError) {
      if (isNetworkError(onboarding.error)) {
        return;
      }
      logout();
      navigate("/login", { replace: true });
    }
  }, [token, onboarding.error, onboarding.isError, logout, navigate]);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (bootstrap.isError) {
      const error = bootstrap.error;
      if (isNetworkError(error)) {
        return;
      }
      const isStaleChildContextError =
        childId &&
        error instanceof ApiError &&
        error.code === "http" &&
        (error.message === "Not authorized to access this child data" ||
          error.message === "Child profile not found");
      if (isStaleChildContextError) {
        setChildId(null);
        navigate("/", { replace: true });
        return;
      }
      logout();
      navigate("/login", { replace: true });
    }
  }, [token, bootstrap.error, bootstrap.isError, childId, setChildId, logout, navigate]);

  if (token && onboarding.isLoading) {
    return <LoadingScreen />;
  }

  if (token && onboarding.isError && isNetworkError(onboarding.error)) {
    return <OfflineUnavailableScreen />;
  }

  if (!token && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  if (token && onboarding.data && onboarding.data.state !== "ready") {
    return <OnboardingPage />;
  }

  if (token && bootstrap.isLoading) {
    return <LoadingScreen />;
  }

  if (token && bootstrap.isError && isNetworkError(bootstrap.error)) {
    return <OfflineUnavailableScreen />;
  }

  if (token && onboarding.data?.profile?.ageGroup === "child") {
    if (location.pathname.startsWith("/settings/terms")) {
      return <Navigate to="/settings" replace />;
    }
  }

  return <RoutesConfig />;
};
