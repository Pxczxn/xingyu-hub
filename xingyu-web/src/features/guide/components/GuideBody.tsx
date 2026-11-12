import type { GuideBlock } from "@/api/guide/guide.types";
import { cn } from "@/lib/cn";

/*
 * Guide / rules body.
 *
 * Renders the server's `blocks` when present, and falls back to the pre-blocks
 * plain-text rendering when they are not — so this ships ahead of the backend
 * and a body authored without `## ` markers still reads exactly as it did.
 *
 * Why blocks at all: the document used to arrive as one plain-text string. That
 * reads fine but makes a clause outline impossible, because the client cannot
 * know which line is a heading. The server now says so (GuideService
 * .extractBlocks), which is what lets /rules put a clause index beside the text
 * instead of guessing at one.
 *
 * The measure is capped here rather than at the call site so both readers get the
 * same line length. `68ch` is about 34 CJK glyphs — comfortable long-form
 * reading. Note the previous version rendered at full shell width, ~70 glyphs a
 * line.
 */
export function GuideBody({
  blocks,
  body,
  fontSize,
  className,
}: {
  blocks?: GuideBlock[] | null;
  body: string;
  /**
   * SK7 阅读器的字号档（`RulesPage` 的工具条把它调到 15/17/19/21）。
   *
   * 传了它，正文字号就由这个根元素的 `font-size` 下发、子元素只继承 —— 这是唯一能让
   * 「字号」按钮真的生效的做法：`text-[15px]` 写在每个 `<p>` 上时，外层再设 font-size
   * 也压不过它（与 `.article-body` 那条注释记录的是同一件事）。不传时行为逐字不变，
   * 所以 `/rules` 之外的调用方（以及把本组件当文档渲染的测试）零影响。
   */
  fontSize?: number;
  className?: string;
}) {
  /* 有字号档时，正文不再自带 `text-[15px]`（它会赢过继承）；行高也跟着字号走。 */
  const prose = fontSize ? "leading-[1.9]" : "text-[15px] leading-8";

  if (!blocks || blocks.length === 0) {
    return (
      <div
        style={fontSize ? { fontSize } : undefined}
        className={cn(
          "max-w-[68ch] whitespace-pre-wrap text-foreground",
          prose,
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      style={fontSize ? { fontSize } : undefined}
      className={cn("flex max-w-[68ch] flex-col gap-5", className)}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          // Level 2 -> h2, level 3 -> h3. The page owns the h1, so blocks never
          // emit one: a document section is not the page.
          const Heading = block.level >= 3 ? "h3" : "h2";
          return (
            <Heading
              key={block.id ?? `h-${index}`}
              id={block.id ?? undefined}
              className={cn(
                "scroll-mt-24 font-semibold tracking-tight text-primary",
                block.level >= 3 ? "text-base" : "text-lg",
              )}
            >
              {block.text}
            </Heading>
          );
        }

        return (
          <p
            key={`p-${index}`}
            className={cn("whitespace-pre-wrap text-foreground", prose)}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
