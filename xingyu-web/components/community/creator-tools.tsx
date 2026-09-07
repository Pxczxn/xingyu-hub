"use client";

import Link from "next/link";
import { Check, ChevronRight, Clock3, MoreHorizontal, Save, Send } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AuthorIdentity({ username, name, subtitle, href }: { username: string; name?: string; subtitle?: string; href?: string }) {
  const content = <><Avatar fallback={name || username} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{name || username}</span>{subtitle ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span> : null}</span></>;
  return href ? <Link href={href} className="flex items-center gap-2 hover:text-[rgb(var(--violet))]">{content}</Link> : <span className="flex items-center gap-2">{content}</span>;
}

export function GalaxyBadge({ name, href = "/galaxies" }: { name: string; href?: string }) { return <Link href={href} className="inline-flex items-center rounded-full bg-[rgb(var(--navy))] px-2.5 py-1 text-xs font-medium text-white hover:bg-[rgb(var(--navy)/.9)]">{name} · 星系</Link>; }

export function SeriesProgress({ current, total, label = "阅读进度" }: { current: number; total: number; label?: string }) {
  const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return <div className="min-w-36"><div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{current}/{total}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[rgb(var(--violet))] transition-[width]" style={{ width: `${percent}%` }} /></div></div>;
}

export function EditorToolbar({
  body = "",
  onInsert,
  textareaRef,
}: {
  body?: string;
  onInsert?: (next: string, selectionStart: number, selectionEnd: number) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  function wrapSelection(before: string, after: string, placeholder: string) {
    const textarea =
      textareaRef?.current ??
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label="文章正文"]');
    if (!textarea || !onInsert) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    const selectionStart = start + before.length;
    const selectionEnd = selectionStart + selected.length;
    onInsert(next, selectionStart, selectionEnd);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
      <Button variant="ghost" size="sm" type="button">正文</Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => wrapSelection("**", "**", "粗体")}><strong>B</strong></Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => wrapSelection("*", "*", "斜体")}><em>I</em></Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => wrapSelection("> ", "", "引用")}>引用</Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => wrapSelection("`", "`", "code")}>代码</Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => wrapSelection("![", "](图片链接)", "图片描述")}>图片</Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => wrapSelection("[", "](链接)", "链接文字")}>链接</Button>
      <Button variant="ghost" size="icon" type="button" aria-label="更多编辑操作"><MoreHorizontal className="h-4 w-4" /></Button>
    </div>
  );
}

export function EditorCanvas({ initialTitle = "", initialBody = "", title: controlledTitle, body: controlledBody, onTitleChange, onBodyChange }: { initialTitle?: string; initialBody?: string; title?: string; body?: string; onTitleChange?: (value: string) => void; onBodyChange?: (value: string) => void }) {
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const [localBody, setLocalBody] = useState(initialBody);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const title = controlledTitle ?? localTitle;
  const body = controlledBody ?? localBody;

  function updateTitle(value: string) { setLocalTitle(value); onTitleChange?.(value); }
  function updateBody(value: string) { setLocalBody(value); onBodyChange?.(value); }

  function handleInsert(next: string, selectionStart: number, selectionEnd: number) {
    updateBody(next);
    requestAnimationFrame(() => {
      const textarea = bodyRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  return (
    <div className="xy-panel p-5 sm:p-7">
      <Input value={title} onChange={event => updateTitle(event.target.value)} placeholder="输入一个清晰的标题" aria-label="文章标题" className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0" />
      <EditorToolbar body={body} onInsert={handleInsert} textareaRef={bodyRef} />
      <textarea ref={bodyRef} value={body} onChange={event => updateBody(event.target.value)} placeholder="从这里开始写作…" aria-label="文章正文" className="mt-5 min-h-[420px] w-full resize-y border-0 bg-transparent text-[15px] leading-8 outline-none placeholder:text-muted-foreground" />
    </div>
  );
}

export function PublishPanel({ onSave, onSubmit }: { onSave?: () => void; onSubmit?: () => void }) { return <section className="xy-panel p-5"><p className="font-medium">发布检查</p><ul className="mt-4 space-y-3 text-sm text-muted-foreground"><li className="flex gap-2"><Check className="h-4 w-4 text-[rgb(var(--violet))]" />标题与正文</li><li className="flex gap-2"><Clock3 className="h-4 w-4" />选择话题与可见范围</li></ul><div className="mt-5 grid gap-2"><Button variant="outline" onClick={onSave}><Save className="mr-1.5 h-4 w-4" />保存草稿</Button><Button onClick={onSubmit}><Send className="mr-1.5 h-4 w-4" />提交审核</Button></div></section>; }

export function RevisionTimeline({ revisions }: { revisions: Array<{ id: string; label: string; detail: string; active?: boolean }> }) { return <ol className="border-l border-border pl-5">{revisions.map(revision => <li key={revision.id} className="relative pb-6 last:pb-0"><span className={cn("absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-card", revision.active ? "bg-[rgb(var(--violet))]" : "bg-muted-foreground")} /><p className="text-sm font-medium">{revision.label}</p><p className="mt-1 text-sm text-muted-foreground">{revision.detail}</p></li>)}</ol>; }

export function SettingsNav({ items, current }: { items: Array<{ label: string; href: string }>; current: string }) { return <nav className="xy-panel h-fit p-3" aria-label="设置导航">{items.map(item => <Link key={item.href} href={item.href} className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-sm", current === item.href ? "bg-[rgb(var(--violet)/.1)] font-medium text-[rgb(var(--violet))]" : "hover:bg-muted")}><span>{item.label}</span><ChevronRight className="h-4 w-4" /></Link>)}</nav>; }
