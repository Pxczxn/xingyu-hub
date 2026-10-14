/*
 * AuthCaptchaImage — the picture that sits beside its own input.
 *
 * Why this is shared (2026-10-13, 批次 08)
 * ----------------------------------------
 * Login and register each drew this by hand, and both copies had drifted from
 * the control they sit next to: `h-10 rounded` against an `Input` that is
 * `h-9 rounded-md`. The picture therefore hung 2px above and below the field it
 * belongs to, with a different corner radius — read as a mistake, not a choice,
 * because a control row has one height.
 *
 * `shrink-0` is load-bearing: the `Input` beside it is `w-full`, so on a narrow
 * screen the flex row will happily squash the captcha instead of the field. A
 * captcha that has been squeezed is a captcha nobody can read.
 *
 * The border stays `border-border`: `--border` and `--input` resolve to the same
 * value in `tokens.css` (40 14% 87%), so the distinction would be semantic only,
 * and this is an image frame, not a control.
 */
export function AuthCaptchaImage({ src }: { src: string }) {
  return <img src={src} alt="验证码" className="h-9 shrink-0 rounded-md border border-border" />;
}
