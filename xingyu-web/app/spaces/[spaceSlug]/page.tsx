"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  FileText,
  Rss,
  Search,
  Sparkles,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import {
  communityApi,
  type ProfileDetail,
  type SpaceWorks,
} from "@/lib/community-api";

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <span className="xy-space-real-avatar">
      {src ? (
        <img src={src} alt={`${name} 的头像`} />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function WorkArt({ index, large = false }: { index: number; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`xy-space-real-art xy-space-real-art--${index % 5}${large ? " is-large" : ""}`}
    >
      <FileText />
    </span>
  );
}

function SpaceContent() {
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";
  const [space, setSpace] = useState<SpaceWorks | null>(null);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [query, setQuery] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSpace(null);
    setProfile(null);
    setError(null);
    communityApi
      .getSpaceWorks(spaceSlug, category || undefined)
      .then(async (data) => {
        if (!active) return;
        setSpace(data);
        if (data.username) {
          try {
            const detail = await communityApi.getProfile(data.username);
            if (active) setProfile(detail);
          } catch {
            /* 公开主页资料缺失时仍展示空间内容 */
          }
        }
      })
      .catch(() => {
        if (active) setError("创作空间暂时无法加载，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [spaceSlug, category]);

  const works = useMemo(
    () =>
      (space?.works ?? []).filter((work) =>
        work.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, space?.works],
  );
  const featured = works[0];
  const latest = works.slice(featured ? 1 : 0, featured ? 5 : 4);
  const displayName = space?.displayName || space?.username || "创作空间";

  return (
    <AppShell>
      <main className="xy-space-page xy-space-real">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <header className="xy-space-identity">
          <Avatar name={displayName} src={profile?.avatar} />
          <div>
            <h1>
              {displayName}
              <Sparkles />
            </h1>
            <p>{space?.description || "在这里沉淀持续创作的内容。"}</p>
            <Link href={`/spaces/${encodeURIComponent(spaceSlug)}`}>
              <Rss />
              订阅更新（RSS）
            </Link>
          </div>
          <Image
            className="xy-space-writing"
            src="/prototype-assets/creation-space/writing.png"
            alt=""
            aria-hidden="true"
            width={368}
            height={173}
          />
        </header>
        <nav className="xy-space-tabs" aria-label="创作空间内容类型">
          <div>
            {["全部作品", "文章", "系列", "分类"].map((label, index) => (
              <Link
                className={index === 0 ? "active" : ""}
                href={`/spaces/${encodeURIComponent(spaceSlug)}`}
                key={label}
              >
                {label}
              </Link>
            ))}
          </div>
          <label>
            <span className="sr-only">搜索空间作品</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="在本空间内搜索作品"
            />
            <Search />
          </label>
        </nav>
        <div className="xy-space-chips">
          <Link
            className={!category ? "active" : ""}
            href={`/spaces/${encodeURIComponent(spaceSlug)}`}
          >
            全部
          </Link>
          {(space?.categories ?? []).slice(0, showAllCategories ? undefined : 8).map((item) => (
            <Link
              className={category === item.slug ? "active" : ""}
              href={`/spaces/${encodeURIComponent(spaceSlug)}?category=${encodeURIComponent(item.slug)}`}
              key={item.id}
            >
              {item.name}
            </Link>
          ))}
          {(space?.categories?.length ?? 0) > 8 ? (
            <button type="button" onClick={() => setShowAllCategories((value) => !value)}>
              {showAllCategories ? "收起" : "更多"}
              <ChevronDown className={showAllCategories ? "rotate-180" : ""} />
            </button>
          ) : null}
        </div>
        <div className="xy-space-grid">
          <section className="xy-space-featured xy-space-real-featured">
            {featured ? (
              <Link href={`/articles/${encodeURIComponent(featured.id)}`}>
                <WorkArt index={0} large />
                <div>
                  <span>最新作品</span>
                  <h2>{featured.title || "未命名作品"}</h2>
                  <p>
                    {featured.categorySlug
                      ? `分类：${featured.categorySlug}`
                      : "该作品暂未设置分类。"}
                  </p>
                  <small>
                    <FileText /> 文章作品
                  </small>
                </div>
              </Link>
            ) : (
              <div className="xy-space-real-empty">
                <FileText />
                <h2>暂无公开作品</h2>
                <p>作者发布作品后，会在这里展示。</p>
              </div>
            )}
          </section>
          <section className="xy-space-latest">
            <header>
              <h2>最新作品</h2>
              <Link
                href={`/users/${encodeURIComponent(space?.username || spaceSlug)}/works`}
              >
                查看全部 ›
              </Link>
            </header>
            {space === null && !error ? (
              <p className="xy-space-real-loading">正在加载作品…</p>
            ) : null}
            {latest.map((work, index) => (
              <Link
                href={`/articles/${encodeURIComponent(work.id)}`}
                key={work.id}
              >
                <WorkArt index={index + 1} />
                <div>
                  <h3>{work.title || "未命名作品"}</h3>
                  <p>
                    {work.categorySlug
                      ? `收录于 ${work.categorySlug}`
                      : "暂未设置分类"}
                  </p>
                  <small>文章作品</small>
                </div>
                <Bookmark />
              </Link>
            ))}
            {space !== null && !latest.length ? (
              <p className="xy-space-real-loading">暂无更多作品。</p>
            ) : null}
          </section>
          <aside className="xy-space-shelf xy-space-real-categories">
            <h2>作品分类</h2>
            <div className="xy-space-real-category-list">
              {(space?.categories ?? []).map((item, index) => (
                <Link
                  href={`/spaces/${encodeURIComponent(spaceSlug)}?category=${encodeURIComponent(item.slug)}`}
                  key={item.id}
                >
                  <i
                    className={`xy-space-real-category-icon xy-space-real-category-icon--${index % 4}`}
                  >
                    <FileText />
                  </i>
                  <span>{item.name}</span>
                  <small>
                    {
                      works.filter((work) => work.categorySlug === item.slug)
                        .length
                    }{" "}
                    篇
                  </small>
                </Link>
              ))}
              {space !== null && !space.categories.length ? (
                <p>作者暂未创建分类。</p>
              ) : null}
            </div>
            <Link
              href={`/users/${encodeURIComponent(space?.username || spaceSlug)}/works/settings/categories`}
            >
              查看全部分类 ›
            </Link>
          </aside>
        </div>
        <section className="xy-space-series">
          <header>
            <h2>系列作品</h2>
            <Link
              href={`/users/${encodeURIComponent(space?.username || spaceSlug)}/works`}
            >
              查看全部系列 ›
            </Link>
          </header>
          <div className="xy-space-real-series-empty">
            <LayersHint />
            <p>该创作空间暂未提供系列列表。</p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function LayersHint() {
  return (
    <span className="xy-space-real-series-mark">
      <FileText />
      <FileText />
    </span>
  );
}

export default function CreationSpacePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="xy-space-page">加载中…</main>
        </AppShell>
      }
    >
      <SpaceContent />
    </Suspense>
  );
}
