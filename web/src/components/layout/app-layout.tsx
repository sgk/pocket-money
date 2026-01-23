import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export const AppLayout = () => {
  return (
    <div className="page-shell min-h-screen">
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="hidden justify-end px-4 pt-4 md:flex md:px-6">
            <UserMenu />
          </header>
          <main className="flex-1 p-4 pt-4 md:p-6">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
