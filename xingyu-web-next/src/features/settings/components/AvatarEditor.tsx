import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { filesApi } from "@/api/files/files.api";
import { clientSettingsApi } from "@/api/settings/client-settings.api";
import { Button } from "@/components/ui/button";
import {
  AVATAR_ACCEPT_ATTR,
  AVATAR_MAX_LABEL,
  resolveAvatarSrc,
  validateAvatarFile,
} from "@/features/settings/avatar-file";

/*
 * AvatarEditor — the real avatar loop on /settings/profile (Phase 2A-2c).
 *
 *   current avatar -> pick a file -> validate -> local preview -> upload
 *                  -> write the avatar -> the new value shows everywhere
 *
 * ── The contract this drives (verified live 2026-09-23) ────────────────────
 * Two requests, in this order, and it really is two:
 *   1. POST /api/v1/messages/upload      -> { url, name, mimeType }
 *   2. PUT  /api/v1/me/client-settings   -> { avatar: url }
 *
 * The avatar is NOT a profile column: it lives in `settings_json.avatar`, so
 * PATCH /me/profile cannot write it (it returns 200 and changes nothing). See
 * api/files/files.api.ts and api/settings/client-settings.api.ts.
 *
 * ── Two-phase atomicity ────────────────────────────────────────────────────
 *   upload fails            -> step 2 is never called; the saved avatar is kept
 *   upload ok, write fails  -> the UI says so, keeps the OLD saved avatar, and
 *                              remembers the uploaded URL so a retry re-issues
 *                              only step 2 (never a second upload)
 *
 * The retry detail matters: re-uploading on every retry would leave one orphan
 * object per attempt. Nothing deletes them — the backend has no cleanup — so
 * the frontend must not manufacture more of them than necessary. This is a
 * mitigation, not a fix: the orphan gap is recorded in the phase report.
 *
 * ── Preview is not "saved" ─────────────────────────────────────────────────
 * The preview is an object URL for a local file. It is labelled as a preview
 * and the saved avatar is only ever taken from a server response, so a preview
 * can never be mistaken for a persisted avatar.
 */

type AvatarStatus = "idle" | "selected" | "uploading" | "success" | "error";

function describeError(error: unknown, phase: "upload" | "save"): string {
  const detail = error instanceof ApiError ? error.problem.detail : null;
  if (phase === "upload") {
    return detail ? `图片上传失败：${detail}` : "图片上传失败，请稍后重试。";
  }
  return detail
    ? `图片已上传，但头像保存失败：${detail}。当前头像未变更。`
    : "图片已上传，但头像保存失败，当前头像未变更。请稍后重试。";
}

export function AvatarEditor({
  avatar,
  fallbackText,
  onAvatarSaved,
}: {
  /** The persisted avatar URL, owned by the page so it can also be reloaded. */
  avatar: string | null;
  /** Initial letter shown when there is no avatar. */
  fallbackText: string;
  /** Called with the new persisted value (or null after a reset). */
  onAvatarSaved: (avatar: string | null) => void;
}) {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /*
   * Set once step 1 has succeeded. While it is set, a retry skips the upload
   * and re-issues only the settings write.
   */
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  /*
   * Idempotency guard lives in the handler, not on `disabled`.
   * `disabled` only takes effect on the NEXT render, so a double click (or a
   * second call path) can enter the handler twice before it flips. Two uploads
   * would mean two stored objects and a wasted round trip.
   */
  const pendingRef = useRef(false);
  /*
   * The live preview URL is mirrored into a ref so that revocation never has to
   * happen inside a state updater. React StrictMode (this app runs under it —
   * see main.tsx) double-invokes updaters in development, so calling
   * `URL.createObjectURL` in one would mint TWO object URLs per selection and
   * leak one of them.
   */
  const previewRef = useRef<string | null>(null);

  /** Drop the current preview and release its object URL. Idempotent. */
  const clearPreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  /*
   * Unmount-only cleanup. Deliberately NOT keyed on `previewUrl`: that would
   * re-run the cleanup on every change and revoke the URL a second time after
   * `clearPreview` already released it.
   */
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  const pickFile = useCallback(
    (file: File) => {
      const message = validateAvatarFile(file);
      // Replace any previous preview either way; a stale one would be misleading.
      clearPreview();
      setUploadedUrl(null);

      if (message !== null) {
        setSelectedFile(null);
        setStatus("error");
        setError(message);
        return;
      }

      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreviewUrl(url);
      setSelectedFile(file);
      setStatus("selected");
      setError(null);
    },
    [clearPreview],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Allow re-picking the same file after a failure.
      event.target.value = "";
      if (!file) return;
      pickFile(file);
    },
    [pickFile],
  );

  const upload = useCallback(async () => {
    if (pendingRef.current) return;
    if (!selectedFile && !uploadedUrl) return;

    pendingRef.current = true;
    setStatus("uploading");
    setError(null);

    let phase: "upload" | "save" = "upload";
    try {
      let url = uploadedUrl;
      if (!url) {
        const uploaded = await filesApi.uploadFile(selectedFile as File);
        url = resolveAvatarSrc(uploaded.url);
        if (!url) throw new Error("上传响应缺少文件地址");
        setUploadedUrl(url);
      }

      phase = "save";
      const settings = await clientSettingsApi.updateAvatar(url);
      // Adopt the server's view; fall back to the URL we just wrote.
      const saved = resolveAvatarSrc(settings.avatar) ?? url;
      onAvatarSaved(saved);

      clearPreview();
      setSelectedFile(null);
      setUploadedUrl(null);
      setStatus("success");
    } catch (caught) {
      /*
       * Never a fake success: the preview stays (so the user can retry) and the
       * saved avatar is untouched.
       */
      setStatus("error");
      setError(describeError(caught, phase));
    } finally {
      pendingRef.current = false;
    }
  }, [selectedFile, uploadedUrl, onAvatarSaved, clearPreview]);

  const resetToDefault = useCallback(async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setStatus("uploading");
    setError(null);
    try {
      const settings = await clientSettingsApi.updateAvatar(null);
      onAvatarSaved(resolveAvatarSrc(settings.avatar));
      clearPreview();
      setSelectedFile(null);
      setUploadedUrl(null);
      setStatus("success");
    } catch (caught) {
      setStatus("error");
      setError(describeError(caught, "save"));
    } finally {
      pendingRef.current = false;
    }
  }, [onAvatarSaved, clearPreview]);

  const savedAvatar = resolveAvatarSrc(avatar);
  const displayedAvatar = previewUrl ?? savedAvatar;
  const uploading = status === "uploading";
  const initial = (fallbackText || "?").trim().slice(0, 1) || "?";

  return (
    <section aria-labelledby="settings-avatar-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="settings-avatar-heading" className="text-base font-semibold text-primary">
          头像
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          支持 PNG、JPG、GIF、WebP，最大 {AVATAR_MAX_LABEL}。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {displayedAvatar ? (
          <img
            src={displayedAvatar}
            alt=""
            data-testid="avatar-image"
            className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            data-testid="avatar-fallback"
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-muted text-2xl font-medium text-muted-foreground"
          >
            {initial}
          </span>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={AVATAR_ACCEPT_ATTR}
              aria-label="选择头像图片"
              onChange={handleInputChange}
              className="sr-only"
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              选择图片
            </Button>
            <Button
              type="button"
              disabled={uploading || (selectedFile === null && uploadedUrl === null)}
              onClick={() => void upload()}
            >
              {uploading ? "上传中…" : "上传头像"}
            </Button>
            {savedAvatar ? (
              <Button
                type="button"
                variant="ghost"
                disabled={uploading}
                onClick={() => void resetToDefault()}
              >
                恢复默认头像
              </Button>
            ) : null}
          </div>

          {/* A pending local file is a preview, never a saved avatar. */}
          {previewUrl ? (
            <p data-testid="avatar-preview-hint" className="text-xs text-muted-foreground">
              预览（尚未保存）
            </p>
          ) : null}
          {status === "success" ? (
            <p role="status" data-testid="avatar-saved" className="text-sm text-primary">
              头像已更新
            </p>
          ) : null}
          {status === "error" && error ? (
            <p role="alert" data-testid="avatar-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
