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
/*
 * H 轴（2026-11-10，批次 C）—— 和 `AuthCard` 同一套取值，理由写在那个文件里。
 *   `card`   默认：白卡 + 发丝线（旧形状，未迁移的调用点不受影响）
 *   `line`   无面：状态结论直接落在内容列上，靠一条发丝线与下面分开
 *   `banner` 有面横幅：底色 + 母题，用于映射表里 H=幅 的认证页
 */
export type AuthStatusPanelVariant = "card" | "line" | "banner";

const PANEL_SURFACE: Record<AuthStatusPanelVariant, string> = {
  card: "rounded-card border border-border/70 bg-card",
  line: "border-b border-border/70",
  banner: "motif-orbit relative isolate overflow-hidden rounded-card border border-border/70 bg-surface-sunken",
};

export function AuthStatusPanel({
  icon,
  disc,
  title,
  body,
  action,
  live = false,
  variant = "card",
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
  variant?: AuthStatusPanelVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-6 py-7 text-center",
        variant === "line" ? "rounded-none pb-6" : "rounded-card",
        PANEL_SURFACE[variant],
        className,
      )}
      {...(live ? { role: "status", "aria-live": "polite" as const } : {})}
    >
      {/* 母题（`.motif-orbit` 的两条环）是定位伪元素，会画在静态文字之上；
          内容一律进 `relative z-10`，与 `AuthCard` 的 banner 分支同一处理。 */}
      <div className="relative z-10">
        <span
          className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full", disc)}
          aria-hidden
        >
          {icon}
        </span>
      {/*
        2026-11-12：与 `AuthCard` 一样走 `text-h1`。此前认证状态屏停在 20px，
        是为了和表单态同一档；现在两处都用页面标题档。
      */}
        <h1 className="mt-3 text-h1 text-primary">{title}</h1>
        <div className="mx-auto mt-2 max-w-sm text-meta leading-6 text-muted-foreground">
          {body}
        </div>
        {action ? <div className="mt-5 flex flex-col items-center gap-3">{action}</div> : null}
      </div>
    </div>
  );
}

/** The link style used for the secondary action inside a status panel. */
export const authStatusLinkClass =
  "focus-ring rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong";

/** The filled style used for a status panel's primary action. */
export const authStatusPrimaryClass =
  "focus-ring rounded-md bg-primary px-4 py-2 text-meta font-medium text-primary-foreground transition-opacity hover:opacity-90";
