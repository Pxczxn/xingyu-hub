"use client";
import styles from "./user-profile.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Eye, Heart, LayoutGrid, List, Sparkles } from "lucide-react";
import { communityApi, type SpaceWorks } from "@/lib/community-api";
import { hasStoredSession, resolveMediaUrl } from "@/lib/api-client";
import { resolveProfileWorkCover } from "@/lib/paths";
import { formatPublishDate } from "@/lib/format";
import {
  PROFILE_WORKS_VIEW_PREFERENCE_KEY,
  profileWorksViewFromPreference,
  profileWorksViewToPreference,
  readProfileWorksViewMode,
  writeProfileWorksViewMode,
  type ProfileWorksViewMode,
} from "@/lib/profile-works-view";

export type ProfileWorkItem = {
  id: string;
  title: string;
  categorySlug?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  coverUrl?: string | null;
  pinned?: boolean;
  viewCount?: number;
  likeCount?: number;
  bookmarkCount?: number;
};

type ProfileWorksSectionProps = {
  works: SpaceWorks["works"];
  viewMode: ProfileWorksViewMode;
  visible: boolean;
};

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function formatMetric(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return "0";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function formatPublishLabel(publishedAt?: string | null) {
  return formatPublishDate(publishedAt);
}

function normalizeWorks(works: SpaceWorks["works"]): ProfileWorkItem[] {
  return works.map((work) => ({
    id: work.id,
    title: work.title,
    categorySlug: work.categorySlug,
    summary: work.summary ?? null,
    publishedAt: work.publishedAt ?? null,
    coverUrl: work.coverUrl ?? null,
    pinned: Boolean(work.pinned),
    viewCount: work.viewCount ?? 0,
    likeCount: work.likeCount ?? 0,
    bookmarkCount: work.bookmarkCount ?? 0,
  }));
}

function WorkCover({
  index,
  coverUrl,
  className,
}: {
  index: number;
  coverUrl?: string | null;
  className?: string;
}) {
  const src = coverUrl ? resolveMediaUrl(coverUrl) : resolveProfileWorkCover(index);
  return (
    <span className={className ?? cn(styles.workCover)} aria-hidden="true">
      <img src={src} alt="" />
    </span>
  );
}

function WorkMetrics({ work }: { work: ProfileWorkItem }) {
  return (
    <div className={cn(styles.workMetrics)} aria-label="作品数据">
      <span>
        <Eye aria-hidden="true" strokeWidth={2.25} />
        {formatMetric(work.viewCount)}
      </span>
      <span>
        <Heart aria-hidden="true" strokeWidth={2.25} />
        {formatMetric(work.likeCount)}
      </span>
      <span>
        <Bookmark aria-hidden="true" strokeWidth={2.25} />
        {formatMetric(work.bookmarkCount)}
      </span>
    </div>
  );
}

function WorksEmptyState() {
  return (
    <div className={cn(styles.worksEmpty)} role="status">
      <img src="/prototype-assets/profile/profile-space.png" alt="" aria-hidden="true" />
      <Sparkles aria-hidden="true" />
      <h3>还没有作品，从第一篇内容开始</h3>
      <p>写下你的第一篇内容，让它出现在这里。</p>
    </div>
  );
}

function GridWorkCard({ work, index }: { work: ProfileWorkItem; index: number }) {
  const publishedLabel = formatPublishLabel(work.publishedAt);

  return (
    <Link href={`/articles/${encodeURIComponent(work.id)}`} className={cn(styles.workCard)}>
      <WorkCover index={index} coverUrl={work.coverUrl} />
      <div className={cn(styles.workCard__body)}>
        <h3>{work.title}</h3>
        {publishedLabel ? (
          <time className={cn(styles.workMeta)} dateTime={work.publishedAt ?? undefined}>
            {publishedLabel}
          </time>
        ) : null}
        <WorkMetrics work={work} />
      </div>
    </Link>
  );
}

function BannerWorkCard({ work, index }: { work: ProfileWorkItem; index: number }) {
  return (
    <Link href={`/articles/${encodeURIComponent(work.id)}`} className={cn(styles.workBanner)}>
      <WorkCover index={index} coverUrl={work.coverUrl} className={cn(styles.workBanner__cover)} />
      <div className={cn(styles.workBanner__body)}>
        <span className={cn(styles.workBanner__badge)}>置顶</span>
        <h3>{work.title}</h3>
        {work.summary ? <p>{work.summary}</p> : null}
      </div>
    </Link>
  );
}

function ListWorkRow({ work, index }: { work: ProfileWorkItem; index: number }) {
  const publishedLabel = formatPublishLabel(work.publishedAt);

  return (
    <Link
      href={`/articles/${encodeURIComponent(work.id)}`}
      className={cn(styles.workRow, work.pinned && styles.isPinned)}
    >
      <WorkCover index={index} coverUrl={work.coverUrl} className={cn(styles.workRow__thumb)} />
      <div className={cn(styles.workRow__main)}>
        <div className={cn(styles.workRow__copy)}>
          {work.pinned ? <span className={cn(styles.workRow__badge)}>置顶</span> : null}
          <h3>{work.title}</h3>
          {publishedLabel ? (
            <time className={cn(styles.workMeta)} dateTime={work.publishedAt ?? undefined}>
              {publishedLabel}
            </time>
          ) : null}
        </div>
        <div className={cn(styles.workRow__stats)}>
          <WorkMetrics work={work} />
        </div>
      </div>
    </Link>
  );
}

export function ProfileWorksViewToggle({
  mode,
  onChange,
}: {
  mode: ProfileWorksViewMode;
  onChange: (mode: ProfileWorksViewMode) => void;
}) {
  return (
    <div className={cn(styles.viewToggle)} role="group" aria-label="作品视图切换">
      <button
        type="button"
        className={mode === "grid" ? styles.isActive : undefined}
        aria-pressed={mode === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid aria-hidden="true" />
        <span className="sr-only">网格视图</span>
      </button>
      <button
        type="button"
        className={mode === "list" ? styles.isActive : undefined}
        aria-pressed={mode === "list"}
        onClick={() => onChange("list")}
      >
        <List aria-hidden="true" />
        <span className="sr-only">列表视图</span>
      </button>
    </div>
  );
}

export function useProfileWorksViewMode(isOwner: boolean) {
  const isDesktop = useDesktopLayout();
  const [viewMode, setViewMode] = useState<ProfileWorksViewMode>(() => readProfileWorksViewMode());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setViewMode(readProfileWorksViewMode());
  }, []);

  useEffect(() => {
    if (!isOwner || !hasStoredSession()) return;
    communityApi
      .getClientSettings()
      .then((settings) => {
        const fromServer = profileWorksViewFromPreference(settings.preferences?.[PROFILE_WORKS_VIEW_PREFERENCE_KEY]);
        if (fromServer) {
          setViewMode(fromServer);
          writeProfileWorksViewMode(fromServer);
        }
      })
      .catch(() => undefined);
  }, [isOwner]);

  const persistViewMode = useCallback(
    (mode: ProfileWorksViewMode) => {
      writeProfileWorksViewMode(mode);
      if (!isOwner || !hasStoredSession()) return;
      void communityApi
        .getClientSettings()
        .then((settings) =>
          communityApi.updateClientSettings({
            ...settings,
            preferences: {
              ...settings.preferences,
              [PROFILE_WORKS_VIEW_PREFERENCE_KEY]: profileWorksViewToPreference(mode),
            },
          })
        )
        .catch(() => undefined);
    },
    [isOwner]
  );

  const changeViewMode = useCallback(
    (mode: ProfileWorksViewMode) => {
      if (mode === viewMode) return;
      setVisible(false);
      window.setTimeout(() => {
        setViewMode(mode);
        persistViewMode(mode);
        requestAnimationFrame(() => setVisible(true));
      }, 160);
    },
    [persistViewMode, viewMode]
  );

  const effectiveMode: ProfileWorksViewMode = isDesktop ? viewMode : "list";

  return {
    isDesktop,
    viewMode: effectiveMode,
    visible,
    changeViewMode,
  };
}

export function ProfileWorksSection({
  works,
  viewMode,
  visible,
}: {
  works: SpaceWorks["works"];
  viewMode: ProfileWorksViewMode;
  visible: boolean;
}) {
  const items = useMemo(() => normalizeWorks(works), [works]);
  const pinnedWork = items.find((item) => item.pinned);
  const regularWorks = items.filter((item) => !item.pinned);

  if (!items.length) {
    return <WorksEmptyState />;
  }

  if (viewMode === "list") {
    return (
      <div className={cn(styles.worksStage, styles.worksList, visible && styles.isVisible)}>
        {items.map((work, index) => (
          <ListWorkRow work={work} index={index} key={work.id} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(styles.worksStage, styles.worksGrid, visible && styles.isVisible)}>
      {pinnedWork ? <BannerWorkCard work={pinnedWork} index={0} /> : null}
      {regularWorks.length ? (
        <div className={cn(styles.worksGrid__cards)}>
          {regularWorks.map((work, index) => (
            <GridWorkCard work={work} index={index + 1} key={work.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
