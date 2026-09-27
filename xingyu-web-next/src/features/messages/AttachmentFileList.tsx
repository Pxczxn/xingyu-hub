import type { ChatMessage } from "@/api/messages/messages.types";
import { formatMessageTime, senderLabel } from "./MessageBubble";

/*
 * File list for one conversation (Phase 2I-3b).
 *
 * The rows come from `GET /messages/{id}/files`, which already filtered to FILE
 * messages server-side — an image is never in this list, and no client-side
 * filtering happens here. A recalled row (attachments nulled by the backend) is
 * skipped by the caller rather than rendered as a dead link.
 *
 * `attachmentName` is what the user called the file and is preferred over the
 * URL's uuid. It is nullable in the payload, so "附件" is the honest fallback —
 * never a slice of a storage path, which would look like a filename and is not.
 *
 * An icon rather than a preview: these are PDFs/Office/text/zip, so there is
 * nothing to render, and a generic glyph is more useful than a broken image.
 */

export function AttachmentFileList({ items }: { items: ChatMessage[] }) {
  return (
    <ul aria-label="文件列表" className="flex flex-col gap-2">
      {items.map((message) => {
        const at = formatMessageTime(message.createdAt);
        return (
          <li key={message.id}>
            <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
              >
                文件
              </span>
              <span className="min-w-0 flex-1">
                <a
                  href={message.attachmentUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-accent hover:underline"
                >
                  {message.attachmentName ?? "附件"}
                </a>
                <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{senderLabel(message.senderId)}</span>
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
