import { Link, useSearchParams } from "react-router-dom";
import { Check, Clock4, Mail } from "lucide-react";
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
    <div className="flex flex-col gap-6">
      {/* Conclusion first — this is the whole point of the page. */}
      <div className="rounded-xl border border-border/70 bg-card px-6 py-7 text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-strong"
          aria-hidden
        >
          <Clock4 className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-primary">注册已提交</h1>
        {registered ? (
          <p className="mx-auto mt-2 max-w-xs text-meta leading-6 text-muted-foreground">
            我们已收到你的注册申请。
          </p>
        ) : null}
      </div>

      {/* Where it actually is. A rail with three stops, not three bullets. */}
      <ol className="flex list-none flex-col p-0">
        {STEPS.map((step, index) => {
          const done = step.state === "done";
          const current = step.state === "current";
          return (
            <li key={step.title} className="flex gap-3.5">
              <span className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                    done
                      ? "border-accent-line bg-accent-soft text-accent-strong"
                      : current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground/50",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <span className="text-[11px] font-semibold tabular-nums">{index + 1}</span>
                  )}
                </span>
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn("w-px flex-1", done ? "bg-accent-line" : "bg-border")}
                  />
                ) : null}
              </span>

              <span className={cn("min-w-0", index < STEPS.length - 1 && "pb-5")}>
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
                  {current ? (
                    <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-strong">
                      进行中
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-meta leading-6 text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-3 border-t border-border/70 pt-5">
        <p className="flex items-start gap-2 text-meta text-muted-foreground">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          在此期间无需重复提交，重复提交不会加快审核。
        </p>
        <Link
          to="/login"
          className="focus-ring w-fit rounded-md border border-input px-3 py-2 text-meta font-medium text-foreground transition-colors hover:bg-surface-sunken"
        >
          返回登录
        </Link>
      </div>
    </div>
  );
}
