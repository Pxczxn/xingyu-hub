import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { ApiError } from "@/api/client";
import { explorationApi } from "@/api/exploration/exploration.api";
import type { ExploreDomain } from "@/api/exploration/exploration.types";
import { MAX_CUSTOM_LABELS, MAX_CUSTOM_LABEL_LENGTH } from "@/api/exploration/exploration.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
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
 *
 * 骨架（A §3 `/me/*` 表 · ExplorationInterests = SK2 · 线/紧/错）
 * --------------------------------------------------------------
 * H=线：`PageMasthead`（无面），与 MyGroups / 收藏夹列表那两张「横幅」页在首屏
 *       就分开 —— 同是 SK2，一张是面、一张是线。
 * D=紧：官方领域按分组排成「小标题 + chip 行」，组与组之间发丝线，不再套卡面；
 *       个人兴趣是一段紧行 + 输入条。chip 本身就是条目，套卡只会多一层无用的框。
 * R=错：`rail` 存在（SK2 的 `lg:[1fr|320px]`），右轨只放由本轮已取回数据派生的
 *       选择概览，不新增请求、也不放任何可编辑控件 —— 编辑只发生在主列。
 *
 * 行为未变：两个读取（`getMap`/`getMine` 的 `Promise.all`）、`reloadKey` 重试、
 * 三态、`isDirty` 守卫、整份 payload、保存后按服务端响应重新播种、全部 aria 属性
 * （`aria-pressed` / `aria-label="移除 X"` / `aria-label="添加个人兴趣"`）逐条保留。
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; map: ExploreDomain[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function ExplorationInterestsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

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
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the load itself failed, so offer the load
             again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        )}
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
      const next = await explorationApi.updateMine({
        domainIds: selectedIds,
        customLabels: labels,
      });
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

  const groupCount = state.map.filter((group) => (group.children ?? []).length > 0).length;

  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead
          title="我的探索"
          description="从官方领域列表中选择你关心的方向，也可以添加个人兴趣标签。这只影响你自己的探索视图，不会改变社区的公共结构。"
        />
      }
      rail={
        selectable.length > 0 ? (
          <ExploreRail
            selectedCount={selectedIds.length}
            labelCount={labels.length}
            optionCount={selectable.length}
            groupCount={groupCount}
          />
        ) : null
      }
      railLabel="探索侧栏"
    >
      {selectable.length === 0 ? (
        // The official map yielded no leaves. Say WHY instead of rendering an
        // empty section — a blank screen reads as a broken page.
        <PageState
          kind="empty"
          title="暂无可选领域"
          description="官方领域还没有可选的子领域，请稍后再试。"
        />
      ) : (
        /* D=紧：分组 + chip 行，组间发丝线，无卡面。 */
        <section aria-label="官方领域" className="min-w-0">
          <h2 className="section-heading">官方领域</h2>
          <div className="mt-3 flex flex-col">
            {state.map.map((group) => {
              const children = group.children ?? [];
              if (children.length === 0) return null;
              return (
                <div
                  key={group.id}
                  className="border-t border-border/60 py-4 first:border-t-0 first:pt-0"
                >
                  <h3 className="flex items-center gap-2 text-h3 text-primary">
                    {/* Decorative: the domain name beside it carries the meaning,
                        so the mark keeps the accent colour. */}
                    <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                    {group.name}
                  </h3>
                  {group.description ? (
                    <p className="mt-1 text-caption text-muted-foreground">{group.description}</p>
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
                            // Hand-written toggle, so it carries the shared focus
                            // ring itself — the Button primitive is not involved.
                            "focus-ring rounded-pill border px-4 py-2 text-meta transition-colors",
                            active
                              ? "border-border-strong bg-surface-sunken font-medium text-primary"
                              : "border-border bg-card text-muted-foreground hover:bg-muted",
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
          </div>
        </section>
      )}

      <section aria-label="个人兴趣" className="min-w-0">
        <h2 className="section-heading">个人兴趣标签</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          例如 Java、独立开发、逆向研究——只对你可见，不进入官方领域。 最多 {MAX_CUSTOM_LABELS}{" "}
          个，每个不超过 {MAX_CUSTOM_LABEL_LENGTH} 个字符。
        </p>

        <ul aria-label="已添加的兴趣" className="mt-3 flex flex-wrap gap-2">
          {labels.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1 rounded-pill border border-dashed border-border bg-muted px-3 py-1.5 text-meta text-foreground"
            >
              {label}
              <button
                type="button"
                aria-label={`移除 ${label}`}
                onClick={() => {
                  setLabels((current) => removeLabel(current, label));
                  setLabelError(null);
                }}
                className="focus-ring rounded-chip text-muted-foreground hover:text-foreground"
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
          <p role="alert" className="mt-2 text-caption text-destructive">
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
            className={cn("text-meta", saveFailed ? "text-destructive" : "text-muted-foreground")}
          >
            {saveMessage}
          </p>
        ) : null}
      </div>
    </ArchetypeFrame>
  );
}

/**
 * 右栏（R=错）：只读概览，四个数字都能从主列当前状态直接数出来。
 *
 * 刻意不放任何可编辑控件或「一键全选」类捷径：这一页的写操作是**破坏性整份替换**，
 * 把编辑入口分叉到两处会让「我到底提交了什么」变得不可复核。
 */
function ExploreRail({
  selectedCount,
  labelCount,
  optionCount,
  groupCount,
}: {
  selectedCount: number;
  labelCount: number;
  optionCount: number;
  groupCount: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="explore-rail-selection"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="explore-rail-selection" className="text-h3 text-primary">
          你的选择
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">官方领域</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {selectedCount} 个
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">个人标签</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {labelCount} 个
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="explore-rail-scope"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="explore-rail-scope" className="text-h3 text-primary">
          可选范围
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">可选子领域</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {optionCount} 个
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">官方分组</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {groupCount} 个
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
