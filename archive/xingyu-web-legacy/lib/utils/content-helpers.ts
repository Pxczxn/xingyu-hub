/**
 * 内容处理工具函数
 */

import type { ContentSummary } from "@/lib/community-api";

/**
 * 截断文本
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * 生成内容卡片 href
 */
export function contentHref(item: ContentSummary): string {
  if (item.objectType === "series") {
    return `/series/${item.id}`;
  }
  if (item.objectType === "moment") {
    return `/moments/${item.id}`;
  }
  return `/articles/${item.id}`;
}

/**
 * 获取封面图 URL
 */
export function resolveContentCoverUrl(
  cover: string | undefined,
  id: string,
  index: number = 0
): string {
  if (cover && cover.startsWith("http")) {
    return cover;
  }

  // 使用占位图
  const colors = [
    "e6ecfb", // 浅蓝
    "f2e6fb", // 浅紫
    "e6fbf2", // 浅绿
    "fbe6ec", // 浅粉
    "fbf2e6", // 浅黄
  ];

  const color = colors[index % colors.length];
  return `https://placehold.co/600x400/${color}/59647d?text=${encodeURIComponent(id.slice(0, 8))}`;
}

/**
 * 计算封面图宽高比
 */
export function getCoverAspect(cover?: string): "16/9" | "4/3" | "1/1" {
  // 可以根据 cover URL 或元数据判断
  // 这里暂时返回默认值
  return "16/9";
}
