import { instantToKst } from "@/lib/datetime/kst";
import type { PublicRecentFormSide } from "@/types/public-game-analysis-view";

export function formatKoreanMonthDay(dateKst: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) return null;
  const month = Number(dateKst.slice(5, 7));
  const day = Number(dateKst.slice(8, 10));
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return `${month}월 ${day}일`;
}

export function formatKoreanDateTime(
  dateKst: string | null,
  startTimeKst: string | null,
): string | null {
  if (!dateKst) return null;
  const day = formatKoreanMonthDay(dateKst);
  if (!day) return null;
  const time =
    startTimeKst && /^\d{2}:\d{2}/.test(startTimeKst)
      ? startTimeKst.slice(0, 5)
      : null;
  return time ? `${day} ${time}` : day;
}

export function formatObservedAtKst(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const kst = instantToKst(iso);
  if (!kst) return null;
  const day = formatKoreanMonthDay(kst.date);
  if (!day) return null;
  return `${day} ${kst.time}`;
}

export function formatOdds(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

export function formatRecentFormSummary(side: Omit<PublicRecentFormSide, "summary" | "team">): string {
  const drawPart = side.draws > 0 ? ` ${side.draws}무` : "";
  return `최근 ${side.window}경기 ${side.wins}승${drawPart} ${side.losses}패`;
}

export function matchHeaderMeta(league: string | null, dateTime: string | null): string {
  return [league, dateTime].filter(Boolean).join(" · ");
}
