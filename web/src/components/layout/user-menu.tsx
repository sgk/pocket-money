import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBootstrap } from "@/lib/query";
import { useText } from "@/lib/text";

type UserMenuProps = {
  compact?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const UserMenu = ({ compact = false, isOpen, onOpenChange }: UserMenuProps) => {
  const { t } = useText();
  const { logout } = useAuth();
  const { data } = useBootstrap();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const email = data?.profile?.email?.trim();
  const displayName = data?.profile?.displayName?.trim();
  const label = email || t("noEmail");
  const menuLabel = displayName || label;
  const photoUrl = data?.profile?.photoUrl;

  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  useEffect(() => {
    if (isControlled) {
      return;
    }
    onOpenChange?.(internalOpen);
  }, [internalOpen, isControlled, onOpenChange]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        if (isControlled) {
          onOpenChange?.(false);
        } else {
          setInternalOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isControlled, onOpenChange]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-full transition hover:bg-secondary/60 ${
          compact ? "h-8 w-8 translate-y-[4px]" : "h-9 w-9"
        }`}
        onClick={() => {
          if (isControlled) {
            onOpenChange?.(!open);
            return;
          }
          setInternalOpen((prev) => !prev);
        }}
        aria-label={label}
      >
        {photoUrl && !imageError ? (
          <img
            src={photoUrl}
            alt={t("userAvatarAlt")}
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
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border bg-card p-2 text-sm shadow-lg">
          <div className="px-2 py-1 text-xs text-muted-foreground">{menuLabel}</div>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
            onClick={handleLogout}
          >
            {t("logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
};
