import type { ScreenSpec } from "@/lib/screen-registry";

/** 不再渲染 mock 详情，统一由 ScreenTemplate 处理。 */
export function renderDistinctScreen(_screen: ScreenSpec) {
  return null;
}
