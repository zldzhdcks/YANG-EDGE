/**
 * Resolve NPB team names via TEAM_ALIASES (display/canonical only).
 */
import { TEAM_ALIASES } from "@/lib/teams/team-aliases";
import { normalizeTeamName } from "@/lib/teams/normalize-team-name";

export type NpbTeamIdentity = {
  providerName: string;
  canonicalNameKo: string | null;
  canonicalNameEn: string | null;
  canonicalTeamId: string | null;
  mappingStatus: "MATCHED" | "UNMATCHED";
};

function slugifyTeamId(displayName: string): string {
  return `npb-${displayName
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

export function resolveNpbTeamIdentity(providerName: string): NpbTeamIdentity {
  const normalized = normalizeTeamName(providerName);
  const candidates = TEAM_ALIASES.filter(
    (a) => a.league === "NPB" && a.sport === "baseball",
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
