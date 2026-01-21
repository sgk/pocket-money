import { NavLink } from "react-router-dom";
import { Home, List, Settings, Wallet } from "lucide-react";

const navItems = [
  { to: "/", label: "まとめ", icon: Home },
  { to: "/ledger", label: "おかねノート", icon: List },
  { to: "/assets", label: "おかねのばしょ", icon: Wallet },
  { to: "/settings/assets", label: "おかねばしょ設定", icon: Settings },
  { to: "/settings/categories", label: "つかいみち設定", icon: Settings },
];

export const Sidebar = () => {
  return (
    <aside className="w-64 border-r bg-card/80 p-5 shadow-elevated backdrop-blur">
      <div className="mb-8">
        <h1 className="font-display text-2xl">おこづかいノート</h1>
        <p className="text-xs text-muted-foreground">かんたんに きろく</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
