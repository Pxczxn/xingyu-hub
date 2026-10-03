import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { usersApi } from "@/api/users/users.api";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarEditor } from "@/features/settings/components/AvatarEditor";
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
 *   avatar                                       -> POST /api/v1/messages/upload
 *                                                -> PUT  /api/v1/me/client-settings
 *
 * Explicitly NOT here:
 *   - username   : 30-day cooldown, scoped to a later phase
 *   - password   : no self-service endpoint exists on this backend (B10)
 *   - email      : needs a verification link (human gate)
 *
 * Save is always explicit — there is no autosave. A failed save keeps whatever
 * the user typed (we never re-GET over their input).
 *
 * The avatar is deliberately NOT part of this form: it is stored in
 * `settings_json`, written by its own two-request flow, and saving the text
 * fields must never include it. AvatarEditor owns that loop and reports the
 * persisted value back through `onAvatarSaved`.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * The old page was one narrow column (max-w-xl): avatar upload, then five form
 * controls stacked, then a save row. Nothing on it answered the only question a
 * profile editor raises — "what will other people actually see?" The reader had
 * to save, navigate to their own profile, and come back to find out.
 *
 * It is now a TWO-COLUMN page: the work surface (avatar + fields) on the left,
 * and a LIVE PUBLIC-PREVIEW card pinned on the right at >=lg. Every control in
 * the form writes into `values`, which the preview renders directly, so the
 * answer updates as you type rather than after a save.
 *
 * The preview is the reason this page is not a stack of inputs. It is not
 * decoration and it is not a second source of truth: it renders `values`, never
 * the server copy, and it is aria-hidden because a screen reader would otherwise
 * hear every field twice.
 * ---------------------------------------------------------------------------
 */

type LoadState = "loading" | "error" | "ready";
type SaveState = "idle" | "saving" | "saved";

export function SettingsProfilePage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
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
        setAvatar(profile.avatar ?? null);
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
        setSaveError(error instanceof ApiError ? error.problem.detail : "保存失败，请稍后重试。");
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
  const visibilityLabel =
    VISIBILITY_OPTIONS.find((option) => option.value === values.visibility)?.label ?? "—";

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-profile-heading">
        <h2 id="settings-profile-heading" className="section-heading">
          资料
        </h2>
        <p className="lede mt-1.5 max-w-2xl">这些信息会展示在你的公开主页上，右侧是实时预览。</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          <AvatarEditor
            avatar={avatar}
            fallbackText={values.displayName || username}
            onAvatarSaved={setAvatar}
          />

          <form
            className="section-gap"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-username">用户名</Label>
              <Input id="settings-username" value={username} readOnly disabled />
              <p className="text-meta text-muted-foreground">
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
                className="focus-ring w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
                <p role="alert" data-testid="website-error" className="text-meta text-destructive">
                  {websiteError}
                </p>
              ) : null}
            </div>

            {/*
              Visibility is one enum whose value decides who can see the whole
              profile, so each option is a CHOICE CARD carrying its own hint and a
              selected state — not a bare radio with the hint floating beside it.
              The hint belongs to the option, and the current choice has to be
              legible at a glance.
            */}
            <fieldset className="flex flex-col gap-2" disabled={saving}>
              <legend className="text-meta font-medium text-foreground-soft">资料可见性</legend>
              <div className="flex flex-col gap-1.5">
                {VISIBILITY_OPTIONS.map((option) => {
                  const selected = values.visibility === option.value;
                  return (
                    <div
                      key={option.value}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        selected
                          ? "border-accent-line bg-accent-soft/60"
                          : "border-border/70 bg-card hover:bg-surface-sunken/50",
                        saving ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <input
                        id={`visibility-${option.value}`}
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={selected}
                        onChange={() => setField("visibility", option.value)}
                        className="mt-0.5 h-4 w-4 shrink-0 border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="min-w-0">
                        {/*
                          The hint stays OUTSIDE the <label>. A label's accessible
                          name is its entire text content, so nesting the hint
                          would make the control announce as
                          "公开 仅自己可见…" and break getByLabelText("公开").
                          The card still LOOKS like one clickable block; the label
                          just covers the option name.
                        */}
                        <Label
                          htmlFor={`visibility-${option.value}`}
                          className="block cursor-pointer text-meta font-medium text-primary"
                        >
                          {option.label}
                        </Label>
                        <p className="mt-0.5 text-meta text-muted-foreground">{option.hint}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {clearAttempts.length > 0 ? (
              <p role="alert" data-testid="clear-blocked" className="text-meta text-destructive">
                以下字段暂不支持清空，请填写内容后再保存：
                {clearAttempts.map((field) => PROFILE_FIELD_LABELS[field]).join("、")}
              </p>
            ) : null}

            {saveError ? (
              <p
                role="alert"
                data-testid="profile-save-error"
                className="text-meta text-destructive"
              >
                {saveError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant={dirty && !blocked ? "default" : "outline"}
                disabled={!dirty || blocked || saving}
              >
                {saving ? "保存中…" : "保存"}
              </Button>

              {dirty && !saving ? (
                <span data-testid="profile-dirty" className="text-meta text-muted-foreground">
                  有未保存的修改
                </span>
              ) : null}
              {saveState === "saved" ? (
                <span
                  role="status"
                  data-testid="profile-saved"
                  className="text-meta font-medium text-accent-strong"
                >
                  已保存
                </span>
              ) : null}
              {conflict ? (
                <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
                  重新加载
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {/*
          Live public-page preview.
          aria-hidden on purpose: every value shown here is already announced by
          the control that edits it, so exposing it would make a screen reader
          read each field twice. It renders `values` (the unsaved local state),
          never the server copy — that is the whole point of having it.
        */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div
            aria-hidden
            className="rounded-xl border border-border/70 bg-card p-4"
            data-testid="profile-preview"
          >
            <p className="eyebrow mb-3">公开主页预览</p>

            <div className="flex items-center gap-3">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                  {(values.displayName || username || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-card font-semibold text-primary">
                  {values.displayName || "（未填写昵称）"}
                </p>
                <p className="truncate text-meta text-muted-foreground">
                  {username ? `@${username}` : "@—"}
                </p>
              </div>
            </div>

            <p className="mt-3 line-clamp-4 text-meta leading-6 text-muted-foreground">
              {values.bio || "（还没有填写简介）"}
            </p>

            {values.websiteUrl ? (
              <p className="mt-2 truncate text-meta text-accent-strong">{values.websiteUrl}</p>
            ) : null}

            <p className="mt-4 border-t border-border/60 pt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              {visibilityLabel}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
