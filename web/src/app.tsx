import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useBootstrap } from "@/lib/query";
import { RoutesConfig } from "@/routes";

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">じゅんびちゅう...</p>
    </div>
  </div>
);

export const App = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const bootstrap = useBootstrap();

  useEffect(() => {
    if (bootstrap.isError) {
      logout();
      navigate("/login", { replace: true });
    }
  }, [bootstrap.isError, logout, navigate]);

  if (token && bootstrap.isLoading) {
    return <LoadingScreen />;
  }

  if (!token && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  return <RoutesConfig />;
};
