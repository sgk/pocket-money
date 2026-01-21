import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBootstrap } from "@/lib/query";

export const UserMenu = () => {
  const { logout } = useAuth();
  const { data } = useBootstrap();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const email = data?.profile?.email ?? "メールなし";

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm shadow-sm transition hover:bg-secondary"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </span>
        <span className="max-w-[120px] truncate text-sm sm:max-w-[180px]">{email}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-card p-2 text-sm shadow-lg">
          <div className="px-2 py-1 text-xs text-muted-foreground">せってい</div>
          <Link
            to="/settings/assets"
            className="block rounded-md px-3 py-2 hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            おかねばしょ設定
          </Link>
          <Link
            to="/settings/categories"
            className="block rounded-md px-3 py-2 hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            つかいみち設定
          </Link>
          <div className="my-2 border-t" />
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
            onClick={handleLogout}
          >
            ログアウト
          </button>
        </div>
      ) : null}
    </div>
  );
};
