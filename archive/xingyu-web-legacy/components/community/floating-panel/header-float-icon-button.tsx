"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeaderFloatIconButton({
  label,
  children,
  unreadCount = 0,
  active = false,
  onClick,
}: {
  label: string;
  children: ReactNode;
  unreadCount?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={active}
        onClick={onClick}
        className={cn("text-muted-foreground", active && "bg-muted text-foreground")}
      >
        {children}
      </Button>
      {unreadCount > 0 ? (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] font-medium leading-none text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </div>
  );
}
