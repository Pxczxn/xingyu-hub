"use client";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function PasswordSecurityPage(){return <CompactPageShell eyebrow="账号安全" title="修改密码" description="通过已验证邮箱安全更新密码。" width="md" backHref="/settings/security" backLabel="返回安全设置"><section className="xy-panel space-y-5"><div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 text-accent"/><p className="text-sm leading-6 text-muted-foreground">我们会向已验证邮箱发送重置链接。完成修改后，其他设备可能需要重新登录。</p></div><div className="flex items-center justify-between gap-3 pt-1"><Link href="/settings/security" className="text-sm text-muted-foreground hover:text-foreground">取消</Link><Button asChild><Link href="/forgot-password"><KeyRound className="mr-2 h-4 w-4"/>发送重置邮件</Link></Button></div></section></CompactPageShell>}
