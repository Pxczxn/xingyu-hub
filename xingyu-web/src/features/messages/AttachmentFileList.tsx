import type { ChatMessage } from "@/api/messages/messages.types";
import { formatMessageTime, senderName } from "./MessageBubble";
import { AuthenticatedAttachment } from "./AuthenticatedAttachment";

/*
 * File list for one conversation.
 *
 * The rows come from `GET /messages/{id}/files`, which already filtered to FILE
 * messages server-side — an image is never in this list, and no client-side
 * filtering happens here. A recalled row (attachments nulled by the backend) renders as
 * a muted placeholder rather than a dead link.
 *
 * `attachmentName` is what the user called the file and is preferred over the
 * URL's uuid. It is nullable in the payload, so "附件" is the honest fallback —
 * never a slice of a storage path, which would look like a filename and is not.
 *
 * An icon rather than a preview: these are PDFs/Office/text/zip, so there is
 * nothing to render, and a generic glyph is more useful than a broken image.
 *
 * 2026-10-06: download goes through the member-checked endpoint (see
 * `AuthenticatedAttachment`), and the sender line uses the structured `sender` instead
 * of a truncated user id.
 */

export function AttachmentFileList({
  items,
  conversationId,
}: {
  items: ChatMessage[];
  conversationId: string;
}) {
  return (
    <ul aria-label="文件列表" className="flex flex-col gap-2">
      {items.map((message) => {
        const at = formatMessageTime(message.createdAt);
        const who = senderName(message);
        return (
          <li key={message.id}>
            {/*
              2026-10-13 (batch 07c): `rounded-xl` + `border-border/70` is the card
              surface used everywhere else in the app; this row was the last
              `rounded-md` + full-strength border left in the feature, which reads as a
              slightly harder, slightly older box next to the image tiles and the
              mailbox rows.
            */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
              >
                文件
              </span>
              <span className="min-w-0 flex-1">
                <AuthenticatedAttachment
                  conversationId={conversationId}
                  messageId={message.id}
                  fileId={message.attachmentFileId}
                >
                  {(url) => (
                    <a
                      href={url}
                      download={message.attachmentName ?? "附件"}
                      rel="noreferrer"
                      className="block truncate text-sm text-accent-strong hover:underline"
                    >
                      {message.attachmentName ?? "附件"}
                    </a>
                  )}
                </AuthenticatedAttachment>
                {/*
                  2026-10-13 (batch 07c): this line carries TWO facts — who sent it and
                  when — so it takes the prose step (`text-meta`, 13px), not the 11px
                  micro step. 11px is for a label that is glanced at (a pill, a badge);
                  two facts stacked under a filename are read.
                */}
                <span className="mt-0.5 flex items-center gap-2 text-meta text-muted-foreground">
                  <span>{who ?? "已注销用户"}</span>
                  {at ? <time>{at}</time> : null}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
