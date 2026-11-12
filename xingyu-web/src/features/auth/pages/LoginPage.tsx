import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { ArchetypeFrame } from "@/components/layout";
import { AuthActionBar } from "@/features/auth/components/AuthActionBar";
import { AuthCaptchaImage } from "@/features/auth/components/AuthCaptchaImage";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { useAuth } from "@/features/auth/auth.store";
import type { LoginFormValues } from "@/features/auth/auth.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { resolvePostLoginPath } from "@/features/onboarding/post-login-routing";
import { getPublicConfig } from "@/lib/public-config";

/**
 * Wording that only makes sense when the *credentials* were rejected.
 * Used by {@link describeLoginFailure} to tell a credential rejection apart from
 * a session-expiry failure detail handed over by a shared interceptor.
 */
const CREDENTIAL_HINTS = ["账号", "密码", "用户名", "邮箱"];

/**
 * User-facing message for a failed sign-in.
 *
 * /login is a guest-only surface (`GuestOnly` in `router/guards.tsx`), so a 401
 * here answers "these credentials are wrong" — it says nothing about a session
 * the browser may hold in another tab. Backend wording that already talks about
 * credentials is shown as-is; a session-expiry detail ("会话已过期…") would be
 * nonsense on this page and is replaced with the credential wording instead.
 * (Audit 2026-11-10, A1)
 */
function describeLoginFailure(err: unknown): string {
  if (!(err instanceof ApiError)) return "登录失败，请检查账号或密码。";
  const { status, detail, title } = err.problem;
  const message = detail || title || "登录失败";
  if (status !== 401 && status !== 403) return message;
  return CREDENTIAL_HINTS.some((hint) => message.includes(hint)) ? message : "账号或密码不正确";
}

/**
 * Login (Phase 1A).
 * Payload follows the real contract: { login, password, rememberMe?, uuid?, code? }.
 * Captcha is only requested when the backend config enables it.
 *
 * --- 2026-11-10 批次 C：SK5 · 线 / 松 / 齐 -------------------------------
 * 骨架由 `ArchetypeFrame skeleton="SK5"` 给出（居中窄栏；窄栏宽度仍由 `AuthLayout`
 * 的 `max-w-md` 决定，frame 只负责「居中、无侧栏、单一竖列」这件事）。H=线 由
 * `AuthCard variant="line"` 表达：标题贴内容列左缘、下面一条发丝线、**没有卡面**。
 * 与 `/register`（幅：带母题的有面横幅）放在一起时，一眼就能分出「这是随便一个
 * 表单页」还是「这是本域的落地页」。D=松 落在 `contentClassName="gap-5"` 与
 * 每个字段下方的说明行上；R=齐 就是「所有块与内容列同宽」，frame 不传 `rail` 即如此。
 *
 * 业务逻辑（校验 / 提交流程 / captcha 重载 / returnTo 解析）一行未动：只把
 * 提交按钮移进 `AuthActionBar`（仍在 `<form>` 内部，`type="submit"` 的语义不变）。
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";

  /*
   * RegisterPage hands the new account here as `/login?registered=1`. Read it
   * once, on mount: a guest-only guard now keeps a signed-in reader off this
   * page, so the flag can only be the freshly-created account hand-off. It hides
   * as soon as the reader starts filling the form (see the form's onChange) —
   * an acknowledgement, not a permanent banner.
   */
  const [showRegisteredNotice, setShowRegisteredNotice] = useState(
    () => params.get("registered") === "1",
  );

  const [values, setValues] = useState<LoginFormValues>({
    login: "",
    password: "",
    rememberMe: false,
  });
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
    let result;
    try {
      result = await login({
        login: values.login,
        password: values.password,
        rememberMe: values.rememberMe,
        uuid: captchaEnabled && captcha ? captcha.uuid : undefined,
        code: captchaEnabled ? captchaCode : undefined,
      });
    } catch (err) {
      // Only *report* the failure — never clear the session here. Clearing the
      // token on a failed submit used to sign the whole browser out (Audit A1).
      // GuestOnly now keeps a signed-in reader off /login, but the guard still
      // admits `status === "error"` (token stored, /me unreachable), so a failed
      // submit must not delete a token that was never proven dead.
      setError(describeLoginFailure(err));
      if (captchaEnabled) void loadCaptcha();
      return;
    } finally {
      setSubmitting(false);
    }

    // Preserve the backend's forced password-change semantics.
    // Navigation stays outside the login catch: a thrown redirect must not
    // delete the session login() just stored.
    if (result.mustChangePassword) {
      navigate("/force-change-password", { replace: true });
      return;
    }
    navigate(await resolvePostLoginPath(returnTo), { replace: true });
  }

  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="loose">
      <AuthCard
        variant="line"
        title="登录星语"
        description="继续使用你的账号参与社区创作。"
        contentClassName="gap-5"
        footer={
          <>
            还没有账号？
            <Link to="/register" className="ml-1 text-accent-strong hover:underline">
              立即注册
            </Link>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link to="/forgot-password" className="text-accent-strong hover:underline">
              忘记密码
            </Link>
          </>
        }
      >
        {showRegisteredNotice ? (
          <p
            role="status"
            data-testid="login-registered"
            className="rounded-control border border-border bg-card p-3 text-meta text-foreground"
          >
            账号已创建，请使用刚才注册的邮箱或用户名登录。
          </p>
        ) : null}

        <form
          onSubmit={handleSubmit}
          /*
           * Any typing in the form retires the registration acknowledgement: it
           * confirmed the previous screen's success, and once the reader is
           * filling this form it has served its purpose.
           */
          onChange={() => setShowRegisteredNotice(false)}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="login">账号</Label>
            <Input
              id="login"
              name="login"
              autoComplete="username"
              placeholder="邮箱或用户名"
              value={values.login}
              onChange={(e) => setValues((v) => ({ ...v, login: e.target.value }))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              required
            />
            <p className="text-meta text-muted-foreground">用注册时填写的邮箱或用户名登录。</p>
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
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
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
                {captcha?.img ? <AuthCaptchaImage src={captcha.img} /> : null}
              </div>
            </div>
          ) : null}

          {rememberMeEnabled ? (
            <label className="flex items-center gap-2 text-meta text-muted-foreground">
              <input
                type="checkbox"
                checked={values.rememberMe}
                onChange={(e) => setValues((v) => ({ ...v, rememberMe: e.target.checked }))}
              />
              记住我
            </label>
          ) : null}

          {error ? (
            <AuthFormError id="login-error" testId="login-error" focusOnMount>
              {error}
            </AuthFormError>
          ) : null}

          <AuthActionBar>
            <Button type="submit" disabled={submitting}>
              {submitting ? "登录中…" : "登录"}
            </Button>
          </AuthActionBar>
        </form>
      </AuthCard>
    </ArchetypeFrame>
  );
}
