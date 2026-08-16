/**
 * Football canonical team catalog v1.
 *
 * v1 policy: canonicalTeamId is PROVIDER_SEEDED_V1
 * (`fb-team-v1-api-football-{providerTeamId}`).
 * That is a YANG EDGE identity key, but it is not provider-independent.
 * Do not auto-create name slugs (fb-team-arsenal). Migration later:
 * introduce independent IDs and keep providers.apiFootball.teamId as mapping.
 *
 * K League Jeonbuk / Ulsan: two repo sources disagree. Do NOT guess.
 * Those provider IDs are blocked (IDENTITY_REVIEW_REQUIRED).
 */
import type {
  FootballIdentityScope,
  FootballProviderId,
  FootballTeamIdentityStatus,
} from "./types";
import {
  FOOTBALL_IDENTITY_SCOPE_V1,
  FOOTBALL_SLATE_2026_08_12_TEAMS,
  FOOTBALL_SLATE_2026_08_14_TEAMS,
  FOOTBALL_SLATE_2026_08_17_TEAMS,
  SLATE_SRC_2026_08_12,
  SLATE_SRC_2026_08_14,
  SLATE_SRC_2026_08_17,
} from "./team-catalog-slate-2026-08";

export { FOOTBALL_IDENTITY_SCOPE_V1 } from "./team-catalog-slate-2026-08";

export type FootballTeamCatalogEntry = {
  canonicalTeamId: string;
  canonicalName: string;
  country: string;
  active: true;
  identityScope: FootballIdentityScope;
  identityStatus: "MATCHED";
  provider: FootballProviderId;
  providerTeamId: string;
  providers: { apiFootball: { teamId: string } };
  aliases: string[];
  source: string;
};

export type FootballTeamConflict = {
  canonicalName: string;
  country: string;
  identityStatus: "IDENTITY_REVIEW_REQUIRED";
  provider: FootballProviderId;
  conflictingProviderTeamIds: string[];
  sources: { path: string; providerTeamId: string }[];
};

function matched(
  providerTeamId: string,
  canonicalName: string,
  country: string,
  aliases: string[],
  source: string,
): FootballTeamCatalogEntry {
  return {
    canonicalTeamId: `fb-team-v1-api-football-${providerTeamId}`,
    canonicalName,
    country,
    active: true,
    identityScope: FOOTBALL_IDENTITY_SCOPE_V1,
    identityStatus: "MATCHED",
    provider: "api-football",
    providerTeamId,
    providers: { apiFootball: { teamId: providerTeamId } },
    aliases,
    source,
  };
}

const ALIAS = "src/lib/teams/team-aliases.ts";
const FOUNDATION = "src/lib/football/foundation/team-registry.ts";
const MLS_FIXTURE_NOTE =
  "src/lib/teams/team-aliases.ts (comment: 2026-07-26 API-Football fixtures)";

export const FOOTBALL_TEAM_CONFLICTS_V1: FootballTeamConflict[] = [
  {
    canonicalName: "Jeonbuk Motors",
    country: "South-Korea",
    identityStatus: "IDENTITY_REVIEW_REQUIRED",
    provider: "api-football",
    conflictingProviderTeamIds: ["276", "2769"],
    sources: [
      { path: FOUNDATION, providerTeamId: "276" },
      { path: ALIAS, providerTeamId: "2769" },
    ],
  },
  {
    canonicalName: "Ulsan HD",
    country: "South-Korea",
    identityStatus: "IDENTITY_REVIEW_REQUIRED",
    provider: "api-football",
    conflictingProviderTeamIds: ["275", "2764"],
    sources: [
      { path: FOUNDATION, providerTeamId: "275" },
      { path: ALIAS, providerTeamId: "2764" },
    ],
  },
];

/** Provider IDs that must never become MATCHED until the conflict is resolved. */
export const FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS = new Set(
  FOOTBALL_TEAM_CONFLICTS_V1.flatMap((c) => c.conflictingProviderTeamIds),
);

export const FOOTBALL_TEAM_CATALOG_V1: FootballTeamCatalogEntry[] = [
  matched("33", "Manchester United", "England", ["Man United", "Man Utd"], FOUNDATION),
  matched("40", "Liverpool", "England", ["Liverpool FC"], `${ALIAS}; ${FOUNDATION}`),
  matched("50", "Manchester City", "England", ["Man City"], `${ALIAS}; ${FOUNDATION}`),
  matched("42", "Arsenal", "England", ["Arsenal FC"], `${ALIAS}; ${FOUNDATION}`),
  matched("541", "Real Madrid", "Spain", ["Real Madrid CF"], ALIAS),
  matched("529", "Barcelona", "Spain", ["FC Barcelona"], ALIAS),
  matched("157", "Bayern Munich", "Germany", ["FC Bayern München", "Bayern München"], ALIAS),

  matched("2766", "FC Seoul", "South-Korea", ["Seoul", "서울", "FC서울"], ALIAS),
  matched("2763", "Pohang Steelers", "South-Korea", ["Pohang", "포항"], ALIAS),
  matched("2760", "Gangwon FC", "South-Korea", ["Gangwon", "강원"], ALIAS),
  matched("2762", "Jeju United", "South-Korea", ["Jeju", "제주"], ALIAS),
  matched("2758", "Daegu FC", "South-Korea", ["Daegu", "대구"], ALIAS),
  matched("2761", "Incheon United", "South-Korea", ["Incheon", "인천"], ALIAS),
  matched("2765", "Gwangju FC", "South-Korea", ["Gwangju", "광주"], ALIAS),
  matched("2759", "Daejeon Hana Citizen", "South-Korea", ["Daejeon", "대전"], ALIAS),
  matched("2789", "Suwon FC", "South-Korea", ["Suwon City", "수원FC"], ALIAS),
  matched("7002", "Gimcheon Sangmu", "South-Korea", ["Sangju Sangmu", "김천"], ALIAS),

  matched("1608", "Atlanta United", "USA", ["Atlanta United FC"], MLS_FIXTURE_NOTE),
  matched("16489", "Austin FC", "USA", ["Austin"], MLS_FIXTURE_NOTE),
  matched("1614", "CF Montreal", "Canada", ["CF Montréal", "Montreal Impact"], MLS_FIXTURE_NOTE),
  matched("18310", "Charlotte FC", "USA", ["Charlotte"], MLS_FIXTURE_NOTE),
  matched("1607", "Chicago Fire", "USA", ["Chicago Fire FC"], MLS_FIXTURE_NOTE),
  matched("1610", "Colorado Rapids", "USA", [], MLS_FIXTURE_NOTE),
  matched("1613", "Columbus Crew", "USA", ["Columbus Crew SC"], MLS_FIXTURE_NOTE),
  matched("1615", "DC United", "USA", ["D.C. United"], MLS_FIXTURE_NOTE),
  matched("2242", "FC Cincinnati", "USA", [], MLS_FIXTURE_NOTE),
  matched("1597", "FC Dallas", "USA", [], MLS_FIXTURE_NOTE),
  matched("1600", "Houston Dynamo", "USA", ["Houston Dynamo FC"], MLS_FIXTURE_NOTE),
  matched("9568", "Inter Miami", "USA", ["Inter Miami CF"], MLS_FIXTURE_NOTE),
  matched("1616", "Los Angeles FC", "USA", ["LAFC"], MLS_FIXTURE_NOTE),
  matched("1605", "LA Galaxy", "USA", ["Los Angeles Galaxy"], MLS_FIXTURE_NOTE),
  matched("1612", "Minnesota United", "USA", ["Minnesota United FC"], MLS_FIXTURE_NOTE),
  matched("9569", "Nashville SC", "USA", ["Nashville"], MLS_FIXTURE_NOTE),
  matched("1609", "New England Revolution", "USA", [], MLS_FIXTURE_NOTE),
  matched("1604", "New York City FC", "USA", ["NYCFC"], MLS_FIXTURE_NOTE),
  matched("1602", "New York Red Bulls", "USA", [], MLS_FIXTURE_NOTE),
  matched("1598", "Orlando City", "USA", ["Orlando City SC"], MLS_FIXTURE_NOTE),
  matched("1599", "Philadelphia Union", "USA", [], MLS_FIXTURE_NOTE),
  matched("1617", "Portland Timbers", "USA", [], MLS_FIXTURE_NOTE),
  matched("1606", "Real Salt Lake", "USA", [], MLS_FIXTURE_NOTE),
  matched("25484", "San Diego FC", "USA", ["San Diego"], MLS_FIXTURE_NOTE),
  matched("1596", "San Jose Earthquakes", "USA", ["San José Earthquakes"], MLS_FIXTURE_NOTE),
  matched("1595", "Seattle Sounders", "USA", ["Seattle Sounders FC"], MLS_FIXTURE_NOTE),
  matched("1611", "Sporting Kansas City", "USA", ["Sporting KC"], MLS_FIXTURE_NOTE),
  matched("20787", "St. Louis City SC", "USA", ["St. Louis City"], MLS_FIXTURE_NOTE),
  matched("1601", "Toronto FC", "Canada", [], MLS_FIXTURE_NOTE),
  matched("1603", "Vancouver Whitecaps", "Canada", ["Vancouver Whitecaps FC"], MLS_FIXTURE_NOTE),

  ...FOOTBALL_SLATE_2026_08_12_TEAMS.map(([id, name]) =>
    matched(id, name, "UNKNOWN", [name], SLATE_SRC_2026_08_12),
  ),
  ...FOOTBALL_SLATE_2026_08_14_TEAMS.map(([id, name]) =>
    matched(id, name, "UNKNOWN", [name], SLATE_SRC_2026_08_14),
  ),
  ...FOOTBALL_SLATE_2026_08_17_TEAMS.map(([id, name]) =>
    matched(id, name, "UNKNOWN", [name], SLATE_SRC_2026_08_17),
  ),
];

export type FootballTeamResolveResult = {
  status: FootballTeamIdentityStatus;
  canonicalTeamId: string | null;
  reasons: string[];
};

export function assertTeamCatalogIntegrity(
  entries: FootballTeamCatalogEntry[],
  blockedIds: Set<string> = FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
): void {
  const byCanonical = new Map<string, string>();
  const byProvider = new Map<string, string>();
  for (const row of entries) {
    if (row.identityScope !== FOOTBALL_IDENTITY_SCOPE_V1) {
      throw new Error(`IDENTITY_SCOPE_INVALID: ${row.canonicalTeamId}`);
    }
    if (row.providers.apiFootball.teamId !== row.providerTeamId) {
      throw new Error(
        `PROVIDER_NAMESPACE_MISMATCH: ${row.canonicalTeamId} apiFootball.teamId≠providerTeamId`,
      );
    }
    if (blockedIds.has(row.providerTeamId)) {
      throw new Error(
        `PROVIDER_TEAM_ID_COLLISION: MATCHED catalog contains blocked id ${row.providerTeamId}`,
      );
    }
    const prevC = byCanonical.get(row.canonicalTeamId);
    if (prevC && prevC !== row.providerTeamId) {
      throw new Error(
        `CANONICAL_TEAM_PROVIDER_CONFLICT: ${row.canonicalTeamId} → ${prevC} vs ${row.providerTeamId}`,
      );
    }
    byCanonical.set(row.canonicalTeamId, row.providerTeamId);
    const pKey = `${row.provider}:${row.providerTeamId}`;
    const prevP = byProvider.get(pKey);
    if (prevP && prevP !== row.canonicalTeamId) {
      throw new Error(
        `PROVIDER_TEAM_ID_COLLISION: ${pKey} → ${prevP} vs ${row.canonicalTeamId}`,
      );
    }
    byProvider.set(pKey, row.canonicalTeamId);
  }
}

assertTeamCatalogIntegrity(FOOTBALL_TEAM_CATALOG_V1);

const BY_PROVIDER_TEAM = new Map(
  FOOTBALL_TEAM_CATALOG_V1.map((t) => [
    `${t.provider}:${t.providerTeamId}`,
    t,
  ]),
);

export function getMatchedTeam(
  provider: string,
  providerTeamId: string,
): FootballTeamCatalogEntry | null {
  return BY_PROVIDER_TEAM.get(`${provider}:${providerTeamId}`) ?? null;
}

export function resolveProviderTeam(
  provider: string,
  providerTeamId: string,
): FootballTeamResolveResult {
  const id = String(providerTeamId);
  if (!id) {
    return {
      status: "IDENTITY_REVIEW_REQUIRED",
      canonicalTeamId: null,
      reasons: ["PROVIDER_TEAM_ID_MISSING"],
    };
  }
  if (FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(id)) {
    return {
      status: "IDENTITY_REVIEW_REQUIRED",
      canonicalTeamId: null,
      reasons: ["K_LEAGUE_PROVIDER_ID_CONFLICT", `BLOCKED_PROVIDER_TEAM_ID:${id}`],
    };
  }
  const hit = getMatchedTeam(provider, id);
  if (!hit) {
    return {
      status: "IDENTITY_REVIEW_REQUIRED",
      canonicalTeamId: null,
      reasons: ["UNKNOWN_PROVIDER_TEAM_ID", `PROVIDER_TEAM_ID:${id}`],
    };
  }
  return {
    status: "MATCHED",
    canonicalTeamId: hit.canonicalTeamId,
    reasons: [],
  };
}
