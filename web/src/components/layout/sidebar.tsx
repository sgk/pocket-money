import { Link, NavLink } from "react-router-dom";
import { Home, List, Wallet } from "lucide-react";
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
      className={`relative z-40 w-full shrink-0 border-b bg-card/80 p-2 shadow-elevated backdrop-blur min-[1200px]:h-screen min-[1200px]:w-64 min-[1200px]:border-b-0 min-[1200px]:border-r min-[1200px]:p-5 min-[1200px]:overflow-hidden ${className}`}
    >
      <div className="mb-1 min-[1200px]:mb-8">
        <Link
          to="/"
          className="font-display text-lg leading-none min-[1200px]:text-2xl"
          onClick={onNavigate}
        >
          おこづかいノート
        </Link>
        <p className="hidden text-xs text-muted-foreground min-[1200px]:block">
          かんたんに きろく
        </p>
      </div>
      <nav className="mt-4 flex flex-col gap-2 min-[1200px]:mt-0">
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
      </nav>
    </aside>
  );
};
