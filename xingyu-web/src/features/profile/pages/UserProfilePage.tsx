import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail, SpaceWorks } from "@/api/users/users.types";
import { momentsApi } from "@/api/moments/moments.api";
import type { MomentView } from "@/api/moments/moments.types";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth.store";
import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileStats } from "@/features/profile/components/ProfileStats";
import { ProfileWorks } from "@/features/profile/components/ProfileWorks";
import { ProfileWorksFilter } from "@/features/profile/components/ProfileWorksFilter";
import { ProfileMoments } from "@/features/profile/components/ProfileMoments";
import { ProfileBlockControl } from "@/features/blocks/components/ProfileBlockControl";
import { isBlockedUsername, loadBlockedUsers } from "@/features/blocks/blocked-users.store";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * Public user profile (Phase 1B) — real implementation.
 * Real endpoints: GET /api/v1/users/{username}, /works, POST|DELETE .../follow.
 * Follow genuinely works on this backend (unlike Topic follow).
 *
 * Phase 2A-2a adds the block entry. Block state is NOT part of the profile DTO —
 * there is no `blocked` field and no status endpoint (contract gap, verified
 * 2026-09-23) — so it is read through the shared store rather than re-downloading
 * the block list on every profile view.
 *
 * 批次 06（S4 身份详情）：全宽身份头 → 主栏/侧栏（`lg:grid-cols-[minmax(0,1fr)_300px]`，
 * 侧栏下移见方案 §五）。方案 §4.3 写的是「作品流 tab（文章 / 系列 / 动态）」，但用户维度
 * 端点只有 /{username}、/{username}/works、/{username}/works/categories、follow 与
 * followers/following（CommunityUserController 逐条核对）—— 没有 series，也没有 moments，
 * 三个 tab 里两个没有数据源。改由真实存在的第二维（创作空间分类）承担筛选，
 * 理由写在 ProfileWorksFilter 里。
 *
 * 批次 07（视觉改造）：身份头从卡片改成通栏身份带（见 ProfileHeader），统计从侧栏四宫格
 * 改成身份带内联一行（见 ProfileStats），侧栏整列撤掉、主栏吃满宽度。撤侧栏的理由和
 * 「为什么没有创作空间卡」写在下面渲染处的注释里 —— 结论是当前没有满足「真实存在且有
 * 有效数据」的侧栏内容，而不是「没时间做」。
 */
type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; profile: ProfileDetail };

/**
 * "unknown" also covers "the block list could not be read". In that case the
 * block control is not rendered at all, rather than showing an action that may
 * be the wrong one.
 */
type BlockStatus = "unknown" | "loading" | "blocked" | "clear";

export function UserProfilePage() {
  const { username = "" } = useParams<{ username: string }>();
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [works, setWorks] = useState<SpaceWorks | null>(null);
  const [worksError, setWorksError] = useState(false);
  const [worksPending, setWorksPending] = useState(false);
  const [moments, setMoments] = useState<MomentView[] | null>(null);
  const [momentsError, setMomentsError] = useState(false);
  /*
   * 当前分类筛选，和「它是在谁的主页上选的」存在一起。
   *
   * 存成一对而不是一个裸 slug：路由从 /u/A 换到 /u/B 时 React 不会重挂本组件，
   * 裸 slug 会被带进 B 的页面。用 effect 重置不行 —— effect 在本次提交里跑，而
   * works 的请求 effect 读的是「本次渲染」的 slug，等重置生效时请求已经带着 A 的
   * 分类发出去了（一次白请求 + 一帧高亮错位的 chip）。渲染期比对用户名则让 B 的
   * 第一帧直接拿到 `null`，请求只发一次、且是对的。
   */
  const [filter, setFilter] = useState<{ username: string; slug: string | null }>({
    username,
    slug: null,
  });
  const categorySlug = filter.username === username ? filter.slug : null;
  const [following, setFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<BlockStatus>("unknown");
  /* Bumping the key replays the load effects — the retry mechanism for the
     error branch below. The effects keep their per-run `active` guards. */
  const [reloadKey, setReloadKey] = useState(0);

  // Identity only. The works list used to be fetched from here as well; it has its
  // own effect now because the category filter is a request parameter and the two
  // therefore have different dependencies.
  useEffect(() => {
    if (!username) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    setFollowError(null);
    // A different profile is a different works list — the previous one is not this
    // page's data. Cleared here, not in the works effect: that one also re-runs on a
    // category change, where keeping the old list is exactly the point.
    setWorks(null);
    setWorksError(false);

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

    return () => {
      active = false;
    };
  }, [username, reloadKey]);

  /*
   * Works: re-fetched when the profile changes AND when the category does.
   *
   * `works` is deliberately NOT cleared on a category change — only flagged
   * `pending`. Two reasons: the grid keeps its height instead of collapsing to a
   * loading card and back, and the filter chips are rendered from
   * `works.categories`, so clearing it would delete the only way back to 「全部」
   * at exactly the moment a failed request makes that way necessary.
   *
   * Rendering the chips off the response is safe because the backend builds
   * `categories` independently of `categorySlug` (CreationSpaceService
   * .getPublicWorks), so a filtered response still carries the full list and the
   * chips cannot self-collapse.
   */
  useEffect(() => {
    if (!username) return;
    let active = true;
    setWorksError(false);
    setWorksPending(true);

    // Works is non-critical: a failure degrades only that section.
    usersApi
      .getUserWorks(username, categorySlug ?? undefined)
      .then((data) => {
        if (!active) return;
        setWorks(data);
        setWorksPending(false);
      })
      .catch(() => {
        if (!active) return;
        setWorksError(true);
        setWorksPending(false);
      });

    return () => {
      active = false;
    };
  }, [username, categorySlug, reloadKey]);

  /*
   * Moments are a separate public surface with its own endpoint. A failure
   * degrades only this section; the article works above must stay readable.
   */
  useEffect(() => {
    if (!username) return;
    let active = true;
    setMoments(null);
    setMomentsError(false);
    momentsApi
      .listByUsername(username)
      .then((data) => {
        if (active) setMoments(data);
      })
      .catch(() => {
        if (active) setMomentsError(true);
      });
    return () => {
      active = false;
    };
  }, [username, reloadKey]);

  const owner = state.kind === "ready" ? state.profile.owner === true : null;
  // Guests and the viewer's own profile get no block control: the backend rejects
  // blocking yourself (400 "username: 不能屏蔽自己"), so offering it would be noise.
  const canBlock = isAuthenticated && owner === false;

  useEffect(() => {
    if (!canBlock || !username) {
      setBlockStatus("unknown");
      return;
    }
    let active = true;
    setBlockStatus("loading");
    loadBlockedUsers()
      .then(() => {
        if (active) setBlockStatus(isBlockedUsername(username) ? "blocked" : "clear");
      })
      .catch(() => {
        if (active) setBlockStatus("unknown");
      });
    return () => {
      active = false;
    };
  }, [canBlock, username]);

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

  const handleRelationshipChanged = useCallback(
    async (nextBlocked: boolean) => {
      // The 204 already confirmed the new block state. Blocking additionally
      // removes any follow in BOTH directions (UserBlockService.blockByUsername),
      // so the header must not keep showing a stale "已关注".
      setBlockStatus(nextBlocked ? "blocked" : "clear");
      if (nextBlocked) setFollowing(false);
      try {
        // Minimal necessary re-sync of the real relationship state (follow + counts).
        const profile = await usersApi.getProfile(username);
        setState({ kind: "ready", profile });
        setFollowing(profile.following === true);
      } catch {
        // Re-sync failed: keep what the 204 confirmed instead of reporting a
        // false failure for an action that already succeeded.
      }
    },
    [username],
  );

  function handleSelectCategory(slug: string | null) {
    // Re-clicking the active chip is a no-op: `setFilter` would allocate a new object
    // and re-render for nothing. The request would not re-fire (the effect depends on
    // the derived slug, not on this object), so it is pure waste.
    if (slug === categorySlug) return;
    setFilter({ username, slug });
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "notfound") {
    return <PageState kind="empty" title="用户不存在" description="该用户可能已注销或改名。" />;
  }
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

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
        statsSlot={<ProfileStats profile={profile} />}
        blockControl={
          canBlock && (blockStatus === "blocked" || blockStatus === "clear") ? (
            <ProfileBlockControl
              username={username}
              blocked={blockStatus === "blocked"}
              onRelationshipChanged={handleRelationshipChanged}
            />
          ) : null
        }
      />

      {/*
        批次 07：侧栏撤掉，主栏吃满宽度。

        上一版是 `lg:grid-cols-[minmax(0,1fr)_300px]` + 300px 侧栏，但侧栏里只装得下
        四张统计小卡 —— 那是「数字」，不是「内容」。撤掉统计（改由身份带内联承载）之后
        侧栏没有任何有独立价值的东西可放，实测确认：

          · 创作空间 description —— `CommunityAccountService` 注册时无条件创建空间且
            description 恒为 null，`CommunitySpaceController` 只有两个 GET，没有编辑
            端点，所以这个字段在当前产品里根本填不进来；
          · 用户维度系列列表 —— 仍没有端点（CommunityUserController 只有 /{username}、
            /{username}/works、/{username}/works/categories、/{username}/moments、
            follow、followers/following）；
          · 动态 —— 2026-10-30 补了公开端点 /{username}/moments，所以在作品流下方
            单独成区，不再挤进侧栏；
          · 「TA 的关注者」 —— `/u/:username/followers` 没有前端路由，且
            canViewFollowLists=false 时后端直接 403，链接会指向死路。

        空着一列 300px 只为放几张小卡，正是这一版要解决的问题。留白给作品流。
      */}
      <section aria-labelledby="works-heading" className="min-w-0">
        <h2 id="works-heading" className="section-heading mb-3">
          公开文章
        </h2>

        {/* Chips come from the works response, so they appear with the first page of
            results and stay put across filter changes (see the works effect above). */}
        <ProfileWorksFilter
          categories={works?.categories ?? []}
          active={categorySlug}
          onSelect={handleSelectCategory}
        />

        {worksError ? (
          <p role="alert" data-testid="works-error" className="text-sm text-destructive">
            文章加载失败
          </p>
        ) : works ? (
          <ProfileWorks works={works} filterSlug={categorySlug} pending={worksPending} />
        ) : (
          <PageState kind="loading" />
        )}
      </section>

      <section aria-labelledby="moments-heading" className="mt-8 min-w-0">
        <h2 id="moments-heading" className="section-heading mb-3">
          公开动态
        </h2>
        {momentsError ? (
          <p role="alert" data-testid="profile-moments-error" className="text-sm text-destructive">
            动态加载失败
          </p>
        ) : moments ? (
          <ProfileMoments moments={moments} />
        ) : (
          <PageState kind="loading" />
        )}
      </section>
    </div>
  );
}
