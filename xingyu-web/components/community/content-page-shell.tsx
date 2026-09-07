import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";

type ContentWidth = "md" | "lg" | "xl";

const widthClass: Record<ContentWidth, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
};

export function ContentPageShell({
  children,
  width = "lg",
  className,
}: {
  children: ReactNode;
  width?: ContentWidth;
  className?: string;
}) {
  return (
    <AppShell>
      <main className={cn("xy-page", widthClass[width], className)}>{children}</main>
    </AppShell>
  );
}
