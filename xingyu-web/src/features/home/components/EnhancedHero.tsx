import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import heroSpaceArt from "@/assets/xingyu-hero-space-art.webp";

/*
 * 一张径向遮罩盖住四边。两层 linear-gradient 要靠 mask-composite 相乘，
 * 合不上时上下缘会保持不透明，报头底边就是一条直线。
 * 椭圆在碰到元素边框之前已经全透明，直角和直边都落在透明区里。
 */
const HERO_ART_MASK: CSSProperties = {
  WebkitMaskImage:
    "radial-gradient(ellipse 52% 50% at 58% 38%, #000 0%, #000 20%, transparent 70%)",
  maskImage:
    "radial-gradient(ellipse 52% 50% at 58% 38%, #000 0%, #000 20%, transparent 70%)",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};

/*
 * Home hero — 报头。
 *
 * 结构来自已确认的视觉稿：左侧是标题 / 副文 / 两个入口，右侧是星空素材（行星、
 * 星环、山脊、云），素材向右贴到内容区边缘，左缘用遮罩淡进页面底色。文字永远
 * 是最高对比的一层，素材只负责氛围，不承担信息。
 *
 * 三条硬约束（测试与验收都会看）：
 *  1. 主标题就是「欢迎来到星语」，副文是「在这里，遇见好内容，和同频的人。」；
 *     登录用户看到的是回访问候，不是新人欢迎语。
 *  2. 访客有两个入口：探索内容（实心）+ 开始创作（描边）。登录后不再出现这两
 *     个入口 —— 顶栏已经有创作，账号菜单已经在里面。
 *  3. 素材里没有任何数字或「运营精选」暗示：它不是数据模块，是背景。
 *
 * 为什么用 `object-cover` + 遮罩，而不是把图拉满：素材是约 3.9:1 的宽幅图，报头
 * 右侧区域是约 2.4:1，按百分比硬拉会把行星压扁。`object-cover` 只裁不拉伸，裁掉
 * 的正好是素材左侧那片空白天空。
 *
 * 只在 xl 以上铺素材：1024-1279px 时文字栏仍占 32rem，右侧区域剩给插画的
 * 宽度不足以让行星退到文字之后——实测 768px 下行星会压在标题上，把墨蓝标题
 * 拖成灰蓝。窄屏就是干净的奶油纸 + 文字，宽屏才出现画面。
 */
export function EnhancedHero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section
      aria-labelledby="home-nameplate"
      className="relative isolate overflow-hidden border-b border-border/50"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
        <img
          src={heroSpaceArt}
          alt=""
          decoding="async"
          className="absolute inset-y-0 right-0 h-full w-[72%] object-cover object-[70%_center]"
          style={HERO_ART_MASK}
        />
      </div>
      <div className="relative z-10 grid gap-8 py-10 md:grid-cols-[minmax(0,32rem)_1fr] md:items-center md:py-14">
        <div className="min-w-0">
          <h1
            id="home-nameplate"
            className="font-display text-display-lg text-primary"
          >
            {isAuthenticated ? "欢迎回来" : "欢迎来到星语"}
            <span aria-hidden className="ml-2 align-top text-lg text-accent">
              ✦
            </span>
          </h1>

          <p className="mt-4 max-w-[26rem] text-body leading-7 text-foreground-soft">
            {isAuthenticated ? "继续探索你的关注与创作。" : "在这里，遇见好内容，和同频的人。"}
          </p>

          {isAuthenticated ? null : (
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/discover"
                className={cn(buttonVariants({ variant: "accent", size: "default" }), "gap-2")}
              >
                <Compass className="h-4 w-4" aria-hidden />
                探索内容
              </Link>
              <Link
                to="/register"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "group gap-2",
                )}
              >
                开始创作
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
