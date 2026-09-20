import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { useAuth } from "@/features/auth/auth.store";
import type { LoginFormValues } from "@/features/auth/auth.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import { setStoredToken } from "@/lib/storage";

/**
 * Login (Phase 1A).
 * Payload follows the real contract: { login, password, rememberMe?, uuid?, code? }.
 * Captcha is only requested when the backend config enables it.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";

  const [values, setValues] = useState<LoginFormValues>({ login: "", password: "", rememberMe: false });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [rememberMeEnabled, setRememberMeEnabled] = useState(true);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captcha, setCaptcha] = useState<{ uuid: string; img: string } | null>(null);
  const [captchaCode, setCaptchaCode] = useState("");

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
        setRememberMeEnabled(config.login?.rememberMe !== false);
        const enabled = config.login?.captchaEnabled === true;
        setCaptchaEnabled(enabled);
        if (enabled) void loadCaptcha();
      })
      .catch(() => {
        /* config unavailable -> keep sane defaults */
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({
        login: values.login,
        password: values.password,
        rememberMe: values.rememberMe,
        uuid: captchaEnabled && captcha ? captcha.uuid : undefined,
        code: captchaEnabled ? captchaCode : undefined,
      });

      // Preserve the backend's forced password-change semantics.
      if (result.mustChangePassword) {
        navigate("/force-change-password", { replace: true });
        return;
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setStoredToken(null);
      if (err instanceof ApiError) {
        setError(err.problem.detail || err.problem.title || "登录失败");
      } else {
        setError("登录失败，请检查账号或密码。");
      }
      if (captchaEnabled) void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="登录星语"
      description="继续使用你的账号参与社区创作。"
      footer={
        <>
          还没有账号？
          <Link to="/register" className="ml-1 text-accent hover:underline">
            立即注册
          </Link>
          <span className="mx-2 text-muted-foreground">·</span>
          <Link to="/forgot-password" className="text-accent hover:underline">
            忘记密码
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="login">账号</Label>
          <Input
            id="login"
            name="login"
            autoComplete="username"
            placeholder="邮箱或用户名"
            value={values.login}
            onChange={(e) => setValues((v) => ({ ...v, login: e.target.value }))}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">密码</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="请输入密码"
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
            required
          />
        </div>

        {captchaEnabled ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="captcha">验证码</Label>
            <div className="flex items-center gap-2">
              <Input
                id="captcha"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                placeholder="请输入验证码"
                required
              />
              {captcha?.img ? (
                <img src={captcha.img} alt="验证码" className="h-10 rounded border border-border" />
              ) : null}
            </div>
          </div>
        ) : null}

        {rememberMeEnabled ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={values.rememberMe}
              onChange={(e) => setValues((v) => ({ ...v, rememberMe: e.target.checked }))}
            />
            记住我
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "登录中…" : "登录"}
        </Button>
      </form>
    </AuthCard>
  );
}
