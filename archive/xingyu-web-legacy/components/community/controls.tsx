"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TopicChip({ children, active = false, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", active ? "border-[rgb(var(--violet))] bg-[rgb(var(--violet)/.1)] text-[rgb(var(--violet))]" : "border-border bg-card text-muted-foreground hover:border-[rgb(var(--violet)/.45)] hover:text-foreground")}>{children}</button>;
}

export function FilterBar({ filters, active, onChange }: { filters: string[]; active: string; onChange: (filter: string) => void }) {
  return <div className="flex flex-wrap items-center gap-2" aria-label="内容筛选"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" />{filters.map(filter => <TopicChip key={filter} active={filter === active} onClick={() => onChange(filter)}>{filter}</TopicChip>)}</div>;
}

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return <nav className="flex items-center justify-center gap-2" aria-label="分页"><Button variant="outline" size="icon" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="上一页"><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-20 text-center text-sm text-muted-foreground">{page} / {pageCount}</span><Button variant="outline" size="icon" onClick={() => onChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} aria-label="下一页"><ChevronRight className="h-4 w-4" /></Button></nav>;
}

export function StatusBanner({ title, description, onDismiss }: { title: string; description?: string; onDismiss?: () => void }) {
  return <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgb(var(--violet)/.26)] bg-[rgb(var(--violet)/.08)] px-4 py-3" role="status"><div><p className="text-sm font-medium">{title}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>{onDismiss ? <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="关闭提示"><X className="h-4 w-4" /></Button> : null}</div>;
}
