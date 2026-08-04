/**
 * Football Team Registry v0 — Provider ID based.
 * Same displayName MUST NOT auto-merge distinct providerTeamIds.
 */
import type { FootballProviderId, FootballTeam } from "./types";

/**
 * Minimal seed for Foundation gate tests / wiring.
 * Production expansion is a separate data mission — no provider calls here.
 */
export const FOOTBALL_TEAM_REGISTRY_V0: FootballTeam[] = [
  {
    provider: "api-football",
    providerTeamId: "33",
    officialName: "Manchester United",
    displayName: "맨체스터 유나이티드",
    country: "England",
    aliases: ["Man United", "Man Utd"],
    active: true,
  },
  {
    provider: "api-football",
    providerTeamId: "40",
    officialName: "Liverpool",
    displayName: "리버풀",
    country: "England",
    aliases: [],
    active: true,
  },
  {
    provider: "api-football",
    providerTeamId: "50",
    officialName: "Manchester City",
    displayName: "맨체스터 시티",
    country: "England",
    aliases: ["Man City"],
    active: true,
  },
  {
    provider: "api-football",
    providerTeamId: "42",
    officialName: "Arsenal",
    displayName: "아스널",
    country: "England",
    aliases: [],
    active: true,
  },
  {
    provider: "api-football",
    providerTeamId: "276",
    officialName: "Jeonbuk Motors",
    displayName: "전북 현대",
    country: "South-Korea",
    aliases: ["Jeonbuk"],
    active: true,
  },
  {
    provider: "api-football",
    providerTeamId: "275",
    officialName: "Ulsan HD",
    displayName: "울산 HD",
    country: "South-Korea",
    aliases: ["Ulsan"],
    active: true,
  },
];

export function listTeams(): FootballTeam[] {
  return FOOTBALL_TEAM_REGISTRY_V0.slice();
}

export function getTeamByProviderId(
  provider: FootballProviderId | string,
  providerTeamId: string,
): FootballTeam | null {
  return (
    FOOTBALL_TEAM_REGISTRY_V0.find(
      (t) =>
        t.provider === provider &&
        t.providerTeamId === String(providerTeamId) &&
        t.active,
    ) ?? null
  );
}

export function isTeamRegistered(
  provider: FootballProviderId | string,
  providerTeamId: string,
): boolean {
  return getTeamByProviderId(provider, providerTeamId) != null;
}

/**
 * Lookup by display/alias is advisory only — never identity SoT.
 * Returns ALL matches; never auto-merges.
 */
export function findTeamsByDisplayName(name: string): FootballTeam[] {
  const n = name.trim().toLowerCase();
  if (!n) return [];
  return FOOTBALL_TEAM_REGISTRY_V0.filter((t) => {
    if (t.displayName.toLowerCase() === n) return true;
    if (t.officialName.toLowerCase() === n) return true;
    return t.aliases.some((a) => a.toLowerCase() === n);
  });
}
