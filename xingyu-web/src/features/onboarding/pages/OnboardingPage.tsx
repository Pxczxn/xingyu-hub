import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { ApiError } from "@/api/client";
import { onboardingApi } from "@/api/onboarding/onboarding.api";
import type { OnboardingPatch, OnboardingState } from "@/api/onboarding/onboarding.types";
import { usersApi } from "@/api/users/users.api";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveOnboardingExitPath } from "@/features/onboarding/post-login-routing";
import {
  INTEREST_DOMAINS,
  MAX_CUSTOM_INTERESTS,
  MAX_INTEREST_LABEL_LENGTH,
  normalizeCustomInterestLabel,
  parseInterestsJson,
  splitInterests,
} from "@/features/onboarding/onboarding-interests";
import { buildOnboardingProfilePatch } from "@/features/onboarding/onboarding-profile";
import { cn } from "@/lib/cn";

/*
 * /onboarding (Phase 2A-3).
 *
 * Step machine is the onboarding row, not the URL:
 *   WELCOME → INTERESTS → FOLLOWS → PROFILE → completed=true
 *
 * `DONE` is a Legacy/backend step literal kept for resume only. New
 * sessions complete via `completed=true` after PROFILE.
 *
 * FOLLOWS is DEGRADED: GET /users/suggested and /u/suggested return 500
 * (CommunityAuthContext not injected). This step is skippable and never
 * invents a recommendation list.
 *
 * PROFILE writes go through usersApi.updateMyProfile — the same wrapper as
 * Settings. Empty strings are never sent.
 */

const STEPS = [
  { key: "WELCOME", label: "欢迎" },
  { key: "INTERESTS", label: "兴趣" },
  { key: "FOLLOWS", label: "关注" },
  { key: "PROFILE", label: "资料" },
] as const;

const RESUME_STEPS = new Set<string>([...STEPS.map((item) => item.key), "DONE"]);

export function OnboardingAliasRedirect() {
  const [params] = useSearchParams();
  const query = params.toString();
  return <Navigate to={query ? `/onboarding?${query}` : "/onboarding"} replace />;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const exitPath = resolveOnboardingExitPath(params.get("returnTo"));

  const [state, setState] = useState<OnboardingState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState("");
  const [customInterestError, setCustomInterestError] = useState<string | null>(null);
  const [activeDomainId, setActiveDomainId] = useState(INTEREST_DOMAINS[0]?.id ?? "tech");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileBaseline, setProfileBaseline] = useState({ displayName: "", bio: "" });
  const [lockVersion, setLockVersion] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const loadGenerationRef = useRef(0);

  const load = useCallback(() => {
    const generation = ++loadGenerationRef.current;
    setLoadError(false);
    onboardingApi
      .get()
      .then((data) => {
        if (generation !== loadGenerationRef.current) return;
        setState(data);
        setSelectedInterests(parseInterestsJson(data.interestsJson));
      })
      .catch(() => {
        if (generation !== loadGenerationRef.current) return;
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [load]);

  const currentStep = state?.step ?? "WELCOME";

  useEffect(() => {
    if (currentStep !== "PROFILE") return;
    let active = true;
    setProfileLoaded(false);
    usersApi
      .getMyProfile()
      .then((profile) => {
        if (!active) return;
        const next = {
          displayName: profile.displayName ?? "",
          bio: profile.bio ?? "",
        };
        setDisplayName(next.displayName);
        setBio(next.bio);
        setProfileBaseline(next);
        setLockVersion(profile.lockVersion ?? 0);
        setProfileLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setProfileLoaded(false);
      });
    return () => {
      active = false;
    };
  }, [currentStep]);

  const { custom: customInterests } = useMemo(
    () => splitInterests(selectedInterests),
    [selectedInterests],
  );

  const run = useCallback(async (action: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setSaveError(null);
    try {
      await action();
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.problem.detail || err.problem.title
          : "保存失败，请稍后重试。",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  const patchOnboarding = useCallback(async (payload: OnboardingPatch) => {
    const data = await onboardingApi.update(payload);
    setState(data);
    if (payload.interestsJson !== undefined) {
      setSelectedInterests(parseInterestsJson(payload.interestsJson));
    }
    return data;
  }, []);

  const finish = useCallback(async () => {
    const data = await patchOnboarding({ completed: true });
    const confirmed = await onboardingApi.get().catch(() => data);
    setState(confirmed);
    if (confirmed.completed) navigate(exitPath, { replace: true });
  }, [exitPath, navigate, patchOnboarding]);

  const addCustom = () => {
    const label = normalizeCustomInterestLabel(customInterestInput);
    if (!label) {
      setCustomInterestError("请输入兴趣名称");
      return;
    }
    if (label.length > MAX_INTEREST_LABEL_LENGTH) {
      setCustomInterestError(`兴趣名称不超过 ${MAX_INTEREST_LABEL_LENGTH} 个字符`);
      return;
    }
    if (customInterests.length >= MAX_CUSTOM_INTERESTS) {
      setCustomInterestError(`最多添加 ${MAX_CUSTOM_INTERESTS} 个自定义兴趣`);
      return;
    }
    if (selectedInterests.includes(label)) {
      setCustomInterestError("该兴趣已添加");
      return;
    }
    setSelectedInterests((prev) => [...prev, label]);
    setCustomInterestInput("");
    setCustomInterestError(null);
  };

  if (loadError) {
    return <PageState kind="error" title="无法加载入门引导" description="请稍后重试。" />;
  }

  if (!state) {
    return <PageState kind="loading" />;
  }

  if (state.completed) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-primary">入门引导已完成</h1>
        <p className="text-sm text-muted-foreground">你已经记录过兴趣并完成入门。</p>
        <Button onClick={() => navigate(exitPath, { replace: true })}>继续</Button>
      </section>
    );
  }

  const knownStep = RESUME_STEPS.has(currentStep);

  if (!knownStep) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-primary">入门状态异常</h1>
        <p className="text-sm text-muted-foreground">
          当前步骤无法识别。请重新读取入门状态，不会猜测或写回未知步骤。
        </p>
        <Button type="button" onClick={() => load()}>
          重新读取
        </Button>
      </section>
    );
  }

  const stepIndex = STEPS.findIndex((item) => item.key === currentStep);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">入门引导</p>
        <h1 className="text-xl font-semibold text-primary">设置你的星语档案</h1>
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="引导步骤">
          {STEPS.map((item, index) => (
            <li
              key={item.key}
              className={cn(
                "rounded-full border px-2.5 py-1",
                index === stepIndex
                  ? "border-accent bg-accent text-accent-foreground"
                  : index < stepIndex
                    ? "border-border bg-muted text-foreground"
                    : "border-border text-muted-foreground",
              )}
            >
              {item.label}
            </li>
          ))}
        </ol>
      </header>

      {currentStep === "WELCOME" ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <Sparkles className="mb-2 h-5 w-5 text-accent" aria-hidden />
          <h2 className="text-lg font-medium">欢迎来到星语</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            用几步记录你关心的领域，并补上展示名称。兴趣只保存在入门资料里。
          </p>
          <Button
            className="mt-4"
            variant="accent"
            disabled={pending}
            onClick={() =>
              void run(() => patchOnboarding({ step: "INTERESTS" }).then(() => undefined))
            }
          >
            {pending ? "跳转中…" : "开始设置"}
          </Button>
        </div>
      ) : null}

      {currentStep === "INTERESTS" ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium">记录兴趣</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            选择你想记录的领域与兴趣。这些标签只保存在入门资料里，不会改变推荐结果。
          </p>

          <div
            className="mt-4 flex gap-1 overflow-x-auto pb-2"
            role="tablist"
            aria-label="兴趣领域"
          >
            {INTEREST_DOMAINS.map((domain) => (
              <button
                key={domain.id}
                type="button"
                role="tab"
                aria-selected={activeDomainId === domain.id}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs",
                  activeDomainId === domain.id
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setActiveDomainId(domain.id)}
              >
                {domain.label}
              </button>
            ))}
          </div>

          {INTEREST_DOMAINS.filter((domain) => domain.id === activeDomainId).map((domain) => (
            <div key={domain.id} className="mt-3 flex flex-wrap gap-2">
              {domain.interests.map((interest) => {
                const selected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      selected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border hover:bg-muted",
                    )}
                    onClick={() =>
                      setSelectedInterests((prev) =>
                        prev.includes(interest)
                          ? prev.filter((item) => item !== interest)
                          : [...prev, interest],
                      )
                    }
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="mt-4 rounded-md bg-muted/50 p-3">
            <Label htmlFor="onboarding-custom-interest">自定义兴趣</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="onboarding-custom-interest"
                value={customInterestInput}
                maxLength={MAX_INTEREST_LABEL_LENGTH}
                disabled={customInterests.length >= MAX_CUSTOM_INTERESTS}
                onChange={(event) => {
                  setCustomInterestInput(event.target.value);
                  setCustomInterestError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustom}>
                添加
              </Button>
            </div>
            {customInterestError ? (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {customInterestError}
              </p>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            已选 <span className="font-medium text-foreground">{selectedInterests.length}</span> 项
          </p>
          <Button
            className="mt-3"
            variant="accent"
            disabled={pending}
            onClick={() =>
              void run(() => {
                const payload: OnboardingPatch =
                  selectedInterests.length > 0
                    ? { step: "FOLLOWS", interestsJson: JSON.stringify(selectedInterests) }
                    : { step: "FOLLOWS" };
                return patchOnboarding(payload).then(() => undefined);
              })
            }
          >
            {pending ? "保存中…" : "下一步"}
          </Button>
        </div>
      ) : null}

      {currentStep === "PROFILE" ? (
        <form
          className="rounded-lg border border-border bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (profileLoaded) {
                const payload = buildOnboardingProfilePatch(lockVersion, profileBaseline, {
                  displayName,
                  bio,
                });
                if (payload) {
                  const saved = await usersApi.updateMyProfile(payload);
                  setLockVersion(saved.lockVersion ?? lockVersion + 1);
                  setProfileBaseline({
                    displayName: saved.displayName ?? displayName.trim(),
                    bio: saved.bio ?? bio.trim(),
                  });
                }
              }
              await finish();
            });
          }}
        >
          <h2 className="text-lg font-medium">完善资料</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            设置展示名称与简介。留空的字段不会被提交，因为后端无法真正清空它们。
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-display-name">展示名称</Label>
              <Input
                id="onboarding-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-bio">简介</Label>
              <textarea
                id="onboarding-bio"
                className="min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </div>
          </div>
          <Button className="mt-4" variant="accent" type="submit" disabled={pending}>
            {pending ? "保存中…" : "下一步"}
          </Button>
        </form>
      ) : null}

      {currentStep === "FOLLOWS" ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium">推荐关注</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            创作者推荐暂时不可用。这一步可以跳过，不会伪造名单，也不影响已经记录的兴趣。
          </p>
          <Button
            className="mt-4"
            variant="accent"
            disabled={pending}
            onClick={() =>
              void run(() => patchOnboarding({ step: "PROFILE" }).then(() => undefined))
            }
          >
            {pending ? "跳转中…" : "跳过"}
          </Button>
        </div>
      ) : null}

      {currentStep === "DONE" ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-medium">欢迎加入星语</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedInterests.length > 0
              ? `已记录 ${selectedInterests.length} 项兴趣。`
              : "入门设置已就绪。"}
          </p>
          <Button
            className="mt-4"
            variant="accent"
            disabled={pending}
            onClick={() => void run(finish)}
          >
            {pending ? "进入中…" : "进入星语"}
          </Button>
        </div>
      ) : null}

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        也可以稍后在{" "}
        <Link to="/settings/profile" className="text-accent underline">
          设置
        </Link>{" "}
        里继续改资料。
      </p>
    </section>
  );
}
