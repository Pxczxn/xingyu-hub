"use client";

import Link from "next/link";
import { Bookmark, Flag, Heart, MessageCircle, Send, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { cn } from "@/lib/utils";
import { AddToCollectionButton } from "@/components/community/collection-picker";

export function FollowButton({
  username,
  initialFollowing = false,
  compact = false,
  className,
}: {
  username: string;
  initialFollowing?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      if (following) {
        await communityApi.unfollowUser(username);
        setFollowing(false);
      } else {
        await communityApi.followUser(username);
        setFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={following ? "outline" : "default"}
      size={compact ? "sm" : "default"}
      disabled={loading}
      onClick={() => void toggle()}
      aria-pressed={following}
      className={className}
    >
      <UserPlus className="mr-1.5 h-4 w-4" />
      {loading ? "处理中…" : following ? "已关注" : "关注"}
    </Button>
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
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(likes);
  const [loading, setLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setBookmarked(initialBookmarked);
  }, [initialLiked, initialBookmarked]);

  useEffect(() => {
    Promise.all([
      communityApi.getLikeStatus(objectType, objectId).catch(() => ({ liked: initialLiked })),
      communityApi.getBookmarkStatus(objectType, objectId).catch(() => ({ bookmarked: initialBookmarked })),
    ]).then(([likeStatus, bookmarkStatus]) => {
      setLiked(likeStatus.liked);
      setBookmarked(bookmarkStatus.bookmarked);
    });
  }, [objectType, objectId, initialLiked, initialBookmarked]);

  async function toggleLike() {
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
    <div className="xy-panel p-4" role="group" aria-label="分享选项">
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
}: {
  comments: CommentItem[];
  objectType?: string;
  objectId?: string;
  onPosted?: () => void;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topLevel = comments.filter((comment) => !comment.parentId);
  const repliesByParent = comments.reduce<Record<string, CommentItem[]>>((acc, comment) => {
    if (!comment.parentId) return acc;
    acc[comment.parentId] = [...(acc[comment.parentId] ?? []), comment];
    return acc;
  }, {});

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
    return (
      <article className={cn("border-b border-border pb-5", nested && "ml-6 border-l pl-4")} key={comment.id}>
        <div className="flex items-center justify-between gap-3">
          <Link href={`/users/${comment.author}`} className="text-sm font-medium hover:text-[rgb(var(--violet))]">
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

  return (
    <section aria-labelledby="comment-title">
      <h2 id="comment-title" className="text-lg font-semibold">
        讨论
      </h2>
      {objectType && objectId && (
        <div className="mt-4 space-y-2">
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
            className="min-h-20 w-full rounded-md border border-border bg-background p-3 text-sm"
            placeholder="写下你的想法…"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" disabled={submitting || !body.trim()} onClick={() => void submitComment()}>
            {submitting ? "发送中…" : replyTo ? "发表回复" : "发表评论"}
          </Button>
        </div>
      )}
      <div className="mt-4 space-y-5">
        {topLevel.map((comment) => renderComment(comment))}
      </div>
    </section>
  );
}
