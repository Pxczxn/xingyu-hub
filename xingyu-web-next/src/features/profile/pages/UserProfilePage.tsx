import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail, SpaceWorks } from "@/api/users/users.types";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth.store";
import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileStats } from "@/features/profile/components/ProfileStats";
import { ProfileWorks } from "@/features/profile/components/ProfileWorks";
import { PageState } from "@/components/shared/PageState";

/*
 * Public user profile (Phase 1B) — real implementation.
 * Real endpoints: GET /api/v1/users/{username}, /works, POST|DELETE .../follow.
 * Follow genuinely works on this backend (unlike Topic follow).
 */
type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; profile: ProfileDetail };

export function UserProfilePage() {
  const { username = "" } = useParams<{ username: string }>();
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [works, setWorks] = useState<SpaceWorks | null>(null);
  const [worksError, setWorksError] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    setWorks(null);
    setWorksError(false);
    setFollowError(null);

    usersApi
      .getProfile(username)
      .then((profile) => {
        if (!active) return;
        setState({ kind: "ready", profile });
        setFollowing(profile.following === true);
      })
      .catch((err) => {
        if (!active) return;
        const status = err instanceof ApiError ? err.problem.status : 0;
        setState({ kind: status === 404 ? "notfound" : "error" });
      });

    // Works is non-critical: a failure degrades only that section.
    usersApi
      .getUserWorks(username)
      .then((data) => {
        if (active) setWorks(data);
      })
      .catch(() => {
        if (active) setWorksError(true);
      });

    return () => {
      active = false;
    };
  }, [username]);

  async function toggleFollow() {
    if (followPending) return; // duplicate-click guard
    setFollowError(null);
    const next = !following;
    setFollowing(next); // optimistic
    setFollowPending(true);
    try {
      if (next) await usersApi.followUser(username);
      else await usersApi.unfollowUser(username);
    } catch {
      setFollowing(!next); // rollback
      setFollowError("操作失败，请稍后重试");
    } finally {
      setFollowPending(false);
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "notfound") {
    return <PageState kind="empty" title="用户不存在" description="该用户可能已注销或改名。" />;
  }
  if (state.kind === "error") return <PageState kind="error" />;

  const { profile } = state;

  return (
    <div className="section-gap">
      <ProfileHeader
        profile={profile}
        following={following}
        followPending={followPending}
        followError={followError}
        onToggleFollow={() => void toggleFollow()}
        canFollow={isAuthenticated}
      />

      <ProfileStats profile={profile} />

      <section aria-labelledby="works-heading">
        <h2 id="works-heading" className="mb-3 text-base font-semibold text-primary">
          公开作品
        </h2>
        {worksError ? (
          <p role="alert" data-testid="works-error" className="text-sm text-destructive">
            作品加载失败
          </p>
        ) : works ? (
          <ProfileWorks works={works} />
        ) : (
          <PageState kind="loading" />
        )}
      </section>
    </div>
  );
}
