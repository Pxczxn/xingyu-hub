import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import { Button } from "@/components/ui/button";

/*
 * "Start a new direct conversation" (Phase 2I-3).
 *
 * `POST /api/v1/messages/direct/{otherUserId}` resolves the path segment as a
 * userId first and a username second (`ConversationService.resolveUserId`), so
 * this accepts a username — which is what a user actually has to hand. It is
 * labelled as such rather than pretending to be a user search.
 *
 * Failure modes are surfaced verbatim, because each one means something
 * different to the user and the backend already distinguishes them:
 *   400 「不能与自己发起私信」 · 409 「无法向该用户发送私信」 (either side blocked) ·
 *   404 unknown user.
 */
export function NewMessageComposer() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = username.trim().replace(/^@/, "");
    if (!target || busy) return;

    setBusy(true);
    setError(null);
    try {
      const conversation = await messagesApi.openDirect(target);
      setUsername("");
      setOpen(false);
      // Land on the thread. `replace: false` so Back returns to the mailbox.
      navigate(`/messages/${encodeURIComponent(conversation.id)}`);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError && err.problem.detail
          ? err.problem.detail
          : "无法发起私信，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        新建私信
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="text"
        value={username}
        aria-label="对方用户名"
        placeholder="对方用户名"
        onChange={(event) => setUsername(event.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="accent" size="sm" disabled={busy || !username.trim()}>
          {busy ? "发起中…" : "开始"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          取消
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
