import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "xy-empty-state flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-center",
        compact ? "mt-2 px-4 py-5 sm:py-6" : "px-5 py-8 sm:py-10",
        className
      )}
    >
      {Icon && <Icon className={cn("text-muted-foreground/60", compact ? "mb-2 h-8 w-8" : "mb-4 h-10 w-10")} />}
      <p className={cn("font-semibold tracking-[-0.015em] text-foreground", compact ? "text-[1.0625rem] sm:text-lg" : "text-xl")}>{title}</p>
      {description && <p className={cn("max-w-sm text-muted-foreground", compact ? "mt-2 text-[0.9375rem] leading-6 sm:text-base" : "mt-2 text-base leading-7")}>{description}</p>}
      {actionLabel && actionHref && (
        <Button asChild variant="accent" size="default" className={compact ? "mt-4" : "mt-5"}>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
