import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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

export const App = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onboarding = useOnboardingStatus();
  const isReady = onboarding.data?.state === "ready";
  const bootstrap = useBootstrap(isReady);

  useEffect(() => {
    if (onboarding.isError) {
      logout();
      navigate("/login", { replace: true });
    }
  }, [onboarding.isError, logout, navigate]);

  useEffect(() => {
    if (bootstrap.isError) {
      logout();
      navigate("/login", { replace: true });
    }
  }, [bootstrap.isError, logout, navigate]);

  if (token && onboarding.isLoading) {
    return <LoadingScreen />;
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

  if (token && onboarding.data?.profile?.ageGroup === "child") {
    if (location.pathname.startsWith("/settings/terms")) {
      return <Navigate to="/settings" replace />;
    }
  }

  return <RoutesConfig />;
};
