"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** 入门引导主区域宽度：移动端全宽，桌面端约占 70% 视口，上限 1280px。 */
export const onboardingMainWidthClass =
  "w-full max-w-[1200px] lg:w-[72%] xl:w-[70%] 2xl:max-w-[1280px]";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <header className="fixed inset-x-0 top-3.5 z-50 px-4 sm:top-4 sm:px-6 lg:px-8">
        <div className={cn("mx-auto flex w-full", onboardingMainWidthClass)}>
          <div className="inline-flex h-11 items-center rounded-full border border-white/75 bg-white/52 px-4 shadow-[0_10px_28px_rgb(41_54_91/0.12)] backdrop-blur-xl sm:px-5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.02em] text-foreground" aria-label="星语社区">
              <Image src="/brand/logo-emblem.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" aria-hidden="true" />
              <span translate="no">星语社区</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4 pt-[4.25rem] sm:px-6 sm:pb-5 sm:pt-[4.5rem] lg:px-8 lg:pb-6">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{ backgroundImage: "url('/images/onboarding-cosmic-paper-background.png')" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 bg-[rgb(var(--cream)/.28)]" aria-hidden="true" />
        <div className={cn("relative mx-auto w-full", onboardingMainWidthClass)}>{children}</div>
      </div>
    </div>
  );
}
