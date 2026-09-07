import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  className,
  variant = "default",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  variant?: "default" | "compact";
}) {
  const isCompact = variant === "compact";

  return (
    <section
      className={cn(
        "xy-orbit-bg relative overflow-hidden rounded-xl border border-white/85 bg-white/78 shadow-[0_10px_28px_rgba(30,45,82,.05)] backdrop-blur-xl",
        isCompact
          ? "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4"
          : "px-5 py-5 sm:px-7 sm:py-6",
        className
      )}
    >
      <div className={cn("relative min-w-0", isCompact ? "flex-1" : "max-w-2xl")}>
        {eyebrow && <p className="xy-kicker">{eyebrow}</p>}
        <h1
          className={cn(
          "font-semibold tracking-[-0.035em] text-foreground",
            isCompact ? "mt-1 text-xl leading-tight sm:text-2xl" : "mt-1.5 text-[1.75rem] leading-tight sm:text-3xl"
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "text-muted-foreground",
              isCompact ? "mt-1.5 max-w-xl text-sm leading-6 sm:text-[0.9375rem]" : "mt-2 max-w-xl text-sm leading-6 sm:text-[0.9375rem] sm:leading-7"
            )}
          >
            {description}
          </p>
        )}
        {actions && !isCompact && <div className="mt-4 flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      {isCompact && actions ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
      <Sparkles
        className={cn(
          "pointer-events-none absolute text-[rgb(var(--accent))] opacity-60",
          isCompact ? "right-4 top-3 h-5 w-5" : "right-10 top-8 h-7 w-7 opacity-70"
        )}
        aria-hidden="true"
      />
    </section>
  );
}

export function SectionHeading({ title, href, action = "查看全部", description, className }: { title: string; href?: string; action?: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-3", className)}>
      <div>
        <h2 className="xy-section-title">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">{description}</p>}
      </div>
      {href && <Link href={href} className="xy-section-action rounded-md px-2 py-1 hover:bg-[rgb(var(--violet)/.08)]">{action}<ArrowRight className="h-4 w-4" /></Link>}
    </div>
  );
}

export function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={cn("rounded-full border px-3 py-1.5 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>{children}</span>;
}
