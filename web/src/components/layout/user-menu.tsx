import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBootstrap } from "@/lib/query";

type UserMenuProps = {
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const UserMenu = ({ compact = false, onOpenChange }: UserMenuProps) => {
  const { logout } = useAuth();
  const { data } = useBootstrap();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const email = data?.profile?.email?.trim();
  const displayName = data?.profile?.displayName?.trim();
  const label = email || "メールなし";
  const menuLabel = displayName || label;
  const photoUrl = data?.profile?.photoUrl;

  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

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
    <div className="relative z-50" ref={menuRef}>
      <button
        type="button"
        className={`flex items-center rounded-full border bg-card text-sm shadow-sm transition hover:bg-secondary ${
          compact ? "gap-1 px-2 py-2" : "gap-2 px-3 py-2"
        }`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
      >
        {photoUrl && !imageError ? (
          <img
            src={photoUrl}
            alt="ユーザー"
            className={`${compact ? "h-8 w-8" : "h-9 w-9"} rounded-full object-cover`}
            onError={() => setImageError(true)}
          />
        ) : (
          <span
            className={`flex items-center justify-center rounded-full bg-secondary text-secondary-foreground ${
              compact ? "h-8 w-8" : "h-9 w-9"
            }`}
          >
            <User className="h-4 w-4" />
          </span>
        )}
        {compact ? null : null}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border bg-card p-2 text-sm shadow-lg">
          <div className="px-2 py-1 text-xs text-muted-foreground">{menuLabel}</div>
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
