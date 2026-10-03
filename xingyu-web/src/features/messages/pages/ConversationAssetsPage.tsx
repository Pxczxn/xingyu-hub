import { Link, useParams } from "react-router-dom";
import { isRecalled } from "@/api/messages/messages.types";
import { PageState } from "@/components/shared/PageState";
import { AttachmentMediaGrid } from "../AttachmentMediaGrid";
import { AttachmentFileList } from "../AttachmentFileList";
import { useConversationAttachments } from "../use-conversation-attachments";

/*
 * Shared media (images) and files for one conversation (Phase 2I-3b).
 *
 * One page component, two modes, because the two endpoints differ only in which
 * message type they filter to — the loading, error and empty handling is the
 * same, and duplicating it would mean fixing every future fix twice.
 *
 *   /messages/:conversationId/media  -> GET /messages/{id}/media  (IMAGE rows)
 *   /messages/:conversationId/files  -> GET /messages/{id}/files  (FILE rows)
 *
 * Both return BARE ARRAYS (not pages) and are capped at 200 server-side, so
 * there is no cursor to walk. The lists are disjoint by construction: the
 * backend filters on the stored message type, so no client-side filtering
 * happens here.
 *
 * A recalled message is still listed. The backend keeps the row and nulls its
 * attachments, so it arrives as a tombstone with no URL — it is filtered out
 * below rather than rendered as a broken tile. That is a rendering decision, not
 * a claim that the message is gone.
 */

export type AttachmentKind = "media" | "files";

export function ConversationAssetsPage({ kind }: { kind: AttachmentKind }) {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { state, reload } = useConversationAttachments(conversationId, kind);

  if (!conversationId) {
    return <PageState kind="error" title="会话不存在" description="缺少会话标识。" />;
  }

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title={state.notFound ? "会话不存在" : "加载失败"}
          description={
            state.notFound
              ? "这个会话不存在，或者你不在其中。"
              : state.expired
                ? "登录状态已过期，请重新登录。"
                : "无法读取这个会话的内容，请稍后重试。"
          }
        />
        <p className="text-center">
          {state.expired ? (
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          ) : (
            <Link
              to={`/messages/${encodeURIComponent(conversationId)}`}
              className="text-sm text-accent hover:underline"
            >
              返回会话
            </Link>
          )}
        </p>
      </div>
    );
  }

  // A recalled row has no attachment left to show.
  const items = state.items.filter((row) => !isRecalled(row));
  const label = kind === "media" ? "图片" : "文件";

  return (
    <div className="section-gap">
      {/*
        This is a PANEL over the conversation, not a page in its own right — the
        reader got here from the thread and will go back to it. So the header is
        one toolbar row: identity on the left, the one toggle and one action on
        the right, all at the same height. The three plain text links it used to
        be gave "go back", "switch view" and "refresh" identical weight, which
        made the switch — the only thing here that changes what you are looking
        at — the hardest of the three to find.
      */}
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{label}</h1>
          <span className="text-meta tabular-nums text-muted-foreground">{items.length} 条</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/messages/${encodeURIComponent(conversationId)}`}
            className="focus-ring rounded-md px-2.5 py-1.5 text-meta text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
          >
            返回会话
          </Link>

          <span className="flex items-center gap-1 rounded-lg bg-surface-sunken p-1">
            <Link
              to={`/messages/${encodeURIComponent(conversationId)}/media`}
              aria-current={kind === "media" ? "true" : undefined}
              /* Accessible name kept as the original verb phrase while the
                 visible label is the shorter noun: WCAG 2.5.3 (Label in Name)
                 requires the name to CONTAIN the visible text, and "看图片"
                 contains "图片". Changing the visible label was a deliberate
                 visual choice; changing what a screen reader hears was not. */
              aria-label="看图片"
              className={
                kind === "media"
                  ? "rounded-md bg-card px-2.5 py-1 text-meta font-medium text-primary"
                  : "rounded-md px-2.5 py-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              图片
            </Link>
            <Link
              to={`/messages/${encodeURIComponent(conversationId)}/files`}
              aria-current={kind === "files" ? "true" : undefined}
              aria-label="看文件"
              className={
                kind === "files"
                  ? "rounded-md bg-card px-2.5 py-1 text-meta font-medium text-primary"
                  : "rounded-md px-2.5 py-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              文件
            </Link>
          </span>

          <button
            type="button"
            onClick={() => void reload()}
            className="focus-ring rounded-md border border-input px-2.5 py-1.5 text-meta text-foreground transition-colors hover:bg-surface-sunken"
          >
            刷新
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title={kind === "media" ? "还没有图片" : "还没有文件"}
          description={
            kind === "media"
              ? "在会话里发送图片后，会集中显示在这里。"
              : "在会话里发送文件后，会集中显示在这里。"
          }
        />
      ) : kind === "media" ? (
        <AttachmentMediaGrid items={items} />
      ) : (
        <AttachmentFileList items={items} />
      )}
    </div>
  );
}
