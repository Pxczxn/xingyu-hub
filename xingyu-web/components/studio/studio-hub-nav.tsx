"use client";
import styles from "./studio-hub.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FolderOpen,
  Handshake,
  Layers3,
  PenLine,
  Trash2,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/studio/content", label: "内容管理", icon: FolderOpen },
  { href: "/studio/series", label: "系列管理", icon: Layers3 },
  { href: "/studio/assets", label: "素材库", icon: FolderOpen },
  { href: "/studio/collaboration", label: "共创与投稿", icon: Handshake },
  { href: "/studio/analytics", label: "创作数据", icon: BarChart3 },
  { href: "/studio/content?tab=trash", label: "回收站", icon: Trash2 },
] as const;

type Props = {
  onCreateArticle?: () => void;
  creating?: boolean;
};

export function StudioHubNav({ onCreateArticle, creating }: Props) {
  const pathname = usePathname();

  return (
    <aside className={cn(styles.nav)} aria-label="创作中心导航">
      <div className={cn(styles.navHead)}>
        <h2>创作中心</h2>
      </div>
      <nav className={cn(styles.navList)}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const base = href.split("?")[0];
          const active = pathname === base || pathname.startsWith(`${base}/`);
          return (
            <Link
              key={href}
              href={href}
              className={active ? styles.isActive : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className={cn(styles.navActions)}>
        <p>快速动作</p>
        <div>
          <button type="button" className={cn(styles.navBtn)} disabled={creating} onClick={onCreateArticle}>
            <PenLine aria-hidden="true" />
            写文章
          </button>
          <Link href="/studio/moments/new" className={cn(styles.navBtn)}>
            <PenLine aria-hidden="true" />
            发动态
          </Link>
          <Link href="/studio/series/new" className={cn(styles.navBtn)}>
            <Layers3 aria-hidden="true" />
            建系列
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function StudioHubMobileNav() {
  const pathname = usePathname();

  return (
    <nav className={cn(styles.mobileNav)} aria-label="创作中心导航">
      <Link href="/studio" className={pathname === "/studio" ? "is-active" : undefined} aria-current={pathname === "/studio" ? "page" : undefined}>
        工作台
      </Link>
      {NAV_ITEMS.slice(0, 4).map(({ href, label }) => {
        const base = href.split("?")[0];
        const active = pathname.startsWith(base) && href !== "/studio/content?tab=trash";
        return (
          <Link key={href} href={href} className={active ? styles.isActive : undefined}>
            {label.replace("管理", "")}
          </Link>
        );
      })}
    </nav>
  );
}
