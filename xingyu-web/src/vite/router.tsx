import {
  createContext,
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";

type PageModule = { default: ComponentType };
type RouteMatch = { component: LazyExoticComponent<ComponentType>; params: Record<string, string> } | null;

const navigationEvent = "xingyu:navigate";

function readLocation() {
  return `${window.location.pathname}${window.location.search}`;
}

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(navigationEvent, listener);
  };
}

export function navigate(href: string, replace = false) {
  const target = new URL(href, window.location.origin);
  if (target.origin !== window.location.origin) {
    window.location.assign(target.href);
    return;
  }
  window.history[replace ? "replaceState" : "pushState"]({}, "", `${target.pathname}${target.search}${target.hash}`);
  window.dispatchEvent(new Event(navigationEvent));
}

function routeFromModulePath(modulePath: string) {
  const pagePath = modulePath.replace(/^\.\/app/, "").replace(/\/page\.tsx$/, "") || "/";
  const names: string[] = [];
  const expression = pagePath
    .split("/")
    .filter(Boolean)
    .map((part) => {
      const dynamic = /^\[(.+)\]$/.exec(part);
      if (dynamic) {
        names.push(dynamic[1]);
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { names, pattern: new RegExp(`^/${expression}/?$`), specificity: names.length * -100 + pagePath.length };
}

const pageModules = import.meta.glob<PageModule>("../../app/**/page.tsx");
const routes = Object.entries(pageModules)
  .map(([modulePath, load]) => ({
    ...routeFromModulePath(modulePath.replace(/^(\.\.\/)+app/, "./app")),
    component: lazy(load),
  }))
  .sort((left, right) => right.specificity - left.specificity);

function matchRoute(pathname: string): RouteMatch {
  for (const route of routes) {
    const matches = route.pattern.exec(pathname);
    if (!matches) continue;
    return {
      component: route.component,
      params: Object.fromEntries(route.names.map((name, index) => [name, decodeURIComponent(matches[index + 1])])),
    };
  }
  return null;
}

type NavigationValue = { pathname: string; searchParams: URLSearchParams; params: Record<string, string> };
const NavigationContext = createContext<NavigationValue>({ pathname: "/", searchParams: new URLSearchParams(), params: {} });

export function useViteNavigation() {
  return useContext(NavigationContext);
}

export function ViteAppRouter() {
  const location = useSyncExternalStore(subscribe, readLocation, () => "/");
  const currentUrl = new URL(location, window.location.origin);
  const match = matchRoute(currentUrl.pathname);

  if (!match) {
    return <main className="xy-page"><h1 className="text-2xl font-semibold">页面不存在</h1></main>;
  }

  const Page = match.component;
  return (
    <NavigationContext.Provider value={{ pathname: currentUrl.pathname, searchParams: currentUrl.searchParams, params: match.params }}>
      <Suspense fallback={<main className="xy-page" aria-busy="true" />}>
        <Page />
      </Suspense>
    </NavigationContext.Provider>
  );
}

export function ViteLink({ href, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return <a {...props} href={href} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(href); } }}>{children}</a>;
}

export default ViteLink;
