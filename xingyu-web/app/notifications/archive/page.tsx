"use client";
import Link from "next/link";
import { Archive, ArrowLeft } from "lucide-react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { EmptyState } from "@/components/community/empty-state";
export default function NotificationArchivePage(){return <CompactPageShell eyebrow="互动提醒" title="通知归档" description="已处理的提醒会保留在这里，方便之后回看。" width="lg"><div className="mb-4"><Link href="/notifications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>返回通知</Link></div><EmptyState icon={Archive} title="暂无归档通知" description="目前还没有需要归档的通知。" compact /></CompactPageShell>}