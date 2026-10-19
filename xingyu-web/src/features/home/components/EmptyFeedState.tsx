import { Link } from "react-router-dom";
import { Compass, Hash, Users, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * EmptyFeedState — 首页空状态增强版
 *
 * 设计原则：
 * 1. 明确告知为什么是空的
 * 2. 提供清晰的行动建议
 * 3. 视觉友好，避免让用户感到挫败
 * 4. 根据用户状态（访客/登录）差异化展示
 */

type EmptyStateVariant = "recommend" | "following-guest" | "following-empty";

interface EmptyFeedStateProps {
  variant: EmptyStateVariant;
  className?: string;
}

const CONTENT: Record<
  EmptyStateVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    actions: Array<{
      label: string;
      to: string;
      variant: "primary" | "secondary";
      icon?: React.ComponentType<{ className?: string }>;
    }>;
  }
> = {
  recommend: {
    icon: Sparkles,
    title: "暂无推荐内容",
    description: "我们正在为你准备个性化推荐。先去探索你感兴趣的话题吧！",
    actions: [
      { label: "探索话题", to: "/topics", variant: "primary", icon: Hash },
      { label: "浏览全部内容", to: "/discover", variant: "secondary", icon: Compass },
    ],
  },
  "following-guest": {
    icon: Users,
    title: "登录后可见关注动态",
    description: "关注感兴趣的创作者，第一时间获取他们的最新内容。",
    actions: [
      { label: "登录", to: "/login", variant: "primary" },
      { label: "探索创作者", to: "/creators", variant: "secondary", icon: Users },
    ],
  },
  "following-empty": {
    icon: Users,
    title: "还没有关注动态",
    description: "关注创作者后，他们的最新内容会出现在这里。",
    actions: [
      { label: "探索创作者", to: "/creators", variant: "primary", icon: Users },
      { label: "浏览推荐内容", to: "/discover", variant: "secondary", icon: Compass },
    ],
  },
};

export function EmptyFeedState({ variant, className }: EmptyFeedStateProps) {
  const content = CONTENT[variant];
  const Icon = content.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card px-6 py-16 text-center shadow-sm",
        className,
      )}
    >
      {/* 图标装饰 */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
        <Icon className="h-10 w-10 text-accent-strong" aria-hidden />
      </div>

      {/* 标题 */}
      <h3 className="mb-2 text-lg font-semibold text-foreground">{content.title}</h3>

      {/* 描述 */}
      <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        {content.description}
      </p>

      {/* 行动建议 */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {content.actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className={cn(
                buttonVariants({
                  variant: action.variant === "primary" ? "accent" : "outline",
                  size: "default",
                }),
                "gap-2",
              )}
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" aria-hidden />}
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
