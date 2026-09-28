"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ChatMessage } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

export function ChatMessageCard({
  message,
  onSave,
}: {
  message: ChatMessage;
  onSave?: () => void;
}) {
  return (
    <Card className="p-4">
      {message.messageType === "IMAGE" && message.attachmentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.attachmentUrl}
          alt={message.attachmentName ?? "图片"}
          className="max-h-64 rounded-lg object-contain"
        />
      ) : message.messageType === "FILE" && message.attachmentUrl ? (
        <a
          href={message.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-accent hover:underline"
        >
          {message.attachmentName || message.body || "下载文件"}
        </a>
      ) : (
        <p className="text-sm text-foreground">{message.body}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</p>
        {onSave && (
          <Button type="button" variant="ghost" size="sm" onClick={onSave}>
            收藏
          </Button>
        )}
      </div>
    </Card>
  );
}
