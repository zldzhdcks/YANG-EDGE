/**
 * Load a single KBO game operational state via unified day reader.
 */
import {
  loadKboOperationalDayState,
  resolveDateKstForGameId,
} from "./load-kbo-operational-day-state";
import type { KboOperationalGameState, KboOperationalStatus } from "./types";
import { component } from "./types";

export async function loadKboOperationalGameState(
  gameId: string,
  opts?: { dateKst?: string | null; cwd?: string },
): Promise<KboOperationalGameState> {
  const cwd = opts?.cwd ?? process.cwd();
  const normalized = gameId.trim();
  const dateKst =
    opts?.dateKst?.trim() ||
    (await resolveDateKstForGameId(normalized, cwd));

  if (!dateKst) {
    return emptyBlockedGame(normalized, "SCHEDULE_MISSING — date not resolved");
  }

  const day = await loadKboOperationalDayState(dateKst, cwd);
  const found = day.games.find((g) => g.gameId === normalized);
  if (found) return found;

  return emptyBlockedGame(
    normalized,
    `GAME_NOT_IN_SCHEDULE_${dateKst}`,
    dateKst,
  );
}

function emptyBlockedGame(
  gameId: string,
  reason: string,
  dateKst = "",
): KboOperationalGameState {
  const blocked = component({
    status: "BLOCKED" as KboOperationalStatus,
    reason,
    applicable: true,
    sourceType: "NONE",
    sourcePath: null,
  });
  const na = component({
    status: "NOT_AVAILABLE" as KboOperationalStatus,
    reason: "IDENTITY_UNAVAILABLE",
    applicable: false,
    sourceType: "NONE",
    sourcePath: null,
    maxScore: 0,
    score: 0,
  });
  return {
    dateKst,
    gameId,
    homeTeam: null,
    awayTeam: null,
    scheduledStartTime: null,
    operatingStatus: "UNKNOWN",
    activeRequirement: false,
    schedule: blocked,
    domesticOdds: na,
    overseasOdds: na,
    starter: na,
    lineup: na,
    prediction: na,
    review: na,
    readinessPercent: 0,
    overallStatus: "BLOCKED",
    blockingReasons: [reason],
    waitingReasons: [],
    warnings: [],
    hardErrors: [
      {
        code: "SCHEDULE_MISSING",
        message: reason,
        path: "",
      },
    ],
    sources: [],
  };
}
