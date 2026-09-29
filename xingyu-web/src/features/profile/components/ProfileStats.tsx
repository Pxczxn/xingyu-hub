import { Link } from "react-router-dom";
import type { ProfileDetail } from "@/api/users/users.types";

/*
 * Profile stats: followers / following / articles (all real fields of ProfileDetail).
 *
 * Phase 2I-1: when the viewer IS the owner, 关注者/正在关注 become links to
 * /me/followers and /me/following. Those routes are self-scoped (`/me/*`), so a
 * link only makes sense on your own profile — on someone else's profile the
 * counts stay plain text rather than pointing at your own lists.
 */
export function ProfileStats({ profile }: { profile: ProfileDetail }) {
  const owner = profile.owner === true;

  const stats = [
    { label: "关注者", value: profile.followerCount ?? 0, to: owner ? "/me/followers" : null },
    { label: "正在关注", value: profile.followingCount ?? 0, to: owner ? "/me/following" : null },
    { label: "作品", value: profile.articleCount ?? 0, to: null },
  ];

  return (
    <dl className="grid grid-cols-3 gap-3" data-testid="profile-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-3 text-center">
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {stat.to ? (
              <Link to={stat.to} className="hover:text-accent hover:underline">
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

