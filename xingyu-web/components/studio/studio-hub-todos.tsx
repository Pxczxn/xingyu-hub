"use client";
import styles from "./studio-hub.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { Clock3, ClipboardList, Handshake, TriangleAlert } from "lucide-react";
import type { StudioTodoItem } from "@/components/studio/use-studio-hub-data";
import { formatStudioDateTime } from "@/lib/format";

type Props = {
  todos: StudioTodoItem[];
  loading: boolean;
};

const ICONS = {
  returned: TriangleAlert,
  scheduled: Clock3,
  review: ClipboardList,
  collaboration: Handshake,
  action: ClipboardList,
} as const;

export function StudioHubTodos({ todos, loading }: Props) {
  const visible = todos.slice(0, 3);
  const hasMore = todos.length > 3;

  if (loading) {
    return (
      <section className={cn(styles.todos)} aria-labelledby="studio-hub-todos-title" aria-busy="true">
        <h2 id="studio-hub-todos-title" className={cn(styles.sectionTitle)}>待办事项</h2>
        <div className={cn(styles.todoList)}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={cn(styles.todoItem, styles.skeleton)}>
              <span className={cn(styles.skeletonLine)} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!todos.length) return null;

  return (
    <section className={cn(styles.todos)} aria-labelledby="studio-hub-todos-title">
      <header className={cn(styles.sectionHead)}>
        <h2 id="studio-hub-todos-title" className={cn(styles.sectionTitle)}>待办事项</h2>
        {hasMore ? (
          <Link href="/studio/content?tab=returned" className={cn(styles.textLink)}>
            查看全部
          </Link>
        ) : null}
      </header>
      <ul className={cn(styles.todoList)}>
        {visible.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.id}>
              <div className={cn(styles.todoItem)}>
                <Icon aria-hidden="true" />
                <div className={cn(styles.todoCopy)}>
                  <p>
                    {item.isNew ? <span className={cn(styles.todoNew)}>NEW</span> : null}
                    {item.title}
                  </p>
                  {item.time ? <time dateTime={item.time}>{formatStudioDateTime(item.time)}</time> : null}
                </div>
                <Link href={item.href} className={cn(styles.todoAction)}>
                  {item.icon === "scheduled" ? "管理" : "查看"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
