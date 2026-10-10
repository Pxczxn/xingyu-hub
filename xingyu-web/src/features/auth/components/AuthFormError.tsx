import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * AuthFormError — the ONE way an auth form reports a failure.
 *
 * Why this exists (2026-10-08)
 * ----------------------------
 * The eight auth screens had drifted into three different error renderings:
 *
 *   Login / ResetPassword / Register   bare `<p class="text-sm text-destructive">`
 *   Forgot / ForceChange / Verify      framed box
 *                                      `rounded-lg border border-destructive/25
 *                                       bg-destructive/5 px-3 py-2 text-meta`
 *   Register field errors               bare `<p class="text-meta text-destructive">`
 *
 * Same failure, three weights of alarm — a reader crossing from login to
 * forgot-password is shown the identical event two different ways. The framed
 * box is the one that survived elsewhere in the product (SettingsReauthenticate,
 * MyGroups, and every auth page written after the first batch), so it is the one
 * that becomes the standard.
 *
 * `focusOnMount` closes the second half of the same problem: the audit asked for
 * error feedback to be tied to the operation that failed, "when necessary taking
 * focus". A submit that fails leaves the reader at the bottom of a form whose
 * cause is somewhere above; for the errors that are about the whole submission
 * (bad credentials, wrong confirm, server refusal) the error box takes focus so
 * the alert is announced and the reader is moved to where the answer is. Field
 * errors that sit under their own input do NOT do this — the reader is already
 * looking at the field.
 */
export function AuthFormError({
  children,
  className,
  focusOnMount = false,
  testId,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Move focus to the alert when it appears. Use for form-wide submit failures. */
  focusOnMount?: boolean;
  testId?: string;
  /** The id inputs point at via `aria-describedby`. Sits on the alert itself. */
  id?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <p
      ref={ref}
      id={id}
      role="alert"
      tabIndex={focusOnMount ? -1 : undefined}
      data-testid={testId}
      className={cn(
        "rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-meta text-destructive",
        "focus:outline-none",
        className,
      )}
    >
      {children}
    </p>
  );
}
