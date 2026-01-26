import { Link, NavLink } from "react-router-dom";
import { Home, List, Settings, Wallet } from "lucide-react";
import { useAssets } from "@/lib/query";

const navItems = [
  { to: "/", label: "まとめ", icon: Home },
  { to: "/ledger", label: "ぜんぶ", icon: List },
];

type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export const Sidebar = ({ onNavigate, className = "" }: SidebarProps) => {
  const { data: assets = [] } = useAssets();
  const activeAssets = assets
    .filter((asset) => asset.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <aside
      className={`relative z-40 w-full shrink-0 border-b bg-card/80 px-2 pb-2 shadow-elevated backdrop-blur min-[1200px]:h-screen min-[1200px]:w-64 min-[1200px]:border-b-0 min-[1200px]:border-r min-[1200px]:p-5 min-[1200px]:overflow-hidden ${className}`}
    >
      <nav className="pt-16 min-[1200px]:pt-0 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          );
        })}
        {activeAssets.length === 0 ? (
          <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
            いれものがないよ
          </div>
        ) : (
          activeAssets.map((asset) => (
            <NavLink
              key={asset.id}
              to={`/assets/${asset.id}/ledger`}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`
              }
            >
              <Wallet className="h-4 w-4" />
              <span className="whitespace-nowrap">{asset.name}</span>
            </NavLink>
          ))
        )}
        <div className="my-2 border-t" />
        <NavLink
          to="/settings/assets"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-sm transition ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-secondary"
            }`
          }
        >
          <Settings className="h-4 w-4" />
          <span className="whitespace-nowrap">いれもの設定</span>
        </NavLink>
        <NavLink
          to="/settings/categories"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-sm transition ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-secondary"
            }`
          }
        >
          <Settings className="h-4 w-4" />
          <span className="whitespace-nowrap">つかいみち設定</span>
        </NavLink>
      </nav>
    </aside>
  );
};
