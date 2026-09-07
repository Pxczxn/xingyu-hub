"use client";
import Link from "next/link";
import { MailPlus, ArrowLeft } from "lucide-react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { EmptyState } from "@/components/community/empty-state";
export default function MessageInvitationsPage(){return <CompactPageShell eyebrow="消息中心" title="邀请" description="查看来自群组、星系和创作协作的邀请。" width="lg"><div className="mb-4"><Link href="/messages" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>返回消息</Link></div><EmptyState icon={MailPlus} title="暂无待处理邀请" description="新的群组或协作邀请会显示在这里。" actionLabel="浏览社区" actionHref="/discover" compact /></CompactPageShell>}