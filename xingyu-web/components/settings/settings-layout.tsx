"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useViteNavigation } from "@/src/vite/router";
import {
  isSettingsNavActive,
  SETTINGS_MAIN_NAV,
  settingsSubNav,
  type SettingsNavItem,
} from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

type SettingsLayoutProps = {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
};

function NavLink({ item, pathname }: { item: SettingsNavItem; pathname: string }) {
  const active = isSettingsNavActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-4 text-sm transition-colors",
        active
          ? "bg-[#fff1df] font-semibold text-[#ed842f] shadow-[inset_-3px_0_0_#f18d36]"
          : "text-[#293a60] hover:bg-[#fbf7f1]"
      )}
    >
      {item.label}
    </Link>
  );
}

function SubNav({ items, pathname }: { items: SettingsNavItem[]; pathname: string }) {
  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 border-b border-[#eee7df] pb-4"
      aria-label="设置子菜单"
    >
      {items.map((item) => {
        const active = isSettingsNavActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition-colors",
              active
                ? "bg-[#fff1df] font-medium text-[#d97827]"
                : "text-[#53617d] hover:bg-[#f5f6fb]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsLayout({ children, aside, className }: SettingsLayoutProps) {
  const { pathname } = useViteNavigation();
  const subNav = settingsSubNav(pathname);

  return (
    <AppShell>
      <main className={cn("mx-auto max-w-[1450px] px-5 pb-14 pt-8 lg:px-8", className)}>
        <div
          className={cn(
            "grid gap-6",
            aside ? "xl:grid-cols-[260px_minmax(0,1fr)_330px]" : "xl:grid-cols-[260px_minmax(0,1fr)]"
          )}
        >
          <aside className="h-fit rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[0_12px_32px_rgba(85,64,35,.07)] backdrop-blur-md">
            <h1 className="text-[28px] font-bold tracking-tight text-[#142957]">设置</h1>
            <nav className="mt-7 space-y-1.5" aria-label="设置菜单">
              {SETTINGS_MAIN_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
          </aside>

          <section className="min-w-0 rounded-[30px] border border-white/80 bg-white/75 p-6 shadow-[0_15px_42px_rgba(85,64,35,.08)] backdrop-blur-md lg:p-9">
            {subNav ? <SubNav items={subNav} pathname={pathname} /> : null}
            {children}
          </section>

          {aside ? (
            <aside className="h-fit rounded-[30px] border border-white/80 bg-white/75 p-7 shadow-[0_15px_42px_rgba(85,64,35,.08)] backdrop-blur-md">
              {aside}
            </aside>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
