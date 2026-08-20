/**
 * Lineup temporal provenance — independent from source endpoint.
 *
 * boxscore / schedule-lineups are sources.
 * PRE_GAME / POST_GAME / UNKNOWN are time phases proven by timestamps.
 */
import type {
  LineupCollectionPhase,
  PreGameLineupStatus,
} from "./lineup-dataset-types";

export const TEMPORAL_PROVENANCE_UNPROVEN = "TEMPORAL_PROVENANCE_UNPROVEN";

export type LineupTemporalPhaseResult = {
  collectionPhase: LineupCollectionPhase;
  beforeCutoff: boolean | null;
  warnings: string[];
};

export function resolveLineupSource(opts: {
  usedBoxscore: boolean;
  usedScheduleLineups: boolean;
}): string | null {
  if (opts.usedBoxscore) return "mlb-statsapi-boxscore";
  if (opts.usedScheduleLineups) return "mlb-statsapi-schedule-lineups";
  return null;
}

export function resolveLineupTemporalPhase(input: {
  sourceTimestamp: string | null | undefined;
  cutoffTime: string | null | undefined;
}): LineupTemporalPhaseResult {
  const sourceRaw = input.sourceTimestamp?.trim() || "";
  const cutoffRaw = input.cutoffTime?.trim() || "";
  const sourceMs = Date.parse(sourceRaw);
  const cutoffMs = Date.parse(cutoffRaw);
  if (!sourceRaw || !cutoffRaw || !Number.isFinite(sourceMs) || !Number.isFinite(cutoffMs)) {
    return {
      collectionPhase: "UNKNOWN",
      beforeCutoff: null,
      warnings: [TEMPORAL_PROVENANCE_UNPROVEN],
    };
  }
  if (sourceMs < cutoffMs) {
    return {
      collectionPhase: "PRE_GAME",
      beforeCutoff: true,
      warnings: [],
    };
  }
  return {
    collectionPhase: "POST_GAME",
    beforeCutoff: false,
    warnings: [],
  };
}

export function resolvePreGameLineupStatus(input: {
  collectionPhase: LineupCollectionPhase;
  hasCollectedLineupData: boolean;
}): PreGameLineupStatus {
  if (input.collectionPhase === "PRE_GAME" && input.hasCollectedLineupData) {
    return "COLLECTED";
  }
  return "NOT_COLLECTED";
}

export function isProvenPregameConfirmedLineup(row: {
  collectionPhase: string;
  preGameStatus?: string;
  collectionStatus?: string | null;
  confirmed?: boolean;
  lineupStatus: string;
  sourceTimestamp: string | null | undefined;
  cutoffTime: string | null | undefined;
}): boolean {
  if (row.collectionPhase !== "PRE_GAME") return false;
  if (row.preGameStatus !== "COLLECTED") return false;
  if (row.collectionStatus !== "CONFIRMED" || row.confirmed !== true) return false;
  if (row.lineupStatus !== "COMPLETE") return false;
  const temporal = resolveLineupTemporalPhase({
    sourceTimestamp: row.sourceTimestamp ?? null,
    cutoffTime: row.cutoffTime ?? null,
  });
  return temporal.collectionPhase === "PRE_GAME";
}
