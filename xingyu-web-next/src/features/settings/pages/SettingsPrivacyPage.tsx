import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { usersApi } from "@/api/users/users.api";
import type { FollowersVisibility } from "@/api/users/users.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
        <h2 id="settings-privacy-heading" className="text-base font-semibold text-primary">
          隐私
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">控制谁可以看到你的关注关系。</p>
      </section>

      <form
        className="section-gap max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset className="flex flex-col gap-3" disabled={saving}>
          <legend className="text-sm font-medium text-foreground">关注列表可见性</legend>
          {FOLLOWERS_VISIBILITY_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <input
                id={`followersVisibility-${option.value}`}
                type="radio"
                name="followersVisibility"
                value={option.value}
                checked={value === option.value}
                onChange={() => {
                  setValue(option.value);
                  setSaved(false);
                  setSaveError(null);
                }}
                className="h-4 w-4 border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Label htmlFor={`followersVisibility-${option.value}`} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </fieldset>

        {saveError ? (
          <p role="alert" data-testid="privacy-save-error" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
          {saved ? (
            <span role="status" data-testid="privacy-saved" className="text-sm text-primary">
              已保存
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
