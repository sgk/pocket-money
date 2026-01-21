import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

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

const allowDevAuth = import.meta.env.VITE_ALLOW_DEV_AUTH === "true";
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export const LoginPage = () => {
  const { token, setToken } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [devUid, setDevUid] = useState("");

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

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
        callback: (response) => {
          if (!response.credential) {
            toast.error("ログインにしっぱいしました");
            return;
          }
          setToken(response.credential);
          navigate("/", { replace: true });
        },
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
  }, [setToken, navigate]);

  const handleDevLogin = () => {
    if (!devUid.trim()) {
      toast.error("なまえをいれてね");
      return;
    }
    setToken(`dev:${devUid.trim()}`);
    navigate("/", { replace: true });
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">ログイン</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Googleでログインしよう。
            </p>
            <div className="mt-4" ref={googleButtonRef} />
          </div>
          {allowDevAuth ? (
            <div className="rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">テストログイン</p>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="dev uid"
                  value={devUid}
                  onChange={(event) => setDevUid(event.target.value)}
                />
                <Button type="button" onClick={handleDevLogin}>
                  Dev Login
                </Button>
              </div>
            </div>
          ) : null}
          {!clientId ? (
            <p className="text-xs text-destructive">
              GoogleのIDが未設定です
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
