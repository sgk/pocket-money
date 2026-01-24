import React, { forwardRef } from "react";

type TopbarProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export const Topbar = forwardRef<HTMLElement, TopbarProps>(
  ({ title, children, subtitle }, ref) => {
    return (
      <header
        ref={ref}
        className="sticky top-0 z-30 -mx-4 mb-4 shrink-0 border-b bg-card py-2 backdrop-blur md:-mx-6 md:mb-6"
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
