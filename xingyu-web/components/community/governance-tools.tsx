"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TableColumn<Row> = { key: keyof Row & string; label: string; render?: (row: Row) => ReactNode };
export function DataTable<Row extends { id: string }>({ columns, rows, emptyLabel = "暂无数据" }: { columns: TableColumn<Row>[]; rows: Row[]; emptyLabel?: string }) {
  if (!rows.length) return <div className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{columns.map(column => <th className="whitespace-nowrap px-3 py-3 font-medium" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="border-b border-border last:border-0" key={row.id}>{columns.map(column => <td className="whitespace-nowrap px-3 py-3" key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}

export function ModerationCaseCard({ caseId, title, status, summary, onOpen }: { caseId: string; title: string; status: "待处理" | "处理中" | "已结案"; summary: string; onOpen?: () => void }) {
  const tone = status === "已结案" ? "text-emerald-700 bg-emerald-50" : status === "处理中" ? "text-[rgb(var(--violet))] bg-[rgb(var(--violet)/.1)]" : "text-amber-700 bg-amber-50";
  return <article className="xy-panel-interactive p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">案件 {caseId}</p><h3 className="mt-1 font-medium">{title}</h3></div><span className={cn("rounded-full px-2 py-1 text-xs font-medium", tone)}>{status}</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p><Button variant="ghost" size="sm" className="mt-3" onClick={onOpen}>查看处理进度</Button></article>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "确认", destructive = false, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgb(var(--navy)/.38)] p-4" role="presentation"><section className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><AlertTriangle className={cn("h-5 w-5", destructive ? "text-destructive" : "text-[rgb(var(--accent))]")} /><h2 id="confirm-title" className="font-semibold">{title}</h2></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></div><Button variant="ghost" size="icon" onClick={onCancel} aria-label="关闭确认框"><X className="h-4 w-4" /></Button></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>取消</Button><Button onClick={onConfirm} className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}><CheckCircle2 className="mr-1.5 h-4 w-4" />{confirmLabel}</Button></div></section></div>;
}
