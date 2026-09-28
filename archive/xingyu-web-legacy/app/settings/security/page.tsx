"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  KeyRound,
  Laptop,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type SessionView } from "@/lib/community-api";

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "暂无记录"
    : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SecuritySettingsPage() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi
      .listSessions()
      .then(setSessions)
      .catch(() => setError("暂时无法读取登录设备，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  const active = sessions.filter((session) => !session.revoked);
  const current = active.find((session) => session.current);
  const other = active.filter((session) => !session.current);

  return (
    <SettingsLayout>
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[#eee6de] pb-6">
        <div>
          <p className="text-sm font-semibold text-[#e98538]">账号安全</p>
          <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#162b57]">安全总览</h1>
          <p className="mt-2 text-[15px] text-slate-500">管理登录方式、设备与近期账号活动</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e9f5ed] px-4 py-2 text-sm font-medium text-[#387a55]">
          <ShieldCheck className="h-4 w-4" />
          安全状态良好
        </span>
      </header>
      {error && <Alert variant="destructive" className="mt-5">{error}</Alert>}
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <InfoCard icon={KeyRound} title="密码" text="定期更新密码，可以进一步保护你的账号。" action="修改密码" href="/settings/security/password" />
        <InfoCard icon={Mail} title="邮箱验证" text="已绑定邮箱可用于登录验证和安全提醒。" action="管理邮箱" href="/settings/security/email" />
      </div>
      <section className="mt-8 border-t border-[#eee6de] pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold text-[#1b2e58]">登录设备</h2>
            <p className="mt-1 text-sm text-slate-500">当前有 {loading ? "…" : active.length} 台设备保持登录</p>
          </div>
          <Link href="/settings/security/sessions" className="inline-flex items-center gap-1 text-sm font-medium text-[#db7c31] hover:underline">
            管理全部设备
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {loading ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[#e8dfd5] p-5 text-sm text-slate-400">
              正在读取设备信息…
            </div>
          ) : (
            active.slice(0, 2).map((session) => <DeviceCard key={session.sessionId} session={session} />)
          )}
          {!loading && active.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[#e8dfd5] p-5 text-sm text-slate-400">
              暂未检测到活跃设备
            </div>
          )}
        </div>
      </section>
      <section className="mt-8 border-t border-[#eee6de] pt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold text-[#1b2e58]">近期登录活动</h2>
          <Link href="/settings/security/events" className="text-sm text-[#db7c31] hover:underline">查看安全事件</Link>
        </div>
        <div className="mt-4 space-y-0 rounded-2xl border border-[#eee6de] bg-white/70 px-5">
          {(other.length ? other : current ? [current] : []).slice(0, 3).map((session, index) => (
            <div key={session.sessionId} className={`flex gap-4 py-4 ${index ? "border-t border-[#f0e9e2]" : ""}`}>
              <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff1df] text-[#e88736]">
                <Clock3 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[#24365f]">{session.current ? "当前设备登录" : "设备登录活动"}</p>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {session.deviceLabel} · {formatTime(session.lastActiveAt)}
                </p>
              </div>
            </div>
          ))}
          {!loading && !current && !other.length && (
            <p className="py-5 text-sm text-slate-400">暂无可展示的登录活动</p>
          )}
        </div>
      </section>
      <section className="mt-8 grid gap-4 rounded-2xl border border-[#f1dcc8] bg-[#fff9f1]/85 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#ffe7cc] text-[#e88635]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-[#263960]">开启更强的登录验证</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">敏感操作会要求验证身份，建议保持验证邮箱可用。</p>
        </div>
        <Button asChild className="h-10 rounded-xl bg-[#eb8b3a] px-5 text-white hover:bg-[#dc7e30]">
          <Link href="/settings/security/re-authenticate">验证身份</Link>
        </Button>
      </section>
      <footer className="mt-7 flex items-center gap-2 text-xs text-slate-400">
        <CheckCircle2 className="h-4 w-4 text-[#4a9a68]" />
        你的账号安全状态会在这里持续更新
      </footer>
    </SettingsLayout>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
  action,
  href,
}: {
  icon: typeof KeyRound;
  title: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eee6de] bg-white/70 p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef2ff] text-[#35558d]">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-[#1d315d]">{title}</h2>
      <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{text}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#dc7c31]">
        {action}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function DeviceCard({ session }: { session: SessionView }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-2xl border border-[#eee6de] bg-[#fdfbf8] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf0fb] text-[#385b93]">
        {session.current ? <Laptop className="h-5 w-5" /> : <MonitorSmartphone className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-[#25385f]">{session.deviceLabel}</p>
        <p className="mt-1 text-xs text-slate-500">
          {session.current ? "当前设备" : `最近活跃 ${formatTime(session.lastActiveAt)}`}
        </p>
      </div>
    </div>
  );
}
