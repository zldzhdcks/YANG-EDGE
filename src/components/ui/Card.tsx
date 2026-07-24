import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type CardPadding = "none" | "sm" | "md" | "lg";
type CardAs = "div" | "section" | "article";

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

type CardProps = {
  children: ReactNode;
  as?: CardAs;
  padding?: CardPadding;
  hover?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

export default function Card({
  children,
  as: Component = "div",
  padding = "md",
  hover = false,
  className,
  ...props
}: CardProps) {
  return (
    <Component
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-zinc-900",
        paddingClasses[padding],
        hover && "transition-colors hover:border-white/[0.14]",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
