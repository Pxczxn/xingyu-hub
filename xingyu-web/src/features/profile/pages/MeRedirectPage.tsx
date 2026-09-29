import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import { useAuth } from "@/features/auth/auth.store";
import { PageState } from "@/components/shared/PageState";

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

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/login?returnTo=/me", { replace: true });
      return;
    }
    if (status !== "authenticated") return;

    let active = true;
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
  }, [status, navigate]);

  if (failed) {
    return (
      <PageState
        kind="error"
        title="无法打开个人主页"
        description="暂时无法确定你的用户名，请稍后重试。"
      />
    );
  }

  return <PageState kind="loading" />;
}
