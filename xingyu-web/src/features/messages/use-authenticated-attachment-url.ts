import { useEffect, useState } from "react";
import { messagesApi } from "@/api/messages/messages.api";

/**
 * Fetch a message attachment WITH the session token and hand back an object URL.
 *
 * Why this exists (2026-10-06): message attachments used to be plain
 * `/api/v1/admin/files/...` URLs, and that path does no session check at all — a
 * measured `curl` with no token returned 200. The static controller now refuses that
 * directory, so the bytes are only available through the member-checked endpoint.
 *
 * A plain `<img src>` cannot send the `satoken` header, so the bytes are fetched with
 * the same authenticated transport as every other call and handed to the DOM as a blob
 * URL. The object URL is revoked when the message changes or the bubble unmounts, so a
 * long thread does not leak blobs.
 *
 * Returns `null` while loading and on failure — a broken attachment must not take the
 * conversation down with it.
 */
export function useAuthenticatedAttachmentUrl(
  conversationId: string,
  messageId: string,
  fileId: number | null | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const enabled = Boolean(conversationId && messageId && fileId);

  useEffect(() => {
    if (!enabled) {
      setUrl(null);
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
        if (active) setUrl(null);
      });

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
    // fileId is part of `enabled`; depending on it keeps the effect honest when the
    // same message id is reused with a different attachment.
  }, [conversationId, messageId, fileId, enabled]);

  return url;
}
