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
 * 字号仍沿用卡片的 `text-card`（= 20px / `text-xl`），与其余认证页标题一致；
 * 只改语义标签，不改视觉。
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
        <h1 className="text-card font-semibold leading-none tracking-tight text-primary">
          {title}
        </h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}
        {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
