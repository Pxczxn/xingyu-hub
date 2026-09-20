import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Password field with a show/hide toggle.
 * Migrated because the login form actually needs it; no other input variants were copied.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 pr-16 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {visible ? "隐藏" : "显示"}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
