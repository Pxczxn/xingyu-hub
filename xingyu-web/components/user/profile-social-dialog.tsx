"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { FollowButton } from "@/components/community/engagement";
import { Avatar } from "@/components/ui/avatar";
import { ApiError } from "@/lib/api-client";
import { communityApi, type FollowUser } from "@/lib/community-api";
import { cn } from "@/lib/utils";

export type ProfileSocialTab = "followers" | "following";

type ProfileSocialDialogProps = {
  open: boolean;
  onClose: () => void;
  username: string;
  activeTab: ProfileSocialTab;
  onTabChange: (tab: ProfileSocialTab) => void;
  followerCount: number;
  followingCount: number;
};

function displayName(user: FollowUser) {
  return user.displayName || user.username;
}

function SocialUserRow({
  user,
  following,
  showFollowAction,
  onNavigate,
}: {
  user: FollowUser;
  following: boolean;
  showFollowAction: boolean;
  onNavigate: () => void;
}) {
  return (
    <li className="xy-profile-social-row">
      <Link href={`/u/${user.username}`} className="xy-profile-social-row__profile" onClick={onNavigate}>
        <Avatar fallback={displayName(user)} className="h-11 w-11 shrink-0 text-sm" alt="" />
        <span className="min-w-0">
          <strong>{displayName(user)}</strong>
          <small>@{user.username}</small>
        </span>
      </Link>
      {showFollowAction ? (
        <FollowButton username={user.username} initialFollowing={following} compact className="shrink-0" />
      ) : null}
    </li>
  );
}

export function ProfileSocialDialog({
  open,
  onClose,
  username,
  activeTab,
  onTabChange,
  followerCount,
  followingCount,
}: ProfileSocialDialogProps) {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FollowUser[]>([]);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKeyword("");
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    const listRequest =
      activeTab === "followers"
        ? communityApi.getUserFollowers(username, 50)
        : communityApi.getUserFollowing(username, 50);

    Promise.all([
      listRequest,
      communityApi.tryGetMyProfile().then(async (profile) => {
        if (!profile) return { profile: null, following: [] as FollowUser[] };
        const following = await communityApi.getMyFollowing(100).catch(() => ({ items: [] as FollowUser[] }));
        return { profile, following: following.items };
      }),
    ])
      .then(([listResult, viewerState]) => {
        setItems(listResult.items);
        setViewerUsername(viewerState.profile?.username ?? null);
        setMyFollowingIds(new Set(viewerState.following.map((item) => item.userId)));
      })
      .catch((cause) => {
        setItems([]);
        setError(
          cause instanceof ApiError && cause.problem.status === 403
            ? "该用户的关注列表未公开"
            : "列表加载失败，请稍后重试"
        );
      })
      .finally(() => setLoading(false));
  }, [open, activeTab, username]);

  const filteredItems = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${displayName(item)} ${item.username}`.toLowerCase().includes(query));
  }, [items, keyword]);

  if (!open) return null;

  const tabs: Array<{ id: ProfileSocialTab; label: string; count: number }> = [
    { id: "following", label: "关注", count: followingCount },
    { id: "followers", label: "粉丝", count: followerCount },
  ];

  return (
    <div className="xy-profile-social-dialog" role="presentation" onClick={onClose}>
      <section
        className="xy-profile-social-dialog__panel"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="xy-profile-social-dialog__header">
          <div className="xy-profile-social-dialog__tabs" role="tablist" aria-label="关注与粉丝">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn("xy-profile-social-dialog__tab", activeTab === tab.id && "is-active")}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label} {tab.count}
              </button>
            ))}
          </div>
          <button type="button" className="xy-profile-social-dialog__close" aria-label="关闭" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="xy-profile-social-dialog__search">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索用户昵称或账号"
            aria-label="搜索用户"
          />
        </div>

        <div className="xy-profile-social-dialog__body">
          {loading ? (
            <div className="xy-profile-social-dialog__state">
              <LoaderCircle className="h-6 w-6 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" />
              <p>正在加载列表…</p>
            </div>
          ) : error ? (
            <div className="xy-profile-social-dialog__state">
              <p>{error}</p>
            </div>
          ) : filteredItems.length ? (
            <ul className="xy-profile-social-dialog__list">
              {filteredItems.map((item) => (
                <SocialUserRow
                  key={item.userId}
                  user={item}
                  following={myFollowingIds.has(item.userId)}
                  showFollowAction={Boolean(viewerUsername) && viewerUsername !== item.username}
                  onNavigate={onClose}
                />
              ))}
            </ul>
          ) : (
            <div className="xy-profile-social-dialog__state">
              <p>{keyword ? "没有匹配的用户" : activeTab === "followers" ? "还没有粉丝" : "还没有关注任何人"}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
