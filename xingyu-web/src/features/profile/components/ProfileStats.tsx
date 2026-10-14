import { Link } from "react-router-dom";
import type { ProfileDetail } from "@/api/users/users.types";

/*
 * Profile stats: followers / following / articles / series (all real fields of ProfileDetail).
 *
 * Phase 2I-1: when the viewer IS the owner, 关注者/正在关注 become links to
 * /me/followers and /me/following. Those routes are self-scoped (`/me/*`), so a
 * link only makes sense on your own profile — on someone else's profile the
 * counts stay plain text rather than pointing at your own lists.
 *
 * 批次 06：这块从「页面中段的 4 联横排」搬进了 S4 的 300px 侧栏，所以
 * `sm:grid-cols-4` 撤掉了 —— 300px 分 4 列每格只有 75px，「正在关注」四个字
 * 都放不下。2 列在侧栏（约 140px/格）和窄屏（整宽）下都成立，一个值覆盖两处。
 *
 * 链接的悬停色同时从 `text-accent` 改为 `text-accent-strong`：前者是 FILL
 * token，白底 2.15:1，悬停时反而比静止更看不清。
 */
export function ProfileStats({ profile }: { profile: ProfileDetail }) {
  const owner = profile.owner === true;

  const stats = [
    { label: "关注者", value: profile.followerCount ?? 0, to: owner ? "/me/followers" : null },
    { label: "正在关注", value: profile.followingCount ?? 0, to: owner ? "/me/following" : null },
    { label: "文章", value: profile.articleCount ?? 0, to: null },
    { label: "系列", value: profile.seriesCount ?? 0, to: null },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3" data-testid="profile-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-3 text-center">
          <dt className="text-meta text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {stat.to ? (
              <Link to={stat.to} className="focus-ring hover:text-accent-strong hover:underline">
                {stat.value}
              </Link>
            ) : (
              stat.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
