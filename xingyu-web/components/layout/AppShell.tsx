"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams, matchNavActive } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, MessageSquare, PenLine, Compass, Hash, Layers3, Orbit, BookOpen, Home } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";
import { setStoredToken } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GlobalSearch, MobileTabBar, UserMenuItems } from "@/components/community/app-controls";
import { isValidUsername } from "@/lib/paths";
import { HeaderFloatIconButton } from "@/components/community/floating-panel/header-float-icon-button";
import { MessageFloatTrigger } from "@/components/community/floating-panel/message-float";
import { NotificationFloatTrigger } from "@/components/community/floating-panel/notification-float";
import { SiteFooter } from "@/components/community/site-footer";

const NAV_ITEMS = [
  { href: '/', label: '首页', icon: Home, tone: 'home' },
  { href: '/discover', label: '探索', icon: Compass, tone: 'discover' },
  { href: '/topics', label: '话题', icon: Hash, tone: 'topics' },
  { href: '/series', label: '系列', icon: Layers3, tone: 'series' },
  { href: '/galaxies', label: '星系', icon: Orbit, tone: 'galaxies' },
  { href: '/guide', label: '指南', icon: BookOpen, tone: 'guide' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const openMessages = searchParams.get("openMessages") === "1";
  const [me, setMe] = useState<{ username?: string; displayName?: string | null } | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    getPublicConfig()
      .then((config) => {
        setRegistrationOpen(config.registration?.enabled !== false);
      })
      .catch(() => setRegistrationOpen(true));
  }, []);

  useEffect(() => {
    communityApi
      .tryGetMyProfile()
      .then((profile) => {
        if (!profile) {
          setMe(null);
          return;
        }
        const username = isValidUsername(profile.username) ? profile.username.trim() : undefined;
        setMe({ username, displayName: profile.displayName });
      })
      .catch(() => setMe(null));
  }, [pathname]);

  useEffect(() => {
    if (!openMessages) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openMessages");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [openMessages, pathname, router, searchParams]);

  async function handleLogout() {
    try {
      await communityApi.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setMe(null);
    router.push("/login");
  }

  const avatarLabel = me?.displayName || me?.username || "登录";

  return (
    <div className={cn("xy-app-shell bg-transparent", `xy-nav-${pathname === "/" ? "home" : pathname.split("/")[1] || "home"}`)}>
      <header className="xy-app-header xy-site-header fixed inset-x-0 top-2 z-40 px-3 sm:top-3 sm:px-5 lg:px-8">
        <div className="xy-site-header-inner mx-auto flex h-[3.75rem] max-w-[1420px] items-center gap-1.5 rounded-2xl border border-white/90 bg-white/90 px-2.5 shadow-[0_12px_34px_rgb(36_49_84/0.08)] backdrop-blur-2xl sm:gap-2 sm:px-3.5">
          <BrandLogo className="mr-0.5" priority />

          <nav className="xy-main-nav hidden items-center gap-1 lg:flex" aria-label="主导航">
            {NAV_ITEMS.map((item) => {
              const active = matchNavActive(pathname, item.href, search);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.9375rem] font-medium tracking-[-0.01em] transition-colors",
                    active
                      ? "bg-[rgb(var(--violet)/.12)] font-semibold text-[rgb(var(--violet))]"
                      : "text-muted-foreground hover:bg-white/65 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="default" size="sm" className="h-9 gap-1.5 rounded-full px-4 text-sm">
              <Link href="/studio">
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">创作</span>
              </Link>
            </Button>

            <NotificationFloatTrigger
              trigger={({ unreadCount, open }) => (
                <HeaderFloatIconButton label="通知" unreadCount={unreadCount} active={open}>
                  <Bell className="h-5 w-5" />
                </HeaderFloatIconButton>
              )}
            />

            <Button asChild variant="ghost" size="icon" className="text-muted-foreground lg:hidden">
              <Link href="/notifications" aria-label="通知">
                <Bell className="h-5 w-5" />
              </Link>
            </Button>

            <MessageFloatTrigger
              defaultOpen={openMessages}
              trigger={({ unreadCount, open }) => (
                <HeaderFloatIconButton label="消息" unreadCount={unreadCount} active={open}>
                  <MessageSquare className="h-5 w-5" />
                </HeaderFloatIconButton>
              )}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                className="group inline-flex items-center gap-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={me ? "账户菜单" : "登录或注册"}
              >
                <Avatar fallback={avatarLabel} size="md" className="h-10 w-10" />
                <ChevronDown
                  className="hidden h-3.5 w-3.5 rotate-90 transition-transform duration-200 group-aria-expanded:rotate-0 sm:block"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {me ? (
                  <>
                    <UserMenuItems username={me.username} onNavigate={router.push} />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void handleLogout()}>退出登录</DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => router.push("/login")}>登录</DropdownMenuItem>
                    {registrationOpen && (
                      <DropdownMenuItem onSelect={() => router.push("/register")}>注册</DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="xy-app-content pt-[4.75rem] sm:pt-[5rem]">{children}</div>

      <SiteFooter />

      <MobileTabBar />
    </div>
  );
}
