import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailWarning, RefreshCw } from "lucide-react";
import { authApi } from "@/api/auth/auth.api";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { Button } from "@/components/ui/button";
import { setStoredToken } from "@/lib/storage";
import { clearStoredRecentAuth } from "@/features/settings/recent-auth";
import {
  AuthStatusPanel,
  authStatusLinkClass,
  authStatusPrimaryClass,
} from "@/features/auth/components/AuthStatusPanel";

/**
 * Email verification (Phase 1A).
 * Real contract: POST /api/v1/auth/email/verify { token } and
 * POST /api/v1/auth/email/resend { email? }.
 * When a ?token= is present the page verifies automatically.
 */
/*
 * One shape for all three states: a state glyph, a conclusion, an explanation,
 * and — only where one exists — a single action.
 *
 * All three states used to render through `AuthCard`, i.e. the LOGIN FORM's
 * shell: a title, a description and a body slot. None of the three is a form.
 * Someone arriving from a verification link wants "did it work?" answered before
 * anything else, and a form shell buries that answer under a header sized for a
 * form to sit under.
 *
 * The glyph carries the state so the reader gets it before reading: a spinner
 * while it is in flight, a gold check when it worked, a warning envelope when
 * there is still something to do.
 *
 * 2026-10-08：这里曾有一份与 `AuthStatusPanel` **逐行等价**的局部副本（V-2）。
 * 已删除并改用共享组件 —— 两者只差 `className` 透传与注释，行为完全一致。
 */

/**
 * 2026-10-08 文案核实：到达本页时"邮件到底发没发出去"有**三种**可能，
 * 而本页此前只有一种文案（"验证链接已发往 X"），在没发出去时是**假话**。
 *
 * 后端契约（逐行核对过，不是推测）：
 *   `sendVerificationMail()` 返回 `false` 仅当 `emailService.sendEmailVerificationLink()`
 *   **没有抛异常**；抛异常则返回 `true`，即 `mailPending = 邮件没发出去`。
 *   `RegisterResponse.mailPending` 是 `Boolean`，发成功时是 `null`（而非 false）。
 *   `resendVerification()` 返回 `mailPending:false` 有**三种**短路情形 ——
 *   邮箱不存在、邮箱已验证、站点未开启注册验证 —— 这三种**一封邮件都没发**，
 *   但响应与"发送成功"**无法区分**（这是刻意的反枚举，参见 password-recovery）。
 *
 * 因此到达 `?mailPending=1` 时必须说"没发出去"，而 resend 成功只能说
 * "若该邮箱需要验证 we've sent it" —— 后端无法证明是哪一种，故一律用条件句。
 *
 * ---------------------------------------------------------------------------
 * 2026-10-08：邮箱换绑闭环（B1）。
 *
 * 后端 `verifyEmail` 现在按 token 的 `purpose` 严格分流，返回值有两种成功：
 *   VERIFIED      —— 注册验证，只置 email_verified_at，邮箱没变，用户仍是当前登录态
 *   EMAIL_CHANGED —— 换绑确认，登录邮箱已换成新邮箱，且**全部会话（含本页所在的
 *                    那个）已被后端撤销**
 *
 * 所以 EMAIL_CHANGED 分支必须清掉本地 token：留着它只会让下一次请求拿到 401，
 * 让用户以为"页面坏了"。清掉后引导重新登录，并说清原因（换绑已生效，但需重新登录），
 * 而不是笼统说"验证成功"。
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token");
  // RegisterPage 在注册返回 mailPending=true 时写入这个参数；本页此前**完全无视**它。
  const mailPending = params.get("mailPending") === "1";

  const [status, setStatus] = useState<"pending" | "verifying" | "verified" | "changed" | "error">(
    token ? "verifying" : "pending",
  );
  const [changedEmail, setChangedEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // 单飞守卫：verifyEmail 不是幂等端点 —— token 被第一个 POST 消费，后续 POST 必得
  // EMAIL_TOKEN_INVALID。StrictMode（dev）下每个组件 mount→unmount→mount，effect 跑两遍；
  // 若两遍各发一次 POST，第二遍必然 400 且是唯一 active 的一遍，会把第一遍的成功覆盖成
  // 「验证未完成」—— 而后端此时已真正完成换绑并撤销全部会话（2026-10-09 浏览器实测踩中：
  // DB 邮箱已改、会话已撤，UI 却报验证失败并诱导用户重发）。同一 token 的多遍 effect
  // 必须共享同一个在途请求。
  const verifyInflight = useRef(new Map<string, ReturnType<typeof authApi.verifyEmail>>());

  useEffect(() => {
    if (!token) return;
    let active = true;
    let request = verifyInflight.current.get(token);
    if (!request) {
      request = authApi.verifyEmail(token).finally(() => {
        verifyInflight.current.delete(token);
      });
      verifyInflight.current.set(token, request);
    }
    request
      .then((result) => {
        if (!active) return;
        if (result.status === "EMAIL_CHANGED") {
          // 会话已被后端撤销：本地凭证立即作废，同时清掉 re-auth grant
          //（它绑定 sessionId，session 没了它本就是废的，但留着会误导下一次操作）。
          setStoredToken(null);
          clearStoredRecentAuth();
          setChangedEmail(result.email ?? email);
          setStatus("changed");
          return;
        }
        setStatus("verified");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setMessage("验证失败，链接可能已过期，请重新发送验证邮件。");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function resend() {
    if (!email) return;
    setResending(true);
    setMessage(null);
    try {
      const result = await authApi.resendEmailVerification(email);
      // `mailPending=false` 有三种短路情形（邮箱不存在 / 已验证 / 未开启验证）
      // 与"发送成功"在响应上不可区分，所以这里**不能**断言"已发送"。
      setMessage(
        result.mailPending
          ? "验证邮件发送失败，请稍后再试。"
          : "如该邮箱需要验证，我们已发出验证邮件，请查收。",
      );
    } catch {
      setMessage("发送失败，请稍后再试。");
    } finally {
      setResending(false);
    }
  }

  if (status === "verifying") {
    return (
      <AuthStatusPanel
        live
        icon={<Loader2 className="h-5 w-5 animate-spin" />}
        disc="bg-surface-sunken text-muted-foreground"
        title="正在验证邮箱"
        body="正在验证，请稍候…"
      />
    );
  }

  if (status === "changed") {
    return (
      <AuthStatusPanel
        icon={<RefreshCw className="h-5 w-5" />}
        disc="bg-accent-soft text-accent-strong"
        title="邮箱已更换"
        body={
          <>
            登录邮箱已改为{" "}
            <strong className="font-medium text-foreground">{changedEmail || "新邮箱"}</strong>
            ，原邮箱已不再用于登录。
            <br />
            为保护账号安全，本次操作已退出你所有设备的登录状态，请用新邮箱重新登录。
          </>
        }
        action={
          <Link to="/login" className={authStatusPrimaryClass}>
            用新邮箱登录
          </Link>
        }
      />
    );
  }

  if (status === "verified") {
    return (
      <AuthStatusPanel
        icon={<CheckCircle2 className="h-5 w-5" />}
        disc="bg-accent-soft text-accent-strong"
        title="邮箱验证成功"
        body="你的邮箱已验证，现在可以登录了。"
        action={
          <Link to="/login" className={authStatusPrimaryClass}>
            前往登录
          </Link>
        }
      />
    );
  }

  const failed = status === "error";

  /*
    Body copy is chosen by what the backend actually confirmed, not by how the
    page was reached:

      链接验证失败     -> 这个 token 无效/过期。它**不能**证明任何邮件送达过，
                       所以不能说"已发往"，只能说"可能已过期"。
      mailPending=1  -> 后端明确发不出去（sendVerificationMail 捕获异常）
      无该参数      -> 注册返回 mailPending=null，即发送未抛异常；这是唯一
                       可以说"已发往"的情形

    The old copy claimed "验证链接已发往 X" unconditionally, which was false for
    both of the first two cases — the page had the flag in the URL the whole time
    and never read it.
  */
  const body = failed ? (
    <>这个链接无法完成验证，可能已经过期或已被使用。你可以重新发送一封新的验证邮件， 或稍后再试。</>
  ) : mailPending ? (
    <>
      <strong className="font-medium text-foreground">{email || "你的邮箱"}</strong> 的验证邮件
      <b className="font-semibold text-foreground">没有发出去</b>
      （邮件通道未配置或发送失败）。你可以稍后重试；若持续失败请联系管理员。
    </>
  ) : (
    <>
      验证链接已发往 <strong className="font-medium text-foreground">{email || "你的邮箱"}</strong>
      。若几分钟内没有收到，请检查垃圾邮件，或点击下方按钮重新发送。
    </>
  );

  return (
    <AuthStatusPanel
      icon={<MailWarning className="h-5 w-5" />}
      disc={
        failed ? "bg-destructive/10 text-destructive" : "bg-surface-sunken text-foreground-soft"
      }
      title={failed ? "验证未完成" : mailPending ? "验证邮件未发出" : "验证你的邮箱"}
      body={body}
      action={
        <>
          {failed && message ? <AuthFormError>{message}</AuthFormError> : null}

          {message && !failed ? <p className="text-meta text-muted-foreground">{message}</p> : null}

          {email ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void resend()}
              disabled={resending}
            >
              {/* 「已发送」是断言，而 resend 的成功响应无法区分"真发出"与
                  三种短路情形（同 resendVerification 契约），所以按钮回到
                  「重新发送验证邮件」并保持可用，让读者能再试一次。 */}
              {resending ? "发送中…" : "重新发送验证邮件"}
            </Button>
          ) : null}

          <Link to="/login" className={authStatusLinkClass}>
            返回登录
          </Link>
        </>
      }
    />
  );
}
