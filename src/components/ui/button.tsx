import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,box-shadow,color,opacity] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-violet-500 text-white shadow-[0_6px_0_0_var(--color-violet-600)] hover:bg-violet-400 active:translate-y-[3px] active:shadow-[0_3px_0_0_var(--color-violet-600)]",
        accent:
          "bg-sun-400 text-night-950 shadow-[0_6px_0_0_var(--color-sun-500)] hover:bg-sun-300 active:translate-y-[3px] active:shadow-[0_3px_0_0_var(--color-sun-500)]",
        secondary: "bg-white/8 text-ink ring-1 ring-white/12 hover:bg-white/14",
        ghost: "text-ink-muted hover:bg-white/8 hover:text-ink",
        danger: "bg-coral-500 text-white shadow-[0_5px_0_0_var(--color-coral-600)] hover:bg-coral-400 active:translate-y-[3px]",
        outline: "ring-2 ring-white/20 text-ink hover:bg-white/6 hover:ring-white/35",
        link: "text-cyan-300 underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 rounded-md px-3.5 text-sm",
        md: "h-11 rounded-lg px-5 text-[0.95rem]",
        lg: "h-14 rounded-xl px-7 text-lg",
        xl: "h-16 rounded-2xl px-9 text-xl",
        icon: "size-10 rounded-lg",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Component = asChild ? Slot.Root : "button";
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner className="size-4" />}
            {children}
          </>
        )}
      </Component>
    );
  },
);
Button.displayName = "Button";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
