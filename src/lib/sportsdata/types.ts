/**
 * SportsDataIO MLB 연결 계층 타입.
 * Engine / UI / Odds 와 분리. 이번 단계는 연결만.
 */

export type SportsDataProviderKind = "sportsdataio";

export type ProviderUnavailable = {
  kind: "unavailable";
  reason: "missing-api-key";
};

export type SportsDataRateLimitMeta = {
  remaining: string | null;
  limit: string | null;
  reset: string | null;
  raw: Record<string, string>;
};

export type SportsDataRequestMeta = {
  path: string;
  httpStatus: number;
  elapsedMs: number;
  rateLimit: SportsDataRateLimitMeta;
  cached: boolean;
};

export type SportsDataMlbGame = {
  gameId: string;
  season: number | null;
  status: string | null;
  dateTime: string | null;
  dateTimeUtc: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homePitcherId: number | null;
  awayPitcherId: number | null;
  homePitcherName: string | null;
  awayPitcherName: string | null;
  raw: Record<string, unknown>;
};

export type SportsDataStartingPitchers = {
  gameId: string;
  home: { playerId: number | null; name: string | null };
  away: { playerId: number | null; name: string | null };
  supported: boolean;
};

export type SportsDataLineupPlayer = {
  playerId: number | null;
  name: string | null;
  position: string | null;
  battingOrder: number | null;
  confirmed: boolean | null;
};

export type SportsDataLineup = {
  gameId: string;
  teamId: number | null;
  team: string | null;
  lineupType: "projected" | "confirmed" | "unknown";
  players: SportsDataLineupPlayer[];
  raw: Record<string, unknown>;
};

export type SportsDataInjury = {
  playerId: number | null;
  name: string | null;
  teamId: number | null;
  team: string | null;
  status: string | null;
  bodyPart: string | null;
  startDate: string | null;
  raw: Record<string, unknown>;
};

/**
 * SportsDataIO MLB Provider 인터페이스.
 * 키 미설정 시 getSportsDataProvider() 는 이 대신 ProviderUnavailable 을 반환한다.
 */
export interface SportsDataProvider {
  readonly kind: SportsDataProviderKind;

  getCurrentMlbSeason(): Promise<number>;

  /** date: YYYY-MM-DD (KST/로컬 캘린더 날짜 문자열) */
  getGames(date: string): Promise<SportsDataMlbGame[]>;

  getStartingPitchers(gameId: string): Promise<SportsDataStartingPitchers | null>;

  getProjectedLineup(gameId: string): Promise<SportsDataLineup[]>;

  getConfirmedLineup(gameId: string): Promise<SportsDataLineup[]>;

  getInjuries(teamId: number): Promise<SportsDataInjury[]>;
}

export function isProviderUnavailable(
  value: SportsDataProvider | ProviderUnavailable,
): value is ProviderUnavailable {
  return value.kind === "unavailable";
}
