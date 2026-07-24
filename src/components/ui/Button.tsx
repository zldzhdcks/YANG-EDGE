import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20",
  secondary:
    "border border-white/[0.08] bg-zinc-900 text-white hover:border-white/[0.14] hover:bg-zinc-800",
  outline:
    "border border-white/10 bg-transparent text-white hover:border-white/20 hover:bg-white/5",
  ghost: "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 rounded-lg px-3 text-xs",
  md: "h-10 rounded-lg px-5 text-sm",
  lg: "h-11 rounded-xl px-5 text-sm",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonBaseProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

type ButtonProps = ButtonBaseProps &
  (
    | ({ href: string } & Omit<ButtonHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">)
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">)
  );

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  href,
  ...props
}: ButtonProps) {
  const classes = buttonClasses({ variant, size, fullWidth, className });

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      type={buttonProps.type ?? "button"}
      className={classes}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
