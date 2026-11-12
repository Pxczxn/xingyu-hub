import { Link, useParams } from "react-router-dom";
import { isRecalled } from "@/api/messages/messages.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
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
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : state.notFound ? (
          <p className="text-center">
            <Link
              to={`/messages/${encodeURIComponent(conversationId)}`}
              className="text-sm text-accent-strong hover:underline"
            >
              返回会话
            </Link>
          </p>
        ) : (
          /* Not an auth failure and not a missing conversation — the load
             itself failed, so run it again instead of leaving the reader at
             a dead end. The hook owns the retry path, so this calls its
             `reload` rather than keeping a local replay key. */
          <div className="text-center">
            <Button variant="outline" onClick={() => void reload()}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  // A recalled row has no attachment left to show.
  const items = state.items.filter((row) => !isRecalled(row));
  const label = kind === "media" ? "图片" : "文件";

  /*
   * SK2 画廊 · H=线 / D=松 / R=齐（A §3 的 /messages/* 域 ConversationAssets 行）。
   *
   * 骨架由 `ArchetypeFrame skeleton="SK2"` 提供，页面只声明身份，不再手写宽度与间距：
   *
   *   H=线：头是 `PageMasthead`（无面 masthead，标题贴内容列左缘、动作落在基线尾），
   *   作为 `headerSlot` 交给 frame。原来是一个带 `border-b` 的自制 header + 手写
   *   `text-2xl` 标题 —— 那正是 A §4 点名的「30 处手写大标题」之一。计数仍是自己的一段
   *   （测试与文案都按「N 条」读），只是挪进页头的动作簇，而没有变成第二个标题。
   *   D=松：`density="loose"` 让「页头 → 格子」这一段块间走 `--density-section-gap`，
   *   格子本身已经是独立卡面（`AttachmentMediaGrid` / `AttachmentFileList` 自带）。
   *   R=齐：不给 `rail`，所以 frame 退回单列、与内容列同宽同边 —— 没有侧轨（那是 R=错），
   *   也没有出血带（那是 R=出）。
   *
   * 图/文件是等权条目、先扫后点，所以它是画廊而不是收件箱：一屏多个同权格子
   * （`AttachmentMediaGrid` 自己按 2/3/4 列铺），没有主从结构。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="line"
      density="loose"
      headerSlot={
        /*
          This is a PANEL over the conversation, not a page in its own right — the
          reader got here from the thread and will go back to it. So the header carries
          one action cluster at the same height: identity on the left, the one toggle
          and one action on the right. The three plain text links it used to be gave
          "go back", "switch view" and "refresh" identical weight, which made the
          switch — the only thing here that changes what you are looking at — the
          hardest of the three to find.
        */
        <PageMasthead
          eyebrow="会话素材"
          title={label}
          actions={
            <>
              <span className="text-meta tabular-nums text-muted-foreground">
                {items.length} 条
              </span>

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
                      ? "focus-ring rounded-md bg-card px-2.5 py-1 text-meta font-medium text-primary"
                      : "focus-ring rounded-md px-2.5 py-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
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
                      ? "focus-ring rounded-md bg-card px-2.5 py-1 text-meta font-medium text-primary"
                      : "focus-ring rounded-md px-2.5 py-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
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
            </>
          }
        />
      }
    >
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
        <AttachmentMediaGrid items={items} conversationId={conversationId} />
      ) : (
        <AttachmentFileList items={items} conversationId={conversationId} />
      )}
    </ArchetypeFrame>
  );
}
