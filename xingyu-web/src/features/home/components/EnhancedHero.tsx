import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import heroSpaceArt from "@/assets/xingyu-hero-space-art.webp";

/*
 * 素材的三边渐隐。作用在 alpha 上，所以边缘是真透明而不是「画成纸色」：
 * 它下面是什么（纸色、将来的深色主题、任何父级背景）就露出什么，不会出现
 * 与背景差一两个色阶的硬边，也不需要再用 mask-composite 把两个方向合成。
 *
 * 数值按实测取的：上缘 0→34% 拉开，是因为素材顶部那片深色天空和纸色差得多，
 * 短距离内退不干净；左缘 0→38% 更长，因为它要压住行星左半边，让标题栏永远
 * 落在干净的纸上；右缘只留 0→18%，这里的素材本身就接近纸色，太长的渐隐会
 * 把山脊右麓吃掉。
 */
const HERO_MASK_X: CSSProperties = {
  WebkitMaskImage:
    "linear-gradient(to right, transparent 0%, #000 38%, #000 82%, transparent 100%)",
  maskImage: "linear-gradient(to right, transparent 0%, #000 38%, #000 82%, transparent 100%)",
};

const HERO_MASK_Y: CSSProperties = {
  WebkitMaskImage:
    "linear-gradient(to bottom, transparent 0%, #000 34%, #000 78%, transparent 100%)",
  maskImage: "linear-gradient(to bottom, transparent 0%, #000 34%, #000 78%, transparent 100%)",
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
      {/*
       * Hero 插画：素材原样铺开，三边溶进背景。
       *
       * 素材的纸底和页面纸色只差一两个色阶，但画面顶部是大片偏冷的深色天空，
       * 一旦被 section 的 overflow-hidden 切断，天际线处就是一条横向直角边。
       * 山脊与云在底部本来就要被裁掉（视觉稿就是这个效果），问题只在上边和左右。
       *
       * 用 MASK 而不是盖一层纸色渐变：遮罩直接作用在图片的 alpha 上，边缘是
       * 真透明，露出的就是它底下真正的东西（纸色、将来任何背景、深色主题），
       * 不依赖「叠加色正好等于背景色」这种巧合。之前那版用纸色渐变叠图，实测
       * 右缘是一条 2px 宽、11 级亮度的硬切（x=1597 亮度 234 → x=1600 亮度 245），
       * 因为渐变层的右缘和图片被裁后的可见右缘并不重合。
       *
       * 横向在容器上、纵向在 img 上，两层 mask 天然相乘，不需要 mask-composite，
       * 各浏览器行为一致。
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -bottom-8 hidden xl:block"
      >
        <div className="ml-auto h-full w-[66%]" style={HERO_MASK_X}>
          <img
            src={heroSpaceArt}
            alt=""
            decoding="async"
            className="h-full w-full object-cover object-[62%_center]"
            style={HERO_MASK_Y}
          />
        </div>
      </div>
      <div className="relative z-10 grid gap-8 py-10 md:grid-cols-[minmax(0,32rem)_1fr] md:items-center md:py-14">
        <div className="min-w-0">
          <h1
            id="home-nameplate"
            className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight text-primary sm:text-[60px]"
          >
            {isAuthenticated ? "欢迎回来" : "欢迎来到星语"}
            <span aria-hidden className="ml-2 align-top text-lg text-accent">
              ✦
            </span>
          </h1>

          <p className="mt-4 max-w-[26rem] text-[15px] leading-8 text-foreground-soft sm:text-base">
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
