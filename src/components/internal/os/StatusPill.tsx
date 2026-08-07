import type { OsLevel } from "@/lib/internal/yang-edge-os-presenter";

const LEVEL_CLASS: Record<OsLevel, string> = {
  READY: "border-emerald-700 bg-emerald-950/40 text-emerald-300",
  WARNING: "border-amber-700 bg-amber-950/40 text-amber-300",
  BLOCKED: "border-red-700 bg-red-950/40 text-red-300",
  OFF: "border-zinc-700 bg-zinc-900/50 text-zinc-400",
};

export function StatusPill({
  level,
  label,
}: {
  level: OsLevel;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${LEVEL_CLASS[level]}`}
    >
      {label}
    </span>
  );
}

export function levelSurface(level: OsLevel): string {
  switch (level) {
    case "READY":
      return "border-emerald-900/60 bg-emerald-950/20";
    case "WARNING":
      return "border-amber-900/60 bg-amber-950/20";
    case "BLOCKED":
      return "border-red-900/60 bg-red-950/20";
    default:
      return "border-zinc-800 bg-zinc-900/40";
  }
}
