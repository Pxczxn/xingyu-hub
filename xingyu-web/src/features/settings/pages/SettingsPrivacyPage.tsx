import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { usersApi } from "@/api/users/users.api";
import type { FollowersVisibility } from "@/api/users/users.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  FOLLOWERS_VISIBILITY_OPTIONS,
  toFollowersVisibility,
} from "@/features/settings/settings-form";

/*
 * /settings/privacy — Privacy (Phase 2A-1).
 *
 * Scope, per the Phase 2-0 capability map:
 *   followersVisibility -> PATCH /api/v1/me/profile/privacy
 *
 * This is the ONLY privacy field with a working contract. Deliberately absent:
 *   - "资料可见性" (visibility) lives on /settings/profile because it is part of
 *     the same PATCH /me/profile body — keeping it there means one atomic request
 *     instead of two half-appliable ones.
 *   - preference keys such as searchHistoryEnabled / personalizedRecommendationEnabled
 *     are DEAD KEYS: the backend persists them into an opaque JSON blob but nothing
 *     ever reads them (only readingHistoryEnabled has a consumer). Exposing them
 *     would be a fake switch, so they are not rendered at all.
 *   - notification preferences have no endpoint whatsoever.
 *
 * NOTE: this endpoint ignores lockVersion and unconditionally increments it, so a
 * save here can never 409 — but it DOES move the version, which is why the profile
 * form always re-reads on mount.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * This page used to be the same four-step vertical stack as every other settings
 * page: 标题 → 说明 → 竖排单选堆叠 → 下方浮动保存按钮. That shape is wrong for
 * this page, because this page holds exactly ONE enum with TWO values. A stack of
 * two radios plus a detached save button gives a one-bit setting the same visual
 * weight as the profile form.
 *
 * It is now a single SETTING ROW: the label and its explanation sit on the left,
 * the control sits on the right of the same line, and the save affordance lives
 * beside the control it saves. Reading it top-to-bottom takes one line, which is
 * what a one-bit setting deserves.
 *
 * The explicit-save behaviour is deliberately KEPT (radios + a disabled-until-dirty
 * 保存 button). Instant-save was considered and rejected: an accidental tap on a
 * privacy control would silently publish the reader's follow graph, and the
 * existing tests pin the "never send a no-op PATCH" rule.
 * ---------------------------------------------------------------------------
 */

type LoadState = "loading" | "error" | "ready";

export function SettingsPrivacyPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const [baseline, setBaseline] = useState<FollowersVisibility | null>(null);
  const [value, setValue] = useState<FollowersVisibility>("PRIVATE");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    usersApi
      .getMyProfile()
      .then((profile) => {
        if (!active) return;
        const next = toFollowersVisibility(profile.followersVisibility);
        setBaseline(next);
        setValue(next);
        setSaving(false);
        setSaved(false);
        setSaveError(null);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const save = useCallback(async () => {
    // Same reasoning as the profile form: the disabled button is an affordance,
    // not an invariant. Never send a no-op PATCH.
    if (baseline === null || baseline === value) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await usersApi.updateMyPrivacy({ followersVisibility: value });
      const next = toFollowersVisibility(updated.followersVisibility);
      setBaseline(next);
      setValue(next);
      setSaved(true);
    } catch (error) {
      // Keep the user's selection so a retry does not lose it.
      setSaveError(error instanceof ApiError ? error.problem.detail : "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }, [value, baseline]);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error" || baseline === null) {
    return (
      <div className="section-gap">
        <PageState kind="error" title="隐私设置加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const dirty = baseline !== value;

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-privacy-heading">
        <h2 id="settings-privacy-heading" className="section-heading">
          隐私
        </h2>
        <p className="lede mt-1.5 max-w-2xl">控制谁可以看到你的关注关系。</p>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="overflow-hidden rounded-xl border border-border/70 bg-card"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-5">
          <div className="min-w-0">
            <p className="text-card font-medium text-primary">关注列表可见性</p>
            <p className="mt-0.5 text-meta text-muted-foreground">决定谁能看到你关注了哪些人。</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {/* Segmented control. The native radios stay the real control (and the
                labelled element the tests click) — they are visually hidden and
                driven by the label, so keyboard arrow-key navigation still works. */}
            <fieldset
              className="flex items-center gap-1 rounded-lg bg-surface-sunken p-1"
              disabled={saving}
            >
              <legend className="sr-only">关注列表可见性</legend>
              {FOLLOWERS_VISIBILITY_OPTIONS.map((option) => {
                const selected = value === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1.5 text-meta transition-colors",
                      selected
                        ? "bg-card font-medium text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                      saving && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="radio"
                      name="followersVisibility"
                      value={option.value}
                      checked={selected}
                      onChange={() => {
                        setValue(option.value);
                        setSaved(false);
                        setSaveError(null);
                      }}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                );
              })}
            </fieldset>

            {/* The save affordance changes weight with the dirty state: a solid
                navy block that is permanently disabled is the heaviest thing on
                the page and says nothing. Outlined when clean, filled when there
                is something to save. */}
            <Button
              type="submit"
              size="sm"
              variant={dirty ? "default" : "outline"}
              disabled={!dirty || saving}
            >
              {saving ? "保存中…" : "保存"}
            </Button>

            {saved ? (
              <span
                role="status"
                data-testid="privacy-saved"
                className="text-meta font-medium text-accent-strong"
              >
                已保存
              </span>
            ) : null}
          </div>
        </div>

        {saveError ? (
          <p
            role="alert"
            data-testid="privacy-save-error"
            className="border-t border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
          >
            {saveError}
          </p>
        ) : null}
      </form>
    </div>
  );
}
