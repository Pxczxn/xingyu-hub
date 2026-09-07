"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Bookmark, Eye, Heart, List, MessageCircle, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CommentThread, FollowButton, ReactionBar } from "@/components/community/engagement";
import { ReportDialog } from "@/components/community/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { communityApi, type ArticleDetail, type CommentItem } from "@/lib/community-api";

const mapComments = (items: CommentItem[]) => items.map((x) => ({ id: x.id, author: x.authorUsername ?? x.authorId, authorUsername: x.authorUsername, body: x.body, createdAt: new Date(x.createdAt).toLocaleString("zh-CN"), parentId: x.parentId }));

export default function ArticleReadPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const seriesId = useSearchParams().get("seriesId");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [comments, setComments] = useState<ReturnType<typeof mapComments>>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadComments = useCallback(async () => setComments(mapComments(await communityApi.getComments("ARTICLE", articleId))), [articleId]);
  useEffect(() => {
    communityApi.getArticle(articleId).then(setArticle).catch((e) => setError(e instanceof ApiError && e.problem.status === 404 ? "文章不存在或无权访问" : "加载失败，请稍后重试"));
    communityApi.getLikeCount("ARTICLE", articleId).then((x) => setLikeCount(x.count)).catch(() => undefined);
    Promise.all([communityApi.getLikeStatus("ARTICLE", articleId).catch(() => ({ liked: false })), communityApi.getBookmarkStatus("ARTICLE", articleId).catch(() => ({ bookmarked: false }))]).then(([a, b]) => { setLiked(a.liked); setBookmarked(b.bookmarked); });
    loadComments().catch(() => undefined);
    if (seriesId) communityApi.recordReadingProgress(seriesId, articleId).catch(() => undefined);
  }, [articleId, loadComments, seriesId]);
  if (error) return <AppShell><main className="xy-article-loading"><Alert variant="destructive">{error}</Alert></main></AppShell>;
  if (!article) return <AppShell><main className="xy-article-loading">正在加载文章…</main></AppShell>;
  const paragraphs = (article.body ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const outline = paragraphs.slice(0, 8);
  const wordCount = article.body?.length ?? 0;
  const published = article.publishedAt ? new Date(article.publishedAt).toLocaleString("zh-CN") : "发布日期暂未提供";
  const shareArticle = async () => {
    if (navigator.share) await navigator.share({ title: article.title, url: window.location.href });
    else await navigator.clipboard.writeText(window.location.href);
  };
  return <AppShell><main className="xy-article-page">
    <aside className="xy-article-outline"><h2>文章目录 <List /></h2>{outline.length ? outline.map((text, i) => <a href={`#article-${i + 1}`} className={i === 0 ? "is-active" : ""} key={`${i}-${text}`}>正文段落 {String(i + 1).padStart(2, "0")}</a>) : <p>目录暂未提供</p>}<section><div><b>阅读进度</b><span>阅读记录待同步</span></div><i><span style={{ width: "0%" }} /></i><p>打开文章后记录阅读进度</p><p>{wordCount ? `${wordCount.toLocaleString()} 字` : "字数暂未提供"}</p></section></aside>
    <article className="xy-article-main"><header><div className="xy-article-breadcrumb"><Link href="/">首页</Link> › 文章</div><h1>{article.title}</h1><p>{article.summary || "文章摘要暂未提供"}</p><div className="xy-article-author"><span>{article.ownerUsername.slice(0, 1)}</span><div><Link href={`/users/${article.ownerUsername}`}>{article.ownerUsername}</Link><small>{published}</small></div><aside><Eye />阅读数据暂未提供 <MessageCircle />{comments.length} <Heart />{likeCount}</aside></div><div className="xy-article-tags"><span>文章标签暂未提供</span></div></header><Image src="/prototype-assets/article-detail/night-banner.png" alt="" aria-hidden="true" width={681} height={111} priority />
      {paragraphs.length ? paragraphs.map((text, i) => <section id={`article-${i + 1}`} key={`${i}-${text}`}><h2>正文段落 {String(i + 1).padStart(2, "0")}</h2><p>{text}</p></section>) : <section><h2>正文内容</h2><p>正文内容暂未提供。</p></section>}
      <div className="xy-article-author-card"><div><span>{article.ownerUsername.slice(0, 1)}</span><p><b>关于作者</b><strong>{article.ownerUsername}</strong><small>作者资料暂未提供</small></p></div><FollowButton username={article.ownerUsername} /></div><div id="article-reactions" className="xy-article-reactions"><ReactionBar objectType="ARTICLE" objectId={article.id} initialLiked={liked} initialBookmarked={bookmarked} likes={likeCount} comments={comments.length} href="#comment-title" /></div><section className="xy-article-comments"><h2 id="comment-title">评论（{comments.length}）</h2><CommentThread comments={comments} objectType="ARTICLE" objectId={article.id} onPosted={() => void loadComments()} /></section>
    </article>
    <aside className="xy-article-side"><section><h2>文章操作</h2><div className="xy-article-actions"><a href="#article-reactions"><Heart />喜欢<small>{likeCount}</small></a><a href="#article-reactions"><Bookmark />收藏<small>{bookmarked ? "已收藏" : ""}</small></a><button type="button" onClick={() => void shareArticle()}><Share2 />分享</button><FollowButton username={article.ownerUsername} /></div><ReportDialog targetType="ARTICLE" targetId={article.id} /></section><section><h2>文章信息</h2><div><span>发布日期</span><b>{published}</b></div><div><span>字数统计</span><b>{wordCount ? `${wordCount.toLocaleString()} 字` : "暂未提供"}</b></div><div><span>阅读时长</span><b>暂未提供</b></div><div><span>所属系列</span><b>暂未提供</b></div></section><section><h2>文章内容标签</h2><div className="xy-article-side-tags"><span>文章标签暂未提供</span></div></section>{article.owner && <section><h2>作者操作</h2><Link href={`/studio/articles/${article.id}/edit`}>编辑文章</Link><Link href={`/studio/articles/${article.id}/submit`}>提交审核</Link></section>}</aside>
  </main></AppShell>;
}
