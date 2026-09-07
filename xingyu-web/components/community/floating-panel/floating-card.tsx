"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FloatingCard({
  children,
  className,
  width,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  return (
    <div
      className={cn(
        "xy-float-panel flex flex-col overflow-hidden rounded-2xl border border-[#e8e4dc] bg-[#fffdf9] text-card-foreground shadow-[0_12px_36px_rgb(36_49_84/0.12)]",
        className
      )}
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  );
}

export function FloatingCardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ece8e1] bg-[#fffdf9] px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function FloatingCardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fffdf9]", className)}>{children}</div>;
}

export function FloatingCardFooter({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t border-[#ece8e1] bg-[#fffdf9] px-4 py-2.5">{children}</div>;
}

export function FloatingTabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-[#ece8e1] bg-[#fffdf9] px-3 py-2" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150",
            value === item.id
              ? "bg-[rgb(var(--violet)/.12)] text-[rgb(var(--violet))]"
              : "text-muted-foreground hover:bg-[#f3f1ed] hover:text-foreground"
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count != null && item.count > 0 ? ` (${item.count > 99 ? "99+" : item.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export function HoverFloatRoot({
  open,
  onEnter,
  onLeave,
  trigger,
  panel,
  align = "right",
  className,
}: {
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  trigger: ReactNode;
  panel: ReactNode;
  align?: "right" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn("relative hidden lg:block", className)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {trigger}
      {open ? (
        <div
          className={cn(
            "absolute top-full z-50",
            align === "right" ? "right-0" : "left-0"
          )}
          role="dialog"
          aria-modal="false"
        >
          <div className="xy-float-hover-bridge" aria-hidden="true" />
          <div className="xy-float-panel-wrap">{panel}</div>
        </div>
      ) : null}
    </div>
  );
}
