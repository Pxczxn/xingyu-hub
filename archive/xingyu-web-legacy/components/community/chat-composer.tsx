"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";

function newClientMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type ChatComposerProps = {
  conversationId: string;
  mode: "direct" | "group";
  onSent: () => void;
  onError?: (message: string) => void;
};

export function ChatComposer({ conversationId, mode, onSent, onError }: ChatComposerProps) {
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPublicConfig()
      .then((config) => {
        const maxSize = config.storage?.maxSize;
        if (maxSize) setUploadHint(`单个附件不超过 ${maxSize} MB`);
      })
      .catch(() => undefined);
  }, []);

  async function sendPayload(payload: Record<string, string>) {
    setSending(true);
    try {
      const body = { ...payload, clientMessageId: newClientMessageId() };
      if (mode === "direct") {
        await communityApi.sendDirectMessagePayload(conversationId, body);
      } else {
        await communityApi.sendGroupMessagePayload(conversationId, body);
      }
      setMessageBody("");
      onSent();
    } catch {
      onError?.("发送失败，请稍后重试");
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    const body = messageBody.trim();
    if (!body) return;
    await sendPayload({ body });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSending(true);
    try {
      const uploaded = await communityApi.uploadMessageAttachment(file);
      const isImage = uploaded.mimeType.startsWith("image/");
      await sendPayload({
        type: isImage ? "IMAGE" : "FILE",
        attachmentUrl: uploaded.url,
        attachmentName: uploaded.name,
        body: messageBody.trim() || uploaded.name,
      });
    } catch {
      onError?.("附件上传失败");
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={sending}
          aria-label="添加附件"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          placeholder="输入消息…"
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button variant="accent" onClick={() => void handleSend()} disabled={sending || !messageBody.trim()}>
          发送
        </Button>
      </div>
      {uploadHint && <p className="mt-1 text-xs text-muted-foreground">{uploadHint}</p>}
    </div>
  );
}
