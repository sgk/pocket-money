import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, RefreshCw, WifiOff, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { useText } from "@/lib/text";
import {
  getOfflineOperationsCount,
  OFFLINE_OPERATIONS_CHANGED_EVENT,
} from "@/lib/api";

export const AppLayout = () => {
  const { t } = useText();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isServerReachable, setIsServerReachable] = useState(() => navigator.onLine);
  const [offlineOpsCount, setOfflineOpsCount] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (next) {
        setUserMenuOpen(false);
      }
      return next;
    });
  };
  const closeSidebar = () => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const checkServerReachable = async () => {
      if (!navigator.onLine) {
        if (active) {
          setIsServerReachable(false);
        }
        return;
      }
      try {
        const response = await fetch("/healthz", {
          method: "GET",
          cache: "no-store",
        });
        if (active) {
          setIsServerReachable(response.ok);
        }
      } catch {
        if (active) {
          setIsServerReachable(false);
        }
      }
    };

    const trigger = () => {
      void checkServerReachable();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        trigger();
      }
    };

    trigger();
    const timerId = window.setInterval(trigger, 15000);
    window.addEventListener("online", trigger);
    window.addEventListener("offline", trigger);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timerId);
      window.removeEventListener("online", trigger);
      window.removeEventListener("offline", trigger);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getOfflineOperationsCount().then((count) => {
        if (active) {
          setOfflineOpsCount(count);
        }
      });
    };
    refresh();
    window.addEventListener(OFFLINE_OPERATIONS_CHANGED_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_OPERATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  const isOffline = !isOnline || !isServerReachable;
  const showStatus = isOffline || offlineOpsCount > 0;
  const statusText =
    isOffline && offlineOpsCount > 0
      ? `オフライン / 同期待ち ${offlineOpsCount} 件`
      : isOffline
        ? "オフライン"
        : `同期待ち ${offlineOpsCount} 件`;

  return (
    <div className="page-shell h-screen overflow-hidden">
      <div className="flex h-full flex-col">
        <header className="relative z-40 flex items-center justify-between border-b bg-card/80 px-4 py-2 shadow-elevated backdrop-blur min-[1200px]:px-6">
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary min-[1200px]:invisible"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? t("menuClose") : t("menuOpen")}
            ref={menuButtonRef}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="font-display text-lg leading-none">{t("appTitle")}</div>
          </div>
          <div className="flex items-center gap-2">
            {showStatus ? (
              <div
                className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/30 px-2 py-1 text-xs text-muted-foreground"
                aria-label={statusText}
                title={statusText}
              >
                {isOffline ? (
                  <WifiOff
                    className="h-3.5 w-3.5 text-amber-700"
                    aria-label="オフライン"
                    title="オフライン"
                  />
                ) : null}
                {offlineOpsCount > 0 ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-sky-700" aria-hidden />
                    <span className="tabular-nums text-foreground">{offlineOpsCount}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <UserMenu
              compact
              isOpen={userMenuOpen}
              onOpenChange={(open) => {
                setUserMenuOpen(open);
                if (open) {
                  setSidebarOpen(false);
                }
              }}
            />
          </div>
        </header>

        <div className="flex h-full flex-1 min-h-0 min-[1200px]:flex-row">
          <div className="hidden min-[1200px]:block">
            <Sidebar />
          </div>
          <div className="flex flex-1 min-h-0 flex-col">
            <main className="relative z-0 flex-1 min-h-0 overflow-hidden max-[900px]:px-0 min-[901px]:px-4 pb-0 pt-0 min-[1200px]:px-6 min-[1200px]:pb-0 min-[1200px]:pt-0">
              <div className="flex h-full min-h-0 w-full flex-col max-[900px]:px-4">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
      <div
        className={`fixed inset-0 z-30 min-[1200px]:hidden transition ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!sidebarOpen}
        {...({ inert: sidebarOpen ? undefined : "" } as any)}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/20 transition-opacity duration-200 ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeSidebar}
          aria-label={t("menuClose")}
          tabIndex={sidebarOpen ? 0 : -1}
        />
        <Sidebar
          onNavigate={closeSidebar}
          className={`relative z-10 h-full w-[33vw] max-w-[280px] border-r bg-card/95 px-5 pb-5 shadow-elevated transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        />
      </div>
    </div>
  );
};
