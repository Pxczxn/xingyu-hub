"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InputWithLengthHintProps = InputProps & {
  maxLength: number;
};

export const InputWithLengthHint = React.forwardRef<HTMLInputElement, InputWithLengthHintProps>(
  ({ className, value, maxLength, ...props }, ref) => {
    const length = String(value ?? "").length;

    return (
      <div className="relative">
        <Input
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn("pr-10", className)}
          {...props}
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums text-zinc-400"
          aria-live="polite"
          aria-label={`已输入 ${length} 位`}
        >
          {length}
        </span>
      </div>
    );
  }
);
InputWithLengthHint.displayName = "InputWithLengthHint";
