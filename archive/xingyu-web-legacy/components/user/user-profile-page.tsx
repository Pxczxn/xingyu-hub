"use client";
import styles from "./user-profile.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FolderHeart,
  Layers,
  Link2,
  Lock,
  Send,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FollowButton } from "@/components/community/engagement";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  DEFAULT_AVATAR_URL,
  isValidUsername,
  resolveProfileWorkCover,
  resolveUsernameFromPath,
  userProfilePath,
} from "@/lib/paths";
import {
  communityApi,
  type CollectionSummary,
  type InsightsView,
  type MomentDetail,
  type ProfileDetail,
  type SeriesSummary,
  type SpaceWorks,
} from "@/lib/community-api";
import { requestOpenMessagePanel } from "@/lib/message-panel";
import { ProfileSocialDialog, type ProfileSocialTab } from "@/components/user/profile-social-dialog";
import {
  ProfileWorksSection,
  ProfileWorksViewToggle,
  useProfileWorksViewMode,
} from "@/components/user/profile-works-section";

type ContentTab = "works" | "series" | "moments" | "collections";

type ContentTabDef = {
  key: ContentTab;
  label: string;
  ownerOnly?: boolean;
};

type TimelineGroup = {
  label: string;
  items: Array<{ id: string; title: string; categorySlug?: string | null; kind: string }>;
};

const CONTENT_TABS: ContentTabDef[] = [
  { key: "works", label: "作品" },
  { key: "series", label: "系列" },
  { key: "moments", label: "动态" },
  { key: "collections", label: "收藏", ownerOnly: true },
];

const DEFAULT_BIO = "暂无简介";

function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn(styles.empty)} role="status">
      {children}
    </p>
  );
}

function ProfileAvatar({ avatar, display }: { avatar?: string | null; display: string }) {
  return <img src={avatar || DEFAULT_AVATAR_URL} alt={`${display} 的头像`} />;
}

function TimelineWorkVisual({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className={cn(styles.visual, styles.visualCover)}>
      <img src={resolveProfileWorkCover(index)} alt="" />
    </span>
  );
}

function StatItem({
  label,
  value,
  interactive = false,
  onClick,
  href,
}: {
  label: string;
  value: string | number;
  interactive?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  if (href) {
    return (
      <Link href={href} className={cn(styles.stat, styles.statInteractive)}>
        <b>{value}</b>
        <span>{label}</span>
      </Link>
    );
  }

  if (interactive && onClick) {
    return (
      <button type="button" className={cn(styles.stat, styles.statInteractive)} onClick={onClick}>
        <b>{value}</b>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={cn(styles.stat)}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function resolveContentTab(raw: string | null): ContentTab {
  if (!raw || raw === "home" || raw === "about") return "works";
  if (raw === "works" || raw === "series" || raw === "moments" || raw === "collections") return raw;
  return "works";
}

function resolveCategoryBadge(categories: Array<{ name: string }>): string | null {
  return categories[0]?.name ?? null;
}

function buildTimelineGroups(
  works: Array<{ id: string; title: string; categorySlug?: string | null }>
): TimelineGroup[] {
  if (!works.length) return [];

  const groups = new Map<string, TimelineGroup>();
  const add = (label: string, work: { id: string; title: string; categorySlug?: string | null }) => {
    const current = groups.get(label) ?? { label, items: [] };
    current.items.push({ ...work, kind: "发布了文章" });
    groups.set(label, current);
  };

  works.forEach((work, index) => {
    if (index === 0) add("最近", work);
    else if (index < 4) add("更早", work);
  });

  return ["最近", "更早"].filter((label) => groups.has(label)).map((label) => groups.get(label)!);
}

function formatLikeMetric(count: number | undefined): string {
  if (typeof count !== "number" || Number.isNaN(count) || count < 0) return "0";
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

function formatMomentTime(value?: string) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserProfilePageContent() {
  const params = useParams<{ username?: string }>();
  const pathname = usePathname();
  const username =
    (isValidUsername(params.username) ? params.username.trim() : null) ??
    resolveUsernameFromPath(pathname);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ContentTab>("works");
  const [user, setUser] = useState<ProfileDetail | null>(null);
  const [spaceWorks, setSpaceWorks] = useState<SpaceWorks | null>(null);
  const [insights, setInsights] = useState<InsightsView | null>(null);
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [moments, setMoments] = useState<MomentDetail[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialDialogOpen, setSocialDialogOpen] = useState(false);
  const [socialDialogTab, setSocialDialogTab] = useState<ProfileSocialTab>("followers");
  const worksView = useProfileWorksViewMode(Boolean(user?.owner));

  useEffect(() => {
    setActiveTab("works");
  }, [username]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam || !username) return;
    setActiveTab(resolveContentTab(tabParam));
    router.replace(userProfilePath(username));
  }, [searchParams, username, router]);

  useEffect(() => {
    setUser(null);
    setSpaceWorks(null);
    setInsights(null);
    setSeries([]);
    setMoments([]);
    setCollections([]);
    setError(null);

    if (!username) {
      setError("用户不存在或主页未公开");
      return;
    }

    void Promise.all([communityApi.getProfile(username), communityApi.getUserWorks(username)])
      .then(async ([profile, works]) => {
        setUser(profile);
        setSpaceWorks(works);

        if (profile.owner) {
          const ownerInsights = await communityApi.getMyInsights().catch(() => null);
          setInsights(ownerInsights);
        }
      })
      .catch((cause) => {
        setError(
          cause instanceof ApiError && cause.problem.status === 404
            ? "用户不存在或主页未公开"
            : "加载失败，请稍后重试"
        );
      });
  }, [username]);

  useEffect(() => {
    if (!user?.owner) return;

    setTabLoading(true);
    const loaders: Array<Promise<void>> = [];

    if (activeTab === "series") {
      loaders.push(
        communityApi
          .listMySeries()
          .then((data) => setSeries(data))
          .catch(() => setSeries([]))
      );
    }

    if (activeTab === "moments") {
      loaders.push(
        communityApi
          .getMyMoments()
          .then((data) => setMoments(data))
          .catch(() => setMoments([]))
      );
    }

    if (activeTab === "collections") {
      loaders.push(
        communityApi
          .getCollections()
          .then((data) => setCollections(data))
          .catch(() => setCollections([]))
      );
    }

    if (!loaders.length) {
      setTabLoading(false);
      return;
    }

    void Promise.all(loaders).finally(() => setTabLoading(false));
  }, [activeTab, user?.owner]);

  const tabs = useMemo(
    () => CONTENT_TABS.map((tab) => ({ ...tab, active: activeTab === tab.key })),
    [activeTab]
  );

  if (error) {
    return (
      <AppShell>
        <main className={cn(styles.loading)}>
          <Alert variant="destructive">{error}</Alert>
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <main className={cn(styles.loading)} aria-busy="true">正在加载个人主页…</main>
      </AppShell>
    );
  }

  const display = user.displayName || user.username;
  const works = spaceWorks?.works ?? [];
  const categories = spaceWorks?.categories ?? [];
  const timelineGroups = buildTimelineGroups(works);
  const isCreator = works.length > 0 || Boolean(spaceWorks?.owner);
  const categoryBadge = resolveCategoryBadge(categories);
  const creationCount = user.articleCount ?? insights?.articleCount ?? works.length;
  const likeMetric = formatLikeMetric(insights?.likeCount);
  const followerCount = typeof user.followerCount === "number" ? user.followerCount : 0;
  const followingCount = typeof user.followingCount === "number" ? user.followingCount : 0;
  const canViewFollowLists = user.canViewFollowLists ?? user.owner ?? true;

  function openSocialDialog(tab: ProfileSocialTab) {
    if (!canViewFollowLists) return;
    setSocialDialogTab(tab);
    setSocialDialogOpen(true);
  }

  const renderTabContent = () => {
    if (activeTab === "works") {
      return (
        <ProfileWorksSection
          works={works}
          viewMode={worksView.viewMode}
          visible={worksView.visible}
        />
      );
    }

    if (activeTab === "series") {
      if (!user.owner) {
        return (
          <EmptySection>
            {user.seriesCount ? `该用户有 ${user.seriesCount} 个系列，暂未公开展示。` : "还没有公开系列。"}
          </EmptySection>
        );
      }
      if (tabLoading) return <EmptySection>正在加载系列…</EmptySection>;
      return series.length ? (
        <div className={cn(styles.contentGrid, styles.contentGridList)}>
          {series.map((item) => (
            <Link href={`/series/${encodeURIComponent(item.id)}`} key={item.id} className={cn(styles.entryCard)}>
              <span className={cn(styles.entryCard__icon)} aria-hidden="true">
                <Layers />
              </span>
              <span className={cn(styles.entryCard__body)}>
                <b>{item.title}</b>
                <small>{item.chapterCount ? `${item.chapterCount} 篇` : "系列"}</small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptySection>还没有创建系列。</EmptySection>
      );
    }

    if (activeTab === "moments") {
      if (user.owner) {
        if (tabLoading) return <EmptySection>正在加载动态…</EmptySection>;
        return moments.length ? (
          <div className={cn(styles.momentList)}>
            {moments.map((moment) => (
              <Link href={`/moments/${encodeURIComponent(moment.id)}`} key={moment.id} className={cn(styles.momentItem)}>
                <time>{formatMomentTime(moment.createdAt)}</time>
                <p>{moment.body || "动态内容"}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptySection>还没有发布动态。</EmptySection>
        );
      }

      return timelineGroups.length ? (
        <div className={cn(styles.timeline)}>
          {timelineGroups.map((group) => (
            <section key={group.label} className={cn(styles.timeline__group)}>
              <h3>{group.label}</h3>
              <ol>
                {group.items.map((item, index) => (
                  <li key={item.id}>
                    <Link href={`/articles/${encodeURIComponent(item.id)}`} className={cn(styles.timeline__item)}>
                      <TimelineWorkVisual index={index} />
                      <div>
                        <small>{item.kind}</small>
                        <b>{item.title}</b>
                        <span>{item.categorySlug || "创作"}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <EmptySection>暂无公开动态。</EmptySection>
      );
    }

    if (!user.owner) {
      return (
        <div className={cn(styles.privateHint)}>
          <Lock aria-hidden="true" />
          <p>收藏内容仅本人可见</p>
        </div>
      );
    }

    if (tabLoading) return <EmptySection>正在加载收藏…</EmptySection>;
    return collections.length ? (
      <div className={cn(styles.contentGrid, styles.contentGridList)}>
        {collections.map((collection) => (
          <Link
            href={`/me/collections/${encodeURIComponent(collection.id)}`}
            key={collection.id}
            className={cn(styles.entryCard)}
          >
            <span className={cn(styles.entryCard__icon)} aria-hidden="true">
              <FolderHeart />
            </span>
            <span className={cn(styles.entryCard__body)}>
              <b>{collection.title}</b>
              <small>{collection.itemCount} 项 · {collection.visibility === "PUBLIC" ? "公开" : "私密"}</small>
            </span>
          </Link>
        ))}
      </div>
    ) : (
      <EmptySection>还没有创建收藏夹。</EmptySection>
    );
  };

  return (
    <AppShell>
      <main className={cn(styles.page)}>
        <header className={cn(styles.banner, user.owner && styles.bannerOwner)}>
          <div className={cn(styles.banner__cover)} aria-hidden="true">
            <img src="/prototype-assets/profile/profile-cover.png" alt="" />
          </div>

          {!user.owner ? (
            <div className={cn(styles.banner__actions)}>
              <FollowButton
                username={user.username}
                initialFollowing={user.following}
                profile
              />
              <Button
                variant="outline"
                className={cn(styles.actionBtn)}
                onClick={() => requestOpenMessagePanel({ username: user.username })}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                私信
              </Button>
            </div>
          ) : null}

          <div className={cn(styles.banner__deck)}>
            <div className={cn(styles.creatorModule)}>
              <div className={cn(styles.creatorModule__row)}>
                <div className={cn(styles.avatarSlot)}>
                  <div className={cn(styles.avatar)}>
                    <ProfileAvatar avatar={user.avatar} display={display} />
                  </div>
                </div>

                <div className={cn(styles.identity)}>
                  <div className={cn(styles.identity__headline)}>
                    <h1 className={cn(styles.name)}>{display}</h1>
                    {(isCreator || categoryBadge) ? (
                      <div className={cn(styles.identityBadges)} aria-label="身份标识">
                        {isCreator ? <span className={cn(styles.identityBadge)}>创作者</span> : null}
                        {categoryBadge ? (
                          <span className={cn(styles.identityTag)}>{categoryBadge}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className={cn(styles.handle)}>@{user.username}</p>
                  <p className={cn(styles.signature, !user.bio?.trim() && styles.signaturePlaceholder)}>
                    {user.bio?.trim() || DEFAULT_BIO}
                  </p>
                  {user.websiteUrl ? (
                    <a className={cn(styles.link)} href={user.websiteUrl} target="_blank" rel="noreferrer">
                      <Link2 aria-hidden="true" />
                      {user.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  ) : null}
                </div>
              </div>

              <section className={cn(styles.banner__stats)} aria-label="数据概览">
                <StatItem
                  label="创作"
                  value={creationCount}
                  interactive
                  onClick={() => setActiveTab("works")}
                />
                <StatItem
                  label="粉丝"
                  value={followerCount}
                  interactive={canViewFollowLists}
                  onClick={() => openSocialDialog("followers")}
                />
                <StatItem
                  label="关注"
                  value={followingCount}
                  interactive={canViewFollowLists}
                  onClick={() => openSocialDialog("following")}
                />
                <StatItem
                  label="获赞"
                  value={likeMetric}
                  interactive={user.owner}
                  href={user.owner ? "/me/growth" : undefined}
                />
              </section>
            </div>
          </div>
        </header>

        <div className={cn(styles.tabsBar)}>
          <nav className={cn(styles.tabs)} aria-label="内容导航">
            {tabs.map((tab) =>
              tab.active ? (
                <b key={tab.key} aria-current="page">
                  {tab.label}
                  {tab.ownerOnly && !user.owner ? <Lock className={cn(styles.tabs__lock)} aria-hidden="true" /> : null}
                </b>
              ) : (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}>
                  {tab.label}
                  {tab.ownerOnly && !user.owner ? <Lock className={cn(styles.tabs__lock)} aria-hidden="true" /> : null}
                </button>
              )
            )}
          </nav>
          <div className={cn(styles.tabsBar__actions)}>
            {activeTab === "works" && worksView.isDesktop ? (
              <ProfileWorksViewToggle mode={worksView.viewMode} onChange={worksView.changeViewMode} />
            ) : null}
          </div>
        </div>

        <section className={cn(styles.content)} aria-label={`${tabs.find((tab) => tab.active)?.label ?? "内容"}列表`}>
          {renderTabContent()}
        </section>

        <ProfileSocialDialog
          open={socialDialogOpen}
          onClose={() => setSocialDialogOpen(false)}
          username={user.username}
          activeTab={socialDialogTab}
          onTabChange={setSocialDialogTab}
          followerCount={followerCount}
          followingCount={followingCount}
        />
      </main>
    </AppShell>
  );
}
