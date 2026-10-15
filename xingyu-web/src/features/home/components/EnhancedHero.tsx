import { Link } from "react-router-dom";
import { Compass, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * EnhancedHero — 首页增强版 Hero 区
 *
 * 相比默认 PageMasthead，增加：
 * 1. 微妙的背景装饰（品牌色渐变）
 * 2. 星光动画效果
 * 3. 更强的视觉层级
 * 4. 响应式优化
 */

export function EnhancedHero({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  if (isAuthenticated) {
    // 登录用户：简洁欢迎
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-accent-soft/30 px-6 py-8 sm:px-8 sm:py-10">
        {/* 装饰性背景图案 */}
        <div className="absolute right-0 top-0 h-32 w-32 opacity-[0.03]" aria-hidden>
          <svg viewBox="0 0 100 100" className="h-full w-full text-accent">
            <circle cx="50" cy="50" r="40" fill="currentColor" />
          </svg>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            欢迎回来
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            继续探索你的关注与创作。
          </p>
        </div>
      </div>
    );
  }

  // 访客：特色展示
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-accent-soft/20 to-card px-6 py-8 sm:px-8 sm:py-10">
      {/* 背景装饰 - 星光效果 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* 渐变光晕 */}
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-accent/3 blur-3xl" />
        
        {/* 星星点缀 */}
        <div className="sparkle absolute left-[15%] top-[20%] h-1 w-1 rounded-full bg-accent/40" />
        <div className="sparkle absolute left-[25%] top-[60%] h-1.5 w-1.5 rounded-full bg-accent/30" style={{ animationDelay: '1s' }} />
        <div className="sparkle absolute right-[20%] top-[40%] h-1 w-1 rounded-full bg-accent/40" style={{ animationDelay: '2s' }} />
        <div className="sparkle absolute right-[30%] top-[70%] h-1.5 w-1.5 rounded-full bg-accent/30" style={{ animationDelay: '0.5s' }} />
        <div className="sparkle absolute left-[60%] top-[15%] h-1 w-1 rounded-full bg-accent/35" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* 内容 */}
      <div className="relative text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
          欢迎来到星语
          <span className="sparkle-icon ml-2 inline-block text-accent" aria-hidden>✦</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          从一篇内容开始，探索属于你的星语
        </p>

        {/* 行动按钮 */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/discover"
            className={cn(
              buttonVariants({ variant: "accent", size: "lg" }),
              "group relative gap-2 overflow-hidden shadow-md transition-all duration-200",
              "hover:scale-105 hover:shadow-lg active:scale-100",
            )}
          >
            <Compass className="h-5 w-5 transition-transform group-hover:rotate-12" aria-hidden />
            <span className="relative z-10">探索内容</span>
            {/* 悬浮光效 */}
            <span
              className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/register"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "group gap-2 transition-all duration-200",
              "hover:scale-105 hover:border-accent/50 hover:bg-accent/5 active:scale-100",
            )}
          >
            <Pencil className="h-5 w-5 transition-transform group-hover:-rotate-12" aria-hidden />
            开始创作
          </Link>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" aria-hidden />
    </div>
  );
}
