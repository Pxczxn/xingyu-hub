"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

export default function StudioSettingsPage() {
  return (
    <AppShell>
      <main className="xy-page mx-auto max-w-3xl py-8">
        <h1 className="text-2xl font-semibold">创作设置</h1>
        <p className="mt-2 text-sm text-muted-foreground">管理创作空间分类、素材与展示偏好。</p>
        <section className="mt-8 space-y-4">
          <SettingRow title="创作空间分类" description="管理公开作品分类" href="/studio/settings" />
          <SettingRow title="素材库" description="上传与管理创作素材" href="/studio/assets" />
          <SettingRow title="精选展示" description="配置个人主页精选内容" href="/studio/content" />
        </section>
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href="/studio/content">返回内容管理</Link>
          </Button>
        </div>
      </main>
    </AppShell>
  );
}

function SettingRow({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-[#e8e2da] bg-white/80 px-5 py-4 hover:border-[#cfd7e8]">
      <span>
        <b className="block text-[#1d315a]">{title}</b>
        <small className="text-sm text-[#7b8698]">{description}</small>
      </span>
      <span className="text-sm text-accent">管理 →</span>
    </Link>
  );
}
