"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import styles from "./empty-state-v2.module.css";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
    icon?: LucideIcon;
  };
};

/**
 * 空状态组件 V2
 * 用于无数据时的友好提示
 */
export function EmptyStateV2({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState} role="status">
      <div className={styles.icon} aria-hidden="true">
        <Icon />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <Link href={action.href} className={styles.action}>
          {action.label}
          {action.icon && <action.icon />}
        </Link>
      )}
    </div>
  );
}
