import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";

export const AppLayout = () => {
  return (
    <div className="page-shell min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
