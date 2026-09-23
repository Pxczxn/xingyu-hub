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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
            {name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-primary">{name}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio ? <p className="mt-2 max-w-2xl text-sm text-foreground">{profile.bio}</p> : null}
          {profile.websiteUrl ? (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-accent hover:underline"
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
            variant={following ? "outline" : "primary"}
            disabled={followPending}
            onClick={onToggleFollow}
          >
            {followPending ? "处理中" : following ? "已关注" : "关注"}
          </Button>
        ) : (
          <Link to="/login" className="text-sm text-accent hover:underline">
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
