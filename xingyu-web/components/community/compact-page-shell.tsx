import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { cn } from "@/lib/utils";

type PageWidth = "sm" | "md" | "lg" | "xl" | "full";

const widthClass: Record<PageWidth, string> = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  full: "",
};

type CompactPageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  width?: PageWidth;
  children: ReactNode;
  className?: string;
};

export function CompactPageShell({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "返回",
  width = "full",
  children,
  className,
}: CompactPageShellProps) {
  const heroActions =
    actions || backHref ? (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {actions}
        {backHref ? (
          <Link href={backHref} className="xy-section-action text-sm">
            {backLabel}
          </Link>
        ) : null}
      </div>
    ) : undefined;

  return (
    <AppShell>
      <main className={cn("xy-page", widthClass[width], className)}>
        <PageHero
          variant="compact"
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={heroActions}
        />
        {children}
      </main>
    </AppShell>
  );
}
