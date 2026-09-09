"use client";

import Link from "next/link";
import { ArrowRight, FileText, Layers3, Zap } from "lucide-react";

type Props = {
  onCreateArticle: () => void;
  creating?: boolean;
};

const CARDS = [
  {
    key: "article" as const,
    icon: FileText,
    title: "写文章",
    subtitle: "沉淀一个完整的主题",
    cta: "开始创作",
    href: undefined,
  },
  {
    key: "moment" as const,
    icon: Zap,
    title: "发动态",
    subtitle: "分享当下的想法与灵感",
    cta: "发布动态",
    href: "/studio/moments/new",
  },
  {
    key: "series" as const,
    icon: Layers3,
    title: "建系列",
    subtitle: "把多篇文章组织为连续阅读",
    cta: "创建系列",
    href: "/studio/series/new",
  },
];

export function StudioHubQuickCreate({ onCreateArticle, creating }: Props) {
  return (
    <section className="xy-studio-hub-quick" aria-labelledby="studio-hub-quick-title">
      <h2 id="studio-hub-quick-title" className="xy-studio-hub-section-title">快捷创作入口</h2>
      <div className="xy-studio-hub-quick-grid">
        {CARDS.map((card) => {
          const body = (
            <>
              <span className="xy-studio-hub-quick-icon" aria-hidden="true">
                <card.icon />
              </span>
              <div className="xy-studio-hub-quick-copy">
                <strong>{card.title}</strong>
                <p>{card.subtitle}</p>
              </div>
              <span className="xy-studio-hub-quick-cta">
                {card.cta} <ArrowRight aria-hidden="true" />
              </span>
            </>
          );

          if (card.key === "article") {
            return (
              <button
                key={card.key}
                type="button"
                className="xy-studio-hub-quick-card"
                disabled={creating}
                onClick={onCreateArticle}
              >
                {body}
              </button>
            );
          }

          return (
            <Link key={card.key} href={card.href!} className="xy-studio-hub-quick-card">
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
