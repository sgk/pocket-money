import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export const AppLayout = () => {
  return (
    <div className="page-shell h-screen overflow-hidden">
      <div className="flex h-full flex-col md:flex-row">
        <Sidebar />
        <div className="flex flex-1 min-h-0 flex-col">
          <header className="relative z-40 hidden shrink-0 justify-end px-4 pt-4 md:flex md:px-6">
            <UserMenu />
          </header>
          <main className="relative z-0 flex-1 min-h-0 overflow-auto px-4 pb-0 pt-0 md:px-6 md:pb-0 md:pt-4">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
