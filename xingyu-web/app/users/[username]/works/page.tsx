"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, FileText, FolderOpen, Sparkles, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? <img src={src} alt={`${name} 的头像`} /> : <span>{name.slice(0, 1).toUpperCase()}</span>;
}

function WorkArtwork({ index }: { index: number }) {
  return <span className={`xy-creator-work-art xy-creator-work-art--${index % 4}`} aria-hidden="true"><FileText /></span>;
}

export default function UserWorksPage() {
  const { username } = useParams<{ username: string }>();
  const profileState = useAsyncData(() => communityApi.getProfile(username), [username]);
  const worksState = useAsyncData(() => communityApi.getUserWorks(username), [username]);
  const profile = profileState.data;
  const space = worksState.data;
  const displayName = profile?.displayName || space?.displayName || username;
  const works = space?.works ?? [];
  const categories = space?.categories ?? [];
  const error = profileState.error || worksState.error;

  if (error) return <AppShell><main className="xy-creator-works-loading"><Alert variant="destructive">创作空间不存在或暂未公开</Alert></main></AppShell>;
  if (profileState.loading || worksState.loading || !space) return <AppShell><main className="xy-creator-works-loading">正在加载创作者文章…</main></AppShell>;

  return (
    <AppShell>
      <main className="xy-creator-works-page">
        <div className="xy-creator-works-layout">
          <section>
            <header className="xy-creator-works-hero">
              <div className="xy-creator-works-hero__identity">
                <Avatar name={displayName} src={profile?.avatar} />
                <div><h1>{displayName}</h1><span>星语创作者</span><p>{profile?.bio || space.description || "在星语社区记录创作与思考。"}</p></div>
              </div>
              <div className="xy-creator-works-hero__stats">
                <span><BookOpen /><b>{works.length}</b><small>公开文章</small></span>
                <span><FolderOpen /><b>{categories.length}</b><small>创作分类</small></span>
                <span><UsersRound /><b>{profile?.followerCount ?? "—"}</b><small>粉丝</small></span>
                <span><Sparkles /><b>{profile?.followingCount ?? "—"}</b><small>关注</small></span>
              </div>
            </header>

            <section className="xy-creator-works-list">
              <header><nav><b>全部文章</b><span>系列</span><span>标签</span></nav><span>公开作品 {works.length} 篇</span></header>
              {works.length ? <div>{works.map((work, index) => <Link href={`/articles/${encodeURIComponent(work.id)}`} key={work.id}>
                <WorkArtwork index={index} />
                <div><small>{work.categorySlug || "未分类"}</small><h2>{work.title || "未命名文章"}</h2><p>{work.categorySlug ? `收录于「${work.categorySlug}」分类` : "来自创作空间的公开作品"}</p><span>公开文章</span></div>
              </Link>)}</div> : <p className="xy-creator-works-empty">这位创作者还没有公开文章。</p>}
            </section>
          </section>

          <aside className="xy-creator-works-aside">
            <section>
              <header><h2>公开文章</h2><span>按最近公开排序</span></header>
              {works.length ? <ol>{works.slice(0, 5).map((work, index) => <li key={work.id}><b>{index + 1}</b><Link href={`/articles/${encodeURIComponent(work.id)}`}>{work.title || "未命名文章"}</Link></li>)}</ol> : <p>暂无可展示文章。</p>}
            </section>
            <section>
              <header><h2>创作分类</h2><span>{categories.length} 个分类</span></header>
              {categories.length ? <div className="xy-creator-works-categories">{categories.map((category) => <span key={category.id}>{category.name}</span>)}</div> : <p>暂未设置创作分类。</p>}
            </section>
            <section className="xy-creator-works-rhythm"><h2>创作节奏</h2><div><Sparkles /><p>统计趋势暂未提供</p><span>内容发布频率与时间趋势将在创作统计接口接入后展示。</span></div></section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
