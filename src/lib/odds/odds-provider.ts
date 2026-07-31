import type {
  GetOddsParams,
  GetOddsResult,
  OddsBookmaker,
  OddsData,
  OddsOutcome,
  OddsUsageMeta,
} from "./types";
import {
  computeBestH2hOddsWithFormat,
  type ComputeBestH2hOddsOptions,
} from "./compute-best-h2h-odds";
import { classifyH2hOutcome } from "./odds-provider-classify";
import type { OddsPriceFormat } from "./normalize-odds-price";

export type OddsProvider = import("./types").OddsProvider;
export type OddsProviderKind = import("./types").OddsProviderKind;

export { classifyH2hOutcome };

/**
 * 소수 배당 → 단순 내재 확률.
 *
 * implied = 1 / decimalOdds
 *
 * 주의: 북메이커 마진(overround) 제거 전 시장 확률이다.
 * EDGE Edge 계산에 쓰기 전에 정규화(마진 제거)가 필요할 수 있다.
 */
export function impliedProbabilityFromDecimal(
  decimalOdds: number | null | undefined,
): number | null {
  if (decimalOdds == null || !(decimalOdds > 1)) return null;
  return 1 / decimalOdds;
}

/**
 * 여러 북메이커 h2h 시장에서 홈/무/원정 최고 배당을 고른다.
 * Internal standard: DECIMAL. Pass sourceFormat when provider used american.
 */
export function computeBestH2hOdds(
  bookmakers: OddsBookmaker[],
  homeTeam: string,
  awayTeam: string,
  options: ComputeBestH2hOddsOptions = {},
): {
  bestHomeOdds: number | null;
  bestDrawOdds: number | null;
  bestAwayOdds: number | null;
} {
  const r = computeBestH2hOddsWithFormat(
    bookmakers,
    homeTeam,
    awayTeam,
    options,
  );
  return {
    bestHomeOdds: r.bestHomeOdds,
    bestDrawOdds: r.bestDrawOdds,
    bestAwayOdds: r.bestAwayOdds,
  };
}

export function buildOddsData(input: {
  externalEventId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: OddsBookmaker[];
  lastUpdated: string;
  source: OddsData["source"];
  /** Declared provider odds format (request). Default decimal. */
  sourceFormat?: OddsPriceFormat;
}): OddsData {
  const best = computeBestH2hOddsWithFormat(
    input.bookmakers,
    input.homeTeam,
    input.awayTeam,
    { sourceFormat: input.sourceFormat ?? "decimal" },
  );

  const formatOk =
    best.formatValidationStatus === "FORMAT_CONFIRMED_DECIMAL" ||
    best.formatValidationStatus === "FORMAT_CONVERTED_FROM_AMERICAN";

  return {
    externalEventId: input.externalEventId,
    sportKey: input.sportKey,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    commenceTime: input.commenceTime,
    bookmakers: input.bookmakers,
    bestHomeOdds: formatOk ? best.bestHomeOdds : null,
    bestDrawOdds: formatOk ? best.bestDrawOdds : null,
    bestAwayOdds: formatOk ? best.bestAwayOdds : null,
    impliedHomeProbability: formatOk
      ? impliedProbabilityFromDecimal(best.bestHomeOdds)
      : null,
    impliedDrawProbability: formatOk
      ? impliedProbabilityFromDecimal(best.bestDrawOdds)
      : null,
    impliedAwayProbability: formatOk
      ? impliedProbabilityFromDecimal(best.bestAwayOdds)
      : null,
    lastUpdated: input.lastUpdated,
    source: input.source,
    oddsFormatDeclared: best.declaredFormat,
    oddsFormatEffective: best.effectiveFormat,
    formatValidationStatus: best.formatValidationStatus,
    formatPartialReasons: best.partialReasons,
    formatWarnings: best.warnings,
  };
}

export function emptyUsage(): OddsUsageMeta {
  return {
    requestsRemaining: null,
    requestsUsed: null,
    requestsLast: null,
  };
}

export function parseUsageHeaders(headers: Headers): OddsUsageMeta {
  const num = (name: string): number | null => {
    const raw = headers.get(name);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return {
    requestsRemaining: num("x-requests-remaining"),
    requestsUsed: num("x-requests-used"),
    requestsLast: num("x-requests-last"),
  };
}

/** 캐시 키 — API 키 미포함 */
export function oddsCacheKey(params: GetOddsParams): string {
  const markets = params.markets ?? "h2h";
  const regions = params.regions ?? "eu";
  return [
    params.sportKey,
    markets,
    regions,
    params.commenceTimeFrom ?? "",
    params.commenceTimeTo ?? "",
  ].join("|");
}

export type { GetOddsParams, GetOddsResult, OddsData, OddsOutcome };
