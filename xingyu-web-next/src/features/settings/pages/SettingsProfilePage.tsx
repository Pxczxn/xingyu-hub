import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { usersApi } from "@/api/users/users.api";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PROFILE_FIELD_LABELS,
  VISIBILITY_OPTIONS,
  buildProfilePatch,
  findClearAttempts,
  hasProfileChanges,
  toProfileFormValues,
  validateWebsiteUrlInput,
  type ProfileFieldName,
  type ProfileFormValues,
} from "@/features/settings/settings-form";

/*
 * /settings/profile — Profile text fields (Phase 2A-1).
 *
 * Scope, per the Phase 2-0 capability map:
 *   displayName / bio / websiteUrl / visibility  -> PATCH /api/v1/me/profile
 *
 * Explicitly NOT here:
 *   - avatar     : writable only through the client-settings side channel (2A-2)
 *   - username   : 30-day cooldown, scoped to 2A-2
 *   - password   : no self-service endpoint exists on this backend (B10)
 *   - email      : needs a verification link (human gate)
 *
 * Save is always explicit — there is no autosave. A failed save keeps whatever
 * the user typed (we never re-GET over their input).
 */

type LoadState = "loading" | "error" | "ready";
type SaveState = "idle" | "saving" | "saved";

export function SettingsProfilePage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const [username, setUsername] = useState("");
  const [baseline, setBaseline] = useState<ProfileFormValues | null>(null);
  const [values, setValues] = useState<ProfileFormValues | null>(null);
  const [lockVersion, setLockVersion] = useState(0);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    usersApi
      .getMyProfile()
      .then((profile) => {
        if (!active) return;
        const next = toProfileFormValues(profile);
        setUsername(profile.username ?? "");
        setBaseline(next);
        setValues(next);
        setLockVersion(profile.lockVersion ?? 0);
        setSaveState("idle");
        setSaveError(null);
        setConflict(false);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const setField = useCallback((field: ProfileFieldName, value: string) => {
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
    // Any edit invalidates the "已保存" badge and the previous error.
    setSaveState("idle");
    setSaveError(null);
  }, []);

  const save = useCallback(async () => {
    if (!baseline || !values) return;
    /*
     * Re-check every guard here, not just in the submit button's `disabled`.
     * A disabled button is a UI affordance, not an invariant: implicit form
     * submission (Enter in a text field), a future second submit path, or a
     * dropped `disabled` prop would all bypass it. Since the backend answers a
     * blanked field with 200-while-keeping-the-old-value, getting through here
     * would produce a fake success — exactly what this round must not ship.
     */
    if (findClearAttempts(baseline, values).length > 0) return;
    if (validateWebsiteUrlInput(values.websiteUrl) !== null) return;
    if (!hasProfileChanges(baseline, values)) return;

    setSaveState("saving");
    setSaveError(null);
    setConflict(false);
    try {
      const updated = await usersApi.updateMyProfile(
        buildProfilePatch(baseline, values, lockVersion),
      );
      const next = toProfileFormValues(updated);
      // Adopt the server's view as the new clean baseline (lockVersion included).
      setBaseline(next);
      setValues(next);
      setLockVersion(updated.lockVersion ?? lockVersion + 1);
      setSaveState("saved");
    } catch (error) {
      // Local input is deliberately left untouched.
      setSaveState("idle");
      if (error instanceof ApiError && error.problem.status === 409) {
        setConflict(true);
        setSaveError("资料已被其他会话更新，请重新加载后再保存。");
      } else {
        setSaveError(
          error instanceof ApiError ? error.problem.detail : "保存失败，请稍后重试。",
        );
      }
    }
  }, [baseline, values, lockVersion]);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error" || !baseline || !values) {
    return (
      <div className="section-gap">
        <PageState kind="error" title="资料加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const clearAttempts = findClearAttempts(baseline, values);
  const websiteError = validateWebsiteUrlInput(values.websiteUrl);
  const dirty = hasProfileChanges(baseline, values);
  const blocked = clearAttempts.length > 0 || websiteError !== null;
  const saving = saveState === "saving";

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-profile-heading">
        <h2 id="settings-profile-heading" className="text-base font-semibold text-primary">
          资料
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          这些信息会展示在你的公开主页上。
        </p>
      </section>

      <form
        className="section-gap max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-username">用户名</Label>
          <Input id="settings-username" value={username} readOnly disabled />
          <p className="text-xs text-muted-foreground">
            用户名修改（含 30 天冷却）将在后续阶段开放。
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-displayName">昵称</Label>
          <Input
            id="settings-displayName"
            value={values.displayName}
            onChange={(event) => setField("displayName", event.target.value)}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-bio">简介</Label>
          <textarea
            id="settings-bio"
            rows={4}
            value={values.bio}
            onChange={(event) => setField("bio", event.target.value)}
            disabled={saving}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-websiteUrl">个人网站</Label>
          <Input
            id="settings-websiteUrl"
            value={values.websiteUrl}
            onChange={(event) => setField("websiteUrl", event.target.value)}
            disabled={saving}
            aria-invalid={websiteError !== null}
          />
          {websiteError ? (
            <p role="alert" data-testid="website-error" className="text-xs text-destructive">
              {websiteError}
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-3" disabled={saving}>
          <legend className="text-sm font-medium text-foreground">资料可见性</legend>
          {VISIBILITY_OPTIONS.map((option) => (
            <div key={option.value} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <input
                  id={`visibility-${option.value}`}
                  type="radio"
                  name="visibility"
                  value={option.value}
                  checked={values.visibility === option.value}
                  onChange={() => setField("visibility", option.value)}
                  className="h-4 w-4 border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Label htmlFor={`visibility-${option.value}`} className="font-normal">
                  {option.label}
                </Label>
              </div>
              <p className="pl-6 text-xs text-muted-foreground">{option.hint}</p>
            </div>
          ))}
        </fieldset>

        {clearAttempts.length > 0 ? (
          <p role="alert" data-testid="clear-blocked" className="text-sm text-destructive">
            以下字段暂不支持清空，请填写内容后再保存：
            {clearAttempts.map((field) => PROFILE_FIELD_LABELS[field]).join("、")}
          </p>
        ) : null}

        {saveError ? (
          <p role="alert" data-testid="profile-save-error" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || blocked || saving}>
            {saving ? "保存中…" : "保存"}
          </Button>

          {dirty && !saving ? (
            <span data-testid="profile-dirty" className="text-sm text-muted-foreground">
              有未保存的修改
            </span>
          ) : null}
          {saveState === "saved" ? (
            <span role="status" data-testid="profile-saved" className="text-sm text-primary">
              已保存
            </span>
          ) : null}
          {conflict ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              重新加载
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
