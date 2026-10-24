import { Link } from "react-router-dom";
import { FileText, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/api/messages/messages.types";
import { isRecalled } from "@/api/messages/messages.types";
import { cn } from "@/lib/cn";
import { useAuthenticatedAttachmentUrl } from "./use-authenticated-attachment-url";

/*
 * One chat bubble.
 *
 * 2026-10-06 — sender identity is no longer a truncated id:
 *   - the payload now carries a structured `sender` (userId + CURRENT username /
 *     displayName / avatar, resolved server-side at read time), so a group bubble names
 *     the person and links to their canonical `/u/{username}`. Renaming therefore updates
 *     historical messages instead of stranding them on an opaque id.
 *   - `senderId` is still used to decide which side the bubble goes on, because that is
 *     the one thing that must NOT come from a mutable name.
 *   - when `sender` is missing (profile gone) the label degrades to a neutral 「已注销用户」
 *     rather than showing a raw UUID.
 *
 * Two other things the backend already decided, which this component must not undo:
 *
 *  1. `body` is the display string. For an IMAGE/FILE message the service stores the
 *     attachment URL as `body` when no caption was given, so text is always renderable —
 *     but an attachment is rendered from the attachment, and the body is suppressed when
 *     it merely repeats that URL.
 *  2. A recalled message is a TOMBSTONE. The server blanks the body to 「[消息已撤回]」 and
 *     nulls the attachments; rendering is keyed off `recalledAt`, never off sniffing the
 *     body text.
 *
 * Attachments go through `useAuthenticatedAttachmentUrl`: the raw `attachmentUrl` is a
 * display path whose directory is no longer served statically, and `<img src>` cannot send
 * the session token anyway.
 */

export function formatMessageTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

const SHANGHAI = "Asia/Shanghai";

/**
 * 消息时间的短格式（2026-10-06）。
 *
 * 当天只给 `HH:mm` —— 那一屏的每条消息都在同一天里，重复日期是纯噪音（实测一屏 6 个
 * 完全相同的时间戳）。非当天沿用原来的「MM/DD HH:mm」，不引入「昨天 / N 分钟前」那类
 * 需要日历边界推理的聚合。
 *
 * `now` 是可注入的，和 `isRecallable` 的 `now` 参数同一个理由：这是函数里唯一依赖「此刻」
 * 的地方，而「今天」是上海时区的日历边界。测试若拿 `Date.now() - 60_000` 构造样本，
 * 在本地 00:00 前一分钟内就不再是「今天」——函数会正确地给出带日期的格式，断言却
 * 期待只有时分，于是每天有一个窗口必然失败。
 */
export function formatMessageTimeShort(
  value: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const sameDay =
    now.toLocaleDateString("zh-CN", { timeZone: SHANGHAI }) ===
    date.toLocaleDateString("zh-CN", { timeZone: SHANGHAI });
  return date.toLocaleString("zh-CN", {
    ...(sameDay ? {} : { month: "2-digit", day: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHANGHAI,
  });
}

/**
 * 这条消息现在还能撤回吗（2026-10-06）。
 *
 * 依据是**服务端给的 `recallUntil`**，不是前端复制的窗口常量：那个常量属于服务端策略，
 * 复制一份必然漂移，而窗口只有两分钟，一个常驻的撤回按钮超窗后点击必然 409。
 *
 * 只是提示 —— 真撞上边界时服务端仍会 409，调用方照常把那句话显示出来。
 */
export function isRecallable(message: ChatMessage, now: number = Date.now()): boolean {
  if (isRecalled(message)) return false;
  if (!message.recallUntil) return true; // 旧数据没有这个字段：维持原行为，不假装不可撤回
  const until = new Date(message.recallUntil).getTime();
  return Number.isNaN(until) ? true : until > now;
}

/** What to show as the sender's name, or null when the profile is gone. */
export function senderName(message: ChatMessage): string | null {
  const displayName = message.sender?.displayName?.trim();
  if (displayName) return displayName;
  const username = message.sender?.username?.trim();
  return username || null;
}

/** Canonical profile href, or null when the username cannot be resolved. */
export function senderProfileHref(message: ChatMessage): string | null {
  const username = message.sender?.username?.trim();
  return username ? `/u/${encodeURIComponent(username)}` : null;
}

export function MessageBubble({
  message,
  conversationId,
  mine,
  showSender,
  showTime = true,
  canRecall,
  pending,
  highlighted = false,
  /** Stable id, used by the search landing to find this row in the DOM. */
  rowId,
  onRecall,
}: {
  message: ChatMessage;
  /** Needed to build the member-checked attachment URL. */
  conversationId: string;
  /** Sent by the signed-in user. Resolved by the page from the socket's own id, not from useAuth (which has no id). */
  mine: boolean;
  /** Render a sender label — only useful in a group, and never for your own. */
  showSender: boolean;
  /**
   * 2026-10-06: the page decides this, because only it knows the neighbouring messages.
   * Rule: show the time only when the minute value changes within a run of consecutive
   * messages (see shouldShowMessageTime) — a screen of six messages from the same minute
   * used to render six identical timestamps.
   */
  showTime?: boolean;
  /** The message is mine, not recalled, and the server says the window is still open. */
  canRecall: boolean;
  pending: boolean;
  /** Static (no-motion) emphasis, used when arriving from a search result. */
  highlighted?: boolean;
  /** Rendered as `data-message-id` so the page can scroll to this exact row. */
  rowId?: string;
  onRecall: (message: ChatMessage) => void;
}) {
  const recalled = isRecalled(message);
  const at = showTime ? formatMessageTimeShort(message.createdAt) : null;
  const attachmentUrl = useAuthenticatedAttachmentUrl(
    conversationId,
    message.id,
    message.attachmentFileId,
  );
  const isImage = message.messageType === "IMAGE" && Boolean(message.attachmentFileId);
  const isFile = message.messageType === "FILE" && Boolean(message.attachmentFileId);
  const showBody = Boolean(message.body?.trim()) && !bodyRepeatsAttachment(message);
  const name = senderName(message);
  const profileHref = senderProfileHref(message);

  return (
    <li
      className={cn("flex scroll-mt-24 flex-col gap-1", mine ? "items-end" : "items-start")}
      data-recalled={recalled ? "true" : undefined}
      data-highlighted={highlighted ? "true" : undefined}
      data-message-id={rowId}
    >
      {showSender && !mine ? (
        <span className="px-2 text-xs text-muted-foreground">
          {profileHref ? (
            <Link to={profileHref} className="hover:text-foreground hover:underline">
              {name}
            </Link>
          ) : (
            // No username -> no link. A dead link to nowhere is worse than a plain label.
            (name ?? "已注销用户")
          )}
        </span>
      ) : null}

      <div
        className={cn(
          // 2026-10-06: a static ring, no Motion — this only marks "you arrived here from
          // a search result". A colour change that decays on its own would be Motion.
          "max-w-[80%] rounded-lg border px-3 py-2 text-sm",
          highlighted && "border-accent ring-2 ring-accent/40",
          recalled
            ? "border-dashed border-border bg-muted/40 text-muted-foreground italic"
            : mine
              ? "border-accent/40 bg-accent/15 text-foreground"
              : "border-border bg-card text-foreground",
          pending && "opacity-60",
        )}
      >
        {recalled ? (
          <span className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {message.body || "[消息已撤回]"}
          </span>
        ) : (
          <>
            {isImage && attachmentUrl ? (
              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="block">
                <img
                  src={attachmentUrl}
                  alt={message.attachmentName ?? "图片"}
                  className="max-h-64 max-w-full rounded"
                />
              </a>
            ) : null}

            {isImage && !attachmentUrl ? (
              <span className="text-xs text-muted-foreground">图片加载中…</span>
            ) : null}

            {isFile && attachmentUrl ? (
              <a
                href={attachmentUrl}
                download={message.attachmentName ?? "附件"}
                rel="noreferrer"
                className="flex items-center gap-1.5 underline hover:no-underline"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {message.attachmentName ?? "附件"}
              </a>
            ) : null}

            {isFile && !attachmentUrl ? (
              <span className="text-xs text-muted-foreground">附件加载中…</span>
            ) : null}

            {showBody ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
          </>
        )}
      </div>

      {/*
        2026-10-13 (batch 07c). The time + 「撤回」 line is a FOOTNOTE ON THE BUBBLE, so
        it takes the micro step — 11px — and not `text-meta`. It is read together with
        the bubble it hangs off, not as a sentence in the flow, and the prose step here
        would make the timestamp compete with the message it is dating. 10px was a
        pixel under this app's floor (`.eyebrow`); the 「撤回」 button rides the same
        size on purpose, because it belongs to the same footnote.
      */}
      <span className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
        {at ? <time>{at}</time> : null}
        {canRecall ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRecall(message)}
            className="hover:text-foreground hover:underline disabled:opacity-50"
          >
            {pending ? "撤回中…" : "撤回"}
          </button>
        ) : null}
      </span>
    </li>
  );
}

/** True when the message body is just a restatement of its attachment URL. */
function bodyRepeatsAttachment(message: ChatMessage): boolean {
  const body = message.body?.trim();
  const url = message.attachmentUrl?.trim();
  return Boolean(body && url && body === url);
}
