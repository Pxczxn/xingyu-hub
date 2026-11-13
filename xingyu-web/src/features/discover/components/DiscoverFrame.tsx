import type { ReactNode } from "react";
import { DiscoverTabs } from "./DiscoverTabs";

/*
 * 发现、系列、话题、创作者共用的页首。
 * 标题和分类导航的 DOM 与间距只在这里定义，四页切换时它们落在同一位置。
 * 侧栏和列表放在 children 里，不能把导航再包进某一列。
 */
export function DiscoverFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] bg-white text-slate-900">
      <header className="pb-6 pt-8">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-base text-slate-500">{description}</p>
      </header>
      <div className="mt-8">
        <DiscoverTabs />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
