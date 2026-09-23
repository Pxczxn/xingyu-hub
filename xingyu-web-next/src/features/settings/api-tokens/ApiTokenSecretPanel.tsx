import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

/*
 * The one-time secret panel (Phase 2A-2b).
 *
 * 🔒 This component is the ONLY place a token secret is ever rendered. It is
 * mounted exclusively from the create-success state, and the parent drops that
 * state on dismiss — so after "我已保存" there is no code path that can show
 * the secret again (the backend cannot re-issue it either: it only stores the
 * SHA-256 hash).
 *
 * Rules this component deliberately follows:
 *   - the full secret is rendered as-is (never truncated) and copied from
 *     React state, not from the DOM;
 *   - no hidden <input>/<textarea> keeps the value around;
 *   - nothing is written to localStorage / sessionStorage / IndexedDB / URL,
 *     and nothing is logged;
 *   - masking is purely visual and reversible, and the full value stays in
 *     memory so Copy always yields the real secret.
 */

type CopyState = "idle" | "copied" | "failed";

export function ApiTokenSecretPanel({
  name,
  secret,
  onDismiss,
}: {
  name: string;
  secret: string;
  onDismiss: () => void;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [visible, setVisible] = useState(true);

  const copy = useCallback(async () => {
    try {
      // Clipboard API only; no document.execCommand fallback and no hidden
      // field. A failure is surfaced rather than silently swallowed.
      await navigator.clipboard.writeText(secret);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [secret]);

  return (
    <section
      aria-labelledby="api-token-secret-heading"
      data-testid="api-token-secret-panel"
      className="rounded-lg border-2 border-accent bg-card p-4"
    >
      <h3 id="api-token-secret-heading" className="text-sm font-semibold text-foreground">
        新 Token 已创建
      </h3>

      <p role="alert" className="mt-2 text-sm font-medium text-destructive">
        请立即复制并妥善保存，此 Token 仅显示一次。
      </p>

      <dl className="mt-3 text-sm">
        <dt className="text-xs text-muted-foreground">名称</dt>
        <dd data-testid="api-token-secret-name" className="font-medium text-foreground">
          {name}
        </dd>
        <dt className="mt-3 text-xs text-muted-foreground">Secret</dt>
        <dd className="mt-1">
          <code
            data-testid="api-token-secret-value"
            className="block break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
          >
            {visible ? secret : "•".repeat(32)}
          </code>
        </dd>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" data-testid="api-token-copy" onClick={() => void copy()}>
          {copyState === "copied" ? "已复制" : "复制"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="api-token-toggle-visibility"
          aria-pressed={!visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "隐藏" : "显示"}
        </Button>
        <Button variant="outline" size="sm" data-testid="api-token-dismiss" onClick={onDismiss}>
          我已保存
        </Button>
      </div>

      {copyState === "copied" ? (
        <p data-testid="api-token-copy-status" className="mt-2 text-xs text-muted-foreground">
          已复制到剪贴板。
        </p>
      ) : null}
      {copyState === "failed" ? (
        <p role="alert" data-testid="api-token-copy-status" className="mt-2 text-xs text-destructive">
          复制失败，请手动选中上面的内容复制。
        </p>
      ) : null}
    </section>
  );
}
