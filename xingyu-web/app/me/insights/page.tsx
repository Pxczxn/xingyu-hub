"use client";

import Link from "next/link";
import { BarChart3, BookOpen, ChartNoAxesCombined, FileText, Heart, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

type MetricProps = {
  label: string;
  value: number;
  icon: typeof UsersRound;
  description: string;
};

function MetricCard({ label, value, icon: Icon, description }: MetricProps) {
  return (
    <section className="xy-insight-metric">
      <span><Icon /></span>
      <p>{label}</p>
      <strong>{value.toLocaleString()}</strong>
      <small>{description}</small>
    </section>
  );
}

function UnavailableData({ title, description, icon: Icon }: { title: string; description: string; icon: typeof ChartNoAxesCombined }) {
  return (
    <div className="xy-insight-unavailable">
      <Icon />
      <p>{title}</p>
      <span>{description}</span>
    </div>
  );
}

export default function InsightsPage() {
  const profileState = useAsyncData(() => communityApi.getMyProfile(), []);
  const insightsState = useAsyncData(() => communityApi.getMyInsights(), []);
  const articlesState = useAsyncData(() => communityApi.listMyArticles(), []);
  const profile = profileState.data;
  const insights = insightsState.data;
  const articles = articlesState.data ?? [];
  const displayName = profile?.displayName || profile?.username || "创作者";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <main className="xy-insights-page">
        <div className="xy-insights-layout">
          <header className="xy-insights-header">
            <div>
              <p>星语社区</p>
              <h1>创作者数据中心</h1>
              <span>用数据洞察故事的力量</span>
            </div>
            <nav aria-label="数据分区">
              <span className="is-active">数据总览</span>
              <button type="button" disabled>内容分析</button>
              <button type="button" disabled>读者洞察</button>
              <button type="button" disabled>创作助手</button>
            </nav>
          </header>

          {insightsState.loading || profileState.loading ? <p className="xy-insights-status">正在整理创作数据…</p> : null}
          {insightsState.error ? <p className="xy-insights-status xy-insights-status--error">{insightsState.error}</p> : null}
          {!insightsState.loading && !insightsState.error && insights ? (
            <div className="xy-insights-content">
              <aside className="xy-insights-aside">
                <section className="xy-insights-creator">
                  {profile?.avatar ? <img src={profile.avatar} alt={`${displayName} 的头像`} /> : <span>{avatarLetter}</span>}
                  <div>
                    <h2>{displayName}</h2>
                    <p>创作者</p>
                    {profile?.bio ? <small>{profile.bio}</small> : <small>在星语社区记录自己的创作。</small>}
                  </div>
                </section>

                <section className="xy-insights-summary">
                  <header><h2>关键数据总览</h2><span>累计数据</span></header>
                  <MetricCard label="已发布文章" value={insights.articleCount} icon={BookOpen} description="来自创作内容" />
                  <MetricCard label="草稿数量" value={insights.draftCount} icon={FileText} description="等待继续完善" />
                  <MetricCard label="粉丝" value={insights.followerCount} icon={UsersRound} description="关注你的创作" />
                  <MetricCard label="互动总数" value={insights.likeCount + insights.commentCount} icon={Heart} description="喜欢与评论合计" />
                </section>
              </aside>

              <section className="xy-insights-main">
                <div className="xy-insights-top-grid">
                  <section className="xy-insights-panel xy-insights-trend-panel">
                    <header><div><h2>阅读趋势</h2><p><i /> 阅读量与访客趋势</p></div><span>数据统计接口接入后展示</span></header>
                    <UnavailableData title="暂未提供趋势数据" description="当前接口仅返回累计指标，后续将展示按时间聚合的阅读与访客变化。" icon={ChartNoAxesCombined} />
                  </section>
                  <section className="xy-insights-panel xy-insights-interest-panel">
                    <header><h2>读者兴趣分布</h2></header>
                    <UnavailableData title="暂未提供兴趣分布" description="读者兴趣画像需要单独的聚合数据接口。" icon={Sparkles} />
                  </section>
                </div>

                <div className="xy-insights-metrics-row">
                  <MetricCard label="粉丝" value={insights.followerCount} icon={UsersRound} description="累计关注数" />
                  <MetricCard label="已发布文章" value={insights.articleCount} icon={BookOpen} description="内容资产" />
                  <MetricCard label="获得喜欢" value={insights.likeCount} icon={Heart} description="来自社区互动" />
                  <MetricCard label="收到评论" value={insights.commentCount} icon={MessageCircle} description="来自社区互动" />
                </div>

                <div className="xy-insights-bottom-grid">
                  <section className="xy-insights-panel xy-insights-articles-panel">
                    <header><h2>我的内容</h2><Link href="/studio/content">查看内容 <span>›</span></Link></header>
                    {articlesState.loading ? <p className="xy-insights-list-status">正在加载内容…</p> : null}
                    {articlesState.error ? <p className="xy-insights-list-status xy-insights-status--error">{articlesState.error}</p> : null}
                    {!articlesState.loading && !articlesState.error && articles.length ? <ol>
                      {articles.slice(0, 5).map((article, index) => <li key={article.id}>
                        <b>{index + 1}</b>
                        <div><Link href={`/articles/${encodeURIComponent(article.id)}`}>{article.title || "未命名文章"}</Link><span>{article.status}</span></div>
                        <time>{formatDateTime(article.updatedAt)}</time>
                      </li>)}
                    </ol> : null}
                    {!articlesState.loading && !articlesState.error && articles.length === 0 ? <p className="xy-insights-list-status">暂未创建文章。</p> : null}
                  </section>
                  <section className="xy-insights-panel xy-insights-readers-panel">
                    <header><h2>读者画像</h2></header>
                    <UnavailableData title="暂无读者画像数据" description="年龄、地域和兴趣等聚合数据将在统计接口可用后展示。" icon={BarChart3} />
                  </section>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
