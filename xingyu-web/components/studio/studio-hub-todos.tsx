"use client";

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
      <section className="xy-studio-hub-todos" aria-labelledby="studio-hub-todos-title" aria-busy="true">
        <h2 id="studio-hub-todos-title" className="xy-studio-hub-section-title">待办事项</h2>
        <div className="xy-studio-hub-todo-list">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="xy-studio-hub-todo-item xy-studio-hub-skeleton">
              <span className="xy-studio-hub-skeleton-line" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!todos.length) return null;

  return (
    <section className="xy-studio-hub-todos" aria-labelledby="studio-hub-todos-title">
      <header className="xy-studio-hub-section-head">
        <h2 id="studio-hub-todos-title" className="xy-studio-hub-section-title">待办事项</h2>
        {hasMore ? (
          <Link href="/studio/content?tab=returned" className="xy-studio-hub-text-link">
            查看全部
          </Link>
        ) : null}
      </header>
      <ul className="xy-studio-hub-todo-list">
        {visible.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.id}>
              <div className="xy-studio-hub-todo-item">
                <Icon aria-hidden="true" />
                <div className="xy-studio-hub-todo-copy">
                  <p>
                    {item.isNew ? <span className="xy-studio-hub-todo-new">NEW</span> : null}
                    {item.title}
                  </p>
                  {item.time ? <time dateTime={item.time}>{formatStudioDateTime(item.time)}</time> : null}
                </div>
                <Link href={item.href} className="xy-studio-hub-todo-action">
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
