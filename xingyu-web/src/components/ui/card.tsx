import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/*
 * shadcn/ui Card.
 *
 * 2026-10-03 — aligned to the official shadcn component set (Card / CardHeader /
 * CardTitle / CardDescription / CardContent / CardFooter) with `forwardRef` on
 * every part, matching upstream. The public API was already the same shape, so
 * this is a source-level alignment rather than a call-site migration.
 *
 * Two deliberate deviations from upstream, both project rules:
 *
 *   1. No `shadow-sm`. MASTER.md specifies flat surfaces, and the shadow was the
 *      only one in the product — every other panel separates by border alone.
 *      Depth here comes from the cream-canvas / white-card pair, not from blur.
 *      Call sites that want emphasis pass `hover:shadow-sm` explicitly.
 *
 *   2. `CardTitle` renders an `<h3>`, not upstream's `<div>`. A card title is a
 *      heading: it belongs in the document outline so a screen reader can jump
 *      between cards. `children` is destructured explicitly rather than left in
 *      `...props` so the heading is statically known to have content
 *      (jsx-a11y/heading-has-content).
 *
 * `border-border/70` rather than a hard `border-border` keeps cards a touch
 * quieter than the section dividers they sit among.
 */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border border-border/70 bg-card text-card-foreground", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-card font-semibold leading-none tracking-tight text-primary", className)}
      {...props}
    >
      {children}
    </h3>
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-meta text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
