import { Link } from "react-router-dom";
import type { ProfileDetail } from "@/api/users/users.types";

/*
 * Profile stats: followers / following / articles / series / moments (all real fields of ProfileDetail).
 *
 * Phase 2I-1: when the viewer IS the owner, 关注者/正在关注 become links to
 * /me/followers and /me/following. Those routes are self-scoped (`/me/*`), so a
 * link only makes sense on your own profile — on someone else's profile the
 * counts stay plain text rather than pointing at your own lists.
 *
 * 批次 07：从侧栏的 2×2 四宫格改成身份带里的一行内联。
 *
 * 上一版把四个计数做成四张等大的小卡塞进 300px 侧栏，结果它们的视觉权重压过
 * 了作品流本身 —— 数字框有边框、有留白、占满侧栏整列，而真正要看的公开文章
 * 只是主栏里的一列卡片。计数是「这个人有多大」的注脚，不是页面的主角。
 *
 * 内联之后：`关注者 0 · 正在关注 0 · 文章 5 · 系列 2`，一行 `text-meta`，数字
 * 加粗、标签弱化。它挂在简介下方，读者扫一眼就过，不占版面。窄屏自动换行。
 *
 * 侧栏因此没有别的独立内容可放（创作空间的 description 后端恒为 null、用户维度
 * 没有系列端点；动态在 2026-10-30 补了公开端点，已在作品流下方单独成区），所以整列
 * 侧栏撤掉了，主栏吃满宽度 —— 见 UserProfilePage。
 */
export function ProfileStats({ profile }: { profile: ProfileDetail }) {
  const owner = profile.owner === true;

  const stats = [
    { label: "关注者", value: profile.followerCount ?? 0, to: owner ? "/me/followers" : null },
    { label: "正在关注", value: profile.followingCount ?? 0, to: owner ? "/me/following" : null },
    { label: "文章", value: profile.articleCount ?? 0, to: null },
    { label: "系列", value: profile.seriesCount ?? 0, to: null },
    { label: "动态", value: profile.momentCount ?? 0, to: null },
  ];

  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="profile-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <dt className="text-meta text-muted-foreground">{stat.label}</dt>
          <dd className="text-meta font-semibold tabular-nums text-primary">
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
