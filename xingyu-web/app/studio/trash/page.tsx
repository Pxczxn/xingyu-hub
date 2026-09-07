"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  Clock3,
  FileText,
  FolderOpen,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type TrashItem } from "@/lib/community-api";

const typeMeta: Record<string, { title: string; icon: typeof FileText }> = {
  ARTICLE: { title: "文章", icon: FileText },
  MOMENT: { title: "动态", icon: FileText },
  SERIES: { title: "系列", icon: FolderOpen },
};
export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [tab, setTab] = useState("ALL");
  const [newestFirst, setNewestFirst] = useState(true);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await communityApi.listMyTrash());
    } catch {
      setError("无法加载回收站，请确认已登录");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const groups = useMemo(
    () =>
      Object.entries(
        [...items]
          .filter((item) => tab === "ALL" || item.objectType === tab)
          .sort((a, b) => (Date.parse(b.trashedAt) - Date.parse(a.trashedAt)) * (newestFirst ? 1 : -1))
          .reduce<Record<string, TrashItem[]>>((acc, item) => {
            (acc[item.objectType] ??= []).push(item);
            return acc;
          }, {}),
      ),
    [items, newestFirst, tab],
  );
  async function restore(item: TrashItem) {
    setRestoring(item.objectId);
    try {
      if (item.objectType !== "ARTICLE") throw new Error();
      await communityApi.restoreArticle(item.objectId);
      await load();
    } catch {
      setError(
        item.objectType === "ARTICLE"
          ? "恢复失败，请稍后重试"
          : "该内容类型暂不支持在此恢复",
      );
    } finally {
      setRestoring(null);
    }
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-[1300px] px-5 pb-16 pt-8 lg:px-8">
        <header>
          <h1 className="text-[32px] font-bold tracking-tight text-[#122958]">
            回收站
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            保留最近 30 天内删除的内容，过期后将永久删除且无法恢复。
          </p>
        </header>
        <div className="mt-6 flex gap-3 rounded-xl border border-[#f2d6bf] bg-[#fff7ef]/85 p-4 text-sm text-[#85522e]">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#ee8c3d]" />
          <div>
            <b>温馨提示</b>
            <p className="mt-1 text-[#8d6b53]">
              回收站内容仅保留 30
              天，之后将永久删除且无法恢复。请及时恢复重要内容。
            </p>
          </div>
        </div>
        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}
        <section className="mt-6 rounded-2xl border border-[#eee3d4] bg-white/80 p-4 shadow-[0_12px_35px_rgba(98,71,39,.06)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex rounded-xl bg-[#fbf8f4] p-1">
              {[
                ["ALL", "全部"],
                ["ARTICLE", "文章"],
                ["MOMENT", "动态"],
                ["SERIES", "系列"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-6 py-2 text-sm transition ${tab === key ? "bg-[#142957] text-white shadow" : "text-slate-500 hover:text-[#172957]"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <button type="button" onClick={() => setNewestFirst((value) => !value)} className="rounded-lg border border-[#eae1d7] bg-white px-4 py-2 text-sm text-slate-600">
              删除时间：{newestFirst ? "最新优先" : "最早优先"}
            </button>
          </div>
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">
              正在加载回收站…
            </div>
          ) : groups.length ? (
            <div className="mt-5 space-y-5">
              {groups.map(([type, rows]) => {
                const meta = typeMeta[type] ?? { title: type, icon: FileText };
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    <h2 className="mb-3 text-sm font-semibold text-[#1d315d]">
                      {meta.title}（{rows.length}）
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-[#eee8e1]">
                      <div className="grid grid-cols-[1fr_190px_160px_205px] bg-[#fbfaf8] px-5 py-3 text-xs text-slate-400">
                        <span>{type === "ARTICLE" ? "标题" : "内容"}</span>
                        <span>删除时间</span>
                        <span>剩余保留天数</span>
                        <span>操作</span>
                      </div>
                      {rows.map((item) => (
                        <div
                          className="grid min-h-[78px] grid-cols-[1fr_190px_160px_205px] items-center border-t border-[#f1ece6] px-5"
                          key={`${item.objectType}-${item.objectId}`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f5f2ed] text-[#7a899e]">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[#21345f]">
                                {item.title || "未命名内容"}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-400">
                                {item.objectId}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm text-slate-500">
                            {new Date(item.trashedAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="w-fit rounded-full bg-[#fff1e2] px-3 py-1 text-xs text-[#e07f2d]">
                            保留中
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={restoring === item.objectId}
                              onClick={() => void restore(item)}
                              className="border-[#e8dfd5] bg-white"
                            >
                              <RotateCcw className="mr-1 h-4 w-4" />
                              {restoring === item.objectId ? "恢复中…" : "恢复"}
                            </Button>
                            <button
                              disabled
                              title="永久删除接口尚未开放"
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#f7d4cf] px-2 text-xs text-[#df655a] opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                              永久删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 grid min-h-[310px] place-items-center rounded-xl border border-dashed border-[#e8ded2] bg-[#fffdfa]/70 text-center">
              <div>
                <ArchiveRestore className="mx-auto h-10 w-10 text-[#e7a260]" />
                <h2 className="mt-4 text-lg font-semibold text-[#1e315b]">
                  回收站还是空空如也
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  删除的内容会显示在这里，便于你找回误删的内容。
                </p>
                <a
                  href="/studio"
                  className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#142957] px-5 text-sm text-white"
                >
                  去创作
                </a>
              </div>
            </div>
          )}
        </section>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Clock3 className="h-4 w-4" />
          恢复后内容将回到原有状态与位置。
        </p>
      </main>
    </AppShell>
  );
}
