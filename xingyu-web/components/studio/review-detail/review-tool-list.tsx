import Link from "next/link";
import { ArrowRight, FolderOpen, PenLine, Star } from "lucide-react";

type ReviewToolListProps = {
  articleHref: string;
  approved: boolean;
};

const TOOL_ITEMS = [
  {
    key: "view",
    icon: Star,
    title: (approved: boolean) => (approved ? "查看作品" : "查看稿件"),
    text: (approved: boolean) => (approved ? "查看已发布内容" : "返回编辑器继续修改"),
    href: (_approved: boolean, articleHref: string) => articleHref,
    primary: true,
  },
  {
    key: "create",
    icon: PenLine,
    title: () => "继续创作",
    text: () => "新建一篇文章",
    href: () => "/studio/content/new",
    primary: false,
  },
  {
    key: "manage",
    icon: FolderOpen,
    title: () => "管理作品",
    text: () => "查看和管理全部作品",
    href: () => "/studio/content",
    primary: false,
  },
] as const;

export function ReviewToolList({ articleHref, approved }: ReviewToolListProps) {
  return (
    <section className="xy-review-tools">
      <h2>创作中心工具</h2>
      <ul>
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href(approved, articleHref)}
                className={item.primary ? "is-primary" : undefined}
              >
                <i aria-hidden="true">
                  <Icon />
                </i>
                <span>
                  <b>{item.title(approved)}</b>
                  <small>{item.text(approved)}</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
