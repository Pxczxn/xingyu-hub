"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Link2,
  MoreHorizontal,
  Orbit,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FollowButton } from "@/components/community/engagement";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  communityApi,
  type GalaxySummary,
  type InsightsView,
  type OnboardingState,
  type ProfileDetail,
  type SpaceWorks,
} from "@/lib/community-api";

type ProfileTab = {
  key: string;
  label: string;
  href: string;
  active?: boolean;
};

type TimelineGroup = {
  label: string;
  items: Array<{ id: string; title: string; categorySlug?: string | null; kind: string }>;
};

const DEFAULT_BIO = "在代码与文字之间，记录创造的轨迹。";

function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <p className="xy-profile-empty" role="status">
      {children}
    </p>
  );
}

function ProfileAvatar({ avatar, display }: { avatar?: string | null; display: string }) {
  if (avatar) {
    return <img src={avatar} alt={`${display} 的头像`} />;
  }
  return (
    <span className="xy-profile-avatar-fallback" aria-hidden="true">
      {display.slice(0, 1).toUpperCase()}
    </span>
  );
}

function WorkVisual({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className={`xy-profile-visual xy-profile-visual--${index % 3}`}>
      <FileText />
    </span>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="xy-profile-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function SectionHeader({ title, href, linkLabel = "查看全部" }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="xy-profile-section-title">
      <h2>{title}</h2>
      {href ? (
        <Link href={href}>
          {linkLabel}
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function buildTabs(profileHref: string, username: string): ProfileTab[] {
  return [
    { key: "home", label: "主页", href: profileHref, active: true },
    { key: "works", label: "作品", href: `${profileHref}/works` },
    { key: "articles", label: "文章", href: `${profileHref}/works` },
    { key: "series", label: "系列", href: `/series?author=${encodeURIComponent(username)}` },
    { key: "collections", label: "收藏", href: "/collections/public" },
    { key: "moments", label: "动态", href: `${profileHref}#profile-timeline` },
    { key: "about", label: "关于", href: `${profileHref}#profile-about` },
  ];
}

function parseInterests(onboarding: OnboardingState | null): string[] {
  if (!onboarding?.interestsJson) return [];
  try {
    const parsed = JSON.parse(onboarding.interestsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string").slice(0, 6);
    }
  } catch {
    return [];
  }
  return [];
}

function buildIdentityTags(isCreator: boolean, categories: Array<{ name: string }>): string[] {
  const tags: string[] = [];
  if (isCreator) tags.push("创作者");
  const categoryTag = categories[0]?.name;
  if (categoryTag && !tags.includes(categoryTag)) tags.push(categoryTag);
  return tags.slice(0, 2);
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
    if (index === 0) add("今天", work);
    else if (index === 1) add("昨天", work);
    else add("更早", work);
  });

  return ["今天", "昨天", "更早"].filter((label) => groups.has(label)).map((label) => groups.get(label)!);
}

function formatReadMetric(count: number | undefined, worksCount: number): string {
  if (typeof count === "number" && count > 0) {
    return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  }
  if (worksCount > 0) return `${worksCount}篇`;
  return "—";
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<ProfileDetail | null>(null);
  const [spaceWorks, setSpaceWorks] = useState<SpaceWorks | null>(null);
  const [insights, setInsights] = useState<InsightsView | null>(null);
  const [galaxies, setGalaxies] = useState<GalaxySummary[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUser(null);
    setSpaceWorks(null);
    setInsights(null);
    setGalaxies([]);
    setOnboarding(null);
    setError(null);

    void Promise.all([communityApi.getProfile(username), communityApi.getUserWorks(username)])
      .then(async ([profile, works]) => {
        setUser(profile);
        setSpaceWorks(works);

        if (profile.owner) {
          const [ownerInsights, ownerGalaxies, ownerOnboarding] = await Promise.all([
            communityApi.getMyInsights().catch(() => null),
            communityApi.getMyGalaxies().catch(() => [] as GalaxySummary[]),
            communityApi.getOnboarding().catch(() => null),
          ]);
          setInsights(ownerInsights);
          setGalaxies(ownerGalaxies);
          setOnboarding(ownerOnboarding);
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

  const profileHref = user ? `/users/${encodeURIComponent(user.username)}` : "";
  const tabs = useMemo(() => (user ? buildTabs(profileHref, user.username) : []), [profileHref, user]);

  if (error) {
    return (
      <AppShell>
        <main className="xy-profile-loading">
          <Alert variant="destructive">{error}</Alert>
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <main className="xy-profile-loading" aria-busy="true">正在加载个人星域…</main>
      </AppShell>
    );
  }

  const display = user.displayName || user.username;
  const works = spaceWorks?.works ?? [];
  const categories = spaceWorks?.categories ?? [];
  const featuredWorks = works.slice(0, 3);
  const timelineGroups = buildTimelineGroups(works.slice(0, 6));
  const isCreator = works.length > 0 || Boolean(spaceWorks?.owner);
  const identityTags = buildIdentityTags(isCreator, categories);
  const interests = parseInterests(onboarding);
  const skillTags = categories.map((item) => item.name);
  const creationCount = insights?.articleCount ?? works.length;
  const readMetric = formatReadMetric(insights?.likeCount, works.length);

  const shareProfile = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <AppShell>
      <main className="xy-profile-page">
        <header className="xy-profile-banner">
          <div className="xy-profile-banner__cover" aria-hidden="true">
            <img src="/prototype-assets/profile/profile-space.png" alt="" />
          </div>

          <div className="xy-profile-banner__actions">
            {!user.owner ? (
              <FollowButton username={user.username} initialFollowing={user.following} className="xy-profile-action-btn xy-profile-action-btn--primary" />
            ) : (
              <Button asChild className="xy-profile-action-btn xy-profile-action-btn--primary">
                <Link href="/settings/profile">编辑资料</Link>
              </Button>
            )}
            {!user.owner ? (
              <Button variant="outline" asChild className="xy-profile-action-btn">
                <Link href={`/messages/users/${encodeURIComponent(user.username)}`}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  私信
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" type="button" className="xy-profile-action-btn" onClick={() => void shareProfile()}>
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              {copied ? "已复制" : "分享"}
            </Button>
            <Button variant="outline" size="icon" asChild className="xy-profile-action-btn xy-profile-action-btn--icon">
              <Link href={`${profileHref}/works`} aria-label="更多操作">
                <MoreHorizontal className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="xy-profile-banner__content">
            <div className="xy-profile-avatar">
              <ProfileAvatar avatar={user.avatar} display={display} />
            </div>

            <div className="xy-profile-identity">
              <div className="xy-profile-identity__head">
                <div>
                  <h1>{display}</h1>
                  <p className="xy-profile-handle">@{user.username}</p>
                </div>
                {identityTags.length ? (
                  <div className="xy-profile-identity-tags">
                    {identityTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="xy-profile-bio">{user.bio || DEFAULT_BIO}</p>
              {user.websiteUrl ? (
                <a className="xy-profile-link" href={user.websiteUrl} target="_blank" rel="noreferrer">
                  <Link2 aria-hidden="true" />
                  {user.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </div>
          </div>

          <section className="xy-profile-banner__metrics" aria-label="星域数据">
            <StatItem label="创作" value={creationCount} />
            <StatItem label="关注" value={user.followingCount ?? "—"} />
            <StatItem label="阅读" value={readMetric} />
          </section>
        </header>

        <nav className="xy-profile-tabs" aria-label="个人星域导航">
          {tabs.map((tab) =>
            tab.active ? (
              <b key={tab.key} aria-current="page">{tab.label}</b>
            ) : (
              <Link key={tab.key} href={tab.href}>{tab.label}</Link>
            )
          )}
        </nav>

        <div className="xy-profile-grid">
          <div className="xy-profile-main">
            <section className="xy-profile-card xy-profile-featured">
              <SectionHeader title="精选作品" href={`${profileHref}/works`} />
              {featuredWorks.length ? (
                <div className="xy-profile-featured__grid">
                  {featuredWorks.map((work, index) => (
                    <Link href={`/articles/${encodeURIComponent(work.id)}`} key={work.id} className="xy-profile-work-card">
                      <WorkVisual index={index} />
                      <div className="xy-profile-work-card__body">
                        <b>{work.title}</b>
                        <p>{work.categorySlug ? `探索 ${work.categorySlug} 方向的创作` : "来自个人星域的公开作品"}</p>
                        <span className="xy-profile-work-card__meta">
                          <span>文章</span>
                          <span>公开阅读</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection>这片星域还没有公开精选作品。</EmptySection>
              )}
            </section>

            <section className="xy-profile-card" id="profile-timeline">
              <SectionHeader title="最近动态" href={`${profileHref}/works`} linkLabel="查看全部" />
              {timelineGroups.length ? (
                <div className="xy-profile-timeline">
                  {timelineGroups.map((group) => (
                    <section key={group.label} className="xy-profile-timeline__group">
                      <h3>{group.label}</h3>
                      <ol>
                        {group.items.map((item, index) => (
                          <li key={item.id}>
                            <Link href={`/articles/${encodeURIComponent(item.id)}`} className="xy-profile-timeline__item">
                              <WorkVisual index={index} />
                              <div>
                                <small>{item.kind}</small>
                                <b>《{item.title}》</b>
                                <span>{item.categorySlug || "创作空间"}</span>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              ) : (
                <EmptySection>暂无公开动态，创作轨迹将在发布后展示。</EmptySection>
              )}
            </section>
          </div>

          <aside className="xy-profile-aside">
            <section className="xy-profile-card" id="profile-about">
              <h2>关于我</h2>
              <p>{user.bio || DEFAULT_BIO}</p>
            </section>

            <section className="xy-profile-card">
              <h2>技能</h2>
              {skillTags.length ? (
                <div className="xy-profile-tags">
                  {skillTags.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              ) : (
                <EmptySection>暂未标注技能方向。</EmptySection>
              )}
            </section>

            <section className="xy-profile-card">
              <h2>兴趣</h2>
              {interests.length ? (
                <div className="xy-profile-tags xy-profile-tags--soft">
                  {interests.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              ) : (
                <EmptySection>{user.owner ? "完善兴趣，让星域更立体。" : "暂未公开兴趣标签。"}</EmptySection>
              )}
            </section>

            <section className="xy-profile-card">
              <SectionHeader
                title="我的星系"
                href={user.owner ? "/me/galaxies" : "/galaxies"}
                linkLabel={user.owner ? "管理星系" : "探索星系"}
              />
              {galaxies.length ? (
                <ul className="xy-profile-galaxies">
                  {galaxies.slice(0, 4).map((galaxy) => (
                    <li key={galaxy.slug}>
                      <Link href={`/galaxies/${encodeURIComponent(galaxy.slug)}`}>
                        <span className="xy-profile-galaxy-icon" aria-hidden="true">
                          <Orbit />
                        </span>
                        <span>
                          <b>{galaxy.name}</b>
                          <small>{galaxy.memberCount != null ? `${galaxy.memberCount} 位星友` : "共创星系"}</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptySection>{user.owner ? "加入星系，与同好一起探索。" : "暂未公开星系信息。"}</EmptySection>
              )}
            </section>

            <section className="xy-profile-card xy-profile-trail">
              <h2>
                <Sparkles aria-hidden="true" />
                星辰轨迹
              </h2>
              <ul className="xy-profile-trail__list">
                <li>
                  <span>发布文章</span>
                  <b>{creationCount}</b>
                </li>
                <li>
                  <span>获得喜欢</span>
                  <b>{insights?.likeCount ?? "—"}</b>
                </li>
                <li>
                  <span>收到评论</span>
                  <b>{insights?.commentCount ?? "—"}</b>
                </li>
                <li>
                  <span>关注星系</span>
                  <b>{user.followingCount ?? "—"}</b>
                </li>
              </ul>
              {user.owner ? (
                <Link href="/me/insights" className="xy-profile-trail__link">
                  查看完整轨迹
                  <ChevronRight aria-hidden="true" />
                </Link>
              ) : null}
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
