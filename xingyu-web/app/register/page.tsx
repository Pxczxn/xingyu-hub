"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputWithLengthHint } from "@/components/ui/input-with-length-hint";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordRuleHints } from "@/components/ui/password-rule-hints";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";
import { validatePasswordClient } from "@/lib/password-rules";
import { USERNAME_MAX_LENGTH, mapUsernameFieldError, validateUsernameClient } from "@/lib/username-rules";
import type { PublicConfig } from "@/lib/community-api";

export default function RegisterPage() {
  const router = useRouter();
  const registerIdempotencyKey = useRef(crypto.randomUUID());
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaUuid, setCaptchaUuid] = useState("");
  const [captchaImg, setCaptchaImg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [verifyEmailRequired, setVerifyEmailRequired] = useState(false);
  const [verifyPhoneRequired, setVerifyPhoneRequired] = useState(false);
  const [needAudit, setNeedAudit] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [passwordRules, setPasswordRules] = useState<PublicConfig["password"] | undefined>();

  async function loadCaptcha() {
    try {
      const result = await communityApi.getCaptcha();
      setCaptchaImg(result.img);
      setCaptchaUuid(result.uuid);
      setCaptchaCode("");
    } catch {
      setCaptchaImg("");
      setCaptchaUuid("");
    }
  }

  useEffect(() => {
    getPublicConfig({ fresh: true })
      .then((config) => {
        setPasswordRules(config.password);
        setRegistrationOpen(config.registration?.enabled !== false);
        setVerifyEmailRequired(config.registration?.verifyEmail === true);
        setVerifyPhoneRequired(
          config.registration?.verifyPhone === true && config.sms?.enabled === true
        );
        setNeedAudit(config.registration?.needAudit === true);
        const captchaOn =
          config.registration?.captchaEnabled === true || config.login?.captchaEnabled === true;
        setCaptchaEnabled(captchaOn);
        if (captchaOn) void loadCaptcha();
      })
      .catch(() => setRegistrationOpen(true));
  }, []);

  async function sendSmsCode() {
    setError(null);
    setSendingSms(true);
    try {
      const result = await communityApi.sendRegisterSms(phone);
      if (result.smsPending) {
        setError("短信通道暂未配置，请联系管理员或稍后再试");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.problem.detail ?? "";
        const match = detail.match(/^(\w+): (.+)$/);
        if (match) {
          const [, field, message] = match;
          setFieldErrors({
            [field]: field === "username" ? mapUsernameFieldError(message) : message,
          });
        } else setError(err.problem.detail || err.problem.title);
      } else {
        setError("验证码发送失败");
      }
    } finally {
      setSendingSms(false);
    }
  }

  async function submitRegister(event: FormEvent) {
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
      const result = await communityApi.register(
        {
          email,
          username,
          password,
          termsVersion: "v1",
          phone: verifyPhoneRequired ? phone : undefined,
          smsCode: verifyPhoneRequired ? smsCode : undefined,
          uuid: captchaEnabled ? captchaUuid : undefined,
          code: captchaEnabled ? captchaCode : undefined,
        },
        registerIdempotencyKey.current
      );

      if (result.auditStatus === "PENDING") {
        router.replace("/register/pending-audit?registered=1");
        return;
      }

      if (
        verifyEmailRequired &&
        result.emailVerification?.status !== "VERIFIED" &&
        result.emailVerification?.status !== "NOT_REQUIRED"
      ) {
        const params = new URLSearchParams({ email, registered: "1" });
        if (result.mailPending) params.set("mailPending", "1");
        router.replace(`/verify-email?${params.toString()}`);
        return;
      }

      router.replace("/login?registered=1");
    } catch (err) {
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
        setError("注册失败，请稍后重试");
      }
      if (captchaEnabled) void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="从这里开始"
      title="加入星语社区"
      description={
        needAudit
          ? "提交注册后需管理员审核通过，方可登录社区。"
          : verifyEmailRequired
            ? "创建账号后完成邮箱验证，再按自己的兴趣开始阅读、关注与创作。"
            : "创建账号后即可登录，按自己的兴趣开始阅读、关注与创作。"
      }
      footer={
        <>
          已有账号？{" "}
          <Link href="/login" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
            直接登录
          </Link>
        </>
      }
    >
      {registrationOpen === null ? (
        <p className="text-sm text-slate-600">加载中…</p>
      ) : !registrationOpen ? (
        <div className="space-y-4 text-sm text-slate-600">
          <p>社区注册暂未开放，请稍后再试或使用已有账号登录。</p>
          <Button asChild className="h-11 bg-[#13234d] text-base hover:bg-[#1b326d]">
            <Link href="/login">返回登录</Link>
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submitRegister(event);
          }}
        >
          <div>
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <Label htmlFor="username">用户名</Label>
            <InputWithLengthHint
              id="username"
              value={username}
              maxLength={USERNAME_MAX_LENGTH}
              onChange={(e) => {
                setUsername(e.target.value);
                if (fieldErrors.username) {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.username;
                    return next;
                  });
                }
              }}
              required
            />
            {fieldErrors.username && <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>}
          </div>
          {verifyPhoneRequired && (
            <>
              <div>
                <Label htmlFor="phone">手机号</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                {fieldErrors.phone && <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>}
              </div>
              <div>
                <Label htmlFor="smsCode">短信验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="smsCode"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="6 位验证码"
                    required
                  />
                  <Button type="button" variant="outline" disabled={sendingSms || !phone} onClick={() => void sendSmsCode()}>
                    {sendingSms ? "发送中…" : "获取验证码"}
                  </Button>
                </div>
                {fieldErrors.smsCode && <p className="mt-1 text-sm text-red-600">{fieldErrors.smsCode}</p>}
              </div>
            </>
          )}
          <div>
            <Label htmlFor="password">密码</Label>
            <PasswordInput
              id="password"
              value={password}
              showLengthHint
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.password;
                    return next;
                  });
                }
              }}
              minLength={passwordRules?.minLength ?? 6}
              maxLength={passwordRules?.maxLength ?? 64}
              required
            />
            <PasswordRuleHints value={password} rules={passwordRules} />
            {fieldErrors.password && <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>}
          </div>
          {captchaEnabled && (
            <div>
              <Label htmlFor="captcha">验证码</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  id="captcha"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  placeholder="请输入验证码"
                  required
                />
                {captchaImg ? (
                  <button type="button" onClick={() => void loadCaptcha()} title="点击刷新">
                    <img src={captchaImg} alt="验证码" className="h-10 rounded border" />
                  </button>
                ) : null}
              </div>
              {fieldErrors.code && <p className="mt-1 text-sm text-red-600">{fieldErrors.code}</p>}
            </div>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button className="h-11 bg-[#13234d] text-base hover:bg-[#1b326d]" type="submit" disabled={submitting}>
            {submitting ? "提交中…" : "注册"}
          </Button>
        </form>
      )}
    </AuthPageShell>
  );
}
