import { useMemo, useSyncExternalStore } from "react";
import { navigate, useViteNavigation } from "./router";

const NAVIGATION_EVENT = "xingyu:navigate";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(NAVIGATION_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(NAVIGATION_EVENT, listener);
  };
}

function readPathname() {
  return window.location.pathname;
}

function readSearch() {
  return window.location.search;
}

export function matchNavActive(pathname: string, href: string, search = ""): boolean {
  const [baseHref, query = ""] = href.split("?");
  if (query) {
    const expected = new URLSearchParams(query);
    const actual = new URLSearchParams(search);
    for (const [key, value] of expected.entries()) {
      if (actual.get(key) !== value) return false;
    }
    return pathname === baseHref || pathname === `${baseHref}/`;
  }

  if (baseHref === "/") return pathname === "/";
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

export function usePathname() {
  return useSyncExternalStore(subscribe, readPathname, () => "/");
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return useViteNavigation().params as T;
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, readSearch, () => "");
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, true),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => window.location.reload(),
    }),
    []
  );
}

export function redirect(href: string): never {
  window.location.replace(href);
  throw new Error("Navigation redirected");
}
