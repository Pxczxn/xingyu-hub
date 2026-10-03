import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * shadcn/ui Toast, built on @radix-ui/react-toast.
 *
 * Why Radix instead of a hand-rolled stack: a floating toast is the one surface
 * in this app that appears WITHOUT the user asking for it, so it has to get the
 * interrupting semantics right — `role="status"` for polite announcements, a
 * live region that is mounted before the first toast so screen readers actually
 * announce it, Escape to dismiss, a real focus target for the close button, and
 * swipe-to-dismiss on touch. All of that is what the primitive is for; a div with
 * a CSS animation gets none of it.
 *
 * Deviations from upstream, both project rules:
 *
 *   1. `Toast` uses `border-border/70` + `shadow-lg` instead of upstream's flat
 *      border. This is the ONLY place the product uses a shadow, and it is
 *      deliberate: a toast floats over arbitrary page content and must separate
 *      from it. Every other surface separates by border alone (see MASTER.md).
 *
 *   2. `ToastDescription` uses the `meta` type step rather than `text-sm`, so a
 *      toast body matches the rest of the product's secondary text.
 *
 * The enter/exit animation is defined here (`data-[state=open]` / `closed` with
 * `data-[swipe=...]`) so it lives next to the primitive rather than in the
 * feature that happens to render it.
 */

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed inset-x-0 top-[var(--toast-top-offset)] z-[100] flex max-h-screen w-full flex-col-reverse gap-2.5 p-3 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:w-[384px] sm:max-w-[calc(100vw-2rem)] sm:flex-col sm:p-4",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-3.5 pr-9",
    "border-border/70 bg-card text-card-foreground shadow-lg",
    "transition-all duration-300 ease-out",
    // enter: slide in from the trailing edge. `translate-y-0` is NOT redundant —
    // the mobile closed state below pushes the card up, and without an explicit
    // reset here the open state would inherit that offset and stay off-screen.
    "data-[state=open]:translate-x-0 data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
    "data-[state=closed]:translate-x-[110%] data-[state=closed]:opacity-0",
    // swipe: follow the gesture on touch
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[swipe=cancel]:translate-x-0",
    "data-[swipe=end]:translate-x-[110%] data-[swipe=end]:opacity-0",
    // mobile: the viewport is full-width at the top, so slide DOWN from above
    // rather than sideways off-screen.
    "max-sm:data-[state=closed]:translate-x-0 max-sm:data-[state=closed]:-translate-y-[110%]",
  ].join(" "),
  {
    variants: {
      tone: {
        default: "",
        success: "border-accent-line/70",
        danger: "border-destructive/40",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, tone, ...props }, ref) => (
  <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ tone }), className)} {...props} />
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-card font-semibold leading-snug text-primary", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("mt-0.5 line-clamp-2 text-meta leading-5 text-muted-foreground", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    toast-close=""
    aria-label="关闭通知"
    className={cn(
      "focus-ring absolute right-1.5 top-1.5 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-surface-sunken hover:text-foreground",
      className,
    )}
    {...props}
  >
    <X className="h-3.5 w-3.5" aria-hidden />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose };
export type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
