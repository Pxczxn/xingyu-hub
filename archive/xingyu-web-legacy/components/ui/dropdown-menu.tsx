"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu components must be used within DropdownMenu");
  return ctx;
}

function computeMenuStyle(
  trigger: HTMLButtonElement,
  side: "top" | "bottom",
  align: "start" | "end",
): React.CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const gap = 8;
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 1000,
  };

  if (align === "end") {
    style.right = window.innerWidth - rect.right;
  } else {
    style.left = rect.left;
  }

  if (side === "top") {
    style.bottom = window.innerHeight - rect.top + gap;
  } else {
    style.top = rect.bottom + gap;
  }

  return style;
}

export function DropdownMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, menuRef }}>
      <div ref={rootRef} className={cn("relative inline-block text-left", className)}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, triggerRef } = useDropdownMenu();

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={open}
      className={cn("inline-flex items-center", className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  className,
  align = "end",
  side = "bottom",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const { open, triggerRef, menuRef } = useDropdownMenu();
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setStyle(computeMenuStyle(trigger, side, align));
  }, [align, side, triggerRef]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className={cn(
        "min-w-[10rem] rounded-md border border-border bg-card p-1 shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  className,
  onSelect,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) {
  const { setOpen } = useDropdownMenu();

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted",
        className,
      )}
      onClick={() => {
        onSelect?.();
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
