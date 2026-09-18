/**
 * MLB event identity contract v1.
 *
 * matchupId  = existing internalGameId (league-home-away slug). Not event-unique.
 * gamePk     = raw MLB Stats API event identifier.
 * eventId    = `mlb-game-${gamePk}`.
 *
 * Do not change buildGameId() / schedule internalGameId semantics.
 */

export const MLB_EVENT_ID_PREFIX = "mlb-game-";

export const MLB_IDENTITY_AMBIGUOUS = "IDENTITY_AMBIGUOUS";
export const MLB_AMBIGUOUS_MATCHUP_ID = "AMBIGUOUS_MATCHUP_ID";

export type MlbScheduleIdentityGame = {
  eventId: string;
  gamePk: number | null;
  matchupId: string;
  commenceTimeUtc?: string | null;
  status?: string;
};

export type MlbDatasetRowIdentity = {
  eventId: string | null;
  gamePk: number | null;
  matchupId: string | null;
  ambiguous: boolean;
  reason: string | null;
};

export type MlbRequestedGameIdResolution = {
  eventIds: string[];
  ambiguousRequested: string[];
  unresolvedRequested: string[];
};

function asNonEmptyString(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Positive integer gamePk. Rejects 0, negatives, floats, and eventId strings. */
export function parsePositiveMlbGamePk(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!/^[1-9]\d*$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }
  return null;
}

export function mlbEventIdFromGamePk(gamePk: number | string): string {
  const pk = parsePositiveMlbGamePk(gamePk);
  if (pk == null) {
    throw new Error(`INVALID_MLB_GAME_PK:${String(gamePk)}`);
  }
  return `${MLB_EVENT_ID_PREFIX}${pk}`;
}

export function mlbGamePkFromEventId(
  eventId: string | null | undefined,
): number | null {
  if (typeof eventId !== "string") return null;
  const s = eventId.trim();
  if (!s.startsWith(MLB_EVENT_ID_PREFIX)) return null;
  return parsePositiveMlbGamePk(s.slice(MLB_EVENT_ID_PREFIX.length));
}

export function isMlbEventId(value: unknown): boolean {
  return mlbGamePkFromEventId(asNonEmptyString(value)) != null;
}

export function mlbIdentityFromScheduleGame(
  g: Record<string, unknown>,
): MlbScheduleIdentityGame | null {
  const gamePk = parsePositiveMlbGamePk(g.gamePk);
  const matchupId =
    asNonEmptyString(g.internalGameId) ??
    (!isMlbEventId(g.gameId) ? asNonEmptyString(g.gameId) : null) ??
    asNonEmptyString(g.matchupId) ??
    "";
  if (gamePk == null && !matchupId) return null;
  const eventId =
    gamePk != null ? mlbEventIdFromGamePk(gamePk) : matchupId;
  return {
    eventId,
    gamePk,
    matchupId,
    commenceTimeUtc:
      asNonEmptyString(g.commenceTimeUtc) ??
      asNonEmptyString(g.scheduledStartTime),
    status: asNonEmptyString(g.statusDetailed) ??
      asNonEmptyString(g.statusAbstract) ??
      asNonEmptyString(g.status) ??
      undefined,
  };
}

function uniqueMatchupEventId(
  matchupId: string,
  schedule: MlbScheduleIdentityGame[],
): string | null {
  const hits = schedule.filter((g) => g.matchupId === matchupId && g.matchupId);
  if (hits.length === 1) return hits[0]!.eventId;
  return null;
}

/**
 * Resolve a dataset row to at most one schedule event.
 * Never last-write-wins across doubleheader siblings.
 */
export function mlbEventIdForDatasetRow(
  row: Record<string, unknown>,
  schedule: MlbScheduleIdentityGame[],
): MlbDatasetRowIdentity {
  const matchupId =
    asNonEmptyString(row.internalGameId) ??
    (!isMlbEventId(row.gameId) ? asNonEmptyString(row.gameId) : null) ??
    asNonEmptyString(row.matchupId);

  const fromEventId = mlbGamePkFromEventId(asNonEmptyString(row.eventId));
  if (fromEventId != null) {
    return {
      eventId: mlbEventIdFromGamePk(fromEventId),
      gamePk: fromEventId,
      matchupId,
      ambiguous: false,
      reason: null,
    };
  }

  const fromPk = parsePositiveMlbGamePk(row.gamePk);
  if (fromPk != null) {
    return {
      eventId: mlbEventIdFromGamePk(fromPk),
      gamePk: fromPk,
      matchupId,
      ambiguous: false,
      reason: null,
    };
  }

  const gameId = asNonEmptyString(row.gameId);
  const gameIdPk = mlbGamePkFromEventId(gameId);
  if (gameIdPk != null) {
    return {
      eventId: mlbEventIdFromGamePk(gameIdPk),
      gamePk: gameIdPk,
      matchupId,
      ambiguous: false,
      reason: null,
    };
  }

  if (matchupId) {
    const unique = uniqueMatchupEventId(matchupId, schedule);
    if (unique) {
      const hit = schedule.find((g) => g.eventId === unique);
      return {
        eventId: unique,
        gamePk: hit?.gamePk ?? mlbGamePkFromEventId(unique),
        matchupId,
        ambiguous: false,
        reason: null,
      };
    }
    const dupHits = schedule.filter((g) => g.matchupId === matchupId);
    if (dupHits.length > 1) {
      return {
        eventId: null,
        gamePk: null,
        matchupId,
        ambiguous: true,
        reason: MLB_IDENTITY_AMBIGUOUS,
      };
    }
  }

  if (gameId && schedule.some((g) => g.eventId === gameId)) {
    const hit = schedule.find((g) => g.eventId === gameId);
    return {
      eventId: gameId,
      gamePk: hit?.gamePk ?? null,
      matchupId: matchupId ?? hit?.matchupId ?? null,
      ambiguous: false,
      reason: null,
    };
  }

  return {
    eventId: null,
    gamePk: null,
    matchupId,
    ambiguous: false,
    reason: null,
  };
}

export function groupMlbDatasetRowsByEventId(
  rows: unknown[],
  schedule: MlbScheduleIdentityGame[],
): {
  byEventId: Map<string, Record<string, unknown>[]>;
  ambiguousRows: number;
} {
  const byEventId = new Map<string, Record<string, unknown>[]>();
  let ambiguousRows = 0;
  for (const raw of rows) {
    if (typeof raw !== "object" || raw == null || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const resolved = mlbEventIdForDatasetRow(row, schedule);
    if (resolved.ambiguous) {
      ambiguousRows += 1;
      continue;
    }
    if (!resolved.eventId) continue;
    const list = byEventId.get(resolved.eventId) ?? [];
    list.push(row);
    byEventId.set(resolved.eventId, list);
  }
  return { byEventId, ambiguousRows };
}

export function indexMlbOddsRowsByEventId(
  rows: Array<Record<string, unknown>>,
  schedule: MlbScheduleIdentityGame[],
): Map<string, Record<string, unknown>> {
  const { byEventId } = groupMlbDatasetRowsByEventId(rows, schedule);
  const map = new Map<string, Record<string, unknown>>();
  for (const [eventId, list] of byEventId) {
    const last = list[list.length - 1];
    if (last) map.set(eventId, last);
  }
  return map;
}

function isCancelledOrPostponed(status: string | undefined): boolean {
  const st = (status ?? "").toUpperCase();
  return st.includes("CANCEL") || st.includes("POSTPON");
}

/**
 * Daily Ops `--game-id` resolver.
 * Event IDs and numeric gamePk map to exactly one event.
 * Legacy matchup slug is allowed only when unique on the date.
 * Duplicate matchup never selects both doubleheader events.
 */
export function resolveMlbRequestedGameIds(
  games: Array<{
    eventId: string;
    gameId?: string;
    gamePk: number | null;
    matchupId: string;
    status?: string;
  }>,
  requested?: string[] | null,
): MlbRequestedGameIdResolution {
  const active = games.filter((g) => !isCancelledOrPostponed(g.status));
  const allEventIds = active.map((g) => g.eventId).filter(Boolean);

  if (!requested?.length) {
    return {
      eventIds: allEventIds,
      ambiguousRequested: [],
      unresolvedRequested: [],
    };
  }

  const byEvent = new Map(active.map((g) => [g.eventId, g]));
  const byPk = new Map<number, (typeof active)[number]>();
  const byMatchup = new Map<string, Array<(typeof active)[number]>>();
  for (const g of active) {
    if (g.gamePk != null) byPk.set(g.gamePk, g);
    if (g.matchupId) {
      const list = byMatchup.get(g.matchupId) ?? [];
      list.push(g);
      byMatchup.set(g.matchupId, list);
    }
  }

  const eventIds: string[] = [];
  const seen = new Set<string>();
  const ambiguousRequested: string[] = [];
  const unresolvedRequested: string[] = [];

  const add = (eventId: string | undefined) => {
    if (!eventId || seen.has(eventId)) return;
    seen.add(eventId);
    eventIds.push(eventId);
  };

  for (const raw of requested) {
    const id = raw.trim();
    if (!id) continue;

    const eventPk = mlbGamePkFromEventId(id);
    if (eventPk != null) {
      const g = byEvent.get(id) ?? byPk.get(eventPk);
      if (g) add(g.eventId);
      else unresolvedRequested.push(id);
      continue;
    }

    const pk = parsePositiveMlbGamePk(id);
    if (pk != null) {
      const g = byPk.get(pk);
      if (g) add(g.eventId);
      else unresolvedRequested.push(id);
      continue;
    }

    const hits = byMatchup.get(id) ?? [];
    if (hits.length === 1) {
      add(hits[0]!.eventId);
    } else if (hits.length > 1) {
      ambiguousRequested.push(id);
    } else {
      unresolvedRequested.push(id);
    }
  }

  return { eventIds, ambiguousRequested, unresolvedRequested };
}

export function mlbMatchupIsUniqueOnDate(
  matchupId: string,
  schedule: MlbScheduleIdentityGame[],
): boolean {
  if (!matchupId) return false;
  return schedule.filter((g) => g.matchupId === matchupId).length === 1;
}

/**
 * Preferred lock / prediction row match for an MLB event.
 * 1. eventId  2. gamePk  3. externalId == String(gamePk)
 * Legacy slug only when the matchup is unique on the date.
 */
export function mlbPredictionRowMatchesEvent(input: {
  row: Record<string, unknown>;
  eventId: string;
  gamePk: number | null;
  matchupId?: string | null;
  matchupUniqueOnDate: boolean;
}): boolean {
  const { row, eventId, gamePk, matchupId, matchupUniqueOnDate } = input;
  const rowEventId = asNonEmptyString(row.eventId);
  if (rowEventId && rowEventId === eventId) return true;

  const rowPk =
    parsePositiveMlbGamePk(row.gamePk) ??
    mlbGamePkFromEventId(rowEventId);
  if (gamePk != null && rowPk === gamePk) return true;

  const externalId = asNonEmptyString(row.externalId);
  if (gamePk != null && externalId === String(gamePk)) return true;

  const hasEventIdentity =
    rowPk != null || isMlbEventId(rowEventId) || isMlbEventId(externalId);
  if (hasEventIdentity) return false;

  if (!matchupUniqueOnDate || !matchupId) return false;
  const rowMatchup =
    asNonEmptyString(row.matchupId) ?? asNonEmptyString(row.gameId);
  return rowMatchup === matchupId;
}
