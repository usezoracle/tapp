"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-green text-ink-true hover:opacity-90 active:opacity-80",
  secondary:
    "bg-surface text-ink border border-line-muted hover:bg-surface-subtle active:bg-surface-muted",
  ghost: "bg-transparent text-ink hover:bg-surface-subtle",
  danger: "bg-danger text-surface hover:opacity-90 active:opacity-80",
};

/**
 * Brand CTA. 59px tall, pill radius, brand-green primary with
 * near-black labels — matches the tapp-merchant + users-app language
 * (single source of truth for the look across all three apps).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading,
    leadingIcon,
    trailingIcon,
    fullWidth = true,
    children,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        "h-[59px] rounded-pill px-6 flex items-center justify-center gap-2 text-base font-medium",
        "transition-opacity disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={20} strokeWidth={2.4} />
      ) : (
        <>
          {leadingIcon}
          <span>{children}</span>
          {trailingIcon}
        </>
      )}
    </button>
  );
});
