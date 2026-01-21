import { NavLink } from "react-router-dom";
import { Home, List, Wallet } from "lucide-react";
import { useAssets } from "@/lib/query";

const navItems = [
  { to: "/", label: "まとめ", icon: Home },
  { to: "/ledger", label: "ぜんぶ", icon: List },
];

export const Sidebar = () => {
  const { data: assets = [] } = useAssets();
  const activeAssets = assets
    .filter((asset) => asset.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <aside className="w-full shrink-0 border-b bg-card/80 p-4 shadow-elevated backdrop-blur md:w-64 md:border-b-0 md:border-r md:p-5">
      <div className="mb-4 md:mb-8">
        <h1 className="font-display text-2xl">おこづかいノート</h1>
        <p className="text-xs text-muted-foreground">かんたんに きろく</p>
      </div>
      <nav className="mt-4 flex flex-col gap-2 md:mt-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
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
            ばしょがないよ
          </div>
        ) : (
          activeAssets.map((asset) => (
            <NavLink
              key={asset.id}
              to={`/assets/${asset.id}/ledger`}
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
