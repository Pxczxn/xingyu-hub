"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Orbit, Plus, Sparkles, X } from "lucide-react";
import { OnboardingShell } from "@/components/layout/OnboardingShell";
import { FollowButton } from "@/components/community/engagement";
import { EmptyState } from "@/components/community/empty-state";
import { OnboardingStepNav } from "@/components/community/onboarding-step-nav";
import { OnboardingStepPanel } from "@/components/community/onboarding-step-panel";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api-client";
import { communityApi, type FollowUser, type OnboardingState } from "@/lib/community-api";
import {
  INTEREST_DOMAINS,
  MAX_CUSTOM_INTERESTS,
  MAX_INTEREST_LABEL_LENGTH,
  normalizeCustomInterestLabel,
  splitInterests,
} from "@/lib/onboarding-interests";
import { cn } from "@/lib/utils";

type OnboardingView = OnboardingState;

function parseInterests(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function interestPillClass(selected: boolean) {
  return cn(
    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors touch-manipulation",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
    selected
      ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90"
      : "border-border bg-card text-foreground/85 hover:border-[rgb(var(--violet)/.45)] hover:bg-muted/70"
  );
}

function domainTabClass(isActive: boolean) {
  return cn(
    "h-8 shrink-0 gap-1 rounded-full border px-3 text-xs font-medium shadow-none transition-colors",
    isActive
      ? "!border-[rgb(var(--violet)/.45)] !bg-[rgb(var(--violet)/.08)] !text-foreground"
      : "!border-transparent !bg-transparent !text-muted-foreground hover:!border-border hover:!bg-card hover:!text-foreground"
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const [onboarding, setOnboarding] = useState<OnboardingView | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<FollowUser[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [customInterestInput, setCustomInterestInput] = useState("");
  const [customInterestError, setCustomInterestError] = useState<string | null>(null);
  const [activeDomainId, setActiveDomainId] = useState(INTEREST_DOMAINS[0]?.id ?? "tech");
  const [saving, setSaving] = useState(false);

  const { custom: customInterests } = useMemo(() => splitInterests(selectedInterests), [selectedInterests]);
  const domainSelectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const domain of INTEREST_DOMAINS) {
      counts[domain.id] = domain.interests.filter((interest) => selectedInterests.includes(interest)).length;
    }
    return counts;
  }, [selectedInterests]);

  useEffect(() => {
    communityApi.getOnboarding()
      .then((data) => {
        setOnboarding(data);
        setSelectedInterests(parseInterests(data.interestsJson));
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.problem.status === 401 || err.problem.status === 403)) {
          setNeedsLogin(true);
        }
      });
  }, []);

  useEffect(() => {
    if (onboarding?.step === "FOLLOWS") {
      communityApi.getSuggestedUsers(8).then(setSuggestedUsers).catch(() => setSuggestedUsers([]));
    }
    if (onboarding?.step === "PROFILE") {
      communityApi
        .tryGetMyProfile()
        .then((profile) => {
          if (profile) {
            setDisplayName(profile.displayName ?? "");
            setBio(profile.bio ?? "");
          }
        })
        .catch(() => {});
    }
  }, [onboarding?.step]);

  const currentStep = onboarding?.step ?? "WELCOME";

  const updateOnboarding = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const data = await communityApi.updateOnboarding(body);
      setOnboarding(data);
      setSelectedInterests(parseInterests(data.interestsJson));
      if (data.completed) {
        router.push("/");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
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

  const removeCustomInterest = (interest: string) => {
    setSelectedInterests((prev) => prev.filter((item) => item !== interest));
    setCustomInterestError(null);
  };

  if (needsLogin) {
    return (
      <OnboardingShell>
        <EmptyState
          icon={Sparkles}
          title="登录后开始入门引导"
          description="完成入门流程，个性化你的星语体验"
          actionLabel="去登录"
          actionHref="/login"
          className="xy-panel xy-orbit-bg w-full border-solid border-border bg-card/95 px-6 py-12 sm:py-14 shadow-none"
        />
      </OnboardingShell>
    );
  }

  if (!onboarding) {
    return (
      <OnboardingShell>
        <div className="xy-panel xy-orbit-bg flex w-full flex-col items-center justify-center gap-3 px-6 py-12 sm:py-14">
          <Orbit className="h-6 w-6 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">加载中…</p>
        </div>
      </OnboardingShell>
    );
  }

  if (onboarding.completed) {
    return (
      <OnboardingShell>
        <EmptyState
          icon={Sparkles}
          title="入门引导已完成"
          description="你已准备好探索星语社区"
          actionLabel="返回首页"
          actionHref="/"
          className="xy-panel xy-orbit-bg w-full border-solid border-border bg-card/95 px-6 py-12 sm:py-14 shadow-none"
        />
      </OnboardingShell>
    );
  }

  const isInterestsStep = currentStep === "INTERESTS";
  const isDoneStep = currentStep === "DONE";

  return (
    <OnboardingShell>
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden",
          isDoneStep
            ? "max-h-[min(680px,calc(100dvh-9.5rem))] overflow-y-auto overscroll-contain rounded-[1.25rem] border border-white/75 bg-white/42 p-5 shadow-[0_18px_48px_rgb(44_57_92/0.12)] backdrop-blur-xl sm:rounded-[1.5rem] sm:p-6 lg:p-8"
            : cn(
                "xy-panel xy-orbit-bg max-h-[min(720px,calc(100dvh-9.5rem))]",
                isInterestsStep ? "flex min-h-0 flex-col" : "overflow-y-auto overscroll-contain p-5 sm:p-6 lg:p-8"
              )
        )}
      >
        <header className="mb-4 shrink-0 sm:mb-5">
          <p className="xy-kicker">{isDoneStep ? "设置完成" : "入门引导"}</p>
          <OnboardingStepNav currentStep={currentStep} />
        </header>

        {currentStep === "WELCOME" && (
          <OnboardingStepPanel stepKey="WELCOME">
            <Sparkles className="mb-2 h-5 w-5 text-[rgb(var(--accent))]" aria-hidden="true" />
            <CardTitle className="text-xl tracking-[-0.02em]">欢迎来到星语</CardTitle>
            <CardDescription className="mt-1.5 text-sm leading-6">
              几分钟完成设置，我们会根据你的兴趣推荐内容与创作者，让阅读与创作都在自己的轨道上发亮。
            </CardDescription>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                选择你关心的领域与兴趣
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--violet))]" aria-hidden="true" />
                完善展示名称与简介
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                关注感兴趣的创作者
              </li>
            </ul>
            <Button variant="accent" className="mt-4 w-full sm:w-auto" disabled={saving} onClick={() => updateOnboarding({ step: "INTERESTS" })}>
              {saving ? "跳转中…" : "开始设置"}
            </Button>
          </OnboardingStepPanel>
        )}

        {currentStep === "INTERESTS" && (
          <OnboardingStepPanel stepKey="INTERESTS" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/80 px-5 py-4 sm:px-6 sm:py-4">
              <CardTitle className="text-lg tracking-[-0.02em]">选择你的兴趣</CardTitle>
              <CardDescription className="mt-1 text-sm leading-6">
                按领域多选，也可添加最多 {MAX_CUSTOM_INTERESTS} 个自定义兴趣
              </CardDescription>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-4">
              <Tabs value={activeDomainId} onValueChange={setActiveDomainId}>
                <p className="mb-2 text-xs text-muted-foreground sm:hidden">左右滑动切换领域</p>
                <div className="relative">
                  <TabsList className="flex h-auto w-full snap-x snap-mandatory justify-start gap-1.5 overflow-x-auto rounded-xl border border-border/70 bg-card/80 p-1.5 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {INTEREST_DOMAINS.map((domain) => {
                      const count = domainSelectionCounts[domain.id] ?? 0;
                      const isActive = activeDomainId === domain.id;
                      return (
                        <TabsTrigger
                          key={domain.id}
                          value={domain.id}
                          className={cn(domainTabClass(isActive), "snap-start")}
                        >
                          <span>{domain.label}</span>
                          {count > 0 ? (
                            <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-accent-foreground">
                              {count}
                            </span>
                          ) : null}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card/95 to-transparent sm:hidden"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/95 to-transparent sm:hidden"
                    aria-hidden="true"
                  />
                </div>

                {INTEREST_DOMAINS.map((domain) => (
                  <TabsContent key={domain.id} value={domain.id} className="mt-2.5">
                    <div className="flex flex-wrap gap-2">
                      {domain.interests.map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          aria-pressed={selectedInterests.includes(interest)}
                          className={interestPillClass(selectedInterests.includes(interest))}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <section className="mt-4 rounded-xl bg-muted/45 p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">自定义兴趣</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">没找到合适的？添加你的专属标签</p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {customInterests.length}/{MAX_CUSTOM_INTERESTS}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="onboarding-custom-interest" className="sr-only">
                      自定义兴趣
                    </label>
                    <Input
                      id="onboarding-custom-interest"
                      value={customInterestInput}
                      onChange={(event) => {
                        setCustomInterestInput(event.target.value);
                        if (customInterestError) setCustomInterestError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomInterest();
                        }
                      }}
                      placeholder="例如：独立游戏、播客制作…"
                      maxLength={MAX_INTEREST_LABEL_LENGTH}
                      disabled={customInterests.length >= MAX_CUSTOM_INTERESTS}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-9 bg-card text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={customInterests.length >= MAX_CUSTOM_INTERESTS}
                    onClick={addCustomInterest}
                    aria-label="添加自定义兴趣"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    添加
                  </Button>
                </div>
                {customInterestError ? (
                  <p className="mt-2 text-xs text-destructive" aria-live="polite">
                    {customInterestError}
                  </p>
                ) : null}
                {customInterests.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {customInterests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-accent px-2.5 py-1 text-sm text-accent-foreground"
                      >
                        {interest}
                        <button
                          type="button"
                          onClick={() => removeCustomInterest(interest)}
                          className="cursor-pointer rounded-full p-0.5 transition-colors hover:bg-accent-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`移除 ${interest}`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>

            <div className="shrink-0 border-t border-border/80 bg-card/95 px-5 py-3.5 sm:px-6 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  已选 <span className="font-semibold tabular-nums text-foreground">{selectedInterests.length}</span> 项兴趣
                  {customInterests.length > 0 ? (
                    <span className="text-muted-foreground">（含 {customInterests.length} 个自定义）</span>
                  ) : null}
                </p>
                <Button
                  variant="accent"
                  className="w-full sm:min-w-[9rem] sm:w-auto"
                  disabled={saving || selectedInterests.length === 0}
                  onClick={() =>
                    updateOnboarding({
                      step: "PROFILE",
                      interestsJson: JSON.stringify(selectedInterests),
                    })
                  }
                >
                  {saving ? "保存中…" : "下一步"}
                </Button>
              </div>
            </div>
          </OnboardingStepPanel>
        )}

        {currentStep === "PROFILE" && (
          <OnboardingStepPanel stepKey="PROFILE">
            <CardTitle className="text-lg tracking-[-0.02em]">完善资料</CardTitle>
            <CardDescription className="mt-1 text-sm leading-6">设置展示名称与简介，其他用户将看到这些信息</CardDescription>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm font-medium" htmlFor="onboarding-display-name">展示名称</label>
                <input
                  id="onboarding-display-name"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="你的昵称"
                  autoComplete="nickname"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="onboarding-bio">简介</label>
                <textarea
                  id="onboarding-bio"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="一句话介绍自己"
                />
              </div>
            </div>
            <Button
              variant="accent"
              className="mt-4 w-full sm:w-auto"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await communityApi.updateMyProfile({
                    displayName: displayName.trim() || undefined,
                    bio: bio.trim() || undefined,
                  });
                  await updateOnboarding({ step: "FOLLOWS" });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "保存中…" : "下一步"}
            </Button>
          </OnboardingStepPanel>
        )}

        {currentStep === "FOLLOWS" && (
          <OnboardingStepPanel stepKey="FOLLOWS">
            <CardTitle className="text-lg tracking-[-0.02em]">推荐关注</CardTitle>
            <CardDescription className="mt-1 text-sm leading-6">
              关注感兴趣的创作者，首页会展示他们的更新。也可稍后再关注。
            </CardDescription>
            {suggestedUsers.length === 0 ? (
              <p className="mt-2.5 text-sm text-muted-foreground">暂无推荐用户，可稍后在社区中发现</p>
            ) : (
              <ul className="mt-2.5 max-h-[min(13rem,calc(100dvh-19rem))] space-y-1.5 overflow-y-auto overscroll-contain">
                {suggestedUsers.map((user) => (
                  <li key={user.userId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.displayName || user.username}</p>
                      <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <FollowButton username={user.username} compact />
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="accent"
              className="mt-4 w-full sm:w-auto"
              disabled={saving}
              onClick={() => updateOnboarding({ step: "DONE" })}
            >
              {saving ? "跳转中…" : "继续"}
            </Button>
          </OnboardingStepPanel>
        )}

        {currentStep === "DONE" && !onboarding.completed && (
          <OnboardingStepPanel stepKey="DONE" className="py-2 sm:py-4">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgb(var(--accent)/.28)] bg-[rgb(var(--accent)/.12)] text-[rgb(var(--accent))] shadow-sm">
                <Image src="/brand/logo-emblem.png" alt="星语社区" width={30} height={30} className="h-6 w-6 object-contain" />
              </div>
              <p className="text-sm font-medium text-[rgb(var(--violet))]">你的个人星图已建立</p>
              <CardTitle className="mt-1.5 text-2xl tracking-[-0.04em] sm:text-[1.75rem]">欢迎加入星语</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-xl text-sm leading-6 sm:text-[0.95rem] sm:leading-7">
                兴趣偏好已保存。现在，去发现值得停留的内容，也让你的思考在这里留下轨迹。
              </CardDescription>
              {selectedInterests.length > 0 ? (
                <p className="mt-4 inline-flex items-center rounded-full border border-white/80 bg-white/45 px-3 py-1 text-sm text-muted-foreground">
                  已记录 <span className="mx-1 font-semibold tabular-nums text-foreground">{selectedInterests.length}</span> 项兴趣偏好
                </p>
              ) : null}
              <Button variant="accent" className="mt-5 h-10 w-full px-6 shadow-[0_10px_24px_rgb(228_139_76/0.24)] sm:w-auto" disabled={saving} onClick={() => updateOnboarding({ completed: true })}>
                {saving ? "进入中…" : "进入星语"}
              </Button>
            </div>
          </OnboardingStepPanel>
        )}
      </div>
    </OnboardingShell>
  );
}

export default OnboardingPage;
