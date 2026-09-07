import Link from "next/link";
import { AlertCircle, ArrowRight, FileQuestion, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: { label: string; href: string } }) {
  return <div className="xy-panel grid min-h-64 place-items-center p-8 text-center"><div><Inbox className="mx-auto h-8 w-8 text-[rgb(var(--violet))]" /><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{action ? <Button asChild className="mt-5"><Link href={action.href}>{action.label}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : null}</div></div>;
}

export function ErrorState({ title = "暂时无法加载", description = "请检查网络后重试。" }: { title?: string; description?: string }) {
  return <div className="xy-panel grid min-h-52 place-items-center p-8 text-center"><div><AlertCircle className="mx-auto h-8 w-8 text-[rgb(var(--accent))]" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p><Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>重新加载</Button></div></div>;
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-busy="true" aria-label="内容加载中">{Array.from({ length: rows }, (_, index) => <div className="animate-pulse rounded-xl border border-border p-5" key={index}><div className="h-3 w-24 rounded bg-muted" /><div className="mt-4 h-5 w-3/4 rounded bg-muted" /><div className="mt-3 h-3 w-full rounded bg-muted" /></div>)}</div>;
}

export function MissingScreen({ pathname }: { pathname: string }) {
  return <div className="xy-page"><div className="xy-panel grid min-h-[55vh] place-items-center p-8 text-center"><div><FileQuestion className="mx-auto h-10 w-10 text-[rgb(var(--violet))]" /><h1 className="mt-5 text-2xl font-semibold">这个坐标暂未开放</h1><p className="mt-3 text-sm text-muted-foreground">{pathname}</p><Button asChild className="mt-6"><Link href="/">返回首页</Link></Button></div></div></div>;
}

export function PendingState({ title }: { title: string }) {
  return <div className="xy-panel flex items-center gap-3 p-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />正在准备{title}…</div>;
}
