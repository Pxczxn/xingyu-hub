import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * AuthActionBar — the committed terminal action of an SK5 流程 page.
 *
 * BELONGS TO: 认证 7 页（登录 / 注册 / 找回 / 重置 / 强制改密 / 待审核 / 验证邮箱）。
 * 这些页面每页只有一个终点动作，且 A §1 把 SK5 的解剖定为「居中窄栏 + 粘底操作条」。
 *
 * WHY NOT `StepFlow`
 * ------------------
 * `components/layout/StepFlow` 的 `actions` 槽既提供步骤条也提供这条粘底条。认证页
 * 全是**单步**流程，步骤条只会有 1 个 li（"1 登录"），凭空多出一个 `aria-label="步骤"`
 * 的列表和一个 `sr-only` 的 h2「步骤」—— 装饰性结构，不是信息。所以这里只取
 * `StepFlow.tsx:113-115` 那条**操作条**的配方（`sticky bottom-0` + 上发丝线 +
 * 半透明底 + `backdrop-blur` + `z-rail`），不复制步骤条。
 *
 * 两条调用约束（来自 SK5 的解剖，不是样式偏好）：
 *   1. 操作条必须渲染在 `<form>` **内部**：`<button type="submit">` 只有落在表单子树里
 *      才会触发提交。StepFlow 的 `actions` 槽在 `children` 之外，这也是它不能直接用于
 *      本域表单的第二个原因。
 *   2. 字段组必须留在操作条上方的滚动流里，操作条不得盖住获焦控件（A §5 第 8 条）。
 *
 * 用边框不用阴影：`E1` 留给离开文档流的表面（B §3），粘在流里的条不是。
 */
export function AuthActionBar({
  children,
  note,
  className,
}: {
  /** 终点动作（提交 / 返回 / 重发）。 */
  children: ReactNode;
  /** 动作左侧的一行状态说明（如「有未保存的修改」）。 */
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-rail border-t border-border/70 bg-card/95 py-3 backdrop-blur",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-end gap-3">
        {note ? <span className="mr-auto text-meta text-muted-foreground">{note}</span> : null}
        {children}
      </div>
    </div>
  );
}
