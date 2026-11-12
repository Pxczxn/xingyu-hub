import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { ArchetypeFrame } from "@/components/layout";
import { AuthActionBar } from "@/features/auth/components/AuthActionBar";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import {
  AuthStatusPanel,
  authStatusPrimaryClass,
} from "@/features/auth/components/AuthStatusPanel";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import {
  PASSWORD_POLICY_FALLBACK_NOTICE,
  passwordRulesHint,
  usingFallbackPasswordPolicy,
  validatePasswordClient,
} from "@/lib/password-rules";
import type { PasswordPolicy } from "@/api/auth/auth.types";
import { useEffect } from "react";

/**
 * Reset password (Phase 1A).
 * Real contract: POST /api/v1/auth/password-reset { token, password }.
 *
 * --- 2026-11-10 批次 C：SK5 · 幅 / 紧 / 出 -------------------------------
 * 幅：`AuthCard variant="banner"` —— 标题落在一块带 `motif-orbit` 母题的面（B §6）。
 * 出：`bleed` —— 横幅左右各越出内容列 16/24px（= `.content-shell` 的 `px-4`/`md:px-6`），
 *     因此它是本页**唯一**比其它块宽的块，其后字段与操作条回到窄栏。两种状态都保持
 *     同一个 H 与同一个 R，失效链接不会换成一个"居中小卡"。
 * 紧：`density="compact"` + `contentClassName="gap-3"`（两个字段之间不留说明段落）。
 * 校验（两次输入一致 / 密码策略）与提交逻辑一行未动，只换了外壳与按钮位置。
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 两次输入不一致是 `确认新密码` 这一个字段的问题 —— 单独放，别混进表单级错误。
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordRules, setPasswordRules] = useState<PasswordPolicy | undefined>();
  // policy 拉不到时不再静默：页面在规则提示下方明说「正在用默认规则」。
  const [passwordPolicyFallback, setPasswordPolicyFallback] = useState(false);

  useEffect(() => {
    getPublicConfig()
      .then((config) => {
        setPasswordRules(config.password);
        setPasswordPolicyFallback(usingFallbackPasswordPolicy(config.password));
      })
      .catch(() => setPasswordPolicyFallback(true));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmError(null);

    if (password !== confirm) {
      // Field-level, not form-level: the sentence says which control is wrong,
      // so raising a second copy in the form-wide alert would say it twice.
      setConfirmError("两次输入的密码不一致");
      return;
    }
    const ruleError = validatePasswordClient(password, passwordRules);
    if (ruleError) {
      setError(ruleError);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem.detail || err.problem.title
          : "重置失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    /*
      An unusable link is a DEAD END, not a form.
      The reader cannot fix this by typing anything — the only way forward is to
      request a fresh link. Rendering it through the form's shell (as it was)
      offered a body slot and a footer under a title, which reads like there is
      something to fill in.
    */
    return (
      <ArchetypeFrame skeleton="SK5" header="shell" density="compact">
        <AuthStatusPanel
          variant="banner"
          className="-mx-4 md:-mx-6"
          icon={<LinkIcon className="h-5 w-5" />}
          disc="bg-destructive/10 text-destructive"
          title="链接无效"
          body="当前链接缺少 token，请回到邮箱点击完整链接。重置链接有时效，过期后需要重新申请。"
          action={
            <Link to="/forgot-password" className={authStatusPrimaryClass}>
              重新申请重置链接
            </Link>
          }
        />
      </ArchetypeFrame>
    );
  }

  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="compact">
      <AuthCard
        variant="banner"
        bleed
        title="设置新密码"
        description="新密码需要满足页面下方的规则提示；保存后会用新密码登录。"
        contentClassName="gap-3"
        footer={
          <Link to="/login" className="text-accent-strong hover:underline">
            返回登录
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">新密码</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-meta text-muted-foreground">{passwordRulesHint(passwordRules)}</p>
            {passwordPolicyFallback ? (
              <p role="status" className="text-meta text-warning">
                {PASSWORD_POLICY_FALLBACK_NOTICE}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">确认新密码</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setConfirmError(null);
              }}
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? "confirm-error" : undefined}
              required
            />
            {confirmError ? (
              <p id="confirm-error" role="alert" className="text-meta text-destructive">
                {confirmError}
              </p>
            ) : null}
          </div>

          {error ? (
            <AuthFormError testId="reset-password-error" focusOnMount>
              {error}
            </AuthFormError>
          ) : null}

          <AuthActionBar>
            <Button type="submit" disabled={submitting}>
              {submitting ? "提交中…" : "重置密码"}
            </Button>
          </AuthActionBar>
        </form>
      </AuthCard>
    </ArchetypeFrame>
  );
}
