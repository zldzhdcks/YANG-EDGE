import { TEAM_ALIASES } from "./team-aliases";
import { normalizeTeamName } from "./normalize-team-name";
import type { GetTeamDisplayNameInput, TeamAliasEntry } from "./types";

function idKey(provider: string, id: string | number): string {
  return `${provider.trim().toLowerCase()}:${String(id).trim()}`;
}

const BY_EXTERNAL_ID = new Map<string, TeamAliasEntry>();
const BY_ORIGINAL_NAME = new Map<string, TeamAliasEntry>();

for (const entry of TEAM_ALIASES) {
  for (const ext of entry.externalIds ?? []) {
    BY_EXTERNAL_ID.set(idKey(ext.provider, ext.id), entry);
  }
  for (const name of entry.originalNames) {
    const key = normalizeTeamName(name);
    if (!key) continue;
    // 첫 등록 우선 (KBO/NPB/K리그1이 배열 앞쪽)
    if (!BY_ORIGINAL_NAME.has(key)) {
      BY_ORIGINAL_NAME.set(key, entry);
    }
  }
}

/**
 * UI 표시용 팀명.
 *
 * 우선순위:
 * 1. provider + externalTeamId
 * 2. originalName 별칭 (정규화 일치)
 * 3. 매핑 없으면 원문 그대로
 *
 * Provider·Odds·gameId 경로에서는 호출하지 않는다.
 */
export function getTeamDisplayName(input: GetTeamDisplayNameInput | string): string {
  if (typeof input === "string") {
    return resolveDisplayName({ originalName: input });
  }
  return resolveDisplayName(input);
}

function resolveDisplayName(input: GetTeamDisplayNameInput): string {
  const original = input.originalName?.trim() ?? "";
  if (!original) return original;

  if (
    input.provider &&
    input.externalTeamId != null &&
    String(input.externalTeamId).trim() !== ""
  ) {
    const byId = BY_EXTERNAL_ID.get(
      idKey(String(input.provider), input.externalTeamId),
    );
    if (byId) return byId.displayName;
  }

  const byName = BY_ORIGINAL_NAME.get(normalizeTeamName(original));
  if (byName) return byName.displayName;

  return original;
}

/** 홈 vs 원정 매치 라벨 (표시용) */
export function getMatchDisplayLabel(
  homeTeam: string,
  awayTeam: string,
  options?: {
    homeProvider?: GetTeamDisplayNameInput["provider"];
    awayProvider?: GetTeamDisplayNameInput["provider"];
    homeExternalTeamId?: string | number | null;
    awayExternalTeamId?: string | number | null;
  },
): string {
  const home = getTeamDisplayName({
    originalName: homeTeam,
    provider: options?.homeProvider,
    externalTeamId: options?.homeExternalTeamId,
  });
  const away = getTeamDisplayName({
    originalName: awayTeam,
    provider: options?.awayProvider,
    externalTeamId: options?.awayExternalTeamId,
  });
  return `${home} vs ${away}`;
}

/** @deprecated 호환용 — getTeamDisplayName 사용 */
export function getDisplayTeamName(name: string): string {
  return getTeamDisplayName(name);
}

/** @deprecated 호환용 — getMatchDisplayLabel 사용 */
export function getDisplayMatchLabel(
  homeTeam: string,
  awayTeam: string,
): string {
  return getMatchDisplayLabel(homeTeam, awayTeam);
}
