"use client";
import styles from "@/app/articles/[articleId]/article-detail.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Settings2,
  Share2,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ArticleEngagementActions,
  FollowButton,
  useObjectEngagement,
} from "@/components/community/engagement";
import { ReportDialog } from "@/components/community/report-dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { communityApi, type ArticleDetail } from "@/lib/community-api";

type EngagementState = ReturnType<typeof useObjectEngagement>;

export function ArticleAuthorAction({
  isAuthor,
  username,
}: {
  isAuthor: boolean;
  username: string;
}) {
  if (isAuthor) {
    return (
      <Link href={`/u/${username}`} className={cn(styles.profileLink)}>
        <UserRound aria-hidden="true" />
        个人主页
      </Link>
    );
  }

  return <FollowButton username={username} compact />;
}

export function ArticleAuthorStrip({
  article,
  authorLabel,
  authorAvatar,
  isAuthor,
}: {
  article: ArticleDetail;
  authorLabel: string;
  authorAvatar?: string | null;
  isAuthor: boolean;
}) {
  return (
    <section className={cn(styles.authorStrip)} aria-label={isAuthor ? "作者信息" : "关于作者"}>
      <Avatar
        src={authorAvatar}
        fallback={authorLabel}
        size="lg"
        className={cn(styles.authorStrip__avatar, "h-12", "w-12")}
      />
      <div className={cn(styles.authorStrip__copy)}>
        <b>{authorLabel}</b>
        <p>
          {isAuthor
            ? "这是你的作品，可在右侧管理发布与数据。"
            : "关注作者，获取 TA 的最新创作动态"}
        </p>
      </div>
      <ArticleAuthorAction isAuthor={isAuthor} username={article.ownerUsername} />
    </section>
  );
}

export function ArticleSidePanel({
  article,
  authorLabel,
  authorAvatar,
  isAuthor,
  engagement,
  onShare,
}: {
  article: ArticleDetail;
  authorLabel: string;
  authorAvatar?: string | null;
  isAuthor: boolean;
  engagement: EngagementState;
  onShare: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function handleUnpublish() {
    if (!confirm("确定下架这篇文章？下架后仅你自己可见。")) return;
    setPendingAction("unpublish");
    try {
      const draft = await communityApi.getArticleDraft(article.id);
      await communityApi.saveArticleDraft(article.id, {
        title: draft.title || article.title,
        body: draft.body || article.body,
        summary: draft.summary || article.summary || undefined,
        visibility: "PRIVATE",
        lockVersion: draft.lockVersion,
      });
      router.refresh();
    } catch {
      window.alert("下架失败，请稍后重试");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (!confirm("确定将文章移入回收站？")) return;
    setPendingAction("delete");
    try {
      await communityApi.trashArticle(article.id);
      router.push("/studio/content?tab=trash");
    } catch {
      window.alert("删除失败，请稍后重试");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className={cn(styles.sideCard, styles.sideCardActions)}>
      <h2>{isAuthor ? "文章管理" : "文章操作"}</h2>

      {isAuthor ? (
        <>
          <div className={cn(styles.sideManageActions)}>
            <Link href={`/studio/content/${article.id}`}>
              <Pencil aria-hidden="true" />
              <span>编辑文章</span>
              <small>继续创作</small>
            </Link>
            <Link href="/studio/analytics">
              <BarChart3 aria-hidden="true" />
              <span>查看数据</span>
              <small>创作分析</small>
            </Link>
            <button type="button" onClick={() => void onShare()}>
              <Share2 aria-hidden="true" />
              <span>分享</span>
              <small>传播作品</small>
            </button>
          </div>

          <div className={cn(styles.sideAuthor)}>
            <Avatar src={authorAvatar} fallback={authorLabel} size="md" className="h-9 w-9" />
            <div>
              <Link href={`/u/${article.ownerUsername}`}>{authorLabel}</Link>
              <p>创作者</p>
            </div>
            <ArticleAuthorAction isAuthor username={article.ownerUsername} />
          </div>

          <div className="w-full">
            <DropdownMenu className="block w-full">
              <DropdownMenuTrigger className={cn(styles.moreActions)}>
                <MoreHorizontal aria-hidden="true" />
                更多操作
                <ChevronDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="min-w-[9.5rem]">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => router.push(`/studio/content/${article.id}`)}
                >
                  <Settings2 aria-hidden="true" className="h-4 w-4" />
                  发布设置
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  disabled={pendingAction === "unpublish"}
                  onSelect={() => void handleUnpublish()}
                >
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                  下架
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={pendingAction === "delete"}
                  onSelect={() => void handleDelete()}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <>
          <ArticleEngagementActions
            objectType="ARTICLE"
            objectId={article.id}
            onShare={() => void onShare()}
            engagement={engagement}
          />
          <div className={cn(styles.sideAuthor)}>
            <Avatar src={authorAvatar} fallback={authorLabel} size="md" className="h-9 w-9" />
            <div>
              <Link href={`/u/${article.ownerUsername}`}>{authorLabel}</Link>
              <p>创作者</p>
            </div>
            <FollowButton username={article.ownerUsername} compact />
          </div>
          <ReportDialog targetType="ARTICLE" targetId={article.id} />
        </>
      )}
    </section>
  );
}
