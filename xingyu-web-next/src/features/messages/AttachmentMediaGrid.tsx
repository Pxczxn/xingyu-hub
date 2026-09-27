import type { ChatMessage } from "@/api/messages/messages.types";
import { formatMessageTime } from "./MessageBubble";

/*
 * Image grid for one conversation (Phase 2I-3b).
 *
 * The rows come from `GET /messages/{id}/media`, which already filtered to
 * IMAGE messages server-side, so nothing is re-filtered here. A row with no
 * `attachmentUrl` (a recalled message whose attachments were nulled) is skipped
 * by the caller rather than rendered as a broken tile.
 *
 * Each tile links to the full file in a new tab: the URLs are served publicly
 * by the admin file controller, so a plain anchor is the right affordance — no
 * lightbox, which would be a new surface with its own loading and error states.
 */

export function AttachmentMediaGrid({ items }: { items: ChatMessage[] }) {
  return (
    <ul
      aria-label="图片列表"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((message) => {
        const at = formatMessageTime(message.createdAt);
        return (
          <li key={message.id} className="flex flex-col gap-1">
            <a
              href={message.attachmentUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-border"
            >
              <img
                src={message.attachmentUrl ?? undefined}
                alt={message.attachmentName ?? "图片"}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </a>
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
