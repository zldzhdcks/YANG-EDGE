import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-white/[0.08] bg-zinc-800 text-zinc-300",
  accent: "border-blue-500/30 bg-blue-500/15 text-blue-400",
  success: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  danger: "border-red-500/30 bg-red-500/15 text-red-400",
  muted: "border-transparent bg-transparent text-blue-400",
};

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">;

export default function Badge({
  children,
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
