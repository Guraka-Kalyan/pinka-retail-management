import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, onWheel, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-sm border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{
          backgroundColor: 'var(--card-bg)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border)',
          ...style,
        }}
        ref={ref}
        onWheel={(e) => {
          if (type === "number") {
            (e.target as HTMLInputElement).blur();
          }
          onWheel?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
