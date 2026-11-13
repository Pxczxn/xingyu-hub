import { useEffect, useRef, useState } from "react";
import type { ContentSummary } from "@/api/common.types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/relative-time";

/*
 * 发现列表的一行。整行可点，打开阅读层；没有单独的「阅读全文」按钮。
 */

interface DiscoverListItemProps {
  item: ContentSummary;
  onToggleExpand: () => void;
  className?: string;
}

/*
 * 上传占位图几乎是一整块纯色（测试封面会写着 upload）。缩到 16×16 后亮度方差很低。
 * 真实照片的方差远高于这个门槛。跨域图读不了像素时保留原图。
 */
function isFlatPlate(image: HTMLImageElement): boolean {
  try {
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let sum = 0;
    let sumSq = 0;
    const count = size * size;
    for (let index = 0; index < data.length; index += 4) {
      const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      sum += luminance;
      sumSq += luminance * luminance;
    }
    const mean = sum / count;
    // 实测上传占位图约 170；街景、食物一类封面会到数千。
    return sumSq / count - mean * mean < 400;
  } catch {
    return false;
  }
}

export function DiscoverListItem({ item, onToggleExpand, className }: DiscoverListItemProps) {
  const coverRef = useRef<HTMLImageElement>(null);
  const cover = item.cover?.trim() ?? "";
  const [trackedCover, setTrackedCover] = useState(cover);
  const [verdict, setVerdict] = useState<"pending" | "show" | "hide">("pending");
  if (cover !== trackedCover) {
    setTrackedCover(cover);
    setVerdict("pending");
  }

  useEffect(() => {
    if (!cover || verdict === "hide") return;
    const image = coverRef.current;
    if (!image) return;
    const judge = () => {
      if (image.naturalWidth === 0) {
        setVerdict("hide");
        return;
      }
      setVerdict(isFlatPlate(image) ? "hide" : "show");
    };
    const reject = () => setVerdict("hide");
    if (image.complete) judge();
    else {
      image.addEventListener("load", judge);
      image.addEventListener("error", reject);
    }
    return () => {
      image.removeEventListener("load", judge);
      image.removeEventListener("error", reject);
    };
  }, [cover, verdict]);
  const typeLabel =
    item.objectType === "SERIES" ? "系列" : item.objectType === "MOMENT" ? "动态" : "文章";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleExpand();
        }
      }}
      className={cn(
        "discover-row group flex cursor-pointer items-start gap-6 rounded-xl py-8 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
        {item.summary ? (
          <p className="discover-summary mt-2 line-clamp-2 text-sm text-slate-500">{item.summary}</p>
        ) : null}
        <p className="mt-4 flex flex-wrap items-center text-xs text-slate-400">
          {[
            item.authorName ? <span key="author">{item.authorName}</span> : null,
            <span key="type">{typeLabel}</span>,
            item.updatedAt ? (
              <time key="time" dateTime={item.updatedAt}>
                {formatDateTime(item.updatedAt) || item.updatedAt}
              </time>
            ) : null,
            item.likeCount !== undefined ? (
              <span key="likes" className="tabular-nums">
                {item.likeCount} 赞
              </span>
            ) : null,
            item.commentCount !== undefined ? (
              <span key="comments" className="tabular-nums">
                {item.commentCount} 评论
              </span>
            ) : null,
            item.readMinutes !== undefined && item.readMinutes > 0 ? (
              <span key="read">{item.readMinutes} 分钟</span>
            ) : null,
          ]
            .filter((part) => part !== null)
            .map((part, index) => (
              <span key={index} className="inline-flex items-center">
                {index > 0 ? (
                  <span className="px-1.5" aria-hidden>
                    ·
                  </span>
                ) : null}
                {part}
              </span>
            ))}
        </p>
      </div>

      {cover && verdict !== "hide" ? (
        <div
          className={cn(
            "shrink-0",
            verdict === "show"
              ? "hidden sm:block"
              : "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0",
          )}
          aria-hidden
        >
          <img
            ref={coverRef}
            src={cover}
            alt=""
            className="h-[120px] w-[180px] rounded-lg object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
