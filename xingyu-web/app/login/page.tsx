"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError, setStoredToken } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";
import { resolvePostLoginPath } from "@/lib/post-login-routing";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";
  const registered = params.get("registered") === "1";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [rememberMeEnabled, setRememberMeEnabled] = useState(true);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaUuid, setCaptchaUuid] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");

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
        setRegistrationOpen(config.registration?.enabled !== false);
        setRememberMeEnabled(config.login?.rememberMe !== false);
        const enabled = config.login?.captchaEnabled === true;
        setCaptchaEnabled(enabled);
        if (enabled) void loadCaptcha();
      })
      .catch(() => {
        setRegistrationOpen(true);
        setRememberMeEnabled(true);
      });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await communityApi.login({
        login,
        password,
        rememberMe,
        uuid: captchaEnabled ? captchaUuid : undefined,
        code: captchaEnabled ? captchaCode : undefined,
      });
      router.push(await resolvePostLoginPath(returnTo));
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "登录失败");
      else setError("登录失败，请稍后重试");
      setStoredToken(null);
      if (captchaEnabled) void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="欢迎回来"
      title="登录星语社区"
      description="继续阅读你关心的内容，也继续把想法写成自己的星图。"
      footer={
        registrationOpen ? (
          <>还没有账号？ <Link href="/register" className="font-medium text-[#35457f] underline-offset-4 hover:underline">创建账号</Link></>
        ) : (
          <>社区注册暂未开放</>
        )
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {registered && <Alert variant="success">注册成功，请登录。</Alert>}
          <div>
            <Label htmlFor="login">邮箱或用户名</Label>
            <Input id="login" value={login} onChange={(e) => setLogin(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">密码</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {captchaEnabled && (
            <div>
              <Label htmlFor="captcha">验证码</Label>
              <p className="mb-1 text-xs text-zinc-500">与管理端「登录配置」同步；社区使用图形/算术验证码</p>
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
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            {rememberMeEnabled && (
              <>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                记住我
              </>
            )}
          </label>
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button className="mt-1 h-10" type="submit" disabled={submitting}>
            {submitting ? "登录中…" : "登录"}
          </Button>
        <Link href="/forgot-password" className="mt-1 w-fit text-sm font-medium text-[#35457f] underline-offset-4 hover:underline">忘记密码</Link>
      </form>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-[#f8f7f3] text-sm text-slate-600">正在准备登录页…</main>}>
      <LoginForm />
    </Suspense>
  );
}
