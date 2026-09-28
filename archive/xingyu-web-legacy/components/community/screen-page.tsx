import { MissingScreen } from "@/components/community/screen-states";
import { ScreenTemplate } from "@/components/community/screen-template";
import { SCREEN_REGISTRY } from "@/lib/screen-registry";

/** 每个物理路由通过稳定 screen id 取得自己的页面语义；不依赖 URL 猜测。 */
export function ScreenPage({ id }: { id: string }) {
  const screen = SCREEN_REGISTRY.find((item) => item.id === id);
  return screen ? <ScreenTemplate screen={screen} /> : <MissingScreen pathname={id} />;
}
