import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookMarked,
  BookOpen,
  ChartLine,
  Heart,
  MessageCircle,
  PenLine,
  Settings,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InsightsView, ProfileDetail } from "@/lib/community-api";

type MePrototypePageProps = {
  profile: ProfileDetail;
  insights: InsightsView | null;
};

type HubLink = {
  href: string;
  label: string;
  description: string;
};

const hubSections: { title: string; icon: typeof Star; links: HubLink[] }[] = [
  {
    title: "创作与成长",
    icon: PenLine,
    links: [
      { href: "/studio", label: "创作控制台", description: "文章、动态与系列" },
      { href: "/me/insights", label: "创作数据", description: "阅读、互动与粉丝" },
      { href: "/me/growth", label: "成长记录", description: "徽章与待办任务" },
      { href: "/me/badges", label: "我的徽章", description: "社区荣誉与成就" },
    ],
  },
  {
    title: "阅读与收藏",
    icon: BookOpen,
    links: [
      { href: "/me/bookshelf", label: "我的书架", description: "系列与连载收藏" },
      { href: "/me/history", label: "阅读历史", description: "继续未读完的内容" },
      { href: "/me/collections", label: "我的收藏夹", description: "整理喜欢的内容" },
      { href: "/me/likes", label: "我的喜欢", description: "点赞过的文章与动态" },
    ],
  },
  {
    title: "社区互动",
    icon: UsersRound,
    links: [
      { href: "/me/moments", label: "我的动态", description: "发布与互动记录" },
      { href: "/me/comments", label: "我的评论", description: "参与过的讨论" },
      { href: "/me/following", label: "我的关注", description: "关注的创作者" },
      { href: "/me/followers", label: "我的粉丝", description: "关注你的人" },
      { href: "/me/galaxies", label: "我的星系", description: "加入的共创社区" },
      { href: "/me/groups", label: "我的群聊", description: "消息与协作群组" },
    ],
  },
  {
    title: "账户与设置",
    icon: Settings,
    links: [
      { href: "/settings/profile", label: "编辑资料", description: "头像、简介与主页" },
      { href: "/settings", label: "账号设置", description: "安全、通知与隐私" },
      { href: "/reports", label: "我的举报", description: "举报与申诉记录" },
      { href: "/me/requests", label: "入群申请", description: "待处理的群聊邀请" },
    ],
  },
];

function profileInitial(profile: ProfileDetail) {
  return (profile.displayName || profile.username || "星").trim().slice(0, 1).toUpperCase();
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="xy-me-stat">
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

export function MePrototypePage({ profile, insights }: MePrototypePageProps) {
  const displayName = profile.displayName || profile.username;

  return (
    <main className="xy-me-page">
      <section className="xy-me-hero">
        <div className="xy-me-hero-cover" aria-hidden="true">
          <img src="/prototype-assets/profile/profile-space.png" alt="" />
        </div>
        <div className="xy-me-hero-body">
          <div className="xy-me-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt={`${displayName} 的头像`} />
            ) : (
              <span>{profileInitial(profile)}</span>
            )}
          </div>
          <div className="xy-me-identity">
            <div className="xy-me-identity-top">
              <h1>{displayName}</h1>
              <span className="xy-me-badge"><BadgeCheck className="h-3.5 w-3.5" />创作者</span>
            </div>
            <p className="xy-me-handle">@{profile.username}</p>
            <p className="xy-me-bio">{profile.bio || "完善资料，让更多人了解你的创作方向。"}</p>
            <div className="xy-me-actions">
              <Button asChild className="rounded-full bg-[#ec8b35] text-white hover:bg-[#df7d2d]">
                <Link href="/settings/profile">编辑资料</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-[#e7ded3] bg-white/80">
                <Link href={`/users/${profile.username}`}>查看公开主页</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="xy-me-stats">
          <StatCard label="作品" value={insights?.articleCount ?? "—"} />
          <StatCard label="粉丝" value={profile.followerCount ?? insights?.followerCount ?? "—"} />
          <StatCard label="关注" value={profile.followingCount ?? insights?.followingCount ?? "—"} />
          <StatCard label="获赞" value={insights?.likeCount ?? "—"} />
        </div>
      </section>

      <div className="xy-me-layout">
        <div className="xy-me-main">
          {hubSections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="xy-home-source-panel xy-me-section">
                <header className="xy-me-section-head">
                  <h2><Icon className="h-4 w-4 text-[#e58a4a]" aria-hidden="true" />{section.title}</h2>
                </header>
                <nav className="xy-me-link-grid">
                  {section.links.map((link) => (
                    <Link key={link.href} href={link.href} className="xy-me-link-card">
                      <span>
                        <strong>{link.label}</strong>
                        <small>{link.description}</small>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#a4adbf]" aria-hidden="true" />
                    </Link>
                  ))}
                </nav>
              </section>
            );
          })}
        </div>

        <aside className="xy-me-side">
          <section className="xy-home-source-panel xy-me-side-card">
            <h2><Sparkles className="h-4 w-4 text-[#e58a4a]" />快捷入口</h2>
            <div className="xy-me-quick-links">
              <Link href="/studio"><PenLine className="h-4 w-4" />继续创作</Link>
              <Link href="/me/history"><BookMarked className="h-4 w-4" />继续阅读</Link>
              <Link href="/messages"><MessageCircle className="h-4 w-4" />消息中心</Link>
              <Link href="/me/growth"><ChartLine className="h-4 w-4" />成长记录</Link>
            </div>
          </section>

          <section className="xy-home-source-panel xy-me-side-card xy-me-side-highlight">
            <Star className="h-5 w-5 text-[#eaa64e]" aria-hidden="true" />
            <p>完善个人主页与创作标签，让更多人发现你的内容。</p>
            <Link href="/settings/profile">去完善资料 <ArrowRight className="h-3.5 w-3.5" /></Link>
          </section>

          <section className="xy-home-source-panel xy-me-side-card">
            <h2><Heart className="h-4 w-4 text-[#e58a4a]" />社区服务</h2>
            <div className="xy-me-quick-links">
              <Link href="/appeals">申诉与复核</Link>
              <Link href="/feedback/recommendations">推荐反馈</Link>
              <Link href="/help">帮助中心</Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
