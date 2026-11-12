import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * 举报 / 申诉切换器 —— 纯展示，无状态、无请求。
 *
 * 两页共用同一个切换器是既有事实（改前两页各自手写了一份 `nav aria-label="举报与申诉"`，
 * 且刻意逐字相同：「读者是在它们之间来回切的，页头长得不一样就会读成两个不同的东西」）。
 * 批次 W2 把 /reports 的切换器移进 SK6 的侧轨（R=错），/appeals 仍是主列首块（R=齐），
 * 位置不同但**同一份控件**：所以抽成这一个组件，而不是两份会各自漂移的复制。
 *
 * 它只做呈现：`active` 决定哪一个不可点（当前的用实心 `accent` 变体 + `<span>`，
 * 与改前一致），另一个是 `<Link>`。链接目标与文案一个字未改。
 */
export function ModerationSwitch({
  active,
  className,
}: {
  active: "reports" | "appeals";
  /** 调用方决定排布：侧轨里是纵向一列，主列里是横向一行。 */
  className?: string;
}) {
  const itemClass = "justify-center text-sm";

  return (
    <nav aria-label="举报与申诉" className={cn("flex flex-wrap gap-2", className)}>
      {active === "reports" ? (
        <span className={cn(buttonVariants({ variant: "accent" }), itemClass)}>我的举报</span>
      ) : (
        <Link to="/reports" className={cn(buttonVariants({ variant: "outline" }), itemClass)}>
          我的举报
        </Link>
      )}
      {active === "appeals" ? (
        <span className={cn(buttonVariants({ variant: "accent" }), itemClass)}>我的申诉</span>
      ) : (
        <Link to="/appeals" className={cn(buttonVariants({ variant: "outline" }), itemClass)}>
          我的申诉
        </Link>
      )}
    </nav>
  );
}
