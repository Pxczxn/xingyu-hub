import type { SpaceWorks } from "@/api/users/users.types";
import { Button } from "@/components/ui/button";

/*
 * 作品流的分类筛选（批次 06 / S4）。
 *
 * 为什么不是 tab：方案 §4.3 写的是「作品流 tab（文章 / 系列 / 动态）」，但后端
 * CommunityUserController 的用户维度端点只有 /{username}、/{username}/works、
 * /{username}/works/categories、follow/unfollow、followers/following
 * （2026-10-13 逐条核对）。没有 /{username}/series，也没有 /{username}/moments
 * —— 三个 tab 里两个没有数据源，画出来就是两条死链；只留一个 tab 则是纯噪声。
 * 真正存在的第二维是创作空间分类（`?category=<slug>` + 响应里的 `categories`），
 * 所以由筛选条承担这一维。
 *
 * 三个实现细节：
 *   1. `categories` 为空时整条不渲染。没有分类的空间不该看到一个只有「全部」的
 *      筛选条 —— 那是一个点不出任何差异的控件。
 *   2. `aria-pressed` 而不是 `aria-current`：这些是开关（改变列表内容），不是
 *      页面导航。同页 `GalaxyContentPage` 的筛选按钮同款。
 *   3. 选中的 chip 再点一次直接 return（在调用方拦）。`setFilter` 每次都造新对象，
 *      不拦会白重渲染一次 —— effect 依赖是派生出的 slug 所以不会重复请求，但重渲染
 *      本身没有意义。
 *
 * 下间距 `mb-4` 写在这里而不是调用方：本组件在无分类时返回 `null`，间距跟着
 * 消失，标题与列表之间自动回到 `mb-3`。放在调用方就要多包一层 div 才能达到
 * 同样效果，而多出来的一层在无分类时仍会占位。
 *
 * 视觉沿用既有筛选 chip：`Button variant={active ? "default" : "outline"} size="sm"`。
 */
export function ProfileWorksFilter({
  categories,
  active,
  onSelect,
}: {
  categories: SpaceWorks["categories"];
  /** 选中的 slug；`null` 表示「全部」。 */
  active: string | null;
  onSelect: (slug: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div role="group" aria-label="按分类筛选文章" className="mb-4 flex flex-wrap gap-2">
      <Button
        type="button"
        variant={active === null ? "default" : "outline"}
        size="sm"
        aria-pressed={active === null}
        onClick={() => onSelect(null)}
      >
        全部
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          type="button"
          variant={active === category.slug ? "default" : "outline"}
          size="sm"
          aria-pressed={active === category.slug}
          onClick={() => onSelect(category.slug)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
