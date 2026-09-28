"use client";
import styles from "./badges.module.css";
import { cn } from "@/lib/utils";

import { ChevronRight, CircleCheck, LockKeyhole, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { communityApi, type BadgeView } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

const badgeArtwork = [
  "/prototype-assets/badges/badge-writing.png",
  "/prototype-assets/badges/badge-explorer.png",
  "/prototype-assets/badges/badge-collaboration.png",
  "/prototype-assets/badges/badge-reader.png",
  "/prototype-assets/badges/badge-locked-content.png",
  "/prototype-assets/badges/badge-locked-collaboration.png",
  "/prototype-assets/badges/badge-locked-guide.png",
  "/prototype-assets/badges/badge-locked-builder.png",
];

function BadgeCard({ badge, index }: { badge: BadgeView; index: number }) {
  const locked = !badge.earned;

  return (
    <article className={cn(styles.card, locked && styles.cardLocked)}>
      {locked ? (
        <LockKeyhole aria-label="尚未解锁" className={cn(styles.cardState)} />
      ) : (
        <CircleCheck aria-label="已获得" className={cn(styles.cardState, styles.cardStateEarned)} />
      )}
      <img
        src={badgeArtwork[index % badgeArtwork.length]}
        alt=""
        className={cn(styles.cardArt)}
      />
      <h3>{badge.title}</h3>
      <p>{badge.description || (locked ? "继续参与社区即可解锁这枚徽章" : "已点亮这份星光成就")}</p>
      <span className={cn(styles.cardTag, locked && styles.cardTagLocked)}>
        {locked ? "尚未解锁" : "已获得"}
      </span>
    </article>
  );
}

export default function BadgesPage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getMyBadges(), []);
  const badges = data ?? [];
  const earned = badges.filter((item) => item.earned);

  return (
    <AppShell>
      <main className={cn(styles.badgesPage)}>
        <section className={cn(styles.shell)}>
          <img src="/prototype-assets/badges/header-orbit.png" alt="" className={cn(styles.orbit)} />
          <header className={cn(styles.heading)}>
            <p>个人中心 / 成长记录</p>
            <h1>徽章荣誉</h1>
            <span>记录你的成长轨迹，点亮每一份星光成就</span>
          </header>

          <div className={cn(styles.overview)}>
            <section className={cn(styles.overviewLevel)}>
              <p className={cn(styles.sectionLabel)}>已点亮的徽章</p>
              <div className={cn(styles.levelContent)}>
                <img src="/prototype-assets/badges/level-explorer.png" alt="徽章荣誉" />
                <div>
                  <h2>星语探索者</h2>
                  <strong>{earned.length} 枚</strong>
                  <p>每一次阅读、创作与交流，都会留下成长的轨迹。</p>
                </div>
              </div>
            </section>

            <section className={cn(styles.overviewSummary)}>
              <div>
                <p className={cn(styles.sectionLabel)}>徽章总览</p>
                <Sparkles aria-hidden="true" />
              </div>
              <strong>{earned.length}<small> / {badges.length || "—"}</small></strong>
              <p>已获得徽章</p>
              <div className={cn(styles.summaryLine)} aria-hidden="true"><i /></div>
            </section>

            <section className={cn(styles.overviewMilestone)}>
              <p className={cn(styles.sectionLabel)}>成长里程碑</p>
              <div className={cn(styles.milestoneEmpty)}>
                <Sparkles />
                <p>成长里程碑会随社区贡献自动沉淀</p>
              </div>
            </section>
          </div>

          <section className={cn(styles.collection)}>
            <header>
              <h2>全部徽章</h2>
              <span>已获得 {earned.length} 枚徽章</span>
            </header>

            {loading ? <p className={cn(styles.status)}>正在加载徽章…</p> : null}
            {error ? <p className={cn(styles.status, styles.statusError)}>{error}</p> : null}
            {!loading && !error && badges.length ? (
              <div className={cn(styles.grid)}>
                {badges.map((badge, index) => <BadgeCard badge={badge} index={index} key={badge.id} />)}
              </div>
            ) : null}
            {!loading && !error && badges.length === 0 ? (
              <div className={cn(styles.status)}><Sparkles /><p>还没有可展示的徽章</p><span>继续创作、阅读与参与社区，第一枚徽章将在这里点亮。</span></div>
            ) : null}
          </section>

          <p className={cn(styles.footer)}><Sparkles /> 更多隐藏徽章等待你去发现 <ChevronRight /></p>
        </section>
      </main>
    </AppShell>
  );
}
