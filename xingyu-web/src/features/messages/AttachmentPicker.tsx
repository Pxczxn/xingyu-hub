import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { ApiError } from "@/api/client";
import { filesApi } from "@/api/files/files.api";
import type { ChatMessage, ConversationType } from "@/api/messages/messages.types";
import {
  MESSAGE_ATTACHMENT_ERROR,
  attachmentMessageType,
  validateMessageAttachment,
} from "@/api/messages/messages.types";
import { messagesApi } from "@/api/messages/messages.api";

/*
 * Attachment send control (Phase 2I-3b).
 *
 * Two steps, because the backend has two endpoints with different jobs: the
 * file is uploaded to `POST /api/v1/messages/upload` (which stores bytes and
 * returns a URL — it creates no message and touches no conversation), then a
 * message referencing that URL is sent. `filesApi.uploadFile` owns the
 * transport; this component owns the sequencing and the error surface.
 *
 * Why the file is validated here rather than at the server: a rejected
 * extension, an oversized file or a missing `file` part all come back as
 * 500 INTERNAL_ERROR ("系统繁忙"), which tells the user nothing. The backend
 * only inspects the extension, so `validateMessageAttachment` mirrors that
 * check to produce a real reason. It is a UX guard, not a security boundary.
 *
 * The picker's `accept` lists the whole whitelist, not just images: the backend
 * accepts PDFs/Office/txt/md/csv/zip too, and only the images become IMAGE
 * messages. Narrowing `accept` to images would silently hide a supported case.
 *
 * Cleanup: the value is reset after every attempt (success or failure) so
 * re-picking the same file fires `change` again — without it, a failed upload
 * could never be retried with the same file.
 */

const UPLOAD_FAILED = "附件上传失败，请重试。";
const SEND_FAILED = "附件发送失败，请重试。";

/** The `accept` attribute — the same sixteen extensions the backend allows. */
const ACCEPT_ATTR = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".md", ".csv", ".zip",
].join(",");

export function AttachmentPicker({
  conversationId,
  conversationType,
  disabled,
  onSent,
  onError,
}: {
  conversationId: string;
  conversationType: ConversationType;
  /** True while a text message is being sent, so both paths cannot race. */
  disabled: boolean;
  /** The created message, so the thread can merge it like a text send. */
  onSent: (message: ChatMessage) => void;
  /** A user-facing reason; the message is not swallowed. */
  onError: (reason: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset first: a second attempt with the same file must still fire `change`.
    event.target.value = "";
    if (!file) return;

    setLocalError(null);

    const reason = validateMessageAttachment(file);
    if (reason) {
      setLocalError(reason);
      onError(reason);
      return;
    }

    const messageType = attachmentMessageType(file.name);
    if (!messageType) {
      // Unreachable while the two lists above agree, but the type is nullable
      // so the compiler makes us say what happens. Fail loudly, not silently.
      setLocalError(MESSAGE_ATTACHMENT_ERROR);
      onError(MESSAGE_ATTACHMENT_ERROR);
      return;
    }

    setUploading(true);
    // Track the phase explicitly: both calls happen under `uploading`, so the
    // flag cannot tell the two failures apart and would always report the send
    // step as the one that broke.
    let phase: "upload" | "send" = "upload";
    try {
      const uploaded = await filesApi.uploadFile(file);
      phase = "send";
      const created = await messagesApi.sendAttachment(conversationId, conversationType, {
        url: uploaded.url,
        name: uploaded.name,
        messageType,
      });
      onSent(created);
    } catch (err: unknown) {
      // The backend's own reason when it has one, otherwise a plain statement —
      // never a silent no-op.
      const detail = err instanceof ApiError && err.problem.detail ? err.problem.detail : null;
      const reason = detail ?? (phase === "upload" ? UPLOAD_FAILED : SEND_FAILED);
      setLocalError(reason);
      onError(reason);
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || uploading;

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        data-testid="attachment-input"
        onChange={(event) => void onPick(event)}
      />
      <button
        type="button"
        aria-label="添加附件"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex h-11 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <Paperclip className="h-4 w-4" aria-hidden />
        {uploading ? "上传中…" : "附件"}
      </button>
      {localError ? (
        <p role="alert" className="max-w-40 text-[10px] text-destructive">
          {localError}
        </p>
      ) : null}
    </div>
  );
}

