import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkX, RotateCcw } from "lucide-react";
import { ApiError } from "@/api/client";
import { savedMessagesApi } from "@/api/saved-messages/saved-messages.api";
import {
  formatSavedTime,
  savedAttachmentKind,
  savedConversationHref,
  savedConversationLabel,
  savedMessageBody,
  savedSenderLabel,
  type SavedMessageView,
} from "@/api/saved-messages/saved-messages.types";
import { PageState } from "@/components/shared/PageState";

/*
 * 收藏的私信 (Phase 3I).
 *
 * The bookmark store at `GET /me/saved-messages`. Everything the page shows
 * comes from that one call — there is no per-row fetch, because a
 * `SavedMessageView` already carries the body, the attachment and the
 * conversation identity.
 *
 * Three honesty constraints inherited from the messaging module:
 *
 *  1. A recalled message is a TOMBSTONE. The server has already blanked `body`
 *     to 「[消息已撤回]」 before it reaches us, and the bookmark row carries no
 *     `recalledAt` — so the UI renders the string it is given and never tries
 *     to detect a recall itself. The tombstone icon is chosen from the same
 *     string the backend serves, not from a guess.
 *
 *  2. A DIRECT conversation has no title, so the row shows 「私信」 rather than
 *     inventing a peer name. `savedConversationLabel` owns that rule.
 *
 *  3. Removing a bookmark is a REAL delete with a 404 on a second attempt
 *     (it is not idempotent). So the row is removed from local state only
 *     AFTER the server confirms, and a failure surfaces an error instead of
 *     optimistically hiding a row that still exists.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean }
  | { kind: "ready"; items: SavedMessageView[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

const RECALLED_TOMBSTONE = "[消息已撤回]";

export function SavedMessagesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    savedMessagesApi
      .list()
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "error", expired: isAuthError(err) });
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRemove = useCallback(async (item: SavedMessageView) => {
    setActionError(null);
    setRemovingId(item.messageId);
    try {
      // DELETE /me/saved-messages/{messageId} — the MESSAGE id, never row.id.
      await savedMessagesApi.remove(item.messageId);
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              items: current.items.filter((row) => row.messageId !== item.messageId),
            }
          : current,
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError && err.problem.status === 404
          ? "这条收藏已经不存在了，刷新后可看到最新列表。"
          : "取消收藏失败，请稍后重试。",
      );
    } finally {
      setRemovingId(null);
    }
  }, []);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired ? "登录状态已过期，请重新登录。" : "无法读取收藏的私信，请稍后重试。"
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const { items } = state;

  return (
    <div className="section-gap">
      <header>
        <h1 className="text-xl font-semibold text-primary">收藏的私信</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你在私信里收藏的消息会出现在这里。删除收藏不会删除原消息。
        </p>
      </header>

      {actionError ? (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      ) : null}

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有收藏的私信"
          description="在会话中收藏一条消息后，它会出现在这里。"
        />
      ) : (
        <ul
          aria-label="收藏的私信"
          className="flex flex-col gap-2"
          data-testid="saved-message-rows"
        >
          {items.map((item) => {
            const attachment = savedAttachmentKind(item);
            const body = savedMessageBody(item);
            const isTombstone = body === RECALLED_TOMBSTONE;
            const at = formatSavedTime(item.messageCreatedAt);
            const savedAt = formatSavedTime(item.savedAt);

            return (
              <li
                key={item.messageId}
                className="rounded-lg border border-border bg-card p-4"
                data-testid="saved-message-row"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {savedConversationLabel(item)} · {savedSenderLabel(item.senderId)}
                      {at ? <span className="ml-2">{at}</span> : null}
                    </p>

                    {isTombstone ? (
                      <p className="mt-2 flex items-center gap-1.5 text-sm italic text-muted-foreground">
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        {RECALLED_TOMBSTONE}
                      </p>
                    ) : (
                      <>
                        {attachment === "image" && item.attachmentUrl ? (
                          <a
                            href={item.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block"
                          >
                            <img
                              src={item.attachmentUrl}
                              alt={item.attachmentName ?? "图片"}
                              className="max-h-56 max-w-full rounded"
                            />
                          </a>
                        ) : null}
                        {attachment === "file" && item.attachmentUrl ? (
                          <a
                            href={item.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 flex items-center gap-1.5 text-sm underline hover:no-underline"
                          >
                            {item.attachmentName ?? "附件"}
                          </a>
                        ) : null}
                        {body ? (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
                            {body}
                          </p>
                        ) : null}
                        {!body && !attachment ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            这条消息没有可展示的内容。
                          </p>
                        ) : null}
                      </>
                    )}

                    <p className="mt-2 text-xs text-muted-foreground">
                      <Link
                        to={savedConversationHref(item)}
                        className="text-accent hover:underline"
                      >
                        查看原会话
                      </Link>
                      {savedAt ? <span className="ml-2">收藏于 {savedAt}</span> : null}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={removingId === item.messageId}
                    onClick={() => void handleRemove(item)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
                  >
                    {removingId === item.messageId ? (
                      <>
                        <Bookmark className="h-3.5 w-3.5" aria-hidden />
                        取消中…
                      </>
                    ) : (
                      <>
                        <BookmarkX className="h-3.5 w-3.5" aria-hidden />
                        取消收藏
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
