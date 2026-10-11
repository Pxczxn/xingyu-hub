import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { GalaxyVisual } from "@/components/visual/GalaxyVisual";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { galaxyKindLabel } from "./galaxy-labels";

/*
 * Shared shell for the three galaxy sub-pages (Phase 2H → Phase 4.3).
 *
 * The galaxy is keyed by `slug` in the URL — the backend has no /galaxies/{id}
 * route, so the slug IS the identifier here. The shell owns the single galaxy
 * fetch so 详情 / 成员 / 内容 all render the same header and load/404 states
 * instead of three drifting copies.
 *
 * Phase 4.3 (Galaxy Identity Contract): the header is the Hero — cover
 * (designed fallback to the deterministic visual), official badge, joinMode
 * hint, description (rendered ONLY when admin wrote one — faking copy would
 * be lying for operations), member count and the viewer-scoped content count.
 * The membership control reads `joined`/`joinMode` straight from the payload;
 * the old listMine full-scan and the join→409→apply probe are gone.
 */

export type GalaxyLoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; galaxy: GalaxySummary };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

const TABS = [
  { key: "overview", label: "星系概览", to: "" },
  { key: "members", label: "成员", to: "/members" },
  { key: "content", label: "内容", to: "/content" },
] as const;

export function useGalaxy(slug: string) {
  const [state, setState] = useState<GalaxyLoadState>({ kind: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!slug) {
      setState({ kind: "unavailable" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    galaxiesApi
      .getBySlug(slug)
      .then((galaxy) => {
        if (active) setState({ kind: "ready", galaxy });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "unavailable" : "error" });
      });
    return () => {
      active = false;
    };
  }, [slug, retryToken]);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);
  return { state, retry };
}

/** Decodes the URL segment; a raw `%` would otherwise throw inside decodeURIComponent. */
export function useGalaxySlug(): string {
  const { slug: raw = "" } = useParams<{ slug: string }>();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function galaxyMemberLabel(memberCount: number): string {
  return memberCount > 0 ? `${memberCount} 位成员` : "暂无成员";
}

type JoinStatus = "idle" | "joining" | "applying" | "joined" | "pending" | "error";

/**
 * Membership state + the join/leave/apply action（Galaxy Identity Contract，
 * 2026-10-10 Phase 4.3）。
 *
 * `joined` 与 `joinMode` 来自详情 payload（GET /galaxies/{slug}），不再做
 * listMine 全量探测与 join→409→apply 猜测：OPEN 一键加入；APPROVAL 直接展示
 * 申请流（附留言输入）。退出沿用 Phase 3 的 DELETE 语义；加入/退出成功后通过
 * `onMembershipChanged`（→ useGalaxy.retry）刷新成员与内容计数。
 */
export function useGalaxyMembership(
  slug: string,
  initialJoined: boolean,
  joinMode: string,
  onMembershipChanged?: () => void,
) {
  const { isAuthenticated } = useAuth();
  const [joined, setJoined] = useState(initialJoined);
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const act = useCallback(async () => {
    setErrorMessage(null);
    if (joinMode === "APPROVAL") {
      setStatus("applying");
      try {
        const request = await galaxiesApi.apply(slug, message.trim() || undefined);
        if (request.status === "APPROVED") {
          setJoined(true);
          setStatus("joined");
          onMembershipChanged?.();
        } else {
          setStatus("pending");
        }
      } catch (err: unknown) {
        setStatus("error");
        setErrorMessage(err instanceof ApiError ? err.problem.detail : "申请失败，请稍后重试。");
      }
      return;
    }
    setStatus("joining");
    try {
      await galaxiesApi.join(slug);
      setJoined(true);
      setStatus("joined");
      onMembershipChanged?.();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof ApiError ? err.problem.detail : "加入失败，请稍后重试。");
    }
  }, [slug, joinMode, message, onMembershipChanged]);

  const onLeave = useCallback(async () => {
    setErrorMessage(null);
    setStatus("joining");
    try {
      await galaxiesApi.leave(slug);
      setJoined(false);
      setStatus("idle");
      onMembershipChanged?.();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof ApiError ? err.problem.detail : "退出失败，请稍后重试。");
    }
  }, [slug, onMembershipChanged]);

  return {
    isAuthenticated,
    joined,
    status,
    errorMessage,
    message,
    setMessage,
    act,
    onLeave,
  };
}

function GalaxyJoinControl({
  galaxy,
  onMembershipChanged,
}: {
  galaxy: GalaxySummary;
  onMembershipChanged?: () => void;
}) {
  const { isAuthenticated, joined, status, errorMessage, message, setMessage, act, onLeave } =
    useGalaxyMembership(galaxy.slug, galaxy.joined === true, galaxy.joinMode, onMembershipChanged);

  if (!isAuthenticated) {
    return (
      <Link
        to={`/login?returnTo=${encodeURIComponent(`/galaxies/${galaxy.slug}`)}`}
        className="text-sm text-accent hover:underline"
      >
        登录后加入星系
      </Link>
    );
  }

  if (joined || status === "joined") {
    return (
      <div className="flex w-full flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">已加入星系</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={status === "joining"}
          onClick={() => {
            void onLeave();
          }}
        >
          {status === "joining" ? "正在退出…" : "退出星系"}
        </Button>
      </div>
    );
  }

  if (status === "pending") {
    return <span className="text-sm text-muted-foreground">申请已提交，等待审核</span>;
  }

  const isApproval = galaxy.joinMode === "APPROVAL";

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          variant="default"
          size="sm"
          disabled={status === "joining" || status === "applying"}
          onClick={() => void act()}
        >
          {status === "joining"
            ? "正在加入…"
            : status === "applying"
              ? "正在提交申请…"
              : isApproval
                ? "申请加入"
                : "加入星系"}
        </Button>
        {isApproval ? (
          <span className="text-xs text-muted-foreground">该星系需审核，提交后等待确认。</span>
        ) : null}
      </div>
      {isApproval ? (
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="申请说明（可选）"
          aria-label="申请说明"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : null}
      {status === "error" && errorMessage ? (
        <span role="alert" className="text-sm text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Renders the loading / 404 / error states and the shared galaxy header.
 * Pages pass their body as `children`, which only mounts once the galaxy
 * resolves — so children may assume a non-null galaxy.
 */
export function GalaxyShell({
  activeTab,
  children,
}: {
  activeTab: (typeof TABS)[number]["key"];
  children: (galaxy: GalaxySummary) => React.ReactNode;
}) {
  const slug = useGalaxySlug();
  const { state, retry } = useGalaxy(slug);

  if (!slug) return <PageState kind="empty" title="星系不存在或尚未公开" />;
  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={retry}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="星系不存在或尚未公开"
          description="它可能已被移除，或链接有误。"
        />
        <p className="text-center">
          <Link to="/galaxies" className="text-sm text-accent hover:underline">
            返回星系广场
          </Link>
        </p>
      </div>
    );
  }

  const { galaxy } = state;

  return (
    <article className="section-gap">
      <header className="surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          {galaxy.coverUrl ? (
            /*
              真实封面（V051）：admin 写了 coverUrl 才渲染 img。
              没有就回退确定性装饰图——两者都有设计感，但不互相冒充。
            */
            <img
              src={galaxy.coverUrl}
              alt={`${galaxy.name} 封面`}
              className="h-20 w-32 shrink-0 rounded-lg border border-border/60 object-cover sm:h-24 sm:w-40"
            />
          ) : (
            <GalaxyVisual stableKey={galaxy.slug} official={galaxy.official} variant="masthead" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {galaxyKindLabel(galaxy.official)}
              {galaxy.joinMode === "APPROVAL" ? " · 需申请加入" : ""}
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-primary sm:text-[28px]">
              {galaxy.name}
            </h1>
            {/*
              简介是 admin 维护的身份字段：没有就什么都不渲染——
              编一段占位文案等于替运营撒谎。
            */}
            {galaxy.description ? (
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                {galaxy.description}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {galaxyMemberLabel(galaxy.memberCount)}
              {typeof galaxy.contentCount === "number" ? ` · ${galaxy.contentCount} 篇内容` : ""}
            </p>
            <div className="mt-3">
              <GalaxyJoinControl galaxy={galaxy} onMembershipChanged={retry} />
            </div>
          </div>
        </div>
      </header>

      <nav aria-label="星系导航" className="flex flex-wrap gap-6 border-b border-border/70">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            to={`/galaxies/${encodeURIComponent(galaxy.slug)}${tab.to}`}
            aria-current={activeTab === tab.key ? "page" : undefined}
            className={cn(
              "focus-ring relative rounded-none px-1 pb-2 text-sm transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-accent after:transition-transform",
              activeTab === tab.key
                ? "font-medium text-primary after:scale-x-100"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children(galaxy)}
    </article>
  );
}
