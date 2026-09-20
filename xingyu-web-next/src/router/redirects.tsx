import { Navigate, useParams } from "react-router-dom";

/*
 * Phase 0 carries ONLY these five Legacy redirects.
 * The full Legacy table (~73 rules) is intentionally NOT migrated.
 *
 * Redirect targets /topics, /discover and /settings/profile are not built yet;
 * they are deliberately NOT created as pages — they fall through to the 404 route.
 */

export type LegacyRedirect = {
  /** Source path pattern (React Router syntax, may contain :params). */
  from: string;
  /** Target path pattern; :params are substituted from the matched params. */
  to: string;
};

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  { from: "/users/:username", to: "/u/:username" },
  { from: "/tags", to: "/topics" },
  { from: "/articles", to: "/discover" },
  { from: "/me/profile", to: "/settings/profile" },
  { from: "/settings", to: "/settings/profile" },
];

/** Replace `:param` placeholders in a target path with the matched route params. */
export function buildRedirectPath(
  template: string,
  params: Record<string, string | undefined>,
): string {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? "" : encodeURIComponent(value);
  });
}

export function LegacyRedirectRoute({ to }: { to: string }) {
  const params = useParams();
  return <Navigate to={buildRedirectPath(to, params)} replace />;
}
