"use client";

import Link from "next/link";
import { Bookmark, Check, Flag, Heart, MessageCircle, Send, Share2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { cn } from "@/lib/utils";
import { AddToCollectionButton } from "@/components/community/collection-picker";
import { ConfirmDialog } from "@/components/community/governance-tools";
import styles from "./engagement.module.css";
import shellStyles from "@/components/community/shell-primitives.module.css";

export function FollowButton({
  username,
  initialFollowing = false,
  compact = false,
  profile = false,
  className,
}: {
  username: string;
  initialFollowing?: boolean;
  compact?: boolean;
  profile?: boolean;
  className?: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const pulseOnToggleRef = useRef(false);
  const requestLockRef = useRef(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  useEffect(() => {
    if (!pulseOnToggleRef.current) return;
    pulseOnToggleRef.current = false;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 360);
    return () => window.clearTimeout(timer);
  }, [following]);

  async function follow() {
    if (requestLockRef.current || loading) return;
    requestLockRef.current = true;
    setLoading(true);
    pulseOnToggleRef.current = true;
    setFollowing(true);
    try {
      await communityApi.followUser(username);
    } catch {
      setFollowing(false);
    } finally {
      setLoading(false);
      requestLockRef.current = false;
    }
  }

  async function unfollow() {
    if (requestLockRef.current || loading) return;
    requestLockRef.current = true;
    setLoading(true);
    pulseOnToggleRef.current = true;
    setFollowing(false);
    setConfirmOpen(false);
    try {
      await communityApi.unfollowUser(username);
    } catch {
      setFollowing(true);
    } finally {
      setLoading(false);
      requestLockRef.current = false;
    }
  }

  function handleClick() {
    if (requestLockRef.current || loading) return;
    if (following) {
      setConfirmOpen(true);
      return;
    }
    void follow();
  }

  const label = loading ? "处理中…" : following ? "已关注" : "关注";

  return (
    <>
      <Button
        variant={following ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        disabled={loading}
        onClick={handleClick}
        aria-pressed={following}
        aria-busy={loading}
        data-following={following ? "true" : "false"}
        data-loading={loading ? "true" : "false"}
        data-pulse={pulse ? "true" : "false"}
        className={cn(
          styles.followBtn,
          profile &&
            cn(
              styles.profileActionBtn,
              following ? styles.profileActionBtnFollowing : styles.profileActionBtnPrimary
            ),
          className
        )}
      >
        <span className={styles.followBtnIcon} data-follow-icon aria-hidden="true">
          <UserPlus className={cn(styles.followBtnGlyph, !following && styles.followBtnGlyphActive)} />
          <Check className={cn(styles.followBtnGlyph, following && styles.followBtnGlyphActive)} />
        </span>
        <span className={styles.followBtnLabel} key={label}>{label}</span>
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="取消关注"
        description={`确定不再关注 @${username} 吗？之后将不会在动态里看到 TA 的更新。`}
        confirmLabel={loading ? "处理中…" : "取消关注"}
        destructive
        confirmDisabled={loading}
        onCancel={() => {
          if (loading) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => void unfollow()}
      />
    </>
  );
}

export function useObjectEngagement(
  objectType: string,
  objectId: string,
  initialLiked = false,
  initialBookmarked = false,
  likes = 0
) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(likes);
  const [loading, setLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setBookmarked(initialBookmarked);
    setLikeCount(likes);
  }, [initialLiked, initialBookmarked, likes]);

  useEffect(() => {
    if (!objectId) return;
    Promise.all([
      communityApi.getLikeStatus(objectType, objectId).catch(() => ({ liked: initialLiked })),
      communityApi.getBookmarkStatus(objectType, objectId).catch(() => ({ bookmarked: initialBookmarked })),
    ]).then(([likeStatus, bookmarkStatus]) => {
      setLiked(likeStatus.liked);
      setBookmarked(bookmarkStatus.bookmarked);
    });
  }, [objectType, objectId, initialLiked, initialBookmarked]);

  async function toggleLike() {
    if (!objectId) return;
    setLoading(true);
    try {
      if (liked) {
        await communityApi.unlike(objectType, objectId);
        setLiked(false);
        setLikeCount((count) => Math.max(0, count - 1));
      } else {
        await communityApi.like(objectType, objectId);
        setLiked(true);
        setLikeCount((count) => count + 1);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleBookmark() {
    if (!objectId) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await communityApi.removeBookmark(objectType, objectId);
        setBookmarked(false);
      } else {
        await communityApi.addBookmark(objectType, objectId);
        setBookmarked(true);
      }
    } finally {
      setBookmarkLoading(false);
    }
  }

  return {
    liked,
    likeCount,
    loading,
    bookmarked,
    bookmarkLoading,
    toggleLike,
    toggleBookmark,
  };
}

export function ArticleEngagementActions({
  objectType,
  objectId,
  initialLiked = false,
  initialBookmarked = false,
  likes = 0,
  onShare,
  layout = "vertical",
  className,
  engagement,
}: {
  objectType: string;
  objectId: string;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  likes?: number;
  onShare?: () => void;
  layout?: "vertical" | "float";
  className?: string;
  engagement?: ReturnType<typeof useObjectEngagement>;
}) {
  if (engagement) {
    return (
      <ArticleEngagementActionsView
        engagement={engagement}
        onShare={onShare}
        layout={layout}
        className={className}
      />
    );
  }

  return (
    <ArticleEngagementActionsWithHook
      objectType={objectType}
      objectId={objectId}
      initialLiked={initialLiked}
      initialBookmarked={initialBookmarked}
      likes={likes}
      onShare={onShare}
      layout={layout}
      className={className}
    />
  );
}

function ArticleEngagementActionsWithHook({
  objectType,
  objectId,
  initialLiked = false,
  initialBookmarked = false,
  likes = 0,
  onShare,
  layout = "vertical",
  className,
}: {
  objectType: string;
  objectId: string;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  likes?: number;
  onShare?: () => void;
  layout?: "vertical" | "float";
  className?: string;
}) {
  const engagement = useObjectEngagement(objectType, objectId, initialLiked, initialBookmarked, likes);
  return (
    <ArticleEngagementActionsView
      engagement={engagement}
      onShare={onShare}
      layout={layout}
      className={className}
    />
  );
}

function ArticleEngagementActionsView({
  engagement,
  onShare,
  layout = "vertical",
  className,
}: {
  engagement: ReturnType<typeof useObjectEngagement>;
  onShare?: () => void;
  layout?: "vertical" | "float";
  className?: string;
}) {
  const { liked, likeCount, loading, bookmarked, bookmarkLoading, toggleLike, toggleBookmark } = engagement;

  const rootClass = cn(
    layout === "float" ? "xy-article-float-tools" : "xy-article-side-actions",
    className
  );

  return (
    <div className={rootClass}>
      <button
        type="button"
        className={cn(liked && "is-active")}
        disabled={loading}
        onClick={() => void toggleLike()}
        aria-pressed={liked}
      >
        <Heart className={cn(liked && "fill-current")} aria-hidden="true" />
        <span>{likeCount}</span>
        <small>喜欢</small>
      </button>
      <button
        type="button"
        className={cn(bookmarked && "is-active")}
        disabled={bookmarkLoading}
        onClick={() => void toggleBookmark()}
        aria-pressed={bookmarked}
      >
        <Bookmark className={cn(bookmarked && "fill-current")} aria-hidden="true" />
        <span>{bookmarked ? "已藏" : "收藏"}</span>
        <small>收藏</small>
      </button>
      <button type="button" onClick={() => onShare?.()}>
        <Share2 aria-hidden="true" />
        <span>分享</span>
        <small>分享</small>
      </button>
    </div>
  );
}

export function ReactionBar({
  objectType,
  objectId,
  initialLiked = false,
  initialBookmarked = false,
  likes = 0,
  comments = 0,
  href,
}: {
  objectType: string;
  objectId: string;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  likes?: number;
  comments?: number;
  href?: string;
}) {
  const { liked, likeCount, loading, bookmarked, bookmarkLoading, toggleLike, toggleBookmark } =
    useObjectEngagement(objectType, objectId, initialLiked, initialBookmarked, likes);

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-1.5", liked && "text-[rgb(var(--accent))]")}
        disabled={loading}
        onClick={() => void toggleLike()}
        aria-pressed={liked}
      >
        <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        {likeCount || "喜欢"}
      </Button>
      {href ? (
        <Link
          href={href}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {comments || "评论"}
        </Link>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-1.5", bookmarked && "text-[rgb(var(--accent))]")}
        disabled={bookmarkLoading}
        onClick={() => void toggleBookmark()}
        aria-pressed={bookmarked}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
        {bookmarked ? "已收藏" : "收藏"}
      </Button>
      <AddToCollectionButton objectType={objectType} objectId={objectId} />
    </div>
  );
}

export function ShareSheet({ title, onReport }: { title: string; onReport?: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
  }
  return (
    <div className={cn(shellStyles.panel, "p-4")} role="group" aria-label="分享选项">
      <p className="text-sm font-medium">分享《{title}》</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void copyLink()}>
          <Send className="mr-1.5 h-4 w-4" />
          {copied ? "链接已复制" : "复制链接"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReport}>
          <Flag className="mr-1.5 h-4 w-4" />
          举报
        </Button>
      </div>
    </div>
  );
}

export type CommentItem = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  replyCount?: number;
  parentId?: string | null;
};

export function CommentThread({
  comments,
  objectType,
  objectId,
  onPosted,
  hideHeading = false,
  variant = "default",
}: {
  comments: CommentItem[];
  objectType?: string;
  objectId?: string;
  onPosted?: () => void;
  hideHeading?: boolean;
  variant?: "default" | "article";
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"latest" | "hot">("latest");

  const topLevel = comments.filter((comment) => !comment.parentId);
  const repliesByParent = comments.reduce<Record<string, CommentItem[]>>((acc, comment) => {
    if (!comment.parentId) return acc;
    acc[comment.parentId] = [...(acc[comment.parentId] ?? []), comment];
    return acc;
  }, {});

  const sortedTopLevel = useMemo(() => {
    if (sort === "hot") {
      return [...topLevel].sort(
        (a, b) => (repliesByParent[b.id]?.length ?? 0) - (repliesByParent[a.id]?.length ?? 0)
      );
    }
    return topLevel;
  }, [topLevel, repliesByParent, sort]);

  async function submitComment() {
    if (!objectType || !objectId || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await communityApi.createComment({
        objectType,
        objectId,
        body: body.trim(),
        parentId: replyTo?.id,
      });
      setBody("");
      setReplyTo(null);
      onPosted?.();
    } catch {
      setError("发表评论失败，请确认已登录");
    } finally {
      setSubmitting(false);
    }
  }

  function renderComment(comment: CommentItem, nested = false) {
    const replies = repliesByParent[comment.id] ?? [];
    const itemClass = cn(
      variant === "article" ? styles.commentItem : "border-b border-border pb-5",
      nested && (variant === "article" ? styles.commentItemNested : "ml-6 border-l pl-4")
    );

    return (
      <article className={itemClass} key={comment.id}>
        <div className="flex items-center justify-between gap-3">
          <Link href={`/u/${comment.author}`} className="text-sm font-medium hover:text-[rgb(var(--violet))]">
            {comment.author}
          </Link>
          <time className="text-xs text-muted-foreground">{comment.createdAt}</time>
        </div>
        <p className="mt-2 text-sm leading-6">{comment.body}</p>
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReplyTo(comment);
              setBody(`@${comment.author} `);
            }}
          >
            回复{replies.length ? ` · ${replies.length}` : ""}
          </Button>
        </div>
        {replies.map((reply) => renderComment(reply, true))}
      </article>
    );
  }

  const rootClass = variant === "article" ? styles.commentThread : undefined;

  return (
    <section className={rootClass} aria-labelledby={hideHeading ? undefined : "comment-title"}>
      {!hideHeading ? (
        <h2 id="comment-title" className="text-lg font-semibold">
          讨论
        </h2>
      ) : null}
      {variant === "article" ? (
        <div className={styles.commentSort} role="group" aria-label="评论排序">
          <button
            type="button"
            className={sort === "latest" ? styles.commentSortActive : undefined}
            onClick={() => setSort("latest")}
          >
            最新
          </button>
          <button
            type="button"
            className={sort === "hot" ? styles.commentSortActive : undefined}
            onClick={() => setSort("hot")}
          >
            最热
          </button>
        </div>
      ) : null}
      {objectType && objectId && (
        <div className={cn("mt-4 space-y-2", variant === "article" && styles.commentCompose)}>
          {replyTo && (
            <p className="text-xs text-muted-foreground">
              回复 @{replyTo.author}
              <button type="button" className="ml-2 text-accent hover:underline" onClick={() => setReplyTo(null)}>
                取消
              </button>
            </p>
          )}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={cn(
              "min-h-20 w-full rounded-md border border-border bg-background p-3 text-sm",
              variant === "article" && styles.commentInput
            )}
            placeholder="写下你的想法…"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" disabled={submitting || !body.trim()} onClick={() => void submitComment()}>
            {submitting ? "发送中…" : replyTo ? "发表回复" : "发表评论"}
          </Button>
        </div>
      )}
      <div className={cn("mt-4 space-y-5", variant === "article" && styles.commentList)}>
        {sortedTopLevel.map((comment) => renderComment(comment))}
      </div>
    </section>
  );
}
