import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import type { PasswordPolicy } from "@/api/auth/auth.types";
import { AuthCard } from "@/features/auth/components/AuthCard";
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
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
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
        setVerifyPhoneRequired(config.registration?.verifyPhone === true && config.sms?.enabled === true);
        const on = config.registration?.captchaEnabled === true || config.login?.captchaEnabled === true;
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
        setFieldErrors({ [field]: field === "username" ? mapUsernameFieldError(message) : message });
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

  return (
    <AuthCard
      title="注册星语"
      description="创建账号，开始创作与发现。"
      footer={
        <>
          已有账号？
          <Link to="/login" className="ml-1 text-accent hover:underline">
            直接登录
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          {fieldErrors.email ? <p className="text-sm text-destructive">{fieldErrors.email}</p> : null}
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
          {fieldErrors.username ? (
            <p className="text-sm text-destructive">{fieldErrors.username}</p>
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
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <Button type="button" variant="outline" onClick={() => void sendSmsCode()} disabled={sendingSms || !phone}>
                {sendingSms ? "发送中…" : "发送验证码"}
              </Button>
            </div>
            <Label htmlFor="smsCode">短信验证码</Label>
            <Input id="smsCode" value={smsCode} onChange={(e) => setSmsCode(e.target.value)} required />
          </div>
        ) : null}

        {captchaEnabled ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="captcha">验证码</Label>
            <div className="flex items-center gap-2">
              <Input id="captcha" value={captchaCode} onChange={(e) => setCaptchaCode(e.target.value)} required />
              {captcha?.img ? (
                <img src={captcha.img} alt="验证码" className="h-10 rounded border border-border" />
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
    </AuthCard>
  );
}
