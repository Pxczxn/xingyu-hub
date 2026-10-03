import { Link } from "react-router-dom";
import { BarChart3, FolderTree, PenLine, Send, UserPlus, Library, Layers } from "lucide-react";
import { useAuth } from "@/features/auth/auth.store";

/**
 * Creation studio — entry hub.
 * Access is protected by the RequireAuth guard in the router, so this page is
 * only rendered for authenticated users.
 *
 * Phase 3G removed the last placeholder here. The article editor was shipped in
 * Phase 1C, but nothing linked to it — this hub pointed at a dead "已发布占位"
 * string because `/studio/content` (the list route) did not exist. That route
 * now exists, so the hub offers real entries: 新建文章 / 我的内容 / 我的系列.
 *
 * 2026-10-03 structure pass — ORDERED BY FREQUENCY, not by equal weight.
 *
 * The hub used to be a welcome card with three text links followed by six
 * identical cards, each a small link above a grey sentence. Two problems:
 *
 *   1. Everything had the same weight, so nothing was an answer. A studio hub is
 *      opened to DO something — the most common thing is "write something" and
 *      the second is "go back to what I was writing". Both were buried among
 *      cards about analytics and invite links.
 *   2. The whole card was not a target. Only the small underlined words were, so
 *      the reader had to aim at the title rather than at the card.
 *
 * Now: one primary action (写新文章) with real weight, then the destinations as
 * full-card links, ordered by how often a creator actually needs them. The
 * per-card notes from earlier phases are preserved as comments in the list below
 * — they record why each entry exists, which is worth keeping.
 */

type StudioEntry = {
  to: string;
  title: string;
  body: string;
  icon: typeof PenLine;
};

const ENTRIES: StudioEntry[] = [
  {
    to: "/studio/content",
    title: "我的内容",
    body: "按状态查看全部文章，也可以移入回收站或恢复。",
    icon: Library,
  },
  {
    to: "/studio/series",
    title: "我的系列",
    body: "把文章组织成一条可以顺着读下去的线索。",
    icon: Layers,
  },
  {
    to: "/studio/analytics",
    title: "数据分析",
    body: "查看已发布文章、喜欢、评论与粉丝等汇总数据。",
    icon: BarChart3,
  },
  {
    to: "/studio/submissions",
    title: "我的投稿",
    body: "查看提交审核的稿件及进展。",
    icon: Send,
  },
  {
    // Phase 2N. This page did not exist in Legacy at all — the backend CRUD was
    // never surfaced.
    to: "/studio/categories",
    title: "创作空间分类",
    body: "给作品分组，方便在主页按分类浏览。",
    icon: FolderTree,
  },
  {
    // Phase 2M. The copy deliberately does NOT promise a collaborator list — the
    // backend has no such concept, so this entry only creates and confirms
    // invite links.
    to: "/studio/collaboration",
    title: "邀请协作",
    body: "生成邀请链接，发给想一起创作的人。",
    icon: UserPlus,
  },
];

export function StudioPage() {
  const { user } = useAuth();

  return (
    <div className="section-gap">
      {/* The primary action, given the weight to match how often it is the reason
          this page was opened. */}
      <div className="flex flex-col gap-4 rounded-xl border border-accent-line/50 bg-accent-soft/40 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">STUDIO</p>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-primary">创作中心</h1>
          <p className="mt-2 max-w-prose text-meta leading-6 text-foreground-soft">
            {user?.username ? `${user.username}，欢迎回来。` : "欢迎回来。"}
            在这里管理你的文章、系列与投稿。
          </p>
        </div>

        <Link
          to="/studio/content/new"
          className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-meta font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          <PenLine className="h-4 w-4" aria-hidden />
          写新文章
        </Link>
      </div>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <li key={entry.to} className="min-w-0">
              <Link
                to={entry.to}
                className="focus-ring flex h-full flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-accent-line"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong"
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-card font-semibold text-primary">{entry.title}</span>
                </span>
                <span className="text-meta leading-6 text-muted-foreground">{entry.body}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        to="/"
        className="focus-ring w-fit rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
      >
        返回首页
      </Link>
    </div>
  );
}
