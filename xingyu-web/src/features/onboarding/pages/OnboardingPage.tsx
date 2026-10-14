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
import { Textarea } from "@/components/ui/textarea";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
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

  /* Retry reuses `load()` — this page's existing re-read path (the same one the
     unknown-step branch below offers) — rather than adding a second mechanism. */
  if (loadError) {
    return (
      <div className="section-gap">
        <PageState kind="error" title="无法加载入门引导" description="请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => load()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  if (!state) {
    return <PageState kind="loading" />;
  }

  if (state.completed) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">入门引导已完成</h1>
        <p className="lede">你已经记录过兴趣并完成入门。</p>
        <Button onClick={() => navigate(exitPath, { replace: true })}>继续</Button>
      </section>
    );
  }

  const knownStep = RESUME_STEPS.has(currentStep);

  if (!knownStep) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">入门状态异常</h1>
        <p className="lede">当前步骤无法识别。请重新读取入门状态，不会猜测或写回未知步骤。</p>
        <Button type="button" onClick={() => load()}>
          重新读取
        </Button>
      </section>
    );
  }

  const stepIndex = STEPS.findIndex((item) => item.key === currentStep);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      {/*
        A guided flow, so it opens like one: the same eyebrow treatment the other
        page banners use, an L1 title, and a step rail that is legible rather
        than decorative.
        The rail keeps its three states (done / current / ahead) but gains step
        numbers — "2 of 4" is the single most useful thing to know inside a
        wizard, and a row of coloured pills alone does not say it.
      */}
      <header className="space-y-2.5">
        <p className="eyebrow">ONBOARDING</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">设置你的星语档案</h1>
        <ol className="flex flex-wrap gap-2 text-meta" aria-label="引导步骤">
          {STEPS.map((item, index) => (
            <li
              key={item.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                index === stepIndex
                  ? "border-accent bg-accent font-medium text-accent-foreground"
                  : index < stepIndex
                    ? "border-border bg-muted text-foreground"
                    : "border-border text-muted-foreground",
              )}
            >
              {/*
                2026-10-13 (batch 07c): 10px -> 11px. The disc is 16px, so 11px with
                `leading-none` still clears it with ~2.5px above and below, and 11px is
                this app's floor — the last place a step number should be smaller than
                the label sitting next to it.
              */}
              <span
                aria-hidden
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums",
                  index === stepIndex
                    ? "bg-accent-foreground/15"
                    : index < stepIndex
                      ? "bg-foreground/10"
                      : "bg-muted-foreground/10",
                )}
              >
                {index + 1}
              </span>
              {item.label}
            </li>
          ))}
        </ol>
      </header>

      {/*
        步骤卡片（2026-10-13，批次 08b）
        --------------------------------
        表面取批次 07 起的卡片对：`rounded-xl border border-border/70 bg-card`。
        此前这五个面板写 `rounded-lg border-border` —— 引导页的每一步都是一张卡，
        没有理由比同产品的任何一张卡更方、边框更重。

        标题：五个 h2 全部收进 `.section-heading`（18px 标准档，全库 65 处）。
        字号本来就没差（`text-lg` 与 `text-title` 都是 18px），差的是字重 ——
        `记录兴趣` / `完善资料` / `推荐关注` / `欢迎加入星语` 是 `font-medium`（500），
        只有 `欢迎来到星语` 是 `font-semibold`（600）。`text-lg font-medium` 这个组合
        全库只在本文件出现，且本文件自己都不统一：同一屏里同样的角色两种重量，
        读者读不出这是层级还是随手写的。

        同时把 `text-primary` 补齐（原只有 `欢迎来到星语` 有）。这不是视觉修正：
        `--primary` 与 `--foreground` 同值（226 37% 16%），写与不写一样黑。显式写出来
        是为了这两个 token 将来分家时，区块标题跟着 primary 走。
      */}

      {/*
        步骤内部（2026-10-13，批次 08b）
        --------------------------------
        说明行：本页原来拿 `text-sm text-muted-foreground` 当说明行用，同一个角色
        在五个步骤里换了三种上边距。统一到 `.lede`（= text-meta / leading-6 /
        muted-foreground，全库 20 处；PageSection 也在用，说明二级区块可以挂）。

        错误按 `AuthFormError` 自己写下的契约分两级，不按"看起来像不像"分：
          · 字段级（自定义兴趣）—— 错误就贴在自己的输入框下面，读者已经在看那个
            字段，所以保持裸文字、不抢焦点；只把 text-xs 提到 text-meta，错误
            不该比它上面那句说明还小。
          · 表单级（saveError）—— 属于「整次操作失败」，而且这个框渲染在全部
            卡片之后：读者点的是卡片里的按钮，眼睛不在页面底部。所以用
            AuthFormError 并传 focusOnMount，让焦点把提示带进视口。
        AuthFormError 的注释逐字点名 `bare <p class="text-sm text-destructive">`
        是要消灭的形态，saveError 正是它。这是该组件第一次跨域复用：auth 六页与
        settings 八页都用框式，onboarding 同属 S8，跟着 S8 走；跨域引用 auth 也
        不是新开的口子 —— useAuth 已被 13 个域引用。

        域 tab 与兴趣按钮的尺寸差刻意保留：前者是视图切换（py-1 / text-xs），
        后者是内容选择（py-1.5 / text-sm，ExploreTopics 的话题云与
        ExplorationInterestsPage 的兴趣标签同形）。两级选择同时可见，靠尺寸差
        加上选中态色差（浅底 bg-accent/15 vs 实心 bg-accent）区分层级；改成一样
        高，读者反而分不清哪一级是自己选的域。24px 也刚好压住 WCAG 2.5.8 的
        最小点击目标线。

        tablist 从 overflow-x-auto 改为 flex-wrap：八个域在 624px 内容宽里需要
        约 688px，横向滚动会把「社区与文化」默认藏起来 —— 与 SettingsNav /
        StudioNav 修过的「隐藏导航」同类，移动端只会更糟。

        简介改用 ui/textarea：手写的那个是整张表单唯一没有焦点环的字段（同页两个
        Input 都有，同域 SettingsProfilePage 的 bio 也有）。组件自带
        ring-1 / placeholder / disabled 态；`min-h-[4.5rem]` 经 tailwind-merge
        覆盖默认的 60px，保留原本三行半的高度。

        页脚那句保持 text-xs 不动：它是页面级辅助提示，比卡片内的说明行更次要，
        且 `<p>` + text-xs 在全库有 53 处、跨 14 个域 —— 是合法档位，不是漂移。
      */}

      {currentStep === "WELCOME" ? (
        <div className="rounded-xl border border-border/70 bg-card p-6">
          {/* Decorative: the heading below carries the meaning, so the mark
              keeps the vivid brand gold. */}
          <Sparkles className="mb-2 h-5 w-5 text-accent" aria-hidden />
          <h2 className="section-heading">欢迎来到星语</h2>
          <p className="lede mt-2">
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
        <div className="rounded-xl border border-border/70 bg-card p-6">
          <h2 className="section-heading">记录兴趣</h2>
          <p className="lede mt-1">
            选择你想记录的领域与兴趣。这些标签只保存在入门资料里，不会改变推荐结果。
          </p>

          <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="兴趣领域">
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

          {/*
            切换动效（2026-10-13）
            ----------------------
            上面那段 08b 注释逐字把域 tab 定为**视图切换**，兴趣按钮定为**内容选择**。
            但切换后这一块是硬切：点了另一个域，下面直接换成另一组标签，没有任何过渡。
            读起来像"点了没反应"——尤其在两个域的兴趣数量接近时。

            用 `animate-fade-in`（220ms，全站最轻一档）而不是 `animate-rise-in`：
            这里是一整片标签云、不是列表，没有"逐项到达"可表达，位移只会让八个域的
            切换看起来像页面在抖。这也是动效词汇表里 `fade-in` 标注的用途
            （"通用淡入、tab 切换"）唯一剩下的落点 —— 其余 tab 切换下方都是列表，
            由 `animate-rise-in` 的错峰负责。

            `key={domain.id}` 本来就在（React 靠它重建这一块），所以不需要额外的重播
            机制：键变了就重挂，动画自然重播。

            兴趣按钮（`aria-pressed` 那一层）刻意不加：选中态由色差表达（浅底
            bg-accent/15 → 实心 bg-accent），逐个标签加动画就是动效滥用。
          */}
          {INTEREST_DOMAINS.filter((domain) => domain.id === activeDomainId).map((domain) => (
            <div key={domain.id} className="animate-fade-in mt-3 flex flex-wrap gap-2">
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
              <p className="mt-2 text-meta text-destructive" role="alert">
                {customInterestError}
              </p>
            ) : null}
          </div>

          <p className="lede mt-3">
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
          className="rounded-xl border border-border/70 bg-card p-6"
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
          <h2 className="section-heading">完善资料</h2>
          <p className="lede mt-1">
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
              <Textarea
                id="onboarding-bio"
                className="min-h-[4.5rem]"
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
        <div className="rounded-xl border border-border/70 bg-card p-6">
          <h2 className="section-heading">推荐关注</h2>
          <p className="lede mt-1">
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
        <div className="rounded-xl border border-border/70 bg-card p-6 text-center">
          <h2 className="section-heading">欢迎加入星语</h2>
          <p className="lede mt-2">
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

      {saveError ? <AuthFormError focusOnMount>{saveError}</AuthFormError> : null}

      <p className="text-xs text-muted-foreground">
        也可以稍后在{" "}
        <Link to="/settings/profile" className="text-accent-strong underline">
          设置
        </Link>{" "}
        里继续改资料。
      </p>
    </section>
  );
}
