import React from "react";

export const Topbar = ({
  title,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) => {
  return (
    <header className="mb-6">
      <div className="flex flex-col gap-3">
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
};
