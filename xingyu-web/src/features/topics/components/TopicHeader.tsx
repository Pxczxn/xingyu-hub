import type { TopicSummary } from "@/api/topics/topics.types";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { Link, useLocation } from "react-router-dom";
import { buildLoginPath } from "@/features/auth/login-return-path";

/*
 * Topic identity header — the SK6 page's H=线 masthead.
 *
 * 2026-11-10（阶段三 · 批次 A）—— 从「带卡面的 sticky 卡片」改成无面 masthead：
 *
 *   1. 原来这里手写 `<h1 className="text-2xl font-semibold …">`，是 A §4 点名的
 *      「30 处手写页标题」之一。现在标题来自 `PageMasthead`（H=线的统一页头变体），
 *      页面不再自己定标题样式，也不会出现第二个 `text-2xl` 级标题。
 *   2. 卡面（`rounded-lg border bg-card`）与这里 H=线 的取值是矛盾的：线式页头
 *      无卡片、无边框，标题直接贴在内容列左缘，与下面的行式内容读成同一列。
 *   3. 原来的 `lg:sticky lg:top-24 lg:z-20` 一并去掉：它需要卡面/不透明底才能在
 *      内容滚动时不糊在一起，而「线」本身就是透明的；同时那是个字面量 z-index
 *      （本批规则不许新增/保留裸 z-index）。
 *
 * 行为未变：关注按钮、游客登录引导、游客 `following === null` 时不渲染切换按钮、
 * 计数的乐观更新（counts 由页面传入的 `topic` 派生，页面负责改数）都原样保留。
 * 计数仍渲染成**一个文本节点**（`3 篇内容 · 12 关注`），而不是拆成多个内联 span：
 * 拆开后同一句话会在无障碍树与测试查询里各出现一次。
 */
export function TopicHeader({
  topic,
  isAuthenticated = false,
  following = null,
  followPending = false,
  onToggleFollow,
}: {
  topic: TopicSummary;
  isAuthenticated?: boolean;
  /** null = signed out or state unknown（游客不渲染切换按钮，只给登录引导） */
  following?: boolean | null;
  followPending?: boolean;
  onToggleFollow?: () => void;
}) {
  const location = useLocation();
  const counts = [
    topic.contentCount !== undefined ? `${topic.contentCount} 篇内容` : null,
    topic.followerCount && topic.followerCount > 0 ? `${topic.followerCount} 关注` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /*
   * 关注控件（`actions` 槽）。签名一个字符都没改：登录且状态已知 → 切换按钮；
   * 游客 → 登录引导；已登录但 `following === null`（服务端没给状态）→ 什么都不给，
   * 因为一个首次点击需要猜当前状态的按钮就是一句假话。
   */
  const followControl =
    isAuthenticated && following !== null && onToggleFollow ? (
      <Button
        type="button"
        variant={following ? "secondary" : "default"}
        size="sm"
        disabled={followPending}
        onClick={onToggleFollow}
        aria-pressed={following}
      >
        {following ? "已关注" : "关注"}
      </Button>
    ) : !isAuthenticated ? (
      <Link
        to={buildLoginPath(`${location.pathname}${location.search}`)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        登录后关注
      </Link>
    ) : null;

  return (
    <div className="flex flex-col gap-2">
      <PageMasthead
        eyebrow="话题"
        title={topic.name}
        description={topic.description}
        actions={followControl}
      />
      {/*
        计数是这一页的实质（话题里有多少内容、多少人关注），所以用 `text-meta`
        + `foreground-soft` 这个可读档，而不是 12px 灰。它属于页头之下的一行事实，
        不是第二个标题。
      */}
      {counts ? <p className="text-meta text-foreground-soft">{counts}</p> : null}
    </div>
  );
}
