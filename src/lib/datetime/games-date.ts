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

/** Presentation-only list identity. Not a research/Provider join key. */
export type AnalysisPresentationIdentity = {
  sport?: string | null;
  league?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  startTime?: string | null;
};

const IDENTITY_FIELD_MAX_LEN = 80;

export function sanitizeAnalysisIdentityField(
  raw: unknown,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!trimmed) return null;
  if (trimmed.includes("\0") || trimmed.includes("..")) return null;
  return trimmed.length > IDENTITY_FIELD_MAX_LEN
    ? trimmed.slice(0, IDENTITY_FIELD_MAX_LEN)
    : trimmed;
}

export function sanitizeAnalysisPresentationIdentity(
  identity?: AnalysisPresentationIdentity | null,
): AnalysisPresentationIdentity | null {
  if (!identity) return null;
  const sport = sanitizeAnalysisIdentityField(identity.sport);
  const league = sanitizeAnalysisIdentityField(identity.league);
  const homeTeam = sanitizeAnalysisIdentityField(identity.homeTeam);
  const awayTeam = sanitizeAnalysisIdentityField(identity.awayTeam);
  const startTime = sanitizeAnalysisIdentityField(identity.startTime);
  if (!sport && !league && !homeTeam && !awayTeam && !startTime) return null;
  return { sport, league, homeTeam, awayTeam, startTime };
}

function firstSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseAnalysisPresentationIdentityFromSearch(
  search:
    | Record<string, string | string[] | undefined>
    | null
    | undefined,
): AnalysisPresentationIdentity | null {
  if (!search) return null;
  return sanitizeAnalysisPresentationIdentity({
    sport: firstSearchValue(search.sport),
    league: firstSearchValue(search.league),
    homeTeam: firstSearchValue(search.homeTeam),
    awayTeam: firstSearchValue(search.awayTeam),
    startTime: firstSearchValue(search.startTime),
  });
}

/**
 * Public analysis URL. Optional identity is display fallback only.
 * Existing `buildAnalysisPath(gameId, fromDate)` calls remain valid.
 */
export function buildAnalysisPath(
  gameId: string,
  fromDate?: string | null,
  identity?: AnalysisPresentationIdentity | null,
): string {
  const base = `/analysis/${encodeURIComponent(gameId)}`;
  const params = new URLSearchParams();
  if (fromDate && isValidKstDateString(fromDate)) {
    params.set("fromDate", fromDate);
  }
  const safe = sanitizeAnalysisPresentationIdentity(identity);
  if (safe?.sport) params.set("sport", safe.sport);
  if (safe?.league) params.set("league", safe.league);
  if (safe?.homeTeam) params.set("homeTeam", safe.homeTeam);
  if (safe?.awayTeam) params.set("awayTeam", safe.awayTeam);
  if (safe?.startTime) params.set("startTime", safe.startTime);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
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
