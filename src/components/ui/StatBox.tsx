import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type StatBoxSize = "sm" | "md" | "lg";

const valueSizeClasses: Record<StatBoxSize, string> = {
  sm: "text-lg sm:text-xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-2xl sm:text-3xl md:text-4xl",
};

type StatBoxProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  /** 값 색상 클래스 (기존 팔레트만 — zinc/blue/emerald/amber) */
  valueClassName?: string;
  size?: StatBoxSize;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;

export default function StatBox({
  label,
  value,
  hint,
  accent = false,
  valueClassName,
  size = "md",
  className,
  ...props
}: StatBoxProps) {
  return (
    <div className={cn(className)} {...props}>
      <p
        className={cn(
          "font-bold tabular-nums",
          valueSizeClasses[size],
          valueClassName ?? (accent ? "text-blue-400" : "text-white"),
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{label}</p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-[11px]",
            accent && !valueClassName ? "text-blue-400/80" : "text-zinc-600",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
