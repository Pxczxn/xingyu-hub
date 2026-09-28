"use client";

import Link from "next/link";
import { AtSign, Paperclip, SendHorizontal } from "lucide-react";
import { FormEvent, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversationPreview = { id: string; name: string; detail: string; unread?: number; href: string; active?: boolean };
export function ConversationItem({ conversation }: { conversation: ConversationPreview }) {
  return <Link href={conversation.href} className={cn("flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted", conversation.active && "bg-[rgb(var(--violet)/.1)]")}><Avatar fallback={conversation.name} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{conversation.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{conversation.detail}</p></div>{conversation.unread ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[11px] text-white">{conversation.unread > 99 ? "99+" : conversation.unread}</span> : null}</Link>;
}

export function MessageBubble({ body, outgoing = false, sender, time }: { body: string; outgoing?: boolean; sender?: string; time?: string }) {
  return <article className={cn("flex gap-2", outgoing && "justify-end")}><div className={cn("max-w-[78%] rounded-2xl p-3 text-sm leading-6", outgoing ? "rounded-tr-sm bg-[rgb(var(--navy))] text-white" : "rounded-tl-sm bg-muted")}><p>{body}</p>{sender || time ? <p className={cn("mt-1 text-[11px]", outgoing ? "text-white/65" : "text-muted-foreground")}>{sender ? `${sender} · ` : ""}{time}</p> : null}</div></article>;
}

export function MessageComposer({ onSend }: { onSend?: (body: string) => void }) {
  const [body, setBody] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const value = body.trim(); if (!value) return; onSend?.(value); setBody(""); }
  return <form onSubmit={submit} className="border-t border-border p-3"><label className="sr-only" htmlFor="message-composer">输入消息</label><div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2"><Button variant="ghost" size="icon" type="button" aria-label="添加附件"><Paperclip className="h-4 w-4" /></Button><textarea id="message-composer" value={body} onChange={event => setBody(event.target.value)} rows={1} placeholder="输入消息…" className="max-h-28 min-h-9 flex-1 resize-y bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground" /><Button variant="ghost" size="icon" type="button" aria-label="提及成员"><AtSign className="h-4 w-4" /></Button><Button size="icon" type="submit" aria-label="发送消息" disabled={!body.trim()}><SendHorizontal className="h-4 w-4" /></Button></div></form>;
}

export function GroupMemberRow({ name, role = "成员", action }: { name: string; role?: string; action?: React.ReactNode }) {
  return <div className="flex items-center gap-3 py-3"><Avatar fallback={name} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name}</p><p className="mt-0.5 text-xs text-muted-foreground">{role}</p></div>{action}</div>;
}
