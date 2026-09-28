"use client";

import { FeatureUnavailable, SystemStatusPage } from "@/components/community/feature-unavailable";
import type { ScreenSpec } from "@/lib/screen-registry";

export function ScreenTemplate({ screen }: { screen: ScreenSpec }) {
  if (screen.id.startsWith("SYS")) {
    const kindById: Record<string, "maintenance" | "forbidden" | "not-found" | "offline" | "rate-limited" | "error"> = {
      "SYS-05": "maintenance",
      "SYS-06": "forbidden",
      "SYS-07": "not-found",
      "SYS-08": "offline",
      "SYS-09": "rate-limited",
      "SYS-10": "error",
    };
    const descriptionById: Record<string, string> = {
      "SYS-05": "我们正在进行必要的服务维护，内容和账号数据不会受到影响。",
      "SYS-06": "你可以返回上一页，或切换到有权限访问的社区内容。",
      "SYS-07": "请检查链接是否正确，也可以从首页重新开始探索。",
      "SYS-08": "请检查网络连接；恢复联网后可以重新尝试加载。",
      "SYS-09": "为了保护服务稳定性，请等待片刻后再继续操作。",
      "SYS-10": "请稍后重新尝试；如果问题持续存在，可以返回首页继续浏览。",
    };
    return (
      <SystemStatusPage
        title={screen.name}
        description={descriptionById[screen.id]}
        kind={kindById[screen.id]}
      />
    );
  }
  return <FeatureUnavailable screen={screen} />;
}
