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
  className,
}: {
  blocks?: GuideBlock[] | null;
  body: string;
  className?: string;
}) {
  if (!blocks || blocks.length === 0) {
    return (
      <div
        className={cn(
          "max-w-[68ch] whitespace-pre-wrap text-[15px] leading-8 text-foreground",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <div className={cn("flex max-w-[68ch] flex-col gap-5", className)}>
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
            className="whitespace-pre-wrap text-[15px] leading-8 text-foreground"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
