"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getAppearanceTheme,
  hydrateClientSettingsFromServer,
  saveAppearanceTheme,
  type AppearanceTheme,
} from "@/lib/user-preferences";

const themes: Array<{ id: AppearanceTheme; label: string; icon: typeof Sun; description: string }> = [
  { id: "LIGHT", label: "浅色", icon: Sun, description: "明亮清爽的日间阅读体验" },
  { id: "DARK", label: "深色", icon: Moon, description: "降低夜间浏览的视觉疲劳" },
  { id: "STARRY", label: "星夜", icon: Sparkles, description: "星语品牌主题，深蓝星空氛围" },
];

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<AppearanceTheme | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void hydrateClientSettingsFromServer().then(() => setTheme(getAppearanceTheme()));
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!theme) return;
    saveAppearanceTheme(theme);
    setSaved(true);
  }

  return (
    <SettingsLayout>
      <form onSubmit={onSubmit}>
        <header className="border-b border-[#eee7df] pb-7">
          <p className="text-sm font-medium text-[#e58436]">外观</p>
          <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">外观主题</h1>
          <p className="mt-1 text-sm text-slate-500">选择 LIGHT / DARK / STARRY 界面主题</p>
        </header>
        {!theme ? (
          <p className="mt-7 text-sm text-slate-500">正在加载主题偏好…</p>
        ) : (
          <>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {themes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTheme(item.id);
                    setSaved(false);
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${
                    theme === item.id
                      ? "border-[#ee913f] bg-[#fff8ef] shadow-[0_8px_20px_rgba(237,140,56,.12)]"
                      : "border-[#eee6de] bg-white/70 hover:border-[#e8dfd5]"
                  }`}
                >
                  <item.icon className="h-6 w-6 text-[#e88739]" />
                  <h2 className="mt-4 font-semibold text-[#1a2d58]">{item.label}</h2>
                  <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                </button>
              ))}
            </div>
            {saved && <Alert className="mt-5">外观主题已保存</Alert>}
            <footer className="mt-6 flex justify-end">
              <Button type="submit" className="h-11 rounded-full bg-[#ed8c38] px-8 text-white hover:bg-[#df7d2d]">
                保存主题
              </Button>
            </footer>
          </>
        )}
      </form>
      <p className="mt-4 text-xs text-slate-400">
        通用界面偏好另见
        <Link href="/settings/preferences" className="mx-1 text-[#e38334] hover:underline">通用偏好</Link>
      </p>
    </SettingsLayout>
  );
}
