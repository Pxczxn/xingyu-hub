import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Shared title block for auth screens (design idea taken from Legacy
 * components/community/auth-page-shell.tsx — rebuilt, no CSS copied).
 *
 * 标题层级（2026-10-08）
 * ---------------------
 * 这里刻意不用 `CardTitle`：它渲染的是 `<h3>`（`components/ui/card.tsx`），
 * 因为它服务的是"页面里的一张卡片"，而 `AuthCard` 是**整页**的壳 —— 它是认证页
 * 唯一的顶层内容，所以它的标题必须是页面 `h1`。凡是走 `AuthCard` 的页面
 * （登录、找回密码表单态、重置密码表单态、注册关闭态）此前整页没有 h1，
 * 读屏用户无法跳转到页面主线。与 `components/shared/NotFound.tsx` 的既有做法一致
 * （那里也是把 `CardTitle` 换成显式 `<h1>`）。
 *
 * 字号（2026-10-13，批次 08 修正）
 * -------------------------------
 * 这里曾经写 `text-card`，理由是"沿用卡片的标题档（= 20px / `text-xl`）、与其余
 * 认证页标题一致"。写下时前半句是对的；tokens 改档后 `--text-card` 变成
 * 0.9375rem（15px），它现在是「卡片 / 行主文本」档 —— 全库 44 处 `text-card`
 * 里除本处外全是列表行标题或卡内小标题。
 *
 * 于是认证域同时存在两个 L1：本壳 15px，而 `AuthStatusPanel`、
 * `ForceChangePasswordPage`、`PendingAuditPage` 都是 `text-xl`（20px）。
 * 同一页会在状态切换时跳字号：`ForgotPasswordPage` 的表单态走本壳、发送成功态走
 * `AuthStatusPanel`；`ResetPasswordPage` 的 token 失效态同理。读者点一次提交，
 * 标题就长高 5px —— 这不是层级，是两套规格撞在一起。
 *
 * 现在取 `text-xl`，即认证域的 L1 档。不取 `text-2xl`：那是内容页的 L1，
 * 而认证页是 S8 窄栏（`max-w-md` = 448px），`AuthStatusPanel` 也已经论证过
 * 20px 是与 48px 字形共处之后的选择。
 *
 * 说明行同理：`CardDescription` 的 `text-sm` 是「卡片描述」的尺寸，而这里是
 * 整页的说明行，覆盖成 `text-meta leading-6`（与 `.lede` 一致）。
 *
 * 页脚（同一轮）：认证域所有辅助文本都是 `text-meta` —— `AuthStatusPanel` 的正文、
 * `authStatusLinkClass`、`authStatusPrimaryClass`、`AuthFormError`。只有本壳页脚写
 * `text-sm`，于是 `ForgotPasswordPage` 表单态的「返回登录」是 14px、提交成功后的
 * 同类链接是 13px。改成 `text-meta`，与 h1 一样收进认证域同一套规格。
 *
 * --- 2026-11-10 批次 C：H 轴（A §2 / B §2）--------------------------
 * 认证 7 页全部是 SK5 流程原型，但**页头处理不是同一个值**（A §3 映射表）：
 *
 *   `line`    无面 masthead：标题贴内容列左缘，一条发丝线把它与字段分开。
 *             不给认证页套卡面，是因为卡片边框会把「一个只需填两格就走的
 *             页面」画成一个要阅读的区块。
 *   `banner`  有面横幅：标题落在一块带母题（`motif-orbit`，B §6）的面上，
 *             与下面的字段形成「横幅 → 内容列」两段式。
 *   `card`    旧形状（有边卡 + CardHeader/CardContent）。保留是给**状态页**用的
 *             —— 一个不能填写的结论配一圈边框是恰当的。
 *
 * 所以 H 值由本组件的一个 prop 表达，而不是由页头组件表达：认证域里
 * `AuthCard`/`AuthStatusPanel` 就是页头，h1 只能在这两处出现一次（A §7.2 的
 * 「恰有 1 个 h1」）。页面把 SK5 的栅格交给 `ArchetypeFrame`，把 H 交给这里。
 *
 * `bleed`（R=出）只对 `banner` 有效：把横幅左右各拉出 16/24px（= `.content-shell`
 * 的 `px-4`/`md:px-6`），于是横幅比页内其它任何块都宽 —— 这正是 `BleedBand`
 * 对「出血」的定义（`BleedBand.tsx:12-19` 说明了为什么只到那条线、不到视口边缘）。
 * 其后所有块回到内容列。
 */
export type AuthCardVariant = "line" | "banner" | "card";

const CONTENT_GAP = "gap-4";

export function AuthCard({
  title,
  description,
  children,
  footer,
  variant = "line",
  /** R=出：只让 `banner` 的横幅越过内容列。 */
  bleed = false,
  /** D 轴（B §2）：`gap-6` 松 / `gap-3` 紧。 */
  contentClassName,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: AuthCardVariant;
  bleed?: boolean;
  contentClassName?: string;
  className?: string;
}) {
  const heading = (
    <h1 className="text-xl font-semibold tracking-tight text-primary">{title}</h1>
  );
  const lede = description ? (
    <p className="mt-1.5 text-meta leading-6 text-muted-foreground">{description}</p>
  ) : null;

  const footerNode = footer ? (
    <div className="border-t border-border/60 pt-4 text-meta text-muted-foreground">{footer}</div>
  ) : null;

  if (variant === "card") {
    return (
      <div
        className={cn(
          "min-w-0 rounded-card border border-border/70 bg-card p-6",
          className,
        )}
      >
        <header>
          {heading}
          {lede}
        </header>
        <div className={cn("mt-5 flex flex-col", contentClassName ?? CONTENT_GAP)}>{children}</div>
        {footerNode ? <div className="mt-5">{footerNode}</div> : null}
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={cn("min-w-0", className)}>
        <header
          className={cn(
            "motif-orbit relative isolate overflow-hidden rounded-card border border-border/70 bg-surface-sunken px-6 py-6",
            bleed && "-mx-4 md:-mx-6",
          )}
        >
          <div className="relative z-10">
            {heading}
            {lede}
          </div>
        </header>
        <div className={cn("mt-6 flex flex-col", contentClassName ?? CONTENT_GAP)}>{children}</div>
        {footerNode ? <div className="mt-6">{footerNode}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <header className="border-b border-border/70 pb-4">
        {heading}
        {lede}
      </header>
      <div className={cn("mt-5 flex flex-col", contentClassName ?? CONTENT_GAP)}>{children}</div>
      {footerNode ? <div className="mt-5">{footerNode}</div> : null}
    </div>
  );
}
