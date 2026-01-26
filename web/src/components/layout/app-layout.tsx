import { useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="page-shell h-screen overflow-hidden">
      <div className="flex h-full flex-col">
        <header className="relative z-40 flex items-center justify-between border-b bg-card/80 px-4 py-2 shadow-elevated backdrop-blur min-[1200px]:px-6">
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary min-[1200px]:invisible"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "メニューをとじる" : "メニューをひらく"}
            ref={menuButtonRef}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="font-display text-lg leading-none">おこづかいノート</div>
          <UserMenu compact />
        </header>

        <div className="flex h-full flex-1 min-h-0 min-[1200px]:flex-row">
          <div className="hidden min-[1200px]:block">
            <Sidebar />
          </div>
          <div className="flex flex-1 min-h-0 flex-col">
            <main className="relative z-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 pb-0 pt-0 min-[1200px]:px-6 min-[1200px]:pb-0 min-[1200px]:pt-0">
              <div className="flex h-full min-h-0 w-full flex-col">
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
        inert={sidebarOpen ? undefined : ""}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/20 transition-opacity duration-200 ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeSidebar}
          aria-label="メニューをとじる"
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
