"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { EmptyState } from "@/components/community/empty-state";
import { NotificationItem } from "@/components/community/app-controls";
import { Button } from "@/components/ui/button";
import { communityApi, type NotificationSummary } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    communityApi
      .getNotifications()
      .then(setNotifications)
      .catch(() => {
        setNeedsLogin(true);
        setNotifications([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleRead(item: NotificationSummary) {
    if (item.read) return;
    try {
      const updated = await communityApi.markNotificationRead(item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: updated.read } : n)));
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await communityApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <CompactPageShell
      eyebrow="互动提醒"
      title="通知"
      description="社区互动与系统提醒"
      width="lg"
      actions={
        !needsLogin && unreadCount > 0 ? (
          <Button variant="outline" size="sm" disabled={markingAll} onClick={() => void handleMarkAllRead()}>
            {markingAll ? "处理中…" : "全部已读"}
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : needsLogin ? (
        <EmptyState icon={Bell} title="登录后查看通知" description="通知中心需要登录后才能访问" actionLabel="去登录" actionHref="/login" compact />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="暂无通知" description="当有人关注你、评论或点赞时，通知会出现在这里" compact />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {notifications.map((item) => (
            <li key={item.id}>
              <NotificationItem
                title={item.title}
                body={item.body || ""}
                read={item.read}
                createdAt={formatDateTime(item.createdAt)}
                href={item.targetRoute || "/notifications"}
                onClick={() => void handleRead(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </CompactPageShell>
  );
}
