import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { ApiError } from "@/api/client";
import { explorationApi } from "@/api/exploration/exploration.api";
import type { ExploreDomain } from "@/api/exploration/exploration.types";
import { MAX_CUSTOM_LABELS, MAX_CUSTOM_LABEL_LENGTH } from "@/api/exploration/exploration.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  addLabel,
  flattenSelectableDomains,
  isDirty,
  personalLabels,
  removeLabel,
  selectedOfficialIds,
  toggleId,
} from "../exploration-interests";

/*
 * /me/interests — 我的探索 (Phase 3D)
 *
 * WHAT THIS PAGE WRITES: the caller's OWN exploration preferences. Two halves —
 * official domains (leaves of the tree from `/explore/map`) and personal labels
 * the user mints. The server materializes a personal label as a `PERSONAL`
 * `ExploreDomain` row owned by the user (`ExplorationService:174-184`), so the
 * label list is not a client-side conceit — it is a real record.
 *
 * ⚠️ THE WRITE IS A DESTRUCTIVE FULL REPLACEMENT. `updateUserExploration`
 *   deletes EVERY `user_explore_domain` link row for the user, then re-inserts
 *   from the payload; personal domains whose name is absent from
 *   `customLabels` are ARCHIVED (`ExplorationService:142-168`). Consequences
 *   the UI must honour:
 *     - we always send the COMPLETE state, never a delta;
 *     - we skip the PUT entirely when nothing changed (`isDirty`), so merely
 *       pressing 保存 cannot archive-and-recreate the user's rows;
 *     - we refresh from the response, because the server is the source of truth
 *       for the resulting ids (a re-minted personal label has a NEW id).
 *
 * ⚠️ `GET /explore/me` RETURNS 500 FOR A GUEST — a backend defect, not a
 *   "needs login" state. `CommunityExploreController:56` declares
 *   `@RequestHeader("satoken")` without `required = false`, so Spring throws
 *   `MissingRequestHeaderException` before the handler's own `requireUser()`
 *   (which DOES map to 401) can run; it falls through to the catch-all and
 *   becomes `INTERNAL_ERROR`. Probed 2026-09-28: `/explore/nav` correctly
 *   treats a missing header as guest (200), `/me/profile` correctly returns
 *   401 — only this endpoint mislabels. This route is RequireAuth, so we never
 *   intentionally call it as a guest; an expired session surfaces as the
 *   honest "登录状态已过期" below. See LEGACY-DELTA §三·补16.
 *
 * ⚠️ LEGACY'S /discover?domain=all REDIRECT IS NOT REPRODUCED. Legacy pushed
 *   the user to `/discover?domain=all&sort=featured` after saving. In V2,
 *   `/api/v1/discover` does NOT honour `domain`/`sort` (verified in Phase 1A),
 *   so the URL would advertise filtering that cannot happen. We stay put and
 *   confirm the save instead of faking a filter.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; map: ExploreDomain[] };

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED");
}

export function ExplorationInterestsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [draftLabel, setDraftLabel] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [initial, setInitial] = useState<{ domainIds: string[]; labels: string[] } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    Promise.all([explorationApi.getMap(), explorationApi.getMine()])
      .then(([map, mine]) => {
        if (!active) return;
        const ids = selectedOfficialIds(mine);
        const mineLabels = personalLabels(mine);
        setSelectedIds(ids);
        setLabels(mineLabels);
        setInitial({ domainIds: ids, labels: mineLabels });
        setState({ kind: "ready", map });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          expired: isAuthError(err),
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired
              ? "登录状态已过期，请重新登录。"
              : (state.detail ?? "暂时无法读取探索设置，请稍后重试。")
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const selectable = flattenSelectableDomains(state.map);
  const dirty = initial ? isDirty(initial, { domainIds: selectedIds, labels }) : false;

  const handleAddLabel = () => {
    const result = addLabel(labels, draftLabel);
    if (!result.ok) {
      setLabelError(result.message);
      return;
    }
    setLabels(result.labels);
    setDraftLabel("");
    setLabelError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setSaveFailed(false);
    try {
      const next = await explorationApi.updateMine({ domainIds: selectedIds, customLabels: labels });
      // Re-seed from the server: a re-minted personal label comes back with a
      // fresh id, and its echoed `customLabels` is authoritative.
      const ids = selectedOfficialIds(next);
      const nextLabels = personalLabels(next);
      setSelectedIds(ids);
      setLabels(nextLabels);
      setInitial({ domainIds: ids, labels: nextLabels });
      setSaveMessage("已保存");
    } catch {
      setSaveFailed(true);
      setSaveMessage("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
          我的探索
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          从官方领域星图中选择你关心的方向，也可以添加个人兴趣标签。
          这只影响你自己的探索视图，不会改变社区的公共结构。
        </p>
      </header>

      {selectable.length === 0 ? (
        // The official map yielded no leaves. Say WHY instead of rendering an
        // empty section — a blank screen reads as a broken page.
        <PageState
          kind="empty"
          title="暂无可选领域"
          description="官方领域星图还没有可选的子领域，请稍后再试。"
        />
      ) : (
        <section aria-label="官方领域" className="space-y-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">官方领域</h2>
          {state.map.map((group) => {
            const children = group.children ?? [];
            if (children.length === 0) return null;
            return (
              <div key={group.id}>
                <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {group.name}
                </h3>
                {group.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {children.map((domain) => {
                    const active = selectedIds.includes(domain.id);
                    return (
                      <button
                        key={domain.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedIds((current) => toggleId(current, domain.id))}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          active
                            ? "border-accent bg-accent/10 font-medium text-accent"
                            : "border-border bg-card text-muted-foreground hover:border-accent/50",
                        )}
                      >
                        {domain.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section aria-label="个人兴趣" className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">个人兴趣标签</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          例如 Java、独立开发、逆向研究——只对你可见，不进入官方星图。
          最多 {MAX_CUSTOM_LABELS} 个，每个不超过 {MAX_CUSTOM_LABEL_LENGTH} 个字符。
        </p>

        <ul aria-label="已添加的兴趣" className="mt-3 flex flex-wrap gap-2">
          {labels.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted px-3 py-1.5 text-sm text-foreground"
            >
              {label}
              <button
                type="button"
                aria-label={`移除 ${label}`}
                onClick={() => {
                  setLabels((current) => removeLabel(current, label));
                  setLabelError(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex max-w-md gap-2">
          <Input
            value={draftLabel}
            onChange={(event) => {
              setDraftLabel(event.target.value);
              setLabelError(null);
            }}
            placeholder="添加个人兴趣"
            aria-label="添加个人兴趣"
            aria-invalid={labelError ? true : undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddLabel();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleAddLabel} aria-label="添加">
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {labelError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {labelError}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="min-w-32"
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="mr-2 h-4 w-4" aria-hidden />
          )}
          保存探索
        </Button>
        {saveMessage ? (
          <p
            role={saveFailed ? "alert" : "status"}
            className={cn("text-sm", saveFailed ? "text-destructive" : "text-muted-foreground")}
          >
            {saveMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

