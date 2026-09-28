import { cn } from "@/lib/cn";

export type PageStateKind = "loading" | "error" | "empty";

const CONTENT: Record<PageStateKind, { title: string; hint: string }> = {
  loading: { title: "正在加载…", hint: "" },
  error: { title: "加载失败", hint: "请稍后重试。" },
  empty: { title: "暂无内容", hint: "" },
};

/**
 * Minimal loading / error / empty states used by route hosts in Phase 0.
 * (No data fetching is wired yet — these are presentational placeholders.)
 */
export function PageState({
  kind,
  className,
  title,
  description,
}: {
  kind: PageStateKind;
  className?: string;
  /** Optional overrides so feature pages can explain their own state. */
  title?: string;
  description?: string;
}) {
  const fallback = CONTENT[kind];
  const heading = title ?? fallback.title;
  const hint = description ?? fallback.hint;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live="polite"
      data-testid={`page-state-${kind}`}
      className={cn("rounded-lg border border-border bg-card p-6 text-center", className)}
    >
      <p className="text-sm font-medium text-foreground">{heading}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
