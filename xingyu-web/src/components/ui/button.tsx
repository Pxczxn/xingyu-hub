import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui Button.
 *
 * 2026-10-03 — adopted the OFFICIAL shadcn variant/size vocabulary:
 *   variants: default | destructive | outline | secondary | ghost | link
 *   sizes:    default | sm | lg | icon
 *
 * The previous local set used `primary` / `md`, which meant every contributor
 * had to remember which of the two vocabularies applied to this project. Call
 * sites were migrated with it (`primary` -> `default`, `md` -> `default`).
 *
 * Two deliberate deviations from upstream, both required by this project:
 *
 *   1. `accent` is kept as a project variant. It is the GOLD call to action
 *      (创作, 加入, 发布). Upstream has no equivalent, and the brand cannot lose
 *      its primary CTA — so this is an addition, not a rename.
 *
 *   2. `outline` and `ghost` hover with `bg-surface-sunken`, NOT upstream's
 *      `hover:bg-accent`. In the stock shadcn theme `accent` is a subtle grey
 *      hover surface; in THIS theme `--accent` is the brand gold (#F59E0B), so
 *      upstream's class would flash saturated gold on every outlined button
 *      hover. The semantic collision is real and the brand colour wins.
 *
 * Also omitted: upstream's `[&_svg]:size-4`. It is an arbitrary variant
 * (`0,1,1` specificity) and would silently override the explicit `h-3.5 w-3.5`
 * / `h-4 w-4` that ~60 call sites pass to their icons.
 *
 * Colors stay semantic — everything resolves through src/styles/tokens.css.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-card text-foreground hover:bg-surface-sunken",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-surface-sunken",
        link: "text-accent-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
