/**
 * Football Competition Registry v0 — Research SoT.
 * v1 operator-label aliases are additive exact OWNER labels only.
 * Does NOT promote src/constants/football-leagues.ts (UI filter only).
 */
import type { FootballCompetition } from "./types";

/**
 * Seed competitions for Foundation. Provider IDs align with known API-Football
 * league ids for future mapping, but this registry is the Research SoT —
 * UI whitelist must not be imported as authority.
 */
export const FOOTBALL_COMPETITION_REGISTRY_V0: FootballCompetition[] = [
  {
    competitionId: "fb-comp-api-football-39",
    provider: "api-football",
    providerCompetitionId: "39",
    officialName: "Premier League",
    displayName: "프리미어리그",
    country: "England",
    season: "2025",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["EPL"],
  },
  {
    competitionId: "fb-comp-api-football-140",
    provider: "api-football",
    providerCompetitionId: "140",
    officialName: "La Liga",
    displayName: "라리가",
    country: "Spain",
    season: "2025",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
  },
  {
    competitionId: "fb-comp-api-football-135",
    provider: "api-football",
    providerCompetitionId: "135",
    officialName: "Serie A",
    displayName: "세리에 A",
    country: "Italy",
    season: "2025",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["세리에A"],
  },
  {
    competitionId: "fb-comp-api-football-78",
    provider: "api-football",
    providerCompetitionId: "78",
    officialName: "Bundesliga",
    displayName: "분데스리가",
    country: "Germany",
    season: "2025",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["분데스리"],
  },
  {
    competitionId: "fb-comp-api-football-61",
    provider: "api-football",
    providerCompetitionId: "61",
    officialName: "Ligue 1",
    displayName: "리그 1",
    country: "France",
    season: "2025",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["프리그1"],
  },
  {
    competitionId: "fb-comp-api-football-2",
    provider: "api-football",
    providerCompetitionId: "2",
    officialName: "UEFA Champions League",
    displayName: "UEFA 챔피언스리그",
    country: "Europe",
    season: "2025",
    competitionType: "CONTINENTAL",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["UCL"],
  },
  {
    competitionId: "fb-comp-api-football-3",
    provider: "api-football",
    providerCompetitionId: "3",
    officialName: "UEFA Europa League",
    displayName: "UEFA 유로파리그",
    country: "Europe",
    season: "2025",
    competitionType: "CONTINENTAL",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["UEL"],
  },
  {
    competitionId: "fb-comp-api-football-88",
    provider: "api-football",
    providerCompetitionId: "88",
    officialName: "Eredivisie",
    displayName: "에레디비시에",
    country: "Netherlands",
    season: "2026",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["에레디비"],
  },
  {
    competitionId: "fb-comp-api-football-40",
    provider: "api-football",
    providerCompetitionId: "40",
    officialName: "EFL Championship",
    displayName: "EFL 챔피언십",
    country: "England",
    season: "2026",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
    operatorDisplayAliases: ["EFL챔"],
  },
  {
    competitionId: "fb-comp-api-football-253",
    provider: "api-football",
    providerCompetitionId: "253",
    officialName: "Major League Soccer",
    displayName: "MLS",
    country: "USA",
    season: "2026",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
  },
  {
    competitionId: "fb-comp-api-football-292",
    provider: "api-football",
    providerCompetitionId: "292",
    officialName: "K League 1",
    displayName: "K리그1",
    country: "South-Korea",
    season: "2026",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
  },
  {
    competitionId: "fb-comp-api-football-98",
    provider: "api-football",
    providerCompetitionId: "98",
    officialName: "J1 League",
    displayName: "J1리그",
    country: "Japan",
    season: "2026",
    competitionType: "LEAGUE",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
  },
  {
    competitionId: "fb-comp-api-football-24",
    provider: "api-football",
    providerCompetitionId: "24",
    officialName: "ASEAN Championship",
    displayName: "축ASEA챔",
    country: "World",
    season: "2025",
    competitionType: "INTERNATIONAL",
    status: "RESEARCH_ONLY",
    betmanSupported: false,
    researchSupported: true,
  },
];

function competitionExactLabels(c: FootballCompetition): string[] {
  return [c.officialName, c.displayName, ...(c.operatorDisplayAliases ?? [])];
}

export function listCompetitionLabelCollisions(): Array<{
  label: string;
  competitionIds: string[];
}> {
  const map = new Map<string, string[]>();
  for (const c of FOOTBALL_COMPETITION_REGISTRY_V0) {
    for (const label of competitionExactLabels(c)) {
      const ids = map.get(label) ?? [];
      ids.push(c.competitionId);
      map.set(label, ids);
    }
  }
  return [...map.entries()]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([label, competitionIds]) => ({
      label,
      competitionIds: [...new Set(competitionIds)],
    }));
}

export function listDuplicateProviderCompetitionIds(): Array<{
  provider: string;
  providerCompetitionId: string;
  competitionIds: string[];
}> {
  const map = new Map<string, string[]>();
  for (const c of FOOTBALL_COMPETITION_REGISTRY_V0) {
    const key = `${c.provider}:${c.providerCompetitionId}`;
    const ids = map.get(key) ?? [];
    ids.push(c.competitionId);
    map.set(key, ids);
  }
  return [...map.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, competitionIds]) => {
      const [provider, providerCompetitionId] = key.split(":");
      return { provider, providerCompetitionId, competitionIds };
    });
}

export function listCompetitions(): FootballCompetition[] {
  return FOOTBALL_COMPETITION_REGISTRY_V0.slice();
}

export function getCompetitionById(
  competitionId: string,
): FootballCompetition | null {
  return (
    FOOTBALL_COMPETITION_REGISTRY_V0.find((c) => c.competitionId === competitionId) ??
    null
  );
}

export function getCompetitionByProviderId(
  provider: string,
  providerCompetitionId: string,
): FootballCompetition | null {
  return (
    FOOTBALL_COMPETITION_REGISTRY_V0.find(
      (c) =>
        c.provider === provider &&
        c.providerCompetitionId === String(providerCompetitionId),
    ) ?? null
  );
}

export function findCompetitionByOperatorLabel(
  label: string,
): FootballCompetition | null {
  const n = label.trim();
  if (!n) return null;
  return (
    FOOTBALL_COMPETITION_REGISTRY_V0.find(
      (c) =>
        c.displayName === n ||
        c.officialName === n ||
        (c.operatorDisplayAliases ?? []).includes(n),
    ) ?? null
  );
}

export function isCompetitionRegistered(competitionId: string): boolean {
  const c = getCompetitionById(competitionId);
  return c != null && c.status !== "DISABLED";
}
