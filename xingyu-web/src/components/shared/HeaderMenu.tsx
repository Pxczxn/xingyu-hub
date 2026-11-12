import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

/*
 * Shared chrome for the header bell and the header mailbox.
 *
 * The card hangs under its icon. Width and list height follow the viewport
 * and the root font size: a phone keeps the card inside the screen, a wide
 * desktop does not grow it into a second column.
 */

const CARD_WIDTH = "w-[min(24rem,calc(100vw-2rem))]";
const LIST_MAX_HEIGHT = "max-h-[min(32rem,70dvh)]";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-accent-foreground ring-2 ring-card"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function HeaderMenu({
  label,
  count,
  icon,
  title,
  open,
  onOpenChange,
  headerAction,
  footer,
  children,
  contentClassName,
  bodyClassName,
}: {
  label: string;
  count: number;
  icon: ReactNode;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Replaces the default card width. The bell keeps the shared width. */
  contentClassName?: string;
  /** Replaces the default scrolling list. A chat panel needs a fixed body. */
  bodyClassName?: string;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          {icon}
          <UnreadBadge count={count} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          contentClassName ?? CARD_WIDTH,
          "overflow-hidden rounded-card border-border bg-card p-0 text-foreground shadow-floating",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2>
          {headerAction}
        </div>
        <div className={cn(bodyClassName ?? cn(LIST_MAX_HEIGHT, "overflow-y-auto"))} data-header-menu-list>
          {children}
        </div>
        {footer ? <div className="border-t border-border px-4 py-2.5">{footer}</div> : null}
      </PopoverContent>
    </Popover>
  );
}
