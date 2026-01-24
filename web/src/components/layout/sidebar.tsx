import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Home, List, Menu, Wallet } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { useAssets } from "@/lib/query";

const navItems = [
  { to: "/", label: "まとめ", icon: Home },
  { to: "/ledger", label: "ぜんぶ", icon: List },
];

export const Sidebar = () => {
  const { data: assets = [] } = useAssets();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const activeAssets = assets
    .filter((asset) => asset.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <aside className="relative z-40 w-full shrink-0 border-b bg-card/80 p-2 shadow-elevated backdrop-blur md:h-screen md:w-64 md:border-b-0 md:border-r md:p-5 md:overflow-hidden">
      <div className="mb-1 md:mb-8">
        <div className="flex items-center gap-2 md:block">
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary md:hidden"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="メニューをひらく"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-lg leading-none md:text-2xl">
            おこづかいノート
          </Link>
          <div className="ml-auto md:hidden">
            <UserMenu compact onOpenChange={(open) => open && setIsOpen(false)} />
          </div>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">
          かんたんに きろく
        </p>
      </div>
      <nav className="mt-4 hidden flex-col gap-2 md:flex md:mt-0">
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
            いれものがないよ
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
      <div
        className={`absolute left-4 right-4 top-12 z-50 md:hidden ${
          isOpen ? "block" : "hidden"
        }`}
      >
        <div className="rounded-lg bg-card/95 p-2 backdrop-blur">
          <NavLink
            to="/ledger"
            className={({ isActive }) =>
              `flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`
            }
          >
            <List className="h-4 w-4" />
            <span className="whitespace-nowrap">ぜんぶ</span>
          </NavLink>
          {activeAssets.length === 0 ? (
            <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              いれものがないよ
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
        </div>
      </div>
    </aside>
  );
};
