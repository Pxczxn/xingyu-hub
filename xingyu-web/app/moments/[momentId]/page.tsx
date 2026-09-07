"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CommentThread, FollowButton } from "@/components/community/engagement";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type CommentItem } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

function mapComments(items: CommentItem[]) {
  return items.map((x) => ({
    id: x.id,
    author: x.authorUsername ?? x.authorId,
    authorUsername: x.authorUsername,
    body: x.body,
    createdAt: formatDateTime(x.createdAt),
    parentId: x.parentId,
  }));
}
const topics: string[] = [];
export default function MomentDetailPage() {
  const { momentId } = useParams<{ momentId: string }>();
  const { data, loading, error } = useAsyncData(
    () => communityApi.getMoment(momentId),
    [momentId],
  );
  const { data: commentsRaw, refresh } = useAsyncData(
    () => communityApi.getComments("MOMENT", momentId).catch(() => []),
    [momentId],
  );
  const comments = mapComments(commentsRaw ?? []);
  const author = data?.authorId || "starlight";
  if (loading)
    return (
      <AppShell>
        <main className="xy-moment-loading">正在打开动态…</main>
      </AppShell>
    );
  if (error || !data)
    return (
      <AppShell>
        <main className="xy-moment-loading">
          <Alert variant="destructive">{error || "动态不存在"}</Alert>
        </main>
      </AppShell>
    );
  return (
    <AppShell>
      <main className="xy-moment-page">
        <aside className="xy-moment-rail">
          <nav>
            {[
              ["首页", "/"],
              ["关注", "/me/following"],
              ["发现", "/discover"],
              ["话题广场", "/topics"],
              ["文章", "/discover"],
              ["活动", "/events"],
              ["星语小店", "/collections"],
              ["帮助中心", "/guide"],
            ].map(([x, h]) => (
              <Link href={h} key={x}>
                {x}
              </Link>
            ))}
          </nav>
          <section>
            <span>星</span>
            <b>星语社区 · 连接每一颗星</b>
            <p>温暖 · 真诚 · 共鸣 · 成长</p>
            <Button variant="outline" asChild>
              <Link href="/guide">了解更多</Link>
            </Button>
          </section>
        </aside>
        <div className="xy-moment-center">
          <article className="xy-moment-card">
            <header>
              <Link href="/moments">
                <ArrowLeft />
                返回
              </Link>
              <div>
                <Eye />
                公开 <span>|</span>
                <time>
                  {data.createdAt ? formatDateTime(data.createdAt) : "发布时间暂未提供"}
                </time>
                <MoreHorizontal />
              </div>
            </header>
            <div className="xy-moment-author">
              <span>长</span>
              <div>
                <Link href={`/users/${author}`}>
                  {data.authorUsername || "作者信息暂未提供"}
                </Link>
                <p>作者资料暂未提供</p>
              </div>
            </div>
            <h1>{data.title || "动态标题暂未提供"}</h1>
            <div className="xy-moment-body">
              {(
                data.body || "动态内容暂未提供"
              )
                .split(/\n+/)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
            <div className="xy-moment-gallery">
              {["night-one", "night-two", "night-three"].map((x, i) => (
                <Image
                  src={`/prototype-assets/moment-detail/${x}.png`}
                  alt="星夜"
                  width={245}
                  height={159}
                  key={x}
                />
              ))}
            </div>
            <div className="xy-moment-tags">
              {topics.map((x) => (
                <Link href="/topics" key={x}>
                  # {x}
                </Link>
              ))}
            </div>
            <div className="xy-moment-stats">
              <button type="button" disabled>
                <Star />
                互动数据暂未提供
              </button>
              <button type="button" disabled>
                <Heart />
                点赞数据暂未提供
              </button>
              <button type="button" disabled>
                <MessageCircle />
                {comments.length}
              </button>
              <button type="button" disabled>
                <Share2 />
                分享数据暂未提供
              </button>
                <span>浏览数据暂未提供</span>
            </div>
            <div className="xy-moment-related xy-empty-related">
              <p>关联文章暂未提供</p>
            </div>
          </article>
          <section className="xy-moment-comments">
            <div>
              <h2>全部评论（{comments.length}）</h2>
              <span>按时间</span>
            </div>
            <CommentThread
              comments={comments}
              objectType="MOMENT"
              objectId={momentId}
              onPosted={refresh}
            />
          </section>
        </div>
        <aside className="xy-moment-side">
          <section className="xy-moment-about">
            <h2>关于作者</h2>
            <div>
              <span>长</span>
              <p>
                <b>
                  {data.authorUsername || "作者信息暂未提供"}
                </b>
                <strong>作者统计数据暂未提供</strong>
              </p>
              {data.authorUsername ? <FollowButton username={data.authorUsername} /> : null}
            </div>
            <p>
              用文字记录生活，在星语里遇见温暖。愿我们都能在星光里，找到属于自己的方向。
            </p>
          </section>
          <section>
            <div className="xy-moment-side-title">
              <h2>相关话题</h2>
              <Link href="/topics">更多 ›</Link>
            </div>
            {topics.length ? topics.map((x, i) => (
              <Link href="/topics" className="xy-moment-topic" key={x}>
                <Image
                  src={`/prototype-assets/moment-detail/night-${["one", "two", "three", "one"][i]}.png`}
                  alt=""
                  width={34}
                  height={34}
                />
                <b># {x}</b>
                <span>{[12000, 8765, 6542, 4321][i]} 讨论</span>
              </Link>
            )) : <p className="py-4 text-sm text-slate-400">相关话题暂未提供</p>}
          </section>
          <section>
            <div className="xy-moment-side-title">
              <h2>更多动态</h2>
              <Link href="/moments">更多 ›</Link>
            </div>
            <p className="py-4 text-sm text-slate-400">更多动态暂未提供</p>
          </section>
        </aside>
      </main>
    </AppShell>
  );
}
