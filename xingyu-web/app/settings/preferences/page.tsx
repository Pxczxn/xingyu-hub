"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  getUserPreferences,
  hydrateClientSettingsFromServer,
  saveUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";

export default function PreferencesSettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void hydrateClientSettingsFromServer().then(() => setPrefs(getUserPreferences()));
  }, []);

  function toggle(key: keyof UserPreferences) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setSaved(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prefs) return;
    saveUserPreferences(prefs);
    setSaved(true);
  }

  return (
    <SettingsLayout
      aside={
        <>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#fbf1e4] text-2xl text-[#e88739]" aria-hidden="true">
            ✦
          </div>
          <p className="mt-5 text-sm font-medium text-[#e58436]">舒适阅读</p>
          <h2 className="mt-2 text-xl font-bold text-[#1b2e58]">让社区更贴合你的节奏</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            偏好会同步到当前账号，并在下次打开社区时自动生效。
          </p>
          <Link href="/settings/appearance" className="mt-5 inline-flex text-sm text-[#e38334] hover:underline">
            外观主题设置 →
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <header className="border-b border-[#eee7df] pb-7">
          <p className="text-sm font-medium text-[#e58436]">偏好</p>
          <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">通用偏好</h1>
          <p className="mt-1 text-sm text-slate-500">仅展示已登记的服务端偏好项</p>
        </header>
        {!prefs ? (
          <p className="mt-7 text-sm text-muted-foreground">加载中…</p>
        ) : (
          <>
            <div className="mt-7 space-y-3">
              <div className="rounded-2xl border border-[#eee6de] bg-white/70 p-5">
                <CardTitle>界面偏好</CardTitle>
                <CardDescription className="mt-1">与账号同步保存，并在本设备缓存以加快加载</CardDescription>
                <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[#eee6de] px-4 py-3">
                  <span>
                    <strong className="block text-sm text-[#1a2d58]">紧凑模式</strong>
                    <small className="text-slate-500">减少列表间距，适合快速浏览更多内容</small>
                  </span>
                  <input
                    aria-label="紧凑模式"
                    type="checkbox"
                    checked={prefs.compactMode}
                    onChange={() => toggle("compactMode")}
                  />
                </label>
                <label className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-[#eee6de] px-4 py-3">
                  <span>
                    <strong className="block text-sm text-[#1a2d58]">减少动效</strong>
                    <small className="text-slate-500">降低页面过渡与装饰动画，减少视觉干扰</small>
                  </span>
                  <input
                    aria-label="减少动效"
                    type="checkbox"
                    checked={prefs.reduceMotion}
                    onChange={() => toggle("reduceMotion")}
                  />
                </label>
              </div>
            </div>
            {saved && <Alert className="mt-5">偏好已保存</Alert>}
            <div className="mt-6 flex justify-end">
              <Button type="submit" className="h-11 rounded-full bg-[#ed8c38] px-8 text-white hover:bg-[#df7d2d]">
                保存偏好
              </Button>
            </div>
          </>
        )}
      </form>
    </SettingsLayout>
  );
}
