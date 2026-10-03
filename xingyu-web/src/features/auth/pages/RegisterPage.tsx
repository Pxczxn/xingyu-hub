import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import type { PasswordPolicy } from "@/api/auth/auth.types";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { Bookmark, PenLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import { passwordRulesHint, validatePasswordClient } from "@/lib/password-rules";
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
      .catch(() => setRegistrationOpen(true));
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
      <AuthCard title="注册已关闭" description="当前站点未开放注册，请联系管理员。">
        <Link to="/login" className="text-sm text-accent hover:underline">
          返回登录
        </Link>
      </AuthCard>
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
   */
  const benefits = [
    { icon: PenLine, title: "发布内容", body: "写文章、建系列、发动态，都从同一个创作台开始。" },
    { icon: Users, title: "加入星系", body: "找到同好聚集的地方，参与话题讨论。" },
    { icon: Bookmark, title: "收藏与关注", body: "收藏读过的内容，关注你想继续读的作者。" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
      <div className="rounded-xl border border-border/70 bg-card p-6 sm:p-7">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">注册星语</h1>
          <p className="mt-1.5 text-meta leading-6 text-muted-foreground">
            创建账号，开始创作与发现。
          </p>
        </header>

        <div className="mt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/*
          Six fields in one flat stack gave the reader no structure and no help:
          they could not tell which fields were the account's identity, which was
          its secret, and which were one-off checks — and nothing explained what
          an answer was for. The fields are grouped, and the two that are
          permanent (邮箱 / 用户名) say so, because those are the two a reader
          would most regret getting wrong.
        */}
            <p className="text-meta font-medium text-foreground-soft">账号</p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-meta text-muted-foreground">
                用于登录与找回密码，注册后需要先验证。
              </p>
              {fieldErrors.email ? (
                <p className="text-meta text-destructive">{fieldErrors.email}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <p className="text-meta text-muted-foreground">
                只能使用小写字母、数字和下划线，注册后不可修改。
              </p>
              {fieldErrors.username ? (
                <p className="text-meta text-destructive">{fieldErrors.username}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">密码</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">{passwordRulesHint(passwordRules)}</p>
              {fieldErrors.password ? (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              ) : null}
            </div>

            {verifyPhoneRequired ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">手机号</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
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
                  {captcha?.img ? (
                    <img
                      src={captcha.img}
                      alt="验证码"
                      className="h-10 rounded border border-border"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? "注册中…" : "注册"}
            </Button>
          </form>
        </div>

        <p className="mt-6 border-t border-border/60 pt-4 text-meta text-muted-foreground">
          已有账号？
          <Link to="/login" className="ml-1 font-medium text-accent-strong hover:underline">
            直接登录
          </Link>
        </p>
      </div>

      <aside className="lg:sticky lg:top-24">
        <div className="rounded-xl border border-border/70 bg-card p-5">
          <p className="eyebrow mb-4">加入星语后你可以</p>
          <ul className="flex list-none flex-col gap-4 p-0">
            {benefits.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong"
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-card font-medium text-primary">{item.title}</span>
                    <span className="mt-0.5 block text-meta leading-5 text-muted-foreground">
                      {item.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
