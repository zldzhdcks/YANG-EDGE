/**
 * /games 날짜 query 및 분석 복귀 경로 유틸 (KST YYYY-MM-DD).
 */
import { getKstToday } from "./kst";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidKstDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

/** Invalid or missing → today KST. */
export function parseGamesDateParam(
  value: string | null | undefined,
): string {
  if (value && isValidKstDateString(value)) return value;
  return getKstToday();
}

export function shiftKstDate(dateKst: string, days: number): string {
  const [y, m, d] = dateKst.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function buildGamesPath(dateKst: string): string {
  return `/games?date=${encodeURIComponent(dateKst)}`;
}

export function buildAnalysisPath(
  gameId: string,
  fromDate?: string | null,
): string {
  const base = `/analysis/${encodeURIComponent(gameId)}`;
  if (fromDate && isValidKstDateString(fromDate)) {
    return `${base}?fromDate=${encodeURIComponent(fromDate)}`;
  }
  return base;
}

/**
 * Analysis → games back link.
 * 1) valid fromDate query 2) game dateKst 3) today KST
 */
export function resolveGamesBackDate(
  fromDate: string | null | undefined,
  gameDateKst: string | null | undefined,
): string {
  if (fromDate && isValidKstDateString(fromDate)) return fromDate;
  if (gameDateKst && isValidKstDateString(gameDateKst)) return gameDateKst;
  return getKstToday();
}

export function buildGamesBackPath(
  fromDate: string | null | undefined,
  gameDateKst: string | null | undefined,
): string {
  return buildGamesPath(resolveGamesBackDate(fromDate, gameDateKst));
}
