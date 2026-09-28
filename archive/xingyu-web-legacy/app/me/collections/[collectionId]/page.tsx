"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  FileText,
  FolderHeart,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function objectLabel(type?: string) {
  if (type === "SERIES") return "系列";
  if (type === "MOMENT") return "动态";
  return "文章";
}

function visibilityLabel(value?: string) {
  return value === "PUBLIC"
    ? "公开可见"
    : value === "UNLISTED"
      ? "链接可见"
      : "仅自己可见";
}

export default function MyCollectionDetailPage() {
  const params = useParams<{ collectionId: string }>();
  const collectionId = params.collectionId;
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    data: collection,
    loading,
    error,
    reload,
  } = useAsyncData(
    () => communityApi.getCollection(collectionId),
    [collectionId],
  );

  async function handleRemove(itemId: string) {
    if (!window.confirm("确定从收藏夹移除此条目？")) return;
    setRemovingId(itemId);
    setActionError(null);
    try {
      await communityApi.removeCollectionItem(collectionId, itemId);
      reload();
    } catch {
      setActionError("移除失败，请稍后重试");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading)
    return (
      <AppShell>
        <main className="grid min-h-[70vh] place-items-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" />
        </main>
      </AppShell>
    );
  if (error || !collection)
    return (
      <AppShell>
        <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center">
          <div>
            <h1 className="text-2xl font-semibold text-[#23345a]">
              收藏夹暂时无法打开
            </h1>
            <p className="mt-3 text-muted-foreground">
              {error || "收藏夹不存在或无权访问"}
            </p>
            <Button asChild variant="outline" className="mt-6 rounded-xl">
              <Link href="/me/collections">返回收藏夹</Link>
            </Button>
          </div>
        </main>
      </AppShell>
    );

  const items = collection.items ?? [];
  const articleCount = items.filter(
    (item) => item.objectType !== "SERIES" && item.objectType !== "MOMENT",
  ).length;
  const seriesCount = items.filter(
    (item) => item.objectType === "SERIES",
  ).length;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1500px] px-5 pb-16 pt-9 sm:px-8 lg:px-10">
        <Link
          href="/me/collections"
          className="inline-flex items-center gap-2 text-sm text-[#5d697d] hover:text-[#24365d]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回收藏夹列表
        </Link>
        <header className="relative mt-7 overflow-hidden rounded-[1.5rem] border border-white/75 bg-[rgb(255_253_249/.68)] px-6 py-7 shadow-[0_14px_36px_rgb(42_35_27/.045)] backdrop-blur-xl sm:flex sm:items-center sm:gap-7 sm:px-8">
          <span className="pointer-events-none absolute right-[-5rem] top-[-9rem] h-80 w-80 rounded-full border border-white/70 opacity-75" />
          <img
            src="/prototype-assets/collection-detail/image-collection-detail-cover-01.png"
            alt="收藏夹封面"
            className="relative h-[8.7rem] w-[8.7rem] shrink-0 rounded-xl object-cover shadow-[0_14px_26px_rgb(20_35_65/.18)]"
          />
          <div className="relative mt-5 min-w-0 sm:mt-0 sm:flex-1">
            <h1 className="truncate text-[2rem] font-semibold tracking-[-0.04em] text-[#172a50]">
              {collection.title || "收藏夹"}
            </h1>
            <p className="mt-2 max-w-2xl text-[0.98rem] leading-7 text-[#657287]">
              {collection.description || "在这里整理值得反复阅读的内容。"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#727e91]">
              <span className="inline-flex items-center gap-1.5">
                <FolderHeart className="h-4 w-4 text-[#d28c35]" />
                {items.length} 项内容
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="h-4 w-4 text-[#d28c35]" />
                {visibilityLabel(collection.visibility)}
              </span>
            </div>
          </div>
          <div className="relative mt-5 flex gap-2 sm:mt-0 sm:self-start">
            <Button asChild variant="outline" size="sm" className="h-10 rounded-xl bg-white/75">
              <Link href={`/me/collections/${collectionId}/edit`}>
                <Pencil className="mr-1.5 h-4 w-4" />
                编辑
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl bg-white/75"
              onClick={() =>
                navigator.clipboard?.writeText(window.location.href)
              }
            >
              <Share2 className="mr-1.5 h-4 w-4" />
              复制链接
            </Button>
          </div>
        </header>
        <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18.5rem]">
          <section className="overflow-hidden rounded-[1.3rem] border border-[#ebe4da] bg-[rgb(255_253_249/.78)] shadow-[0_14px_36px_rgb(42_35_27/.045)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-[#e9e2d8] px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-semibold text-[#25375b]">收藏内容</h2>
                <p className="mt-1 text-xs text-[#8490a1]">
                  内容可直接打开或从收藏夹移除
                </p>
              </div>
              <span className="rounded-full bg-[#fbefe0] px-3 py-1 text-xs font-medium text-[#c47b24]">
                {items.length} 项
              </span>
            </div>
            {actionError && (
              <Alert variant="destructive" className="m-5">
                {actionError}
              </Alert>
            )}
            {items.length ? (
              <ul role="list" className="divide-y divide-[#ebe5dc]">
                {items.map((item, index) => (
                  <li
                    key={item.id}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/65 sm:px-6"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#172a4c,#7e95b0)] text-lg font-semibold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={contentHref({
                          id: item.objectId || item.id,
                          objectType: item.objectType,
                        })}
                        className="block truncate text-[1.02rem] font-semibold text-[#26375b] hover:text-[rgb(var(--violet))]"
                      >
                        {item.title || "未命名内容"}
                      </Link>
                      <span className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-[#fff0de] px-2 py-0.5 text-[0.7rem] font-medium text-[#c37a24]">
                          {objectLabel(item.objectType)}
                        </span>
                        <span className="text-xs text-[#8a94a4]">
                          {item.objectId ? "已收藏" : "来源暂不可用"}
                        </span>
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={contentHref({
                          id: item.objectId || item.id,
                          objectType: item.objectType,
                        })}
                        className="hidden rounded-lg p-2 text-[#708097] hover:bg-[#f5f0e9] sm:inline-flex"
                        aria-label="查看内容"
                      >
                        <BookOpenText className="h-4 w-4" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={removingId === item.id}
                        onClick={() => void handleRemove(item.id)}
                        aria-label="从收藏夹移除"
                        className="h-9 w-9 text-[#8790a0] hover:bg-[#fff0ed] hover:text-[#d8513d]"
                      >
                        {removingId === item.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid min-h-[25rem] place-items-center px-6 text-center">
                <div>
                  <FolderHeart className="mx-auto h-10 w-10 text-[#d49b52]" />
                  <h2 className="mt-4 text-xl font-semibold text-[#26375b]">
                    收藏夹还是空的
                  </h2>
                  <p className="mt-2 text-sm text-[#7b8495]">
                    在文章、系列或动态中使用收藏功能，内容会出现在这里。
                  </p>
                  <Button asChild className="mt-5 rounded-xl">
                    <Link href="/discover">去发现内容</Link>
                  </Button>
                </div>
              </div>
            )}
          </section>
          <aside className="space-y-5">
            <section className="rounded-[1.3rem] border border-[#ebe4da] bg-[rgb(255_253_249/.78)] px-5 py-5 shadow-[0_14px_36px_rgb(42_35_27/.045)] backdrop-blur-xl">
              <h2 className="font-semibold text-[#26375b]">整理统计</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-[#718096]">
                    <FolderHeart className="h-4 w-4" />
                    全部内容
                  </dt>
                  <dd className="font-semibold text-[#25375b]">
                    {items.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-[#718096]">
                    <FileText className="h-4 w-4" />
                    文章与动态
                  </dt>
                  <dd className="font-semibold text-[#25375b]">
                    {articleCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-[#718096]">
                    <BookOpenText className="h-4 w-4" />
                    系列
                  </dt>
                  <dd className="font-semibold text-[#25375b]">
                    {seriesCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-[#718096]">
                    <CalendarDays className="h-4 w-4" />
                    最近更新
                  </dt>
                  <dd className="font-semibold text-[#25375b]">—</dd>
                </div>
              </dl>
            </section>
            <section className="rounded-[1.3rem] border border-[#ebe4da] bg-[rgb(255_253_249/.78)] px-5 py-5 shadow-[0_14px_36px_rgb(42_35_27/.045)] backdrop-blur-xl">
              <h2 className="font-semibold text-[#26375b]">收藏夹设置</h2>
              <div className="mt-4 space-y-1">
                <p className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-[#69768b]">
                  <span className="flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4" />
                    可见性设置
                  </span>
                  <b className="font-medium text-[#34415e]">
                    {visibilityLabel(collection.visibility)}
                  </b>
                </p>
                <p className="rounded-lg px-3 py-3 text-sm text-[#8a94a4]">
                  分组、封面与导出功能将在对应接口开放后显示。
                </p>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
