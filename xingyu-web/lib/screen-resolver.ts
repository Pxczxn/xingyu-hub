import { SCREEN_REGISTRY, type ScreenSpec } from "@/lib/screen-registry";

/** 将真实路径映射到页面契约；动态段只用于选择屏幕，不承载业务数据。 */
export function resolveScreen(pathname: string): ScreenSpec | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return SCREEN_REGISTRY.find((screen) => {
    if (screen.owner !== "web") return false;
    const expression = `^${screen.route
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\{[^}]+\\\}/g, "[^/]+")}$`;
    return new RegExp(expression).test(normalized);
  });
}
