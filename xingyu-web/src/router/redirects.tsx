import { Navigate, useParams } from "react-router-dom";

/*
 * Phase 0 carries ONLY these five Legacy redirects.
 * The full Legacy table (~73 rules) is intentionally NOT migrated.
 *
 * Target status as of Phase 2A-1 — all five now resolve to a real route:
 *   /topics           Phase 1B
 *   /discover         Phase 1A
 *   /u/:username      Phase 1B
 *   /settings/profile Phase 2A-1  <- this round fixed the last dead target
 *
 * Before 2A-1, both `/me/profile` and `/settings` pointed at /settings/profile,
 * which did not exist, so they silently landed on the 404 route. They are now
 * genuinely working redirects. `/settings` stays in this table rather than
 * becoming a route of its own so the approved redirect set is unchanged.
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
