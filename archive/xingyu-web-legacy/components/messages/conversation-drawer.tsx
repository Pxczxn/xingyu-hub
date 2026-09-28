"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type ConversationDrawerProps = {
  open: boolean;
  panel: string | null;
  conversationId: string;
  onClose: string;
};

const PANEL_LABELS: Record<string, string> = {
  members: "群成员",
  settings: "群设置",
  info: "群资料",
  invite: "邀请成员",
  requests: "入群申请",
};

export function ConversationDrawer({ open, panel, conversationId, onClose }: ConversationDrawerProps) {
  if (!open || !panel) return null;
  const label = PANEL_LABELS[panel] ?? panel;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-[#e8e2da] bg-white p-6 shadow-xl" role="dialog" aria-label={label}>
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <Button variant="ghost" size="sm" asChild><Link href={onClose}>关闭</Link></Button>
      </header>
      <p className="text-sm text-[#5f6b82]">{label} 功能已收敛到此 Drawer，完整交互将在后续版本补齐。</p>
    </aside>
  );
}
