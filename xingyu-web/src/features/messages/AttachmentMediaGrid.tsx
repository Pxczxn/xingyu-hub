import type { ChatMessage } from "@/api/messages/messages.types";
import { formatMessageTime } from "./MessageBubble";
import { AuthenticatedAttachment } from "./AuthenticatedAttachment";

/*
 * Image grid for one conversation.
 *
 * The rows come from `GET /messages/{id}/media`, which already filtered to IMAGE
 * messages server-side, so nothing is re-filtered here. A recalled message (whose
 * attachments the backend nulls) renders as a muted placeholder instead of a broken tile.
 *
 * 2026-10-06: the bytes are fetched through the member-checked endpoint rather than from
 * `attachmentUrl` — that path is display-only and no longer served statically, and a
 * plain `<img src>` could not carry the session token anyway.
 */

export function AttachmentMediaGrid({
  items,
  conversationId,
}: {
  items: ChatMessage[];
  conversationId: string;
}) {
  return (
    <ul aria-label="图片列表" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((message) => {
        const at = formatMessageTime(message.createdAt);
        return (
          <li key={message.id} className="flex flex-col gap-1">
            <AuthenticatedAttachment
              conversationId={conversationId}
              messageId={message.id}
              fileId={message.attachmentFileId}
            >
              {(url) => (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border border-border"
                >
                  <img
                    src={url}
                    alt={message.attachmentName ?? "图片"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>
              )}
            </AuthenticatedAttachment>
            <span className="truncate px-1 text-[10px] text-muted-foreground">
              {message.attachmentName ?? "图片"}
            </span>
            {at ? <time className="px-1 text-[10px] text-muted-foreground">{at}</time> : null}
          </li>
        );
      })}
    </ul>
  );
}
