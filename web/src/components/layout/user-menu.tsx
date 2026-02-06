import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, User, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useBootstrap, useInvalidateLedger } from "@/lib/query";
import { useText } from "@/lib/text";

type UserMenuProps = {
  compact?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const UserMenu = ({ compact = false, isOpen, onOpenChange }: UserMenuProps) => {
  const { t } = useText();
  const { childId, setChildId, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useBootstrap();
  const invalidate = useInvalidateLedger();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const profile = data?.profile;
  const email = profile?.email?.trim();
  const displayName = profile?.displayName?.trim();
  const label = email || t("noEmail");
  const menuLabel = displayName || label;
  const photoUrl = profile?.photoUrl;
  const children = data?.children ?? [];
  const isImpersonating = Boolean(childId);
  const hasChildrenSection = children.length > 0 || isImpersonating;

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
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border bg-card p-2 text-sm shadow-lg">
          <div className="px-3 py-2 border-b mb-1">
            <div className="font-medium truncate">{menuLabel}</div>
            {email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
          </div>

          {hasChildrenSection && (
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" />
                {t("userMenuChildren")}
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-secondary"
                onClick={() => {
                  setChildId(null);
                  invalidate();
                  void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
                  onOpenChange?.(false);
                  setInternalOpen(false);
                }}
              >
                <span className={!isImpersonating ? "font-bold text-sky-700" : ""}>
                  {t("userMenuSelf")}
                </span>
                {!isImpersonating && <Check className="h-4 w-4 text-sky-700" />}
              </button>
              {children.map((child) => (
                <button
                  key={child.uid}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-secondary"
                  onClick={() => {
                    setChildId(child.uid || null);
                    invalidate();
                    void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
                    onOpenChange?.(false);
                    setInternalOpen(false);
                  }}
                >
                  <span className={childId === child.uid ? "font-bold text-sky-700" : ""}>
                    {child.displayName}
                  </span>
                  {childId === child.uid && <Check className="h-4 w-4 text-sky-700" />}
                </button>
              ))}
            </div>
          )}

          <div className={hasChildrenSection ? "border-t mt-1 pt-1" : "pt-1"}>
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
              onClick={handleLogout}
            >
              {t("logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
