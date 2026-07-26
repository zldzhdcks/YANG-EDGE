import { TEAM_ALIASES } from "./team-aliases";
import { normalizeTeamName } from "./normalize-team-name";
import type { GetTeamDisplayNameInput, TeamAliasEntry } from "./types";

function idKey(provider: string, id: string | number): string {
  return `${provider.trim().toLowerCase()}:${String(id).trim()}`;
}

const BY_EXTERNAL_ID = new Map<string, TeamAliasEntry>();
const BY_ORIGINAL_NAME = new Map<string, TeamAliasEntry[]>();

for (const entry of TEAM_ALIASES) {
  for (const ext of entry.externalIds ?? []) {
    BY_EXTERNAL_ID.set(idKey(ext.provider, ext.id), entry);
  }
  for (const name of entry.originalNames) {
    const key = normalizeTeamName(name);
    if (!key) continue;
    const list = BY_ORIGINAL_NAME.get(key);
    if (list) {
      if (!list.includes(entry)) list.push(entry);
    } else {
      BY_ORIGINAL_NAME.set(key, [entry]);
    }
  }
}

function matchesContext(
  entry: TeamAliasEntry,
  input: GetTeamDisplayNameInput,
): boolean {
  if (input.sport && entry.sport && entry.sport !== input.sport) return false;
  if (
    input.league &&
    entry.league &&
    entry.league.toLowerCase() !== String(input.league).toLowerCase()
  ) {
    return false;
  }
  return true;
}

function pickByName(
  candidates: TeamAliasEntry[],
  input: GetTeamDisplayNameInput,
): TeamAliasEntry | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const contextual = candidates.filter((entry) => matchesContext(entry, input));
  if (contextual.length === 1) return contextual[0];
  if (contextual.length > 1) {
    // 리그까지 지정됐으면 그 순서 유지, 아니면 종목만 맞는 첫 항목
    return contextual[0];
  }

  // 문맥이 없거나 후보를 좁히지 못하면 잘못된 교차 매핑을 피하기 위해
  // 종목/리그가 지정된 경우에는 fallback 하지 않는다.
  if (input.sport || input.league) return null;
  return candidates[0];
}

/**
 * UI 표시용 팀명.
 *
 * 우선순위:
 * 1. provider + externalTeamId
 * 2. originalName 별칭 (정규화 일치, sport/league 문맥으로 충돌 해소)
 * 3. 매핑 없으면 원문 그대로
 *
 * Provider·Odds·gameId 경로에서는 호출하지 않는다.
 */
export function getTeamDisplayName(
  input: GetTeamDisplayNameInput | string,
): string {
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

  const byName = pickByName(
    BY_ORIGINAL_NAME.get(normalizeTeamName(original)) ?? [],
    input,
  );
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
    sport?: GetTeamDisplayNameInput["sport"];
    league?: GetTeamDisplayNameInput["league"];
  },
): string {
  const home = getTeamDisplayName({
    originalName: homeTeam,
    provider: options?.homeProvider,
    externalTeamId: options?.homeExternalTeamId,
    sport: options?.sport,
    league: options?.league,
  });
  const away = getTeamDisplayName({
    originalName: awayTeam,
    provider: options?.awayProvider,
    externalTeamId: options?.awayExternalTeamId,
    sport: options?.sport,
    league: options?.league,
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
