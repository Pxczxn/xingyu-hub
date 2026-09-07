"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/community/empty-state";
import {
  Bookmark,
  ChevronRight,
  Globe2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Star,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type MomentDetail } from "@/lib/community-api";

const COMMON_TOPICS = [
  ["◫", "阅读笔记", "好书摘要与阅读感悟", "9.8k"],
  ["↗", "写作练习", "文字是最温柔的表达", "5.6k"],
  ["✦", "星空记录", "仰望星空的每一刻", "3.2k"],
  ["✧", "生活随想", "日常中的思考与感动", "2.7k"],
] as const;

export default function MomentsPage() {
  const [moments, setMoments] = useState<MomentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    communityApi
      .getMoments()
      .then((data) => data.length && setMoments(data.slice(0, 2)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  return (
    <AppShell>
      <main className="xy-feed-page">
        <section className="xy-feed-main">
          <header>
            <span>我的动态</span>
            <h1>
              我的动态 <i>✦</i>
            </h1>
            <p>记录我所思、所见与热爱的时刻</p>
          </header>
          {loading ? (
            <div className="xy-feed-loading" aria-busy="true"><span/><span/><span/></div>
          ) : moments.length ? (
            moments.map((moment, index) => (
            <article className="xy-feed-entry" key={moment.id}>
              <time>
                <b>{moment.createdAt ? new Date(moment.createdAt).toLocaleDateString("zh-CN") : "日期暂未提供"}</b>
                <i>✦</i>
                    <small>{moment.createdAt ? new Date(moment.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "时间暂未提供"}</small>
              </time>
              <div className="xy-feed-card">
                <header>
                  <Link href={moment.authorUsername ? `/users/${moment.authorUsername}` : "/users"}>
                    <Image
                      src="/prototype-assets/moments-feed/avatar.png"
                      alt=""
                      width={47}
                      height={48}
                    />
                    <span>
                      <b>{moment.authorUsername || "作者信息暂未提供"}</b>
                      <small>作者资料暂未提供</small>
                    </span>
                  </Link>
                  <div>
                    <Globe2 />
                    公开 <MoreHorizontal />
                  </div>
                </header>
                <p>{moment.body || "动态内容暂未提供"}</p>
                {index === 0 ? (
                  <div className="xy-feed-gallery">
                    <Image
                      src="/prototype-assets/moments-feed/river.png"
                      alt="河流中的纸船"
                      width={205}
                      height={125}
                    />
                    <Image
                      src="/prototype-assets/moments-feed/book.png"
                      alt="床上的书"
                      width={205}
                      height={125}
                    />
                  </div>
                ) : (
                  <Image
                    className="xy-feed-night"
                    src="/prototype-assets/moments-feed/night.png"
                    alt="星空"
                    width={331}
                    height={113}
                  />
                )}
                <Link className="xy-feed-topic" href="/topics">
                  # {index ? "星空记录" : "阅读笔记"}
                </Link>
                <footer>
                  <button type="button" disabled>
                    <Star /> 互动数据暂未提供
                  </button>
                  <button type="button" disabled>
                    <MessageCircle /> 评论数据暂未提供
                  </button>
                  <button type="button" disabled>
                    <Share2 /> 分享数据暂未提供
                  </button>
                  <Bookmark />
                </footer>
                {index === 0 && (
                  <div className="xy-feed-comments">
                    <p>评论内容暂未提供</p>
                    <Link href={`/moments/${moment.id}`}>
                      查看全部评论 ›
                    </Link>
                  </div>
                )}
              </div>
            </article>
            ))
          ) : (
            <EmptyState
              compact
              title="暂无动态"
              description="记录一段想法，和社区分享你的当下。"
              actionLabel="写一条动态"
              actionHref="/studio/moments/new"
            />
          )}
        </section>
        <aside className="xy-feed-side">
          <section className="xy-feed-profile">
            <div>
              <Image
                src="/prototype-assets/moments-feed/avatar.png"
                alt=""
                width={72}
                height={72}
              />
              <span>
                <h2>个人资料</h2>
                <p>资料信息暂未提供</p>
              </span>
              <Button variant="outline" asChild><Link href="/settings/profile">编辑资料</Link></Button>
            </div>
            <dl>
              <div>
                <dt>动态</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>关注</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>被收藏</dt>
                <dd>—</dd>
              </div>
            </dl>
            <blockquote>
              我写下的，是想留住的微光；
              <br />
              我阅读的，是想抵达的远方。
            </blockquote>
          </section>
          <Link href="/studio/moments/new" className="xy-feed-write">
            <span>羽</span>
            <b>
              写下此刻的想法<small>记录灵感 · 分享思考</small>
            </b>
            <ChevronRight />
          </Link>
          <section className="xy-feed-topics">
            <h2>常去话题</h2>
            {COMMON_TOPICS.map(([icon, title, description, count]) => (
              <Link href="/topics" key={title}>
                <i>{icon}</i>
                <span>
                  <b>{title}</b>
                  <small>{description}</small>
                </span>
                <em>{count}</em>
                <ChevronRight />
              </Link>
            ))}
            <Link href="/topics">查看更多话题 ›</Link>
          </section>
        </aside>
      </main>
    </AppShell>
  );
}
