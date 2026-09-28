"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type NewChatModalProps = {
  open: boolean;
  onClose: () => void;
};

export function NewChatModal({ open, onClose }: NewChatModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">新建会话</h2>
        <p className="mt-2 text-sm text-muted-foreground">选择单聊或创建群聊。</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild><Link href="/messages/new" onClick={onClose}>新建单聊</Link></Button>
          <Button variant="outline" asChild><Link href="/messages/groups/new" onClick={onClose}>创建群聊</Link></Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </div>
      </div>
    </div>
  );
}
