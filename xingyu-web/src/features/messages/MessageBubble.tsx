import { RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/api/messages/messages.types";
import { isRecalled } from "@/api/messages/messages.types";
import { cn } from "@/lib/cn";

/*
 * One chat bubble (Phase 2I-3).
 *
 * Two things the backend already decided, which this component must not undo:
 *
 *  1. `body` is the display string. For an IMAGE/FILE message the service stores
 *     the attachment URL as `body` when no caption was given, so text is always
 *     renderable — but an attachment is rendered from `attachmentUrl`, and the
 *     body is suppressed when it merely repeats that URL.
 *  2. A recalled message is a TOMBSTONE. The server blanks the body to
 *     「[消息已撤回]」 and nulls the attachments; rendering is keyed off
 *     `recalledAt`, never off sniffing the body text, so the copy can change
 *     server-side without silently turning tombstones back into content.
 *
 * `mine` only controls alignment and which side gets the sender label — there is
 * no sender directory in this phase, so a group bubble shows a shortened id
 * rather than inventing a name.
 */

export function formatMessageTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

/**
 * A short, honest label for a sender with no profile data available.
 * Never claims a name the payload does not carry.
 */
export function senderLabel(senderId: string): string {
  const trimmed = senderId?.trim();
  if (!trimmed) return "某位成员";
  return trimmed.length > 8 ? `${trimmed.slice(0, 8)}…` : trimmed;
}

/** True when the message body is just a restatement of its attachment URL. */
function bodyRepeatsAttachment(message: ChatMessage): boolean {
  const body = message.body?.trim();
  const url = message.attachmentUrl?.trim();
  return Boolean(body && url && body === url);
}

export function MessageBubble({
  message,
  mine,
  showSender,
  canRecall,
  pending,
  onRecall,
}: {
  message: ChatMessage;
  /** Sent by the signed-in user. Resolved by the page from the socket's own id, not from useAuth (which has no id). */
  mine: boolean;
  /** Render a sender label — only useful in a group, and never for your own. */
  showSender: boolean;
  /** The message is mine, not recalled, and still inside the recall window. */
  canRecall: boolean;
  pending: boolean;
  onRecall: (message: ChatMessage) => void;
}) {
  const recalled = isRecalled(message);
  const at = formatMessageTime(message.createdAt);
  const isImage = message.messageType === "IMAGE" && Boolean(message.attachmentUrl);
  const isFile = message.messageType === "FILE" && Boolean(message.attachmentUrl);
  const showBody = Boolean(message.body?.trim()) && !bodyRepeatsAttachment(message);

  return (
    <li
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
      data-recalled={recalled ? "true" : undefined}
    >
      {showSender && !mine ? (
        <span className="px-2 text-xs text-muted-foreground">{senderLabel(message.senderId)}</span>
      ) : null}

      <div
        className={cn(
          "max-w-[80%] rounded-lg border px-3 py-2 text-sm",
          recalled
            ? "border-dashed border-border bg-muted/40 text-muted-foreground italic"
            : mine
              ? "border-accent/40 bg-accent/15 text-foreground"
              : "border-border bg-card text-foreground",
          pending && "opacity-60",
        )}
      >
        {recalled ? (
          <span className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {message.body || "[消息已撤回]"}
          </span>
        ) : (
          <>
            {isImage ? (
              <a
                href={message.attachmentUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={message.attachmentUrl ?? undefined}
                  alt={message.attachmentName ?? "图片"}
                  className="max-h-64 max-w-full rounded"
                />
              </a>
            ) : null}

            {isFile ? (
              <a
                href={message.attachmentUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 underline hover:no-underline"
              >
                {message.attachmentName ?? "附件"}
              </a>
            ) : null}

            {showBody ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
          </>
        )}
      </div>

      <span className="flex items-center gap-2 px-2 text-[10px] text-muted-foreground">
        {at ? <time>{at}</time> : null}
        {canRecall ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRecall(message)}
            className="hover:text-foreground hover:underline disabled:opacity-50"
          >
            {pending ? "撤回中…" : "撤回"}
          </button>
        ) : null}
      </span>
    </li>
  );
}

