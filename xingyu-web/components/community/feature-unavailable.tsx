"use client";

import Link from "next/link";
import { Ban, CircleAlert, CloudOff, Clock3, Gauge, LayoutList, Search, Wrench } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Button } from "@/components/ui/button";
import type { ScreenSpec } from "@/lib/screen-registry";

/** 页面接口尚未接通时，仍提供与产品一致的可浏览布局。 */
export function FeatureUnavailable({ screen }: { screen: ScreenSpec }) {
  const route = screen.route;
  const workspace = route.includes("/studio") || route.includes("/admin");
  const utility = route.includes("/settings") || route.includes("/messages");
  const eyebrow = workspace ? "工作台" : utility ? "个人空间" : "星语社区";
  const description = workspace ? "整理内容、查看进度，并继续完成你的下一步。" : utility ? "这里会集中呈现与你相关的设置与信息。" : "发现值得阅读的内容，和有趣的人慢慢建立连接。";
  return (
    <AppShell>
      <main className="xy-page pb-12">
        <PageHero
          eyebrow={eyebrow}
          title={screen.name}
          description={description}
        />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-2xl border border-[#e8e5df] bg-white/85 p-5 shadow-[0_14px_40px_rgba(35,42,71,.06)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae4] pb-5">
              <div><h2 className="text-lg font-bold text-[#17264f]">{workspace ? "今日概览" : "内容列表"}</h2><p className="mt-1 text-sm text-[#7c8497]">正在为你准备相关内容</p></div>
              <Button variant="outline" className="rounded-lg border-[#dfe3ed] bg-white"><Search className="mr-2 h-4 w-4" />搜索</Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-24 rounded-xl border border-[#eeeae4] bg-[#fbfaf8] p-4"><div className="h-3 w-2/5 rounded bg-[#e9e7e2]" /><div className="mt-3 h-2 w-4/5 rounded bg-[#efede9]" /><div className="mt-2 h-2 w-3/5 rounded bg-[#efede9]" /></div>)}
            </div>
          </section>
          <aside className="rounded-2xl border border-[#e8e5df] bg-[#fffdfa] p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#17264f]"><LayoutList className="h-4 w-4 text-[#e88b43]" />快速入口</div>
            <div className="mt-4 space-y-3 text-sm text-[#66708a]"><p>返回首页继续探索</p><p>查看最近访问记录</p><p>完善你的个人偏好</p></div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

export function SystemStatusPage({
  title,
  description,
  kind = "maintenance",
}: {
  title: string;
  description: string;
  kind?: "maintenance" | "forbidden" | "not-found" | "offline" | "rate-limited" | "error";
}) {
  const statusMeta = {
    maintenance: { label: "系统维护", hint: "我们正在进行必要的服务维护", icon: Wrench, tone: "amber" },
    forbidden: { label: "访问受限", hint: "当前账号没有访问此内容的权限", icon: Ban, tone: "rose" },
    "not-found": { label: "内容不存在", hint: "这个页面可能已被移动或删除", icon: CircleAlert, tone: "violet" },
    offline: { label: "网络离线", hint: "暂时无法连接到星语社区", icon: CloudOff, tone: "slate" },
    "rate-limited": { label: "操作太频繁", hint: "请稍等片刻，再继续刚才的操作", icon: Gauge, tone: "blue" },
    error: { label: "服务异常", hint: "服务暂时遇到问题，我们正在处理", icon: CircleAlert, tone: "red" },
  }[kind];
  const Icon = statusMeta.icon;
  return (
    <AppShell>
      <main className="xy-page grid flex-1 place-items-center py-8">
        <section className="xy-system-status relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/85 bg-white/78 p-7 text-center shadow-[0_22px_70px_rgba(41,53,92,.12)] backdrop-blur-xl sm:p-10">
          <div className={`xy-system-status__halo xy-system-status__halo--${statusMeta.tone}`} />
          <div className={`xy-system-status__icon xy-system-status__icon--${statusMeta.tone}`}>
            <Icon className="h-8 w-8" />
          </div>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#e8eaf1] bg-white/70 px-3 py-1 text-xs font-semibold tracking-[.08em] text-[#69738b]">
            <Clock3 className="h-3.5 w-3.5" />{statusMeta.label}
          </span>
          <h1 className="mt-4 text-[28px] font-bold tracking-tight text-[#162958] sm:text-[34px]">{title}</h1>
          <p className="mt-3 text-sm font-medium text-[#65718a]">{statusMeta.hint}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#8991a3]">{description}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full bg-[#162958] px-6 text-white hover:bg-[#243d78]">
              <Link href="/">回到首页</Link>
            </Button>
            {kind === "offline" || kind === "error" || kind === "rate-limited" ? (
              <Button variant="outline" className="rounded-full border-[#dfe3ed] bg-white/70 px-6" onClick={() => window.location.reload()}>
                重新尝试
              </Button>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
