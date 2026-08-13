/**
 * YANG EDGE — Odds Provider 타입
 *
 * SportsProvider / EDGE Engine 과 분리된 배당 데이터 계층.
 * UI는 아직 소비하지 않으며, /api/odds 와 매칭 유틸만 준비한다.
 */

export type OddsProviderKind = "dummy" | "the-odds-api";

export type OddsSource = "dummy" | "the-odds-api";

export type GetOddsParams = {
  sportKey: string;
  commenceTimeFrom?: string;
  commenceTimeTo?: string;
  /** 기본: h2h */
  markets?: string;
  /** 기본: eu */
  regions?: string;
};

export type OddsOutcome = {
  name: string;
  price: number;
  /** Spreads / totals point when provided by Odds API. */
  point?: number | null;
};

export type OddsMarket = {
  key: string;
  lastUpdate: string;
  outcomes: OddsOutcome[];
};

export type OddsBookmaker = {
  key: string;
  title: string;
  lastUpdate: string;
  markets: OddsMarket[];
};

/**
 * 정규화된 배당 이벤트.
 * best* / implied* 는 h2h 시장 기준.
 */
export type OddsData = {
  externalEventId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: OddsBookmaker[];
  /** 여러 북메이커 중 홈 최고 소수 배당 (없으면 null) */
  bestHomeOdds: number | null;
  bestDrawOdds: number | null;
  bestAwayOdds: number | null;
  /**
   * 단순 내재 확률 = 1 / decimal odds.
   * 북메이커 마진(overround) 제거 전 시장 확률이다.
   */
  impliedHomeProbability: number | null;
  impliedDrawProbability: number | null;
  impliedAwayProbability: number | null;
  lastUpdated: string;
  source: OddsSource;
  /** Additive: declared provider format for this payload. */
  oddsFormatDeclared?: import("./normalize-odds-price").OddsPriceFormat;
  oddsFormatEffective?: import("./normalize-odds-price").OddsPriceFormat;
  formatValidationStatus?: import("./normalize-odds-price").OddsFormatValidationStatus;
  formatPartialReasons?: string[];
  formatWarnings?: string[];
};

/** The Odds API 사용량 헤더 메타 (키 값 포함 금지) */
export type OddsUsageMeta = {
  requestsRemaining: number | null;
  requestsUsed: number | null;
  requestsLast: number | null;
};

export type OddsSportInfo = {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  hasOutrights: boolean;
};

export type GetOddsResult = {
  events: OddsData[];
  usage: OddsUsageMeta;
  sportKey: string;
  cached: boolean;
  fetchedAt: string;
};

/** /sports/{sport}/events — odds 없이 event identity만. The Odds API 쿼터 미차감. */
export type OddsEventListing = {
  externalEventId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
};

export interface OddsProvider {
  readonly kind: OddsProviderKind;

  getOdds(params: GetOddsParams): Promise<GetOddsResult>;

  /** /sports 목록 — The Odds API는 쿼터 미차감. Dummy는 고정 목록. */
  listSports?(): Promise<{ sports: OddsSportInfo[]; usage: OddsUsageMeta }>;

  /** /sports/{sport}/events — 쿼터 미차감. Dummy는 빈 목록. */
  listEvents?(sportKey: string): Promise<{
    events: OddsEventListing[];
    usage: OddsUsageMeta;
  }>;
}
