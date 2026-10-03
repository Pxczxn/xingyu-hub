import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Error boundaries.
 *
 * Why this file exists: before it, the app had NO boundary of any kind — a
 * whole-repo grep for `ErrorBoundary` / `componentDidCatch` returned zero hits.
 * Any render-time throw therefore unmounted the entire tree. The observed
 * symptom, reproduced while building the event detail page (2026-10-03), was a
 * full-screen raw stack trace in dev and a blank page in production, with no
 * recovery path short of a manual reload.
 *
 * Two boundaries, because the two failures have different blast radii:
 *
 *   PageErrorBoundary  wraps the routed page inside AppLayout. A page that
 *                      throws loses only its own content — the header, the nav,
 *                      the unread badges and the footer stay usable, and the
 *                      reader can navigate somewhere else. This is the one that
 *                      matters day to day.
 *
 *   RouteErrorPage     is the router-level `errorElement`. It catches what the
 *                      inner boundary cannot: a failure in the shell itself, in
 *                      a provider, or during route matching. It renders WITHOUT
 *                      the shell, so it must not depend on any provider — no
 *                      useAuth, no toast context.
 */

type PageErrorBoundaryProps = {
  children: ReactNode;
  /**
   * Changing this resets the boundary. Pass `location.pathname`: without it a
   * crashed page stays crashed after the reader navigates away, because the
   * boundary keeps its error state for as long as it stays mounted.
   */
  resetKey?: string;
};

type PageErrorBoundaryState = { error: Error | null };

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept as a console report rather than swallowed: a boundary that hides the
    // cause makes the next bug harder to find than no boundary at all.
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(previous: PageErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-border/70 bg-card px-6 py-12 text-center"
      >
        <p className="text-card font-semibold text-primary">这个页面出错了</p>
        <p className="max-w-md text-meta text-muted-foreground">
          页面渲染时发生异常，其它功能仍然可用。你可以重试，或从上方导航去别处。
        </p>
        {import.meta.env.DEV ? (
          <pre className="max-w-full overflow-x-auto rounded-lg bg-surface-sunken px-3 py-2 text-left font-mono text-[12px] text-muted-foreground">
            {this.state.error.message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="focus-ring mt-1 inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-meta font-medium text-foreground transition-colors hover:bg-surface-sunken"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          重试
        </button>
      </div>
    );
  }
}

/**
 * Router-level fallback. Rendered by React Router in place of the route element
 * when an error escapes everything inside it — including the providers — so this
 * component must stand alone.
 */
export function RouteErrorPage({ className }: { className?: string }) {
  const error = useRouteError();

  // `isRouteErrorResponse` distinguishes a router-thrown response (404, a loader
  // 500) from a genuine render throw. The two deserve different copy: one is a
  // missing page, the other is a bug.
  const isResponse = isRouteErrorResponse(error);
  const status = isResponse ? error.status : null;
  const isMissing = status === 404;

  const detail = isResponse
    ? isMissing
      ? "这个地址不存在，或者内容已被移除。"
      : error.statusText || "服务暂时不可用，请稍后重试。"
    : "页面渲染时发生异常。";

  return (
    <div className={cn("flex min-h-full items-center justify-center px-4 py-16", className)}>
      <div
        role="alert"
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-border/70 bg-card px-6 py-12 text-center"
      >
        {status ? (
          <p className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground/60">
            {status}
          </p>
        ) : null}
        <p className="text-card font-semibold text-primary">
          {isMissing ? "页面不存在" : "出错了"}
        </p>
        <p className="text-meta text-muted-foreground">{detail}</p>

        {/* In dev only: production should not print a stack trace to the reader. */}
        {import.meta.env.DEV && !isResponse && error instanceof Error ? (
          <pre className="max-w-full overflow-x-auto rounded-lg bg-surface-sunken px-3 py-2 text-left font-mono text-[12px] text-muted-foreground">
            {error.message}
          </pre>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-meta font-medium text-foreground transition-colors hover:bg-surface-sunken"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            重新加载
          </button>
          <Link
            to="/"
            className="focus-ring rounded-md bg-primary px-3 py-2 text-meta font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}
