import { useEffect, useState } from "react";
import { messagesApi } from "@/api/messages/messages.api";
import { cn } from "@/lib/cn";

/**
 * One attachment tile / row, backed by the member-checked download endpoint.
 *
 * 2026-10-06: the media grid and the file list used to point straight at
 * `message.attachmentUrl`, i.e. `/api/v1/admin/files/...`, which performs no session
 * check (measured 200 with no token). Those URLs are display-only now; the bytes
 * come from the authenticated endpoint through a blob URL.
 *
 * Takes the ids **explicitly** rather than a `ChatMessage`, because the saved-messages
 * rows are not messages: their `id` is the BOOKMARK id, and the download path needs the
 * real `messageId`. Passing the message object and reading `message.id` is exactly the
 * kind of near-miss that produces a 404 nobody notices.
 *
 * Rows without an `attachmentFileId` (a recalled message, or one written before the
 * column existed) render as a muted placeholder rather than a broken tile — being told
 * the attachment is unavailable is honest; a broken image is not.
 */
export function AuthenticatedAttachment({
  conversationId,
  messageId,
  fileId,
  className,
  children,
}: {
  conversationId: string;
  /** The MESSAGE id (never the bookmark id). */
  messageId: string;
  fileId: number | null | undefined;
  className?: string;
  children: (url: string) => React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!conversationId || !messageId || !fileId) {
      setUrl(null);
      setFailed(false);
      return;
    }
    let active = true;
    let created: string | null = null;
    messagesApi
      .downloadAttachment(conversationId, messageId)
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [conversationId, messageId, fileId]);

  if (!fileId || failed || !url) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {failed ? "附件不可用" : "加载中…"}
      </span>
    );
  }
  return <>{children(url)}</>;
}
