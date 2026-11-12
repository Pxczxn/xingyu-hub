import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import type { PasswordPolicy } from "@/api/auth/auth.types";
import { ArchetypeFrame } from "@/components/layout";
import { AuthActionBar } from "@/features/auth/components/AuthActionBar";
import { AuthCaptchaImage } from "@/features/auth/components/AuthCaptchaImage";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { Bookmark, PenLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import {
  PASSWORD_POLICY_FALLBACK_NOTICE,
  passwordRulesHint,
  usingFallbackPasswordPolicy,
  validatePasswordClient,
} from "@/lib/password-rules";
import { mapUsernameFieldError, validateUsernameClient } from "@/lib/username-rules";

/**
 * Register (Phase 1A).
 * Payload follows the real contract:
 *   { email, username, password, termsVersion, phone?, smsCode?, uuid?, code? }
 * Routing after success is driven by the real response:
 *   auditStatus === "PENDING"        -> /register/pending-audit
 *   email verification still pending -> /verify-email?email=...
 *   otherwise                        -> /login?registered=1
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()),
  );

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captcha, setCaptcha] = useState<{ uuid: string; img: string } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [verifyEmailRequired, setVerifyEmailRequired] = useState(false);
  const [verifyPhoneRequired, setVerifyPhoneRequired] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [passwordRules, setPasswordRules] = useState<PasswordPolicy | undefined>();
  // policy 拉不到时不再静默：页面在规则提示下方明说「正在用默认规则」。
  const [passwordPolicyFallback, setPasswordPolicyFallback] = useState(false);

  async function loadCaptcha() {
    try {
      const result = await authApi.getCaptcha();
      setCaptcha({ uuid: result.uuid, img: result.img });
      setCaptchaCode("");
    } catch {
      setCaptcha(null);
    }
  }

  useEffect(() => {
    let active = true;
    getPublicConfig({ fresh: true })
      .then((config) => {
        if (!active) return;
        setPasswordRules(config.password);
        setPasswordPolicyFallback(usingFallbackPasswordPolicy(config.password));
        setRegistrationOpen(config.registration?.enabled !== false);
        setVerifyEmailRequired(config.registration?.verifyEmail === true);
        setVerifyPhoneRequired(
          config.registration?.verifyPhone === true && config.sms?.enabled === true,
        );
        const on =
          config.registration?.captchaEnabled === true || config.login?.captchaEnabled === true;
        setCaptchaEnabled(on);
        if (on) void loadCaptcha();
      })
      .catch(() => {
        if (!active) return;
        // 不再静默：校验会自动回退到内置下限，但不能让用户以为已拿到站点规则。
        setPasswordPolicyFallback(true);
        setRegistrationOpen(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyApiError(err: unknown) {
    if (err instanceof ApiError) {
      const detail = err.problem.detail ?? "";
      const match = detail.match(/^(\w+): (.+)$/);
      if (match) {
        const [, field, message] = match;
        setFieldErrors({
          [field]: field === "username" ? mapUsernameFieldError(message) : message,
        });
      } else if (err.problem.status >= 500) {
        setError("服务器处理失败，请稍后重试");
      } else {
        setError(err.problem.detail || err.problem.title);
      }
    } else {
      setError("操作失败，请稍后重试");
    }
  }

  async function sendSmsCode() {
    setError(null);
    setSendingSms(true);
    try {
      const result = await authApi.sendRegisterSms(phone);
      if (result.smsPending) setError("短信通道暂未配置，请联系管理员或稍后再试");
    } catch (err) {
      applyApiError(err);
    } finally {
      setSendingSms(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const usernameError = validateUsernameClient(username);
    if (usernameError) {
      setFieldErrors({ username: usernameError });
      return;
    }
    const passwordError = validatePasswordClient(password, passwordRules);
    if (passwordError) {
      setFieldErrors({ password: passwordError });
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.register(
        {
          email,
          username,
          password,
          termsVersion: "v1",
          phone: verifyPhoneRequired ? phone : undefined,
          smsCode: verifyPhoneRequired ? smsCode : undefined,
          uuid: captchaEnabled && captcha ? captcha.uuid : undefined,
          code: captchaEnabled ? captchaCode : undefined,
        },
        idempotencyKey.current,
      );

      if (result.auditStatus === "PENDING") {
        navigate("/register/pending-audit?registered=1", { replace: true });
        return;
      }

      const status = result.emailVerification?.status;
      if (verifyEmailRequired && status !== "VERIFIED" && status !== "NOT_REQUIRED") {
        const params = new URLSearchParams({ email, registered: "1" });
        if (result.mailPending) params.set("mailPending", "1");
        navigate(`/verify-email?${params.toString()}`, { replace: true });
        return;
      }

      navigate("/login?registered=1", { replace: true });
    } catch (err) {
      applyApiError(err);
      if (captchaEnabled) void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  if (registrationOpen === false) {
    return (
      <ArchetypeFrame skeleton="SK5" header="shell" density="loose">
        <AuthCard
          variant="banner"
          title="注册已关闭"
          description="当前站点未开放注册，请联系管理员。"
          footer={
            <Link to="/login" className="text-accent-strong hover:underline">
              返回登录
            </Link>
          }
        >
          <p className="text-meta leading-6 text-muted-foreground">
            已经有账号的话，可以直接登录；如果你的账号还在审核中，审核结果会通过邮件通知。
          </p>
        </AuthCard>
      </ArchetypeFrame>
    );
  }

  /*
   * Two columns at `lg`, one below it.
   *
   * `/register` is the one auth screen with a second job: besides collecting the
   * fields it has to answer "why would I bother?". On a single 448px column there
   * was nowhere to put that answer — above the form pushes the fields down, below
   * it arrives after the reader has already decided. So this page asks for the
   * `wide` layout variant (see AuthLayout) and puts the reason BESIDE the form.
   *
   * The panel is not hidden on small screens; it moves under the form. A value
   * proposition is at least as useful on a phone as on a desktop.
   *
   * Every claim below maps to a feature that exists: articles, series and moments
   * are the three publishable types, 星系 is the group surface, and 收藏 is the
   * bookmark store. Nothing here promises anything the product does not do.
   *
   * --- 2026-11-10 批次 C：SK5 · 幅 / 松 / 齐 -------------------------------
   * 映射表给本页的是「幅 / 松 / 齐」，与 `/login` 的「线」必须一眼分开，所以：
   *   幅  `AuthCard variant="banner"`：标题落在一块带 `motif-orbit` 母题的面上
   *       （B §6 M1，中性发丝环），形成「横幅 → 字段」两段式；登录页没有这层面。
   *   松  `contentClassName="gap-6"` + 每个字段下方的说明行。
   *   齐  **不再并排**：价值主张从 320px 的 `aside` 移到表单下方，与表单同宽、
   *       三列等分（`sm:grid-cols-3`）。并排是 R=错 的构图，而本页在映射表里是 齐 ——
   *       同域里错留给 PendingAudit / VerifyEmail。内容一个字没删，只是换了位置。
   * 提交按钮移进 `AuthActionBar`（仍在 `<form>` 内），校验与提交逻辑一行未动。
   */
  const benefits = [
    { icon: PenLine, title: "发布内容", body: "写文章、建系列、发动态，都从同一个创作台开始。" },
    { icon: Users, title: "加入星系", body: "找到同好聚集的地方，参与话题讨论。" },
    { icon: Bookmark, title: "收藏与关注", body: "收藏读过的内容，关注你想继续读的作者。" },
  ];

  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="loose">
      <AuthCard
        variant="banner"
        title="注册星语"
        description="创建账号，开始创作与探索。"
        contentClassName="gap-6"
        footer={
          <>
            已有账号？
            <Link to="/login" className="ml-1 font-medium text-accent-strong hover:underline">
              直接登录
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/*
          Six fields in one flat stack gave the reader no structure and no help:
          they could not tell which fields were the account's identity, which was
          its secret, and which were one-off checks — and nothing explained what
          an answer was for. The fields are grouped, and the two that are
          permanent (邮箱 / 用户名) say so, because those are the two a reader
          would most regret getting wrong.
        */}
          <p className="border-b border-border/60 pb-2 text-meta font-medium text-foreground-soft">
            账号
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: "" }));
              }}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              required
            />
            <p className="text-meta text-muted-foreground">
              用于登录与找回密码，注册后需要先验证。
            </p>
            {fieldErrors.email ? (
              <p id="email-error" role="alert" className="text-meta text-destructive">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setFieldErrors((prev) => ({ ...prev, username: "" }));
              }}
              aria-invalid={fieldErrors.username ? true : undefined}
              aria-describedby={fieldErrors.username ? "username-error" : undefined}
              required
            />
            <p className="text-meta text-muted-foreground">
              只能使用小写字母、数字和下划线，注册后不可修改。
            </p>
            {fieldErrors.username ? (
              <p id="username-error" role="alert" className="text-meta text-destructive">
                {fieldErrors.username}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">密码</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: "" }));
              }}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              required
            />
            {/*
              规则提示与紧跟其下的错误信息是同一个字段的两条注释，此前一个
              12px（`text-xs`）一个 13px（`text-meta`），叠在一起像两级信息。
              认证域的辅助文本只有 `text-meta` 一档（见 `AuthCard` 的注释），
              这里收进去。
            */}
            <p className="text-meta text-muted-foreground">{passwordRulesHint(passwordRules)}</p>
            {passwordPolicyFallback ? (
              <p role="status" className="text-meta text-warning">
                {PASSWORD_POLICY_FALLBACK_NOTICE}
              </p>
            ) : null}
            {fieldErrors.password ? (
              <p id="password-error" role="alert" className="text-meta text-destructive">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          {verifyPhoneRequired ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">手机号</Label>
              <div className="flex items-center gap-2">
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void sendSmsCode()}
                  disabled={sendingSms || !phone}
                >
                  {sendingSms ? "发送中…" : "发送验证码"}
                </Button>
              </div>
              <Label htmlFor="smsCode">短信验证码</Label>
              <Input
                id="smsCode"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                required
              />
            </div>
          ) : null}

          {captchaEnabled ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="captcha">验证码</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="captcha"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  required
                />
                {captcha?.img ? <AuthCaptchaImage src={captcha.img} /> : null}
              </div>
            </div>
          ) : null}

          {error ? (
            <AuthFormError testId="register-error" focusOnMount>
              {error}
            </AuthFormError>
          ) : null}

          <AuthActionBar>
            <Button type="submit" disabled={submitting}>
              {submitting ? "注册中…" : "注册"}
            </Button>
          </AuthActionBar>
        </form>
      </AuthCard>

      {/* R=齐：价值主张与表单同宽、同边，落在下面而不是并排。 */}
      <section
        aria-labelledby="register-benefits"
        className="rounded-card border border-border/70 bg-card px-6 py-5"
      >
        <h2 id="register-benefits" className="text-card font-semibold text-primary">
          加入星语后你可以
        </h2>
        <ul className="mt-4 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-3">
          {benefits.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-surface-sunken text-foreground-soft"
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-card font-medium text-primary">{item.title}</span>
                  <span className="mt-0.5 block text-meta leading-6 text-muted-foreground">
                    {item.body}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </ArchetypeFrame>
  );
}
