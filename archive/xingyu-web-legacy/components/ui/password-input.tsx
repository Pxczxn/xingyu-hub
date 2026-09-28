"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { formatLengthHint, getLengthHintStatus, lengthHintClassName } from "@/lib/length-hint";
import { cn } from "@/lib/utils";

type PasswordInputProps = InputProps & {
  showLengthHint?: boolean;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, value, minLength, maxLength, showLengthHint = false, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const length = String(value ?? "").length;
    const min = typeof minLength === "number" ? minLength : 0;
    const max = typeof maxLength === "number" ? maxLength : 0;
    const hintEnabled = showLengthHint && max > 0;
    const status = getLengthHintStatus(length, min, max);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          value={value}
          minLength={minLength}
          maxLength={maxLength}
          className={cn(hintEnabled ? "pr-[4.75rem]" : "pr-10", className)}
          {...props}
        />
        {hintEnabled ? (
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 right-10 flex w-10 items-center justify-center text-xs tabular-nums",
              lengthHintClassName(status)
            )}
            aria-live="polite"
            aria-label={`已输入 ${length} 位，要求 ${min} 到 ${max} 位`}
          >
            {formatLengthHint(length, max)}
          </span>
        ) : null}
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
