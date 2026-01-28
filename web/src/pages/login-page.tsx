import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useText } from "@/lib/text";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export const LoginPage = () => {
  const { t } = useText();
  const { token, setToken } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      setError(null);
      setIsSubmitting(true);
      try {
        const sessionToken = await api.loginWithGoogle(response.credential);
        setToken(sessionToken);
        navigate("/", { replace: true });
      } catch (err) {
        console.error(err);
        setError(t("loginError"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, setToken, t]
  );

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    let isActive = true;
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) {
          throw new Error("config fetch failed");
        }
        const data = (await res.json()) as { googleClientId?: string };
        if (isActive) {
          setClientId(data.googleClientId ?? "");
        }
      } catch (error) {
        if (isActive) {
          setClientId("");
        }
      }
    };
    loadConfig();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const initialize = () => {
      const google = window.google;
      if (!google || !google.accounts?.id) {
        return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: "popup",
      });
      if (googleButtonRef.current) {
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          width: 280,
        });
      }
    };

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (script && !window.google) {
      script.addEventListener("load", initialize, { once: true });
      return () => script.removeEventListener("load", initialize);
    }
    initialize();
  }, [clientId, handleCredential]);

  return (
    <div className="page-shell flex h-full items-center justify-center overflow-auto p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t("loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("loginSubtitle")}
            </p>
            <div className="mt-4" ref={googleButtonRef} />
          </div>
          {isSubmitting ? (
            <p className="text-xs text-muted-foreground">{t("loginProcessing")}</p>
          ) : null}
          {!clientId ? (
            <p className="text-xs text-destructive">
              {t("loginMissingGoogleId")}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
