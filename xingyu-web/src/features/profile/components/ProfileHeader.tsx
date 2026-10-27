import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import type { ProfileDetail } from "@/api/users/users.types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { buildLoginPath } from "@/features/auth/login-return-path";

/*
 * Profile header: avatar / display name / username / bio / follow control.
 * Follow is real (verified: POST|DELETE /api/v1/users/{username}/follow -> 204).
 *
 * `blockControl` is an optional slot for the Phase 2A-2a block entry. It is a
 * slot rather than inline logic so this header keeps its existing structure —
 * the block feature must not force a redesign of the profile header.
 *
 * `statsSlot` 同理由：计数是身份的一部分（「这个人写了多少」），但不属于本组件
 * 的数据职责，由页面注入，本组件只决定它落在版面哪一行。
 *
 * 批次 06 修正：两个链接原来用 `text-accent`，而 `--accent` 是 FILL token
 * （`38 92% 50%`，白底 2.15:1），当正文色用不达标。改 `text-accent-strong`
 * （`26 90% 37%`，白底 5.05:1，过 AA）—— 这是方案点名的红线，不是配色偏好。
 *
 * 批次 07：从「一张横跨全宽的圆角白卡」改成**无表面的通栏身份带**。
 *
 * 旧版把头像 + 名字 + 关注按钮塞进 `rounded-xl border bg-card` 的卡里，两端对齐，
 * 中间留出一大片什么都没有的白 —— 实测 1440px 下卡片内左右两块之间空了 600px 以上，
 * 身份带成了页面上最空的一块。更要命的是它与全站报头语言相反：首页、探索页、系列
 * 详情页的报头都是**没有卡片表面的通栏**，靠 eyebrow / 衬线大标题 / 一条 border-b
 * 收口来建立层级。个人主页是唯一一个把身份做成「卡片」的地方。
 *
 * 现在对齐这套语言：
 *  - 去掉 `border`/`bg-card`/`rounded-xl`，只留底部 `border-b border-border/60` 收口；
 *  - 名字改用 `font-display` 衬线，字号走 `--text-display` 档 —— 和「欢迎来到星语」
 *    「探索」「后端工程入门」同一个标题家族；
 *  - 头像从灰底灰字改成淡金渐变 + 淡金描边环（与 CreatorCardItem 的圆形头像同款），
 *    它是身份锚点，不该是一块中性灰；
 *  - 计数（statsSlot）落在简介下方一行内联，不再占侧栏一列。
 *
 * 为什么不做面包屑：全站 `components/ui/breadcrumb.tsx` 零使用，只有系列详情页
 * 手写了一行。个人主页的上一层是「首页」，面包屑只会写「首页 / 某人」，零信息量。
 *
 * 批次 08（身份区收拢）：批次 07 只是把卡片外壳拆了，`sm:justify-between` 还在，
 * 于是同一个病换了个形状复发 —— 身份块仍在最左、操作区仍在最右，实测两块之间的
 * 空档 1920px 下 902.9px、1440px 下 785.4px、1280px 下 641.4px，且随视口线性增长。
 * 「在一个通栏里放两个贴边的块」不是布局，是把两样没关系的东西摆到同一行。
 *
 * 因此结构改成**两段式**，而不是「左右两栏各自贴边」：
 *
 *   header
 *     ├─ 头像（固定 80/96px，身份锚点）
 *     └─ body（flex-1，sm 起 flex-row，gap-8）
 *          ├─ 身份文字：名字 / @用户名 / 简介 / 网站 / 计数
 *          └─ 操作区：shrink-0，**跟在文字后面**，间距固定 32px
 *
 * 空档不再来自容器宽度，而是来自这个固定 gap —— 任何视口下都是 32px，
 * 与 `PageMasthead` 里「动作跟在文字后面、不用 justify-between」是同一判据
 * （那边实测 530px 空档，这里 785–903px，病因完全相同）。
 * 代价是右侧留白随视口变大，这是通栏身份带该有的样子：内容靠左读，空白是页边距，
 * 而不是两块内容之间的裂缝。
 *
 * 四种状态的视觉层级同时理顺（此前它们互不相干，权重全凭颜色碰巧）：
 *
 *   关注         default 实心深色，h-9 —— 页面唯一的主操作
 *   已关注       outline 描边，h-9 —— 同一位置的「已完成」态，主动降权
 *   登录后关注   buttonVariants(default) 挂在 <Link> 上 —— 与「关注」同形同权重。
 *                原来是一行橙色文字链，同一位置在两种登录态下差两级，
 *                访客看到的是「这里有个小链接」而不是「这里能关注」。它仍是 link
 *                （跳登录页），只是长得像按钮。
 *   屏蔽此用户   outline + size=sm，h-8 —— 破坏性但低频，比关注小一号；
 *                点开后才出现 destructive「确认屏蔽」，破坏动作不预先染色。
 *   解除屏蔽     ghost + text-muted-foreground —— 撤销动作，最弱一级。
 *   这是你的主页 纯文本 + Check 图标，无边框无背景 —— 它不可点，就不该长得像控件。
 *                （批次 07 用的是带 border/bg-card 的 chip，与真正的按钮同形。）
 *
 * 窄屏（<sm）走 flex-col：头像独占一行在左，文字与操作区纵向堆叠，操作按钮
 * 拉满宽度给拇指；`sm` 起才排成一行，且操作区 `sm:w-auto` 不撑满 —— 静态标签
 * 「这是你的主页」一旦拉满就会伪装成按钮。
 *
 * 批次 10（操作区改锚名字行）：批次 08 的两段式把操作区放在「整列身份文字」之后，
 * 于是它的左边缘 = 头像 + **这一列文字的实际宽度** + 32px。而这一列的宽度由最宽的
 * 一行决定，也就是简介。批次 08 验收时开发库里 bio 全是 null，量到 32px 就通过了 ——
 * 那个 32px 是 bio 盒子右缘到按钮的距离，不是名字文字到按钮的距离。
 *
 * 补上资料之后同一个病立刻复发。实测（1440 / 1920 数字完全相同，与视口无关）：
 *
 *   bio 为空           名字文字→按钮 151.9px   身份列宽 247.1
 *   bio 5 字          151.9px                  247.1
 *   bio 85 字（真实）  534.7px                  630
 *   bio 超长 3 段      576.7px                  672（撞 max-w-2xl 上限）
 *
 * 也就是「简介写得越长，关注按钮跑得越远」—— 按钮的位置不该由一段自我介绍的长度决定。
 *
 * 因此把结构再拆一层：名字行（h1 + @用户名）与操作区放进同一个 flex 行容器，
 * 简介 / 网站 / 计数移到这一行**下方**通栏。操作区现在锚在名字块之后，间距是
 * `gap-x-6` 的 24px；实测四种 bio 形态（空/短/85 字/超长）在 1440 与 1920 下
 * 名字文字→按钮恒为 24px。
 *
 * 垂直节奏刻意保持不变（bio `mt-2.5`、website `mt-1.5`、stats `mt-3.5` 原样搬到
 * 行容器之外），实测元素间距仍为 [4, 10, 6, 14.5]、bio/website/stats 的 top 位移
 * 与改前逐像素相同 —— 这次只动横向锚点，不动纵向排版。
 *
 * `sm:flex-wrap` 是必需的：名字特别长（或操作区展开成确认块）时操作区换到下一行，
 * 而不是把名字压到折行。
 */
export function ProfileHeader({
  profile,
  following,
  followPending,
  followError,
  onToggleFollow,
  canFollow,
  blockControl,
  statsSlot,
}: {
  profile: ProfileDetail;
  following: boolean;
  followPending: boolean;
  followError: string | null;
  onToggleFollow: () => void;
  canFollow: boolean;
  blockControl?: ReactNode;
  /** Inline counters rendered under the bio — see ProfileStats. */
  statsSlot?: ReactNode;
}) {
  const location = useLocation();
  const name = profile.displayName ?? profile.username;

  return (
    <header className="border-b border-border/60 pb-6 sm:pb-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full border border-border object-cover sm:h-24 sm:w-24"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/20 to-accent/10 text-2xl font-semibold text-accent-foreground ring-2 ring-accent/10 sm:h-24 sm:w-24 sm:text-3xl"
          >
            {name.slice(0, 1)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* 名字行：名字/用户名与操作区同处一行，操作区锚在**名字块之后**，
              而不是锚在整列文字的右边缘 —— 见文件头「批次 10」的实测数据。 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6">
            <div className="min-w-0">
              <h1 className="font-display text-[1.75rem] font-extrabold leading-[1.2] tracking-[-0.03em] text-primary sm:text-[2.05rem]">
                {name}
              </h1>
              <p className="mt-1 text-meta text-muted-foreground">@{profile.username}</p>
            </div>

            <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:w-auto sm:pt-1">
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-2.5">
                {profile.owner ? (
                  <span
                    data-testid="profile-owner-badge"
                    className="inline-flex items-center gap-1.5 text-meta text-muted-foreground"
                  >
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    这是你的主页
                  </span>
                ) : canFollow ? (
                  <>
                    <Button
                      type="button"
                      variant={following ? "outline" : "default"}
                      className="w-full sm:w-auto"
                      disabled={followPending}
                      onClick={onToggleFollow}
                    >
                      {followPending ? "处理中" : following ? "已关注" : "关注"}
                    </Button>
                    {blockControl}
                  </>
                ) : (
                  <Link
                    to={buildLoginPath(`${location.pathname}${location.search}`)}
                    className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}
                  >
                    登录后关注
                  </Link>
                )}
              </div>
              {followError ? (
                <span role="alert" className="text-sm text-destructive">
                  {followError}
                </span>
              ) : null}
            </div>
          </div>

          {profile.bio ? (
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-foreground">{profile.bio}</p>
          ) : null}
          {profile.websiteUrl ? (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-1.5 inline-block break-all text-meta text-accent-strong hover:underline"
            >
              {profile.websiteUrl}
            </a>
          ) : null}
          {statsSlot ? <div className="mt-3.5">{statsSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
