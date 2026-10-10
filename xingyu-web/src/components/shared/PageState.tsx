import { cn } from "@/lib/cn";
import { EmptyRing } from "./illustrations";

export type PageStateKind = "loading" | "error" | "empty";

const CONTENT: Record<PageStateKind, { title: string; hint: string }> = {
  loading: { title: "正在加载…", hint: "" },
  error: { title: "加载失败", hint: "请稍后重试。" },
  empty: { title: "暂无内容", hint: "" },
};

/**
 * Minimal loading / error / empty states used by route hosts in Phase 0.
 * (No data fetching is wired yet — these are presentational placeholders.)
 *
 * 2026-10-03 — artwork on `empty` only, and that restriction is the point:
 *
 *   - `empty` is a state the reader has to be oriented out of ("this is yours, it is
 *     just not filled yet"), which is what the drawing says.
 *   - `loading` is transient; drawing attention to it makes a wait feel longer.
 *   - `error` is a failure. A friendly illustration over "加载失败" reads as flippant,
 *     and the useful thing there is the retry, not a picture.
 *
 * It is on by default for `empty` because that state is a full page on 29 routes —
 * but it stays small (h-20) so the same component still works when a feature drops it
 * into a short section rather than a page. `illustration={false}` opts a caller out.
 */
export function PageState({
  kind,
  className,
  title,
  description,
  illustration,
}: {
  kind: PageStateKind;
  className?: string;
  /** Optional overrides so feature pages can explain their own state. */
  title?: string;
  description?: string;
  /** Set false to render an empty state with no artwork. */
  illustration?: boolean;
}) {
  const fallback = CONTENT[kind];
  const heading = title ?? fallback.title;
  const hint = description ?? fallback.hint;
  const showArt = illustration ?? kind === "empty";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live="polite"
      data-testid={`page-state-${kind}`}
      className={cn("rounded-lg border border-border bg-card p-6 text-center", className)}
    >
      {showArt ? <EmptyRing className="mx-auto mb-4 h-20 w-auto" /> : null}
      <p className="text-sm font-medium text-foreground">{heading}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
