"use client";

import Link from "next/link";
import { Bell, Bookmark, Compass, FolderHeart, Heart, LibraryBig, Plus, Sparkles, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function ProfileAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
  if (avatar) return <img src={avatar} alt={`${name} 的头像`} />;
  return <span className="xy-public-avatar-fallback">{name.slice(0, 1).toUpperCase()}</span>;
}

export default function PublicCollectionsPage() {
  const profileState = useAsyncData(() => communityApi.getMyProfile(), []);
  const collectionsState = useAsyncData(() => communityApi.getCollections(), []);
  const insightsState = useAsyncData(() => communityApi.getMyInsights(), []);
  const profile = profileState.data;
  const collections = collectionsState.data ?? [];
  const insights = insightsState.data;
  const displayName = profile?.displayName || profile?.username || "我的收藏";
  const publicCollections = collections.filter((item) => item.visibility?.toUpperCase() === "PUBLIC");

  return (
    <AppShell>
      <main className="xy-public-collections">
        <aside className="xy-collection-rail" aria-label="收藏导航">
          <b><Sparkles /> 星语社区</b>
          <nav>
            <Link href="/discover"><Compass />发现</Link>
            <Link href="/me/following"><UserRound />关注</Link>
            <Link href="/me/collections"><Bookmark />收藏</Link>
            <Link className="active" href="/collections/public"><FolderHeart />公开收藏</Link>
          </nav>
          <Link href="/studio" className="xy-collection-create"><Sparkles /> 创作中心</Link>
        </aside>

        <section className="xy-public-content">
          <header className="xy-public-profile">
            <ProfileAvatar name={displayName} avatar={profile?.avatar} />
            <div>
              <p><strong>{displayName}</strong><span>创作者</span></p>
              <h1>{profile?.bio || "在知识的星海里，记录与分享我的探索轨迹。"}</h1>
              <div><span>公开展示的收藏内容</span><span>由我整理与维护</span></div>
            </div>
            <blockquote>把值得反复阅读的内容，整理成可以分享的知识地图。</blockquote>
          </header>

          <section className="xy-public-stats">
            <div><FolderHeart /><span>公开收藏夹<b>{publicCollections.length}</b></span></div>
            <div><Bookmark /><span>收藏内容<b>{collections.reduce((sum, item) => sum + (item.itemCount ?? 0), 0)}</b></span></div>
            <div><LibraryBig /><span>已发布文章<b>{insights?.articleCount ?? "—"}</b></span></div>
            <div><UserRound /><span>关注中<b>{insights?.followingCount ?? "—"}</b></span></div>
            <div><Heart /><span>获得喜欢<b>{insights?.likeCount ?? "—"}</b></span></div>
            <p><Link href="/me/collections"><Plus />管理收藏</Link><button type="button" disabled><Bell />订阅更新暂未开放</button></p>
          </section>

          <header className="xy-public-heading">
            <div><h2>公开收藏</h2><p>仅展示你选择公开的收藏夹，其他用户可通过个人主页访问。</p></div>
            <nav><b>最新更新</b><span>公开 {publicCollections.length} 个</span></nav>
          </header>

          {collectionsState.loading ? <p className="xy-public-status">正在加载公开收藏夹…</p> : null}
          {collectionsState.error ? <p className="xy-public-status xy-public-status--error">{collectionsState.error}</p> : null}
          {!collectionsState.loading && !collectionsState.error && publicCollections.length ? (
            <section className="xy-public-grid xy-public-grid--data">
              {publicCollections.map((collection, index) => <Link href={`/collections/${encodeURIComponent(collection.id)}`} key={collection.id}>
                <div className={`xy-public-collection-art xy-public-collection-art--${index % 4}`}><FolderHeart /></div>
                <div><span>公开收藏夹</span><h3>{collection.title}</h3><p>{collection.itemCount ?? 0} 条内容已收录，持续由创作者整理。</p><small>公开可见</small><i>→</i></div>
              </Link>)}
            </section>
          ) : null}
          {!collectionsState.loading && !collectionsState.error && publicCollections.length === 0 ? <section className="xy-public-empty"><FolderHeart /><h3>还没有公开收藏夹</h3><p>前往“我的收藏夹”将一个收藏夹设为公开后，它会出现在这里。</p><Link href="/me/collections">管理收藏夹</Link></section> : null}

          <blockquote className="xy-public-quote">“　收藏不是占有，是把值得回看的内容留在自己的星图里。　”</blockquote>
        </section>
      </main>
    </AppShell>
  );
}
