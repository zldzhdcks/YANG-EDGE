import type {
  GetOddsParams,
  GetOddsResult,
  OddsBookmaker,
  OddsData,
  OddsOutcome,
  OddsUsageMeta,
} from "./types";

export type OddsProvider = import("./types").OddsProvider;
export type OddsProviderKind = import("./types").OddsProviderKind;

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

/** h2h outcome 이름 정규화 → home | away | draw | unknown */
export function classifyH2hOutcome(
  outcomeName: string,
  homeTeam: string,
  awayTeam: string,
): "home" | "away" | "draw" | "unknown" {
  const n = outcomeName.trim().toLowerCase();
  if (n === "draw" || n === "tie" || n === "x") return "draw";
  const home = homeTeam.trim().toLowerCase();
  const away = awayTeam.trim().toLowerCase();
  if (n === home) return "home";
  if (n === away) return "away";
  return "unknown";
}

/**
 * 여러 북메이커 h2h 시장에서 홈/무/원정 최고 배당을 고른다.
 * (최고 배당 = 베터에게 유리한 큰 소수 배당)
 */
export function computeBestH2hOdds(
  bookmakers: OddsBookmaker[],
  homeTeam: string,
  awayTeam: string,
): {
  bestHomeOdds: number | null;
  bestDrawOdds: number | null;
  bestAwayOdds: number | null;
} {
  let bestHomeOdds: number | null = null;
  let bestDrawOdds: number | null = null;
  let bestAwayOdds: number | null = null;

  for (const bm of bookmakers) {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;

    for (const outcome of h2h.outcomes) {
      const side = classifyH2hOutcome(outcome.name, homeTeam, awayTeam);
      if (side === "unknown" || !(outcome.price > 1)) continue;

      if (side === "home") {
        bestHomeOdds =
          bestHomeOdds == null
            ? outcome.price
            : Math.max(bestHomeOdds, outcome.price);
      } else if (side === "away") {
        bestAwayOdds =
          bestAwayOdds == null
            ? outcome.price
            : Math.max(bestAwayOdds, outcome.price);
      } else {
        bestDrawOdds =
          bestDrawOdds == null
            ? outcome.price
            : Math.max(bestDrawOdds, outcome.price);
      }
    }
  }

  return { bestHomeOdds, bestDrawOdds, bestAwayOdds };
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
}): OddsData {
  const best = computeBestH2hOdds(
    input.bookmakers,
    input.homeTeam,
    input.awayTeam,
  );

  return {
    externalEventId: input.externalEventId,
    sportKey: input.sportKey,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    commenceTime: input.commenceTime,
    bookmakers: input.bookmakers,
    bestHomeOdds: best.bestHomeOdds,
    bestDrawOdds: best.bestDrawOdds,
    bestAwayOdds: best.bestAwayOdds,
    impliedHomeProbability: impliedProbabilityFromDecimal(best.bestHomeOdds),
    impliedDrawProbability: impliedProbabilityFromDecimal(best.bestDrawOdds),
    impliedAwayProbability: impliedProbabilityFromDecimal(best.bestAwayOdds),
    lastUpdated: input.lastUpdated,
    source: input.source,
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
