import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/features/auth/auth.store";
import type { LoginFormValues, LoginLocationState } from "@/features/auth/auth.types";

/**
 * Login page (Phase 0). Functional correctness over visual fidelity.
 * Register / forgot-password / reset-password / force-change-password /
 * verify-email are explicitly out of scope for this round.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state ?? {}) as LoginLocationState;
  const redirectTo = state.from ?? "/";

  const [values, setValues] = useState<LoginFormValues>({
    login: "",
    password: "",
    rememberMe: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ login: values.login, password: values.password, rememberMe: values.rememberMe });
      navigate(redirectTo, { replace: true });
    } catch {
      setError("登录失败，请检查账号或密码。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录星语</CardTitle>
        <CardDescription>继续使用你的账号参与社区创作。</CardDescription>
      </CardHeader>
      <CardContent>
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

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={values.rememberMe}
              onChange={(e) => setValues((v) => ({ ...v, rememberMe: e.target.checked }))}
            />
            记住我
          </label>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="md" disabled={submitting}>
            {submitting ? "登录中…" : "登录"}
          </Button>

          <p className="text-xs text-muted-foreground">
            还没有账号？
            <Link to="/" className="ml-1 text-accent hover:underline">
              返回首页
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
