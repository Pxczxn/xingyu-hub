"use client";

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
    <article className={`xy-badge-card ${locked ? "xy-badge-card--locked" : ""}`}>
      {locked ? (
        <LockKeyhole aria-label="尚未解锁" className="xy-badge-card__state" />
      ) : (
        <CircleCheck aria-label="已获得" className="xy-badge-card__state xy-badge-card__state--earned" />
      )}
      <img
        src={badgeArtwork[index % badgeArtwork.length]}
        alt=""
        className="xy-badge-card__art"
      />
      <h3>{badge.title}</h3>
      <p>{badge.description || (locked ? "继续参与社区即可解锁这枚徽章" : "已点亮这份星光成就")}</p>
      <span className={locked ? "xy-badge-card__tag xy-badge-card__tag--locked" : "xy-badge-card__tag"}>
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
      <main className="xy-badges-page">
        <section className="xy-badges-shell">
          <img src="/prototype-assets/badges/header-orbit.png" alt="" className="xy-badges-orbit" />
          <header className="xy-badges-heading">
            <p>个人中心 / 成长记录</p>
            <h1>徽章荣誉</h1>
            <span>记录你的成长轨迹，点亮每一份星光成就</span>
          </header>

          <div className="xy-badges-overview">
            <section className="xy-badges-overview__level">
              <p className="xy-badges-section-label">已点亮的徽章</p>
              <div className="xy-badges-level-content">
                <img src="/prototype-assets/badges/level-explorer.png" alt="徽章荣誉" />
                <div>
                  <h2>星语探索者</h2>
                  <strong>{earned.length} 枚</strong>
                  <p>每一次阅读、创作与交流，都会留下成长的轨迹。</p>
                </div>
              </div>
            </section>

            <section className="xy-badges-overview__summary">
              <div>
                <p className="xy-badges-section-label">徽章总览</p>
                <Sparkles aria-hidden="true" />
              </div>
              <strong>{earned.length}<small> / {badges.length || "—"}</small></strong>
              <p>已获得徽章</p>
              <div className="xy-badges-summary-line" aria-hidden="true"><i /></div>
            </section>

            <section className="xy-badges-overview__milestone">
              <p className="xy-badges-section-label">成长里程碑</p>
              <div className="xy-badges-milestone-empty">
                <Sparkles />
                <p>成长里程碑会随社区贡献自动沉淀</p>
              </div>
            </section>
          </div>

          <section className="xy-badges-collection">
            <header>
              <h2>全部徽章</h2>
              <span>已获得 {earned.length} 枚徽章</span>
            </header>

            {loading ? <p className="xy-badges-status">正在加载徽章…</p> : null}
            {error ? <p className="xy-badges-status xy-badges-status--error">{error}</p> : null}
            {!loading && !error && badges.length ? (
              <div className="xy-badges-grid">
                {badges.map((badge, index) => <BadgeCard badge={badge} index={index} key={badge.id} />)}
              </div>
            ) : null}
            {!loading && !error && badges.length === 0 ? (
              <div className="xy-badges-status"><Sparkles /><p>还没有可展示的徽章</p><span>继续创作、阅读与参与社区，第一枚徽章将在这里点亮。</span></div>
            ) : null}
          </section>

          <p className="xy-badges-footer"><Sparkles /> 更多隐藏徽章等待你去发现 <ChevronRight /></p>
        </section>
      </main>
    </AppShell>
  );
}
