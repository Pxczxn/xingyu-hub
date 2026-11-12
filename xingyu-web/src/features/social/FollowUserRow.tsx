import { Link } from "react-router-dom";
import type { FollowUser } from "@/api/social/social.types";
import { FeedRow } from "@/components/layout";

/*
 * One row of a follow-graph list (Phase 2I-1).
 *
 * Shared by /me/following and /me/followers so the two pages cannot drift. The
 * row is presentational only — the follow/unfollow control is passed in by the
 * page, because only the followers page needs it (see below).
 *
 * 行制（2026-11-10 · 批次 B）：卡面 → 发丝线行
 * ------------------------------------------------
 * 原来是 `rounded-xl border bg-card p-4` 的独立卡面。FollowListPage 在 A §3 里的
 * D 值是 `紧`（行式、无逐项卡面），而卡片正是「松」的写法，所以这里换成 `FeedRow`
 * 的同一套行制（发丝线分隔、无卡面、整行同一条基线），与书架行、点赞行一致。
 *
 * 条目内部结构是本页与 MyLikesPage 的区分手段（两者同为 SK6·紧/错）：
 *   - 这里**有** 44px 头像位（首字母圆底），点赞行没有；
 *   - 元信息压成**一行**（@username · 关注于 YYYY/MM/DD），点赞行是类型/标题**两行**。
 *
 * 结构未变：仍是 `<li>`（父级是 `<ul>`）、名字仍是唯一链接、`followedAt` 缺失时
 * 整段时间不渲染 —— `follow-pages.test.tsx` 直接断言这三点。
 */

/** Falls back to the username when there is no display name, and never renders blank. */
export function followUserLabel(user: FollowUser): string {
  const display = user.displayName?.trim();
  return display || user.username;
}

/** ISO instant -> 「关注于 YYYY/MM/DD」; a missing/odd value degrades to plain text. */
export function formatFollowedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `关注于 ${date.toLocaleDateString("zh-CN")}`;
}

export function FollowUserRow({
  user,
  action,
  className,
}: {
  user: FollowUser;
  /** Optional trailing control (e.g. a follow/unfollow button). */
  action?: React.ReactNode;
  className?: string;
}) {
  const label = followUserLabel(user);
  const followedAt = formatFollowedAt(user.followedAt);

  return (
    // Row surface, not a whole-card link: the name inside is the only target, so
    // `.card-lift` would raise the row for a click it cannot honour.
    <FeedRow
      className={className}
      lead={
        <span
          aria-hidden
          className="grid h-11 w-11 place-items-center rounded-pill bg-primary text-h3 font-semibold text-primary-foreground"
        >
          {label.slice(0, 1)}
        </span>
      }
      meta={action ? <span className="shrink-0">{action}</span> : null}
    >
      <Link
        to={`/u/${encodeURIComponent(user.username)}`}
        className="focus-ring block truncate text-h3 text-primary hover:text-accent-strong"
      >
        {label}
      </Link>
      {/* 一行元信息：账号 + 关注时间。时间缺失时只剩账号，不留空位。 */}
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-caption text-muted-foreground">
        <span className="truncate">@{user.username}</span>
        {followedAt ? <span className="shrink-0">{followedAt}</span> : null}
      </p>
    </FeedRow>
  );
}
