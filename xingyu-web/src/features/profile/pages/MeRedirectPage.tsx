import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import { useAuth } from "@/features/auth/auth.store";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * /me — entry point to the current user's own profile.
 *
 * /api/v1/me does NOT return a username, so we resolve it from
 * /api/v1/me/profile (verified to include `username`) and then hand off to the
 * canonical public profile at /u/{username}. No username is ever guessed, and
 * there is no separate "MeProfile" implementation — it reuses the Profile domain.
 */
export function MeRedirectPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/login?returnTo=/me", { replace: true });
      return;
    }
    if (status !== "authenticated") return;

    let active = true;
    setFailed(false);
    usersApi
      .getMyProfile()
      .then((profile) => {
        if (!active) return;
        if (profile?.username) navigate(`/u/${profile.username}`, { replace: true });
        else setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [status, navigate, reloadKey]);

  if (failed) {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="无法打开个人主页"
          description="暂时无法确定你的用户名，请稍后重试。"
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return <PageState kind="loading" />;
}
