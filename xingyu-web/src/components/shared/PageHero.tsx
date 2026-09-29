import type { ReactNode } from "react";
import { Orbit } from "lucide-react";
import { cn } from "@/lib/cn";

type PageHeroProps = { eyebrow?: string; title: string; description?: string; action?: ReactNode; tone?: "gold" | "blue" | "violet"; className?: string };

export function PageHero({ eyebrow, title, description, action, tone = "gold", className }: PageHeroProps) {
  return <section className={cn("relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8", className)}>
    <div className={cn("pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-80 blur-2xl", { "bg-accent/30": tone === "gold", "bg-sky-300/30": tone === "blue", "bg-violet-300/30": tone === "violet" })} />
    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">{eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p> : null}<h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{title}</h1>{description ? <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}</div>
      <div className="hidden shrink-0 rounded-full border border-border bg-background/70 p-4 sm:block" aria-hidden><Orbit className="h-8 w-8 text-accent" strokeWidth={1.5} /></div>
      {action ? <div className="relative shrink-0">{action}</div> : null}
    </div>
  </section>;
}
