"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  ImageIcon,
  ListTree,
  Save,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { communityApi, type SeriesDetail } from "@/lib/community-api";

const previewTags: string[] = [];

export default function EditSeriesPage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params.seriesId;
  const lockVersion = useRef(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chapterCount, setChapterCount] = useState(0);

  useEffect(() => {
    communityApi
      .getMySeries(seriesId)
      .then((series: SeriesDetail) => {
        setTitle(series.title);
        setDescription(series.description ?? "");
        setStatus(series.status);
        setChapterCount(series.chapters.length);
        lockVersion.current = series.lockVersion ?? 0;
      })
      .catch((err) => {
        setError(
          err instanceof ApiError && err.problem.status === 404
            ? "系列不存在或无权编辑"
            : "加载失败，请稍后重试",
        );
      })
      .finally(() => setLoading(false));
  }, [seriesId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await communityApi.updateSeries(seriesId, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        lockVersion: lockVersion.current,
      });
      lockVersion.current = updated.lockVersion ?? lockVersion.current + 1;
      setSuccess("系列已更新");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem.detail || "保存失败"
          : "保存失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const previewTitle = title || "系列标题暂未提供";
  const previewDescription =
    description ||
    "系列简介暂未提供。";

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-5 pb-28 pt-7 text-[#132957] lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/studio/series"
            className="rounded-full border border-[#eadfce] bg-white/80 p-2.5 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight">编辑系列</h1>
          <span className="hidden text-sm text-slate-400 md:block">
            在知识的轨道上，沉淀你的思考与经验
          </span>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-[#eee3d5] bg-white/80 p-10 text-center text-slate-500">
            正在载入系列信息…
          </div>
        ) : error && !title ? (
          <div>
            <Alert variant="destructive">{error}</Alert>
            <Link
              href="/studio/series"
              className="mt-4 inline-flex text-sm text-[#e8883a]"
            >
              返回系列管理
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="grid gap-4 lg:grid-cols-[.8fr_1.25fr]"
          >
            <section className="rounded-2xl border border-[#eee2d3] bg-white/80 p-5 shadow-[0_12px_35px_rgba(119,83,36,.06)] backdrop-blur-sm lg:p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <BookOpen className="h-5 w-5 text-[#e98a3e]" />
                系列信息
              </h2>
              <label className="mt-5 block text-sm font-semibold">
                系列名称 <i className="not-italic text-[#ec7b32]">*</i>
                <div className="relative mt-2">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={50}
                    className="h-11 w-full rounded-lg border border-[#eadfd2] bg-[#fffdfa] px-3 pr-16 text-sm outline-none focus:border-[#e98a3e]"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400">
                    {title.length}/50
                  </span>
                </div>
              </label>
              <label className="mt-4 block text-sm font-semibold">
                系列简介 <i className="not-italic text-[#ec7b32]">*</i>
                <div className="relative mt-2">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    className="h-28 w-full resize-none rounded-lg border border-[#eadfd2] bg-[#fffdfa] p-3 text-sm leading-6 outline-none focus:border-[#e98a3e]"
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                    {description.length}/500
                  </span>
                </div>
              </label>
              <div className="mt-4">
                <p className="text-sm font-semibold">封面图</p>
                <div className="mt-2 flex gap-3">
                  <img
                    src="/prototype-assets/series-detail/series-cover.png"
                    alt="系列封面预览"
                    className="h-[118px] w-[210px] rounded-lg object-cover"
                  />
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled
                      title="封面上传接口暂未提供"
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-[#eadfd2] bg-white px-3 text-sm"
                    >
                      <ImageIcon className="h-4 w-4" />
                      更换封面
                    </button>
                    <p className="mt-2 max-w-[135px] text-xs leading-5 text-slate-400">
                      建议尺寸 1600×900，JPG/PNG，不超过 5MB
                    </p>
                  </div>
                </div>
              </div>
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold">可见范围</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ["PUBLIC", "公开可见", "所有人可见"],
                    ["COMMUNITY", "社区可见", "仅星语社区成员可见"],
                    ["PRIVATE", "仅自己可见", "仅自己可见"],
                  ].map(([key, label, hint]) => (
                    <label
                      key={key}
                      className={`cursor-pointer rounded-lg border p-3 text-xs ${visibility === key ? "border-[#ed913f] bg-[#fffaf4] text-[#e98538]" : "border-[#eee5da] text-slate-400"}`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        checked={visibility === key}
                        onChange={() => setVisibility(key)}
                      />
                      <span className="block font-semibold">{label}</span>
                      <span className="mt-1 block leading-4">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-5">
                <p className="text-sm font-semibold">标签</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {previewTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#f7f3ee] px-3 py-1.5 text-xs text-slate-500"
                    >
                      {tag} ×
                    </span>
                  ))}
                  <button
                    type="button"
                    disabled
                    title="系列标签接口暂未提供"
                    className="rounded-md border border-[#eadfd2] px-2.5 text-xs text-slate-500"
                  >
                    ＋ 添加标签
                  </button>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-[#fcf8f2] p-3 text-xs leading-5 text-slate-500">
                <Sparkles className="mr-1 inline h-4 w-4 text-[#efa34f]" />
                好的系列是知识的星球，清晰的结构与真诚的分享会吸引同频的伙伴。
              </div>
            </section>
            <section className="space-y-3">
              <div className="rounded-2xl border border-[#eee2d3] bg-white/80 p-5 shadow-[0_12px_35px_rgba(119,83,36,.06)] backdrop-blur-sm lg:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  <h2 className="text-lg font-bold">系列主页预览</h2>
                  <span className="rounded-full bg-[#fff2e4] px-2 py-0.5 text-xs text-[#e88a39]">
                    实时预览
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-[#eee3d5] bg-white">
                  <div className="relative h-44 bg-[#111f47]">
                    <img
                      src="/prototype-assets/series-detail/series-cover.png"
                      alt=""
                      className="h-full w-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#101d44]/85 to-transparent p-7 text-white">
                      <h3 className="text-2xl font-bold">{previewTitle}</h3>
                      <p className="mt-2 text-sm text-white/80">
                        {previewDescription || "系列简介暂未提供"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#e9eefb] text-xs font-bold">
                      星
                    </div>
                    <div className="mr-auto">
                      <b className="text-sm">作者信息暂未提供</b>
                      <p className="text-xs text-slate-400">作者资料暂未提供</p>
                    </div>
                    <div className="grid grid-cols-3 gap-5 text-center text-sm">
                      <span>
                        <b>{chapterCount ?? "—"}</b>
                        <small className="block text-xs text-slate-400">
                          文章
                        </small>
                      </span>
                      <span>
                        <b>—</b>
                        <small className="block text-xs text-slate-400">
                          阅读
                        </small>
                      </span>
                      <span>
                        <b>—</b>
                        <small className="block text-xs text-slate-400">
                          收藏
                        </small>
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-[#eee5dc] p-5">
                    <h4 className="font-semibold">系列简介</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {previewDescription}
                    </p>
                    <h4 className="mt-4 font-semibold">系列标签</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {previewTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#f8f5f1] px-3 py-1 text-xs text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[#eee2d3] bg-white/80 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    章节总览（{chapterCount === undefined ? "暂未提供" : chapterCount}）
                  </h3>
                  <Link
                    href={`/studio/series/${seriesId}/chapters`}
                    className="text-sm text-[#e88635]"
                  >
                    查看全部章节 →
                  </Link>
                </div>
                <p className="mt-6 py-8 text-center text-sm text-slate-400">
                  章节数据暂未提供，请前往章节管理查看
                </p>
                {/* 章节列表由接口数据驱动 */}
                {([] as string[]).map((item, index) => (
                  <div
                    className="mt-3 flex items-center border-b border-[#f2ebe3] pb-3 text-sm"
                    key={item}
                  >
                    <span className="mr-4 text-[#e98538]">0{index + 1}</span>
                    <div>
                      <b>{item}</b>
                      <p className="mt-1 text-xs text-slate-400">
                        章节摘要暂未提供
                      </p>
                    </div>
                    <span className="ml-auto text-xs text-slate-400">
                      状态暂未提供
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <footer className="fixed bottom-5 left-1/2 z-30 flex w-[min(1280px,calc(100%-40px))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-[0_8px_30px_rgba(50,37,18,.14)] backdrop-blur-xl">
              <Link
                href={`/studio/series/${seriesId}/chapters`}
                className="mr-auto inline-flex h-11 items-center gap-2 rounded-xl border border-[#eadfd2] px-5 text-sm font-medium"
              >
                <ListTree className="h-5 w-5" />
                章节总览
              </Link>
              <span className="hidden text-xs text-slate-400 md:inline">
                最近保存：时间暂未提供
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-11 border-[#eadfd2] bg-white px-7"
                onClick={() =>
                  void onSubmit({ preventDefault() {} } as FormEvent)
                }
              >
                保存草稿
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 bg-[#ee8c3d] px-7 text-white hover:bg-[#df7c30]"
              >
                <Save className="mr-1 h-4 w-4" />
                {submitting ? "保存中…" : "更新系列"}
              </Button>
            </footer>
            {error && (
              <div className="lg:col-span-2">
                <Alert variant="destructive">{error}</Alert>
              </div>
            )}
            {success && (
              <div className="lg:col-span-2">
                <Alert>{success}</Alert>
              </div>
            )}
          </form>
        )}
      </main>
    </AppShell>
  );
}
