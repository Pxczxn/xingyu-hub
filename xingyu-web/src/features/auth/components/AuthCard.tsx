import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

/*
 * Shared shell for auth screens (design idea taken from Legacy
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
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-xl font-semibold tracking-tight text-primary">{title}</h1>
        {description ? (
          <CardDescription className="text-meta leading-6">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}
        {footer ? <div className="text-meta text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
