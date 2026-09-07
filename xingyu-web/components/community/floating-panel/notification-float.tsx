"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Heart, MessageCircle, Megaphone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/community/empty-state";
import { communityApi, type NotificationSummary } from "@/lib/community-api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  FloatingCard,
  FloatingCardBody,
  FloatingCardFooter,
  FloatingCardHeader,
  FloatingTabs,
  HoverFloatRoot,
} from "./floating-card";
import { useHoverOpen } from "./use-hover-open";

type NotificationTab = "all" | "social" | "system";

function notificationIcon(category: string) {
  const normalized = category.toUpperCase();
  if (normalized.includes("LIKE") || normalized.includes("REACTION")) return Heart;
  if (normalized.includes("COMMENT") || normalized.includes("REPLY")) return MessageCircle;
  if (normalized.includes("FOLLOW")) return UserPlus;
  if (normalized.includes("SYSTEM") || normalized.includes("ANNOUNCE")) return Megaphone;
  return Bell;
}

function notificationBucket(category: string): NotificationTab {
  const normalized = category.toUpperCase();
  if (
    normalized.includes("LIKE") ||
    normalized.includes("REACTION") ||
    normalized.includes("COMMENT") ||
    normalized.includes("REPLY") ||
    normalized.includes("FOLLOW") ||
    normalized.includes("MENTION")
  ) {
    return "social";
  }
  if (normalized.includes("SYSTEM") || normalized.includes("ANNOUNCE")) return "system";
  return "social";
}

function categoryLabel(category: string) {
  const normalized = category.toUpperCase();
  if (normalized.includes("LIKE") || normalized.includes("REACTION")) return "点赞";
  if (normalized.includes("COMMENT") || normalized.includes("REPLY")) return "评论";
  if (normalized.includes("FOLLOW")) return "关注";
  if (normalized.includes("SYSTEM")) return "系统";
  if (normalized.includes("ANNOUNCE")) return "公告";
  return "互动";
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationSummary;
  onRead: (item: NotificationSummary) => void;
}) {
  const Icon = notificationIcon(item.category);

  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
        !item.read && "bg-[rgb(var(--violet)/.05)]"
      )}
      onClick={() => onRead(item)}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--violet)/.1)] text-[rgb(var(--violet))]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="mb-1 inline-flex rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {categoryLabel(item.category)}
            </span>
            <strong className="block truncate text-sm font-medium">{item.title}</strong>
          </span>
          <time className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</time>
        </span>
        {item.body ? (
          <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">{item.body}</span>
        ) : null}
      </span>
      {!item.read ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--accent))]" aria-hidden="true" /> : null}
    </button>
  );
}

function NotificationPanelContent({
  onUnreadChange,
}: {
  onUnreadChange?: (count: number) => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");

  useEffect(() => {
    communityApi
      .getNotifications()
      .then((items) => {
        setNotifications(items);
        onUnreadChange?.(items.filter((item) => !item.read).length);
      })
      .catch(() => {
        setNeedsLogin(true);
        setNotifications([]);
        onUnreadChange?.(0);
      })
      .finally(() => setLoading(false));
  }, [onUnreadChange]);

  const filtered = useMemo(() => {
    if (tab === "all") return notifications;
    return notifications.filter((item) => notificationBucket(item.category) === tab);
  }, [notifications, tab]);

  const socialUnread = notifications.filter((item) => !item.read && notificationBucket(item.category) === "social").length;
  const systemUnread = notifications.filter((item) => !item.read && notificationBucket(item.category) === "system").length;

  async function handleRead(item: NotificationSummary) {
    if (!item.read) {
      try {
        const updated = await communityApi.markNotificationRead(item.id);
        setNotifications((prev) => {
          const next = prev.map((n) => (n.id === item.id ? { ...n, read: updated.read } : n));
          onUnreadChange?.(next.filter((n) => !n.read).length);
          return next;
        });
      } catch {
        setNotifications((prev) => {
          const next = prev.map((n) => (n.id === item.id ? { ...n, read: true } : n));
          onUnreadChange?.(next.filter((n) => !n.read).length);
          return next;
        });
      }
    }
    if (item.targetRoute) router.push(item.targetRoute);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await communityApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      onUnreadChange?.(0);
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  if (loading) {
    return (
      <FloatingCard width={400} className="h-[30rem]">
        <FloatingCardHeader title="互动消息" description="加载中…" />
        <FloatingCardBody className="px-4 py-6">
          <p className="text-sm text-muted-foreground">正在获取通知…</p>
        </FloatingCardBody>
      </FloatingCard>
    );
  }

  if (needsLogin) {
    return (
      <FloatingCard width={400} className="h-[24rem]">
        <FloatingCardHeader title="互动消息" />
        <FloatingCardBody className="flex items-center justify-center px-4">
          <EmptyState compact title="登录后查看通知" description="社区互动与系统提醒需要登录" actionLabel="去登录" actionHref="/login" className="border-0 bg-[#f5f3ef]" />
        </FloatingCardBody>
      </FloatingCard>
    );
  }

  return (
    <FloatingCard width={400} className="max-h-[32rem]">
      <FloatingCardHeader
        title="互动消息"
        description={unreadCount > 0 ? `${unreadCount} 条未读` : "点赞、评论、关注与系统通知"}
        actions={
          unreadCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={markingAll} onClick={() => void handleMarkAllRead()}>
              {markingAll ? "处理中…" : "全部已读"}
            </Button>
          ) : undefined
        }
      />
      <FloatingTabs
        value={tab}
        onChange={(id) => setTab(id as NotificationTab)}
        items={[
          { id: "all", label: "全部", count: unreadCount },
          { id: "social", label: "互动", count: socialUnread },
          { id: "system", label: "系统", count: systemUnread },
        ]}
      />
      <FloatingCardBody>
        {filtered.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState
              compact
              icon={Bell}
              title={tab === "all" ? "暂无通知" : "该分类暂无通知"}
              description="互动与系统消息会出现在这里"
              className="border-0 bg-[#f5f3ef]"
            />
          </div>
        ) : (
          <ul>
            {filtered.map((item) => (
              <li key={item.id}>
                <NotificationRow item={item} onRead={(n) => void handleRead(n)} />
              </li>
            ))}
          </ul>
        )}
      </FloatingCardBody>
      <FloatingCardFooter>
        <Link href="/notifications" className="text-xs text-muted-foreground transition-colors hover:text-[rgb(var(--violet))]">
          在通知中心查看全部 →
        </Link>
      </FloatingCardFooter>
    </FloatingCard>
  );
}

export function NotificationFloatTrigger({
  trigger,
}: {
  trigger: (props: { unreadCount: number; open: boolean }) => React.ReactNode;
}) {
  const { open, handleEnter, handleLeave } = useHoverOpen();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    communityApi
      .getNotifications()
      .then((items) => setUnreadCount(items.filter((item) => !item.read).length))
      .catch(() => setUnreadCount(0));
  }, [open]);

  return (
    <HoverFloatRoot
      open={open}
      onEnter={handleEnter}
      onLeave={handleLeave}
      trigger={trigger({ unreadCount, open })}
      panel={open ? <NotificationPanelContent onUnreadChange={setUnreadCount} /> : null}
    />
  );
}
