import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { staggerDelay } from "@/lib/stagger";

export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    announcementsApi
      .list()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="section-gap">
      {/*
        页头（2026-10-13，批次 08d）。

        这一页原本是手搓的 flex 行：h1 加右侧「使用指南」。批次 08 的页头形态是
        `border-b border-border/70 pb-5` 那条 hairline，但那个形态没有「右侧操作」的
        位置 —— 而本页有。

        所以这里用共享件 `PageHeader`：它的 class 串逐字就是批次 08 的页头形态
        （`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b
        border-border/70 pb-5`），另外多一个 `actions` 槽，正好装右侧那个链接。手写
        一遍等于把它的 class 串再抄一份。

        `PageHeader` 此前全库零调用 —— 它的文档把自己从「所有工具页的一级原语」降级
        成了「可选，不是模板」，理由是「页面的标题处理该跟着页面的用途走」。公告中心
        正是它点名的那类页面：utility surface、24px 标题、一条 hairline、可选操作。
        这里没有违背那次降级，只是给了它第一个真正的使用者。

        刻意**不**传 `description`：本页没有一句现成的说明文案，而页头不需要靠新写的
        一句话才成立 —— 空状态已经承担了「这里会有什么」的解释。

        列表行错峰入场：条数由服务端决定，与 /reports、/appeals 同一条判据（固定区块
        由 AppLayout 的 `animate-page-enter` 负责，见 EventDetailPage 的注释）。
        错峰挂在 `<li>` 上，不挂在 `<Link>` 上 —— 测试断言每张卡内恰好一个 `<p>` 级别的
        结构，入场动画不该往卡片内部加任何东西。

        卡片表面升到批次 07 起的形态：`rounded-xl` + `border-border/70`，交互反馈用
        `card-lift` —— 整卡都是 `<Link>`，所以抬升说的是真话（方案 §6.2 C：可点击卡片
        「边框提亮 + 微抬升」，`.card-lift` 逐字就是这两条）。刻意不叠 `hover:border-accent-line`：
        `card-lift` 自己的文档写明「描边从 /70 收到全量，换的是锐度不是色相」，再叠一条金色
        描边会有两条 `border-color` 规则在同一元素上竞争。`focus-ring` 是本页原先缺的
        —— 键盘用户此前看不见焦点落在哪张卡上。逐字同形于 `MomentsPage` 的 feed 卡。
      */}
      <PageHeader
        title="公告中心"
        actions={
          <Link to="/guide" className="text-sm text-accent-strong hover:underline">
            使用指南
          </Link>
        }
      />

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? (
        <>
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无已发布公告"
          description="有新的已发布公告时会出现在这里。"
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="animate-rise-in"
              style={{ animationDelay: staggerDelay(index) }}
            >
              <Link
                to={`/announcements/${encodeURIComponent(item.id)}`}
                className="card-lift focus-ring block rounded-xl border border-border/70 bg-card p-4"
              >
                {/* 层级：标题 → 正文预览 → 时间。预览只帮读者在标题之外判断要不要点开，
                    不是把每条公告做成文章卡片，所以纯文本、最多两行、无富文本。 */}
                <h2 className="section-heading">{item.title}</h2>
                {announcementPreview(item.body) ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-foreground-soft">
                    {announcementPreview(item.body)}
                  </p>
                ) : null}
                {item.publishedAt ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatPublishedAt(item.publishedAt)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/*
 * 列表预览用的正文摘要。
 *
 * 直接用公开 DTO 已有的 `body`，**不新增 summary 字段**。
 * 公告正文是纯文本（`whitespace-pre-wrap` 渲染，HTML 不解析），这里把它压成一行：
 * 换行/制表/连续空白折成单空格，避免预览里出现空洞；最多 2 行由 CSS `line-clamp` 负责，
 * 这里不按字符数硬截断（免得多语言下算错），只是把结构压平。
 *
 * 没有 body 时返回空串 —— 列表会整行不渲染预览，而不是留个空段落。
 */
function announcementPreview(body?: string): string {
  if (!body) return "";
  return body.replace(/\s+/g, " ").trim();
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
