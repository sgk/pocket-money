import React, { forwardRef } from "react";

type TopbarProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  dense?: boolean; // 余白を詰めるときに使う
};

export const Topbar = forwardRef<HTMLElement, TopbarProps>(
  ({ title, children, subtitle, dense = false }, ref) => {
    const marginClass = dense ? "md:mb-0" : "md:mb-6";

    return (
      <header
        ref={ref}
        className={`sticky top-0 z-30 -mx-4 mb-0 shrink-0 border-b bg-card py-2 backdrop-blur md:-mx-6 ${marginClass}`}
      >
        <div className="flex flex-col gap-3 px-4 md:px-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl">{title}</h2>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {children ? <div className="w-full">{children}</div> : null}
        </div>
      </header>
    );
  }
);

Topbar.displayName = "Topbar";
