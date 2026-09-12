import type {OwnerOnlyMarketRow} from "./contract-v1";

export type SealedIdentity = {
  fixtureId: number;
  leagueId: number;
  season: number;
  kickoffUtc: string;
  homeTeamId: number;
  awayTeamId: number;
};

export function sameFixtureIdentity(a: SealedIdentity, b: SealedIdentity): boolean {
  return (
    a.fixtureId === b.fixtureId &&
    a.leagueId === b.leagueId &&
    a.season === b.season &&
    a.kickoffUtc === b.kickoffUtc &&
    a.homeTeamId === b.homeTeamId &&
    a.awayTeamId === b.awayTeamId
  );
}

export function classifyMarketJoin(
  sealed: SealedIdentity,
  rows: OwnerOnlyMarketRow[],
): "MATCHED" | "MARKET_ABSENT" | "MARKET_IDENTITY_UNCERTAIN" {
  const byId = rows.filter((row) => row.fixtureId === sealed.fixtureId);
  if (byId.length === 0) return "MARKET_ABSENT";
  const ones = byId.filter((row) => row.marketType === "1X2");
  if (ones.length !== 1) return "MARKET_IDENTITY_UNCERTAIN";
  if (!sameFixtureIdentity(sealed, ones[0])) return "MARKET_IDENTITY_UNCERTAIN";
  return "MATCHED";
}
