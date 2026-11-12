import { Link, useSearchParams } from "react-router-dom";
import { Check, Clock4, Mail } from "lucide-react";
import { ArchetypeFrame } from "@/components/layout";
import { AuthActionBar } from "@/features/auth/components/AuthActionBar";
import { cn } from "@/lib/cn";

/**
 * Registration pending audit (Phase 1A).
 * Reached only when the real register response reports auditStatus === "PENDING".
 *
 * 2026-10-03 structure pass — this is a STATUS page, not a form.
 *
 * It used to render through `AuthCard`, i.e. the exact same shell as the login
 * and register forms: a bordered card with a title, a description and a body
 * slot. That is the right shell for something you type into. A reader who lands
 * here has already finished typing — the only question left is "what happens
 * now, and how long does it take?". Rendering that answer as a form card leaves
 * them looking for a control that does not exist.
 *
 * So it deliberately leaves the shared shell and becomes: a conclusion, then a
 * three-step timeline showing where the application actually is, then the one
 * thing they can still do. The remaining actions are a mail that will arrive and
 * a link back to login — both stated, neither dressed as a next step.
 *
 * --- 2026-11-10 批次 C：SK5 · 线 / 紧 / 错 -------------------------------
 * 线：标题与图标直接落在内容列上，一条发丝线收尾（无卡面、无居中面板）。
 * 紧：三个步骤是行式发丝线（`border-b` + `py-3`），不是三张并排/堆叠的卡。
 * 错：**偏移网格**（A §2 给 R=错 的两条合法构图之一，另一条是 sticky rail）。
 *     步骤列表在 `sm` 以上是 `[5.5rem 状态列 | 1fr 正文列]`，左侧那一列把正文推离
 *     中轴，单一竖列被打断。之所以用偏移网格而不是再加一根侧栏：本页的可说之事
 *     恰好就是 STEPS 里那三行，再造一栏只能靠编造新文案，而文案不属于本轮范围。
 * 终点动作（返回登录）进 `AuthActionBar`；文案、路由、`registered` 判据一行未动。
 */

const STEPS = [
  {
    title: "提交申请",
    description: "你的注册信息已经送达。",
    state: "done" as const,
  },
  {
    title: "管理员审核",
    description: "审核结果会通过邮件通知你，通常需要一到两个工作日。",
    state: "current" as const,
  },
  {
    title: "审核通过",
    description: "通过后即可用你注册的账号登录。",
    state: "todo" as const,
  },
];

export function PendingAuditPage() {
  const [params] = useSearchParams();
  const registered = params.get("registered") === "1";

  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="compact">
      {/* Conclusion first — this is the whole point of the page. */}
      <header className="border-b border-border/70 pb-4">
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-surface-sunken text-foreground-soft"
            aria-hidden
          >
            <Clock4 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-primary">注册已提交</h1>
            {registered ? (
              <p className="mt-1.5 text-meta leading-6 text-muted-foreground">
                我们已收到你的注册申请。
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/*
        Where it actually is. R=错 的偏移网格：左侧「状态列」把正文推离中轴，
        右侧是这一步在做什么。发丝线分行（D=紧），没有逐项卡面。
      */}
      <ol aria-label="审核进度" className="list-none p-0">
        {STEPS.map((step, index) => {
          const done = step.state === "done";
          const current = step.state === "current";
          return (
            <li
              key={step.title}
              className="grid gap-x-5 gap-y-1 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)]"
            >
              <span className="flex items-center gap-2 text-meta">
                <span
                  aria-hidden
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-pill border text-caption tabular-nums",
                    done && "border-accent-line bg-accent-soft text-accent-strong",
                    current && "border-primary bg-primary text-primary-foreground",
                    !done && !current && "border-border-strong text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "truncate",
                    current ? "font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  {done ? "已完成" : current ? "进行中" : "未开始"}
                </span>
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-card font-medium",
                    current
                      ? "text-primary"
                      : done
                        ? "text-foreground-soft"
                        : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                <span className="mt-0.5 block text-meta leading-6 text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <AuthActionBar
        note={
          <span className="flex items-start gap-2">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            在此期间无需重复提交，重复提交不会加快审核。
          </span>
        }
      >
        <Link
          to="/login"
          className="focus-ring rounded-control border border-input bg-card px-3 py-2 text-meta font-medium text-foreground transition-colors hover:bg-surface-sunken"
        >
          返回登录
        </Link>
      </AuthActionBar>
    </ArchetypeFrame>
  );
}
