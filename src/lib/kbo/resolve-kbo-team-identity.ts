/**
 * KBO team identity resolution from provider names via TEAM_ALIASES.
 * Display/canonical only — does not mutate provider names.
 */
import { TEAM_ALIASES } from "../teams/team-aliases";
import { normalizeTeamName } from "../teams/normalize-team-name";
import type { KboTeamIdentity } from "./schedule-result-identity-types";

function slugifyTeamId(displayName: string): string {
  return `kbo-${displayName
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")}`;
}

function pickEnglishName(originalNames: string[], providerName: string): string {
  const english = originalNames.find((n) => /[A-Za-z]/.test(n));
  return english ?? providerName;
}

export function resolveKboTeamIdentity(providerName: string): KboTeamIdentity {
  const normalized = normalizeTeamName(providerName);
  const candidates = TEAM_ALIASES.filter(
    (a) => a.league === "KBO" && a.sport === "baseball",
  );

  for (const entry of candidates) {
    const matched = entry.originalNames.some(
      (name) => normalizeTeamName(name) === normalized,
    );
    if (!matched) continue;

    return {
      providerName,
      canonicalNameKo: entry.displayName,
      canonicalNameEn: pickEnglishName(entry.originalNames, providerName),
      canonicalTeamId: slugifyTeamId(entry.displayName),
      mappingStatus: "MATCHED",
    };
  }

  return {
    providerName,
    canonicalNameKo: null,
    canonicalNameEn: null,
    canonicalTeamId: null,
    mappingStatus: "UNMATCHED",
  };
}
