import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * AuthStatusPanel — a state panel for auth screens that are NOT forms.
 *
 * Why this is shared (2026-10-03)
 * -------------------------------
 * Three auth screens used to render a non-form state inside `AuthCard`, which is
 * the login form's shell: a title, a description and a body slot. In each case
 * the reader had already finished typing and the only question left was "what
 * happened / what now?" — and a form shell buries that answer under a header
 * sized for a form to sit under.
 *
 *   verify-email   全部三个状态（验证中 / 成功 / 待验证）
 *   forgot-password 发送成功之后
 *   reset-password  token 缺失或无效
 *
 * The three were drawing the same shape by hand, so the shape lives here. What
 * each screen passes in is the glyph, the conclusion and its own actions — the
 * parts that actually differ.
 *
 * Note this is a SHARED SHELL, not a shared page: it standardises how a state is
 * announced, not what the state is. A screen whose state needs more structure
 * than "glyph + conclusion + actions" (pending-audit's three-step timeline, for
 * instance) should build its own instead of stretching this one.
 */
export function AuthStatusPanel({
  icon,
  disc,
  title,
  body,
  action,
  live = false,
  className,
}: {
  icon: ReactNode;
  /** Tailwind classes for the tinted disc behind the glyph. */
  disc: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  /** Announce changes to assistive tech — use for a state that resolves async. */
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card px-6 py-7 text-center",
        className,
      )}
      {...(live ? { role: "status", "aria-live": "polite" as const } : {})}
    >
      <span
        className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full", disc)}
        aria-hidden
      >
        {icon}
      </span>
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-primary">{title}</h1>
      <div className="mx-auto mt-2 max-w-sm text-meta leading-6 text-muted-foreground">{body}</div>
      {action ? <div className="mt-5 flex flex-col items-center gap-3">{action}</div> : null}
    </div>
  );
}

/** The link style used for the secondary action inside a status panel. */
export const authStatusLinkClass =
  "focus-ring rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong";

/** The filled style used for a status panel's primary action. */
export const authStatusPrimaryClass =
  "focus-ring rounded-md bg-primary px-4 py-2 text-meta font-medium text-primary-foreground transition-opacity hover:opacity-90";
