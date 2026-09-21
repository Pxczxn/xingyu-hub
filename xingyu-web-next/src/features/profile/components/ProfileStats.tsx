import type { ProfileDetail } from "@/api/users/users.types";

/* Profile stats: followers / following / articles (all real fields of ProfileDetail). */
export function ProfileStats({ profile }: { profile: ProfileDetail }) {
  const stats = [
    { label: "关注者", value: profile.followerCount ?? 0 },
    { label: "正在关注", value: profile.followingCount ?? 0 },
    { label: "作品", value: profile.articleCount ?? 0 },
  ];

  return (
    <dl className="grid grid-cols-3 gap-3" data-testid="profile-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-3 text-center">
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
