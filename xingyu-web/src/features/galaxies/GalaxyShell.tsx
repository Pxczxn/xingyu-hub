import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { galaxyKindLabel } from "./galaxy-labels";

/*
 * Shared shell for the three galaxy sub-pages (Phase 2H).
 *
 * The galaxy is keyed by `slug` in the URL — the backend has no /galaxies/{id}
 * route, so the slug IS the identifier here. The shell owns the single galaxy
 * fetch so 详情 / 成员 / 内容 all render the same header and load/404 states
 * instead of three drifting copies.
 *
 * Why the load state is a discriminated union rather than three booleans:
 * "ready but the galaxy is null" must be impossible, and the 404 case must be
 * distinguishable from a transport failure (the former is a real answer, the
 * latter deserves a retry).
 */

export type GalaxyLoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; galaxy: GalaxySummary };

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND");
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

type JoinStatus = "idle" | "joining" | "applying" | "joined" | "pending" | "error";

/**
 * Membership state + the join/apply action.
 *
 * `joinMode` is not exposed by the API, so the flow is discovery-based: try
 * POST /join, and on 409 CONFLICT fall back to POST /apply (which either files
 * a pending request or, on a galaxy that actually allowed joining, silently
 * succeeds).
 *
 * `listMine` is best-effort: a guest or a failed call just leaves the button
 * visible. Joining an already-joined galaxy is idempotent server-side, so a
 * stale "加入星系" label costs nothing.
 *
 * Phase 3I note: `listMine` now has a SECOND consumer — `MyGalaxiesPage`
 * (`/me/galaxies`). That page is the authority on "which ones did I join"; this
 * hook still only uses the call to decide one button's label, so it must stay
 * tolerant of a failure rather than propagating one.
 */
export function useGalaxyMembership(slug: string) {
  const { isAuthenticated } = useAuth();
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setJoined(false);
    setStatus("idle");
    setErrorMessage(null);
    if (!isAuthenticated || !slug) return;
    galaxiesApi
      .listMine()
      .then((mine) => {
        if (active && mine.some((item) => item.slug === slug)) setJoined(true);
      })
      .catch(() => {
        /* Best-effort: an unknown membership state just shows the join button. */
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, slug]);

  const act = useCallback(async () => {
    setErrorMessage(null);
    setStatus("joining");
    try {
      await galaxiesApi.join(slug);
      setJoined(true);
      setStatus("joined");
      return;
    } catch (err: unknown) {
      const needsApproval =
        err instanceof ApiError && (err.problem.status === 409 || err.problem.code === "CONFLICT");
      if (!needsApproval) {
        setStatus("error");
        setErrorMessage(err instanceof ApiError ? err.problem.detail : "加入失败，请稍后重试。");
        return;
      }
    }
    setStatus("applying");
    try {
      const request = await galaxiesApi.apply(slug, message.trim() || undefined);
      if (request.status === "APPROVED") {
        setJoined(true);
        setStatus("joined");
      } else {
        setStatus("pending");
      }
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof ApiError ? err.problem.detail : "申请失败，请稍后重试。");
    }
  }, [slug, message]);

  return { isAuthenticated, joined, status, errorMessage, message, setMessage, act };
}

function GalaxyJoinControl({ slug }: { slug: string }) {
  const { isAuthenticated, joined, status, errorMessage, message, setMessage, act } =
    useGalaxyMembership(slug);

  if (!isAuthenticated) {
    return (
      <Link to={`/login?returnTo=${encodeURIComponent(`/galaxies/${slug}`)}`} className="text-sm text-accent hover:underline">
        登录后加入星系
      </Link>
    );
  }

  if (joined || status === "joined") {
    return <span className="text-sm text-muted-foreground">已加入星系</span>;
  }

  if (status === "pending") {
    return <span className="text-sm text-muted-foreground">申请已提交，等待审核</span>;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" disabled={status === "joining" || status === "applying"} onClick={() => void act()}>
          {status === "joining" ? "正在加入…" : status === "applying" ? "正在提交申请…" : "加入星系"}
        </Button>
        <span className="text-xs text-muted-foreground">若该星系需要审核，将转为提交申请。</span>
      </div>
      {status === "applying" ? (
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
        <PageState kind="empty" title="星系不存在或尚未公开" description="它可能已被移除，或链接有误。" />
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
      <header className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {galaxyKindLabel(galaxy.official)}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-primary">{galaxy.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{`${galaxy.memberCount} 位成员`}</p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[16rem]">
            <GalaxyJoinControl slug={galaxy.slug} />
          </div>
        </div>
      </header>

      <nav aria-label="星系导航" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            to={`/galaxies/${encodeURIComponent(galaxy.slug)}${tab.to}`}
            aria-current={activeTab === tab.key ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              activeTab === tab.key
                ? "border-accent bg-accent/10 font-medium text-accent"
                : "border-border text-muted-foreground hover:bg-muted",
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

