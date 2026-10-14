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
      className={cn("rounded-xl border border-border/70 bg-card px-6 py-7 text-center", className)}
      {...(live ? { role: "status", "aria-live": "polite" as const } : {})}
    >
      <span
        className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full", disc)}
        aria-hidden
      >
        {icon}
      </span>
      {/*
        20px —— 认证域（S8）的 L1 档。

        域外的内容页（S1–S6）L1 是 24px（`text-2xl`，全库 55 处）。认证页不跟：
        S8 是 448px 窄栏（`AuthLayout` 的 `max-w-md`），24px 的标题放进这么窄的
        栏里就不再是"页面的第一行"，而是一块压住下面所有内容的字。

        居中面板还多一层理由：这个标题不是左对齐页头的顶端，它居中坐在一个 48px
        的字形下面 —— 24px 会与那个字形相争，而不是跟着它。

        2026-10-13（批次 08）修正
        -------------------------
        这里原本写的是"DELIBERATELY 20px, not the 24px L1 used by every other
        page title … 全库审计只会剩下这四个状态屏"。这句话写下时就与事实不符：
        `ForceChangePasswordPage` 与 `PendingAuditPage` 也是 20px，并不是本面板的
        调用点。更糟的是 `AuthCard`（登录 / 找回密码表单态 / 重置密码表单态 /
        注册关闭态）当时是 15px —— 比状态屏更小，于是 `ForgotPasswordPage` 一提交、
        `ResetPasswordPage` 一遇到失效 token，标题就在原地跳 5px。

        现在 `AuthCard` 收进 20px，域内统一。唯一例外是 `/register` 的宽栏落地态
        （24px）：它是域内唯一有第二份工作的页面（表单旁边要放价值主张），而且与
        任何 20px 标题之间隔着一次导航，不会同屏出现。
      */}
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
