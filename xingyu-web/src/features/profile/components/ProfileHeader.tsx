import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ProfileDetail } from "@/api/users/users.types";
import { Button } from "@/components/ui/button";

/*
 * Profile header: avatar / display name / username / bio / follow control.
 * Follow is real (verified: POST|DELETE /api/v1/users/{username}/follow -> 204).
 *
 * `blockControl` is an optional slot for the Phase 2A-2a block entry. It is a
 * slot rather than inline logic so this header keeps its existing structure —
 * the block feature must not force a redesign of the profile header.
 *
 * 批次 06 修正：两个链接原来用 `text-accent`，而 `--accent` 是 FILL token
 * （`38 92% 50%`，白底 2.15:1），当正文色用不达标。改 `text-accent-strong`
 * （`26 90% 37%`，白底 5.05:1，过 AA）—— 这是方案点名的红线，不是配色偏好。
 *
 * 批次 06 视觉：S4 要求「全宽身份头」，所以这个 header 现在自己就是一张面
 * （`rounded-xl border bg-card`，与 GalaxyShell 的身份头同款），不再是裸排版；
 * 头像也从 64px 提到 80/96px —— 个人主页的头像是身份锚点，和星系封面同权。
 */
export function ProfileHeader({
  profile,
  following,
  followPending,
  followError,
  onToggleFollow,
  canFollow,
  blockControl,
}: {
  profile: ProfileDetail;
  following: boolean;
  followPending: boolean;
  followError: string | null;
  onToggleFollow: () => void;
  canFollow: boolean;
  blockControl?: ReactNode;
}) {
  const name = profile.displayName ?? profile.username;

  return (
    <header className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="flex items-start gap-4">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full border border-border object-cover sm:h-24 sm:w-24"
          />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-muted text-2xl font-medium text-muted-foreground sm:h-24 sm:w-24 sm:text-3xl">
            {name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{name}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio ? (
            <p className="mt-2 max-w-2xl text-sm text-foreground">{profile.bio}</p>
          ) : null}
          {profile.websiteUrl ? (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-1 inline-block text-sm text-accent-strong hover:underline"
            >
              {profile.websiteUrl}
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2">
        {profile.owner ? (
          <span className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            这是你的主页
          </span>
        ) : canFollow ? (
          <Button
            type="button"
            variant={following ? "outline" : "default"}
            disabled={followPending}
            onClick={onToggleFollow}
          >
            {followPending ? "处理中" : following ? "已关注" : "关注"}
          </Button>
        ) : (
          <Link to="/login" className="focus-ring text-sm text-accent-strong hover:underline">
            登录后关注
          </Link>
        )}
        {followError ? (
          <span role="alert" className="text-sm text-destructive">
            {followError}
          </span>
        ) : null}
        {blockControl}
      </div>
    </header>
  );
}
