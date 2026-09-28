"use client";
import styles from "./studio-hub.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { ArrowRight, Bell, HelpCircle, Lightbulb, Megaphone, Sparkles } from "lucide-react";
import type { AnnouncementSummary } from "@/lib/community-api";
import { formatStudioDate } from "@/lib/format";

type Props = {
  announcements: AnnouncementSummary[];
  loading: boolean;
};

const HELP_LINKS = [
  { href: "/guide", label: "创作指南" },
  { href: "/events/future-book/rules", label: "社区规则" },
  { href: "/help", label: "常见问题" },
  { href: "/help", label: "联系支持" },
] as const;

const ANNOUNCE_ICONS = [Megaphone, Bell, Sparkles] as const;

function StudioHubAnnouncements({ announcements, loading }: Pick<Props, "announcements" | "loading">) {
  return (
    <section className={cn(styles.announce)} aria-labelledby="studio-hub-announce-title">
      <header className={cn(styles.announceHead)}>
        <h2 id="studio-hub-announce-title">
          <Megaphone aria-hidden="true" />
          星语公告
        </h2>
        <Link href="/announcements" className={cn(styles.announceAll)}>
          全部 <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      {loading ? (
        <div className={cn(styles.announcePanel, styles.skeleton)} aria-busy="true" aria-label="正在加载公告">
          <span className={cn(styles.skeletonLine)} />
          <span className={cn(styles.skeletonLine, "short")} />
        </div>
      ) : announcements.length ? (
        <ul className={cn(styles.announceList)}>
          {announcements.slice(0, 3).map((item, index) => {
            const Icon = ANNOUNCE_ICONS[index % ANNOUNCE_ICONS.length];
            const excerpt = (item.body || item.title || "").trim();
            return (
              <li key={item.id}>
                <Link href={`/announcements/${encodeURIComponent(item.id)}`} className={cn(styles.announceItem)}>
                  <span className={cn(styles.announceItemIcon)} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className={cn(styles.announceItemCopy)}>
                    <strong>{item.title || "社区公告"}</strong>
                    {excerpt ? <p>{excerpt}</p> : null}
                    {item.publishedAt ? (
                      <time dateTime={item.publishedAt}>{formatStudioDate(item.publishedAt)}</time>
                    ) : null}
                  </span>
                  <ArrowRight className={cn(styles.announceItemArrow)} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={cn(styles.announcePanel, styles.announceEmpty)} role="status">
          <span className={cn(styles.announceEmptyIcon)} aria-hidden="true">
            <Megaphone />
          </span>
          <p className={cn(styles.announceEmptyTitle)}>暂无公告</p>
          <p className={cn(styles.announceEmptyDesc)}>社区更新与重要通知会发布在这里。</p>
          <Link href="/announcements" className={cn(styles.announceEmptyLink)}>
            前往公告中心 <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

export function StudioHubAside({ announcements, loading }: Props) {
  return (
    <aside className={cn(styles.aside)} aria-label="创作辅助信息">
      <StudioHubAnnouncements announcements={announcements} loading={loading} />

      <section className={cn(styles.asideBlock)}>
        <h2>
          <Lightbulb aria-hidden="true" />
          创作提示
        </h2>
        <article className={cn(styles.asideCard)}>
          <p>利用「系列」把零散文章组织为持续阅读的主题。</p>
          <Link href="/studio/series">
            了解系列 <ArrowRight aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className={cn(styles.asideBlock)}>
        <h2>
          <HelpCircle aria-hidden="true" />
          帮助
        </h2>
        <ul className={cn(styles.helpList)}>
          {HELP_LINKS.map((link) => (
            <li key={link.label}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
