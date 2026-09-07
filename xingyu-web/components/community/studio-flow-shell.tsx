import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type StudioFlowWidth = "sm" | "md" | "lg";

const widthClass: Record<StudioFlowWidth, string> = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-3xl",
};

type StudioFlowShellProps = {
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
  width?: StudioFlowWidth;
  children: ReactNode;
  className?: string;
};

export function StudioFlowShell({
  backHref,
  backLabel = "返回",
  actions,
  width = "lg",
  children,
  className,
}: StudioFlowShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className={cn("mx-auto flex h-12 items-center justify-between gap-3 px-4 sm:px-6", widthClass[width])}>
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
          {actions}
        </div>
      </header>
      <main className={cn("xy-page", widthClass[width], className)}>{children}</main>
    </div>
  );
}
