"use client";
import styles from "./article-detail.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { List, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ArticleEngagementActions,
  CommentThread,
  useObjectEngagement,
} from "@/components/community/engagement";
import {
  ArticleAuthorStrip,
  ArticleSidePanel,
} from "@/components/community/article-detail-sidebar";
import { Alert } from "@/components/ui/alert";
import { ApiError, resolveContentCoverUrl, resolveMediaUrl } from "@/lib/api-client";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";
import { extractArticleMedia } from "@/lib/article-media";
import {
  ArticleMarkdownBody,
  extractArticleOutline,
  type ArticleOutlineItem,
} from "@/lib/article-markdown";
import { communityApi, type ArticleDetail, type CommentItem } from "@/lib/community-api";
import { formatPublishDate } from "@/lib/format";

const mapComments = (items: CommentItem[]) =>
  items.map((x) => ({
    id: x.id,
    author: x.authorUsername ?? x.authorId,
    authorUsername: x.authorUsername,
    body: x.body,
    createdAt: new Date(x.createdAt).toLocaleString("zh-CN"),
    parentId: x.parentId,
  }));

function outlineLabel(text: string, index: number) {
  if (!text) return `章节 ${index + 1}`;
  return text.length > 20 ? `${text.slice(0, 20)}…` : text;
}

function estimateReadMinutes(wordCount: number) {
  if (!wordCount) return null;
  return Math.max(1, Math.ceil(wordCount / 400));
}

export default function ArticleReadPage() {
  const params = useParams<{ articleId: string }>();
  const pathname = usePathname();
  const articleId =
    params.articleId ?? pathname.match(/^\/articles\/([^/]+)/)?.[1] ?? "";
  const seriesId = useSearchParams().get("seriesId");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [comments, setComments] = useState<ReturnType<typeof mapComments>>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [activeOutline, setActiveOutline] = useState(0);
  const [readProgress, setReadProgress] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const outlineLockRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const engagement = useObjectEngagement("ARTICLE", articleId, liked, bookmarked, likeCount);

  const loadComments = useCallback(async () => {
    if (!articleId) return;
    setComments(mapComments(await communityApi.getComments("ARTICLE", articleId)));
  }, [articleId]);

  useEffect(() => {
    if (!articleId) return;

    setError(null);
    setArticle(null);
    setComments([]);
    setLikeCount(0);
    setLiked(false);
    setBookmarked(false);

    communityApi
      .getArticle(articleId)
      .then(setArticle)
      .catch((e) =>
        setError(e instanceof ApiError && e.problem.status === 404 ? "文章不存在或无权访问" : "加载失败，请稍后重试")
      );
    communityApi.getLikeCount("ARTICLE", articleId).then((x) => setLikeCount(x.count)).catch(() => undefined);
    Promise.all([
      communityApi.getLikeStatus("ARTICLE", articleId).catch(() => ({ liked: false })),
      communityApi.getBookmarkStatus("ARTICLE", articleId).catch(() => ({ bookmarked: false })),
    ]).then(([a, b]) => {
      setLiked(a.liked);
      setBookmarked(b.bookmarked);
    });
    loadComments().catch(() => undefined);
    if (seriesId) communityApi.recordReadingProgress(seriesId, articleId).catch(() => undefined);
  }, [articleId, loadComments, seriesId]);

  const articleBodyMarkdown = useMemo(
    () => (article?.body ? prepareArticleBodyForRead(article.body).markdown : ""),
    [article?.body],
  );
  const outline = articleBodyMarkdown ? extractArticleOutline(articleBodyMarkdown) : [];
  const coverImage = useMemo(() => {
    if (article?.coverUrl) return resolveMediaUrl(article.coverUrl);
    if (articleBodyMarkdown) {
      const fromBody = extractArticleMedia(articleBodyMarkdown)[0]?.url;
      if (fromBody) return resolveMediaUrl(fromBody);
    }
    if (article?.id) return resolveContentCoverUrl(null, article.id);
    return null;
  }, [article?.coverUrl, article?.id, articleBodyMarkdown]);
  const topicTags = article?.topicSlugs?.length
    ? article.topicSlugs
    : article?.categorySlug
      ? [article.categorySlug]
      : [];
  const contentTags = topicTags.length ? topicTags : [];
  const authorLabel = article?.ownerDisplayName || article?.ownerUsername || "作者";
  const authorAvatar = article?.ownerAvatar;
  const isAuthor = Boolean(article?.owner);

  useEffect(() => {
    setActiveOutline(0);
    setReadProgress(0);
  }, [articleId]);

  const lockOutlineSync = useCallback((durationMs = 900) => {
    outlineLockRef.current = Date.now() + durationMs;
  }, []);

  const handleOutlineClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, item: ArticleOutlineItem, index: number) => {
      event.preventDefault();
      const target = document.getElementById(item.id);
      if (!target) return;

      lockOutlineSync();
      setActiveOutline(index);
      setOutlineOpen(false);
      window.history.replaceState(null, "", `#${item.id}`);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [lockOutlineSync]
  );

  useEffect(() => {
    if (!outline.length) return;

    const sectionIds = outline.map((item) => item.id);
    const scrollOffset = 100;
    let rafId = 0;

    const resolveActiveIndex = () => {
      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter((section): section is HTMLElement => Boolean(section));
      if (!sections.length) return 0;

      let activeIndex = 0;
      for (let i = 0; i < sections.length; i += 1) {
        if (sections[i].getBoundingClientRect().top <= scrollOffset) {
          activeIndex = i;
        } else {
          break;
        }
      }
      return activeIndex;
    };

    const updateProgress = () => {
      const bodyEl = document.querySelector(".xy-article-body");
      if (!bodyEl) return;
      const rect = bodyEl.getBoundingClientRect();
      const total = bodyEl.scrollHeight;
      const viewport = window.innerHeight;
      const scrolled = Math.min(total, Math.max(0, viewport * 0.25 - rect.top));
      setReadProgress(Math.min(100, Math.max(0, Math.round((scrolled / total) * 100))));
    };

    const syncActiveOutline = () => {
      if (Date.now() < outlineLockRef.current) return;
      const index = resolveActiveIndex();
      setActiveOutline((prev) => (prev === index ? prev : index));
      updateProgress();
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncActiveOutline);
    };

    const onScrollEnd = () => {
      outlineLockRef.current = 0;
      syncActiveOutline();
    };

    const syncFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const index = sectionIds.indexOf(hash);
      if (index >= 0) {
        lockOutlineSync();
        setActiveOutline(index);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd, { passive: true });
    window.addEventListener("hashchange", syncFromHash);
    syncActiveOutline();
    syncFromHash();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [article?.id, lockOutlineSync, outline.length]);

  useEffect(() => {
    if (!outlineOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOutlineOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [outlineOpen]);

  if (error) {
    return (
      <AppShell>
        <main className={cn(styles.loading)}>
          <Alert variant="destructive">{error}</Alert>
        </main>
      </AppShell>
    );
  }

  if (!articleId || !article) {
    return (
      <AppShell>
        <main className={cn(styles.loading)}>正在加载文章…</main>
      </AppShell>
    );
  }

  const wordCount = article.body?.length ?? 0;
  const publishedLabel = formatPublishDate(article.publishedAt) ?? "发布日期暂未提供";
  const readMinutes = estimateReadMinutes(wordCount);
  const progressPercent = outline.length
    ? Math.max(readProgress, Math.round(((activeOutline + 1) / outline.length) * 100))
    : readProgress;

  const shareArticle = async () => {
    if (navigator.share) await navigator.share({ title: article.title, url: window.location.href });
    else await navigator.clipboard.writeText(window.location.href);
  };

  const outlineNav = (
    <nav className={cn(styles.outline__nav)} aria-label="文章目录">
      {outline.length ? (
        outline.map((item, index) => (
          <a
            href={`#${item.id}`}
            className={[
              index === activeOutline ? "is-active" : "",
              item.level >= 3 ? "is-nested" : "",
              item.level === 4 ? "is-level-4" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={item.id}
            onClick={(event) => handleOutlineClick(event, item, index)}
          >
            {outlineLabel(item.text, index)}
          </a>
        ))
      ) : (
        <p className={cn(styles.outline__empty)}>目录暂未提供</p>
      )}
    </nav>
  );

  return (
    <AppShell>
      <main className={cn(styles.page)}>
        <div className={cn(styles.rail, styles.railLeft)}>
          <aside className={cn(styles.outline)}>
            <div className={cn(styles.outline__progress)}>
              <div className={cn(styles.outline__progressHead)}>
                <span>阅读进度</span>
                <b>{progressPercent}%</b>
              </div>
              <div className={cn(styles.outline__progressBar)} aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <h2>文章目录</h2>
            {outlineNav}
          </aside>
        </div>

        <article className={cn(styles.main)}>
          <div className={cn(styles.main__inner)}>
            <header className={cn(styles.header)}>
              <div className={cn(styles.header__top)}>
                <div className={cn(styles.breadcrumb)}>
                  <Link href="/">首页</Link>
                  <span aria-hidden="true">›</span>
                  <span>文章</span>
                </div>
                <button
                  type="button"
                  className={cn(styles.outlineTrigger)}
                  onClick={() => setOutlineOpen(true)}
                  aria-expanded={outlineOpen}
                >
                  <List aria-hidden="true" />
                  目录
                </button>
              </div>
              <h1>{article.title}</h1>
              {article.summary ? <p className={cn(styles.lead)}>{article.summary}</p> : null}

              {coverImage ? (
                <figure className={cn(styles.hero)}>
                  <img src={coverImage} alt="" />
                </figure>
              ) : null}
            </header>

            <div className={cn(styles.body)}>
              <ArticleMarkdownBody body={articleBodyMarkdown} />
            </div>

            <ArticleAuthorStrip
              article={article}
              authorLabel={authorLabel}
              authorAvatar={authorAvatar}
              isAuthor={isAuthor}
            />

            <section className={cn(styles.comments)} aria-labelledby="comment-title">
              <h2 id="comment-title">评论（{comments.length}）</h2>
              <CommentThread
                comments={comments}
                objectType="ARTICLE"
                objectId={article.id}
                onPosted={() => void loadComments()}
                hideHeading
                variant="article"
              />
            </section>
          </div>

          {!isAuthor ? (
            <ArticleEngagementActions
              objectType="ARTICLE"
              objectId={article.id}
              onShare={() => void shareArticle()}
              layout="float"
              engagement={engagement}
            />
          ) : null}
        </article>

        <div className={cn(styles.rail, styles.railRight)}>
          <aside className={cn(styles.side)}>
            <ArticleSidePanel
              article={article}
              authorLabel={authorLabel}
              authorAvatar={authorAvatar}
              isAuthor={isAuthor}
              engagement={engagement}
              onShare={shareArticle}
            />

            <section className={cn(styles.sideCard)}>
              <h2>文章信息</h2>
              <dl className={cn(styles.sideMeta)}>
                <div>
                  <dt>发布时间</dt>
                  <dd>{publishedLabel}</dd>
                </div>
                <div>
                  <dt>字数</dt>
                  <dd>{wordCount ? `${wordCount.toLocaleString()} 字` : "暂未提供"}</dd>
                </div>
                {readMinutes ? (
                  <div>
                    <dt>阅读时长</dt>
                    <dd>约 {readMinutes} 分钟</dd>
                  </div>
                ) : null}
                {topicTags.length ? (
                  <div>
                    <dt>所属话题</dt>
                    <dd className={cn(styles.sideMeta__topics)}>
                      {topicTags.map((tag) => (
                        <Link href={`/topics/${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {contentTags.length ? (
              <section className={cn(styles.sideCard)}>
                <h2>内容标签</h2>
                <div className={cn(styles.sideTags)}>
                  {contentTags.map((tag) => (
                    <Link href={`/topics/${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>
                  ))}
                </div>
              </section>
            ) : null}

            {seriesId ? (
              <section className={cn(styles.sideCard)}>
                <h2>相关推荐</h2>
                <Link href={`/series/${encodeURIComponent(seriesId)}`} className={cn(styles.relatedCard)}>
                  <b>继续阅读系列</b>
                  <small>查看本系列更多章节</small>
                </Link>
              </section>
            ) : (
              <section className={cn(styles.sideCard)}>
                <h2>相关推荐</h2>
                <Link href={`/u/${article.ownerUsername}`} className={cn(styles.relatedCard)}>
                  <b>作者更多作品</b>
                  <small>前往 TA 的个人主页</small>
                </Link>
              </section>
            )}

          </aside>
        </div>
      </main>

      {outlineOpen ? (
        <div className={cn(styles.outlineDrawer)} role="dialog" aria-modal="true" aria-label="文章目录">
          <button type="button" className={cn(styles.outlineBackdrop)} aria-label="关闭目录" onClick={() => setOutlineOpen(false)} />
          <aside className={cn(styles.outline, styles.outlineDrawer)}>
            <div className={cn(styles.outline__drawerHead)}>
              <h2>文章目录</h2>
              <button type="button" onClick={() => setOutlineOpen(false)} aria-label="关闭">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className={cn(styles.outline__progress)}>
              <div className={cn(styles.outline__progressHead)}>
                <span>阅读进度</span>
                <b>{progressPercent}%</b>
              </div>
              <div className={cn(styles.outline__progressBar)} aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            {outlineNav}
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}
