import { extractSideFromBoxscore } from "../build-lineup-dataset";
import { TEMPORAL_PROVENANCE_UNPROVEN } from "../lineup-temporal-phase";
import { latestAdmissiblePregameSnapshot } from "./store";
import type {
  LineupRawSnapshotV1,
  LineupRefreshCollectionPhase,
  LineupRefreshCollectionStatus,
  LineupRefreshTemporalProof,
  LineupSelectedSnapshotV1,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function classifyBoxscoreBody(body: unknown): {
  collectionStatus: LineupRefreshCollectionStatus;
  confirmed: boolean;
  homeComplete: boolean;
  awayComplete: boolean;
  homeStarterCount: number;
  awayStarterCount: number;
  playerIds: number[];
  warnings: string[];
} {
  const teams = asRecord(asRecord(body)?.teams);
  const home = extractSideFromBoxscore(teams?.home);
  const away = extractSideFromBoxscore(teams?.away);
  const homeComplete = home.lineupStatus === "COMPLETE";
  const awayComplete = away.lineupStatus === "COMPLETE";
  const anyStarters = home.starters.length > 0 || away.starters.length > 0;
  const playerIds = [...home.starters, ...away.starters]
    .map((s) => s.playerId)
    .filter((id) => typeof id === "number")
    .sort((a, b) => a - b);
  let collectionStatus: LineupRefreshCollectionStatus = "NOT_RELEASED";
  if (homeComplete && awayComplete) collectionStatus = "CONFIRMED";
  else if (anyStarters) collectionStatus = "PARTIAL";
  return {
    collectionStatus,
    confirmed: collectionStatus === "CONFIRMED",
    homeComplete,
    awayComplete,
    homeStarterCount: home.starters.length,
    awayStarterCount: away.starters.length,
    playerIds,
    warnings: [...home.warnings, ...away.warnings],
  };
}

/**
 * SOURCE provenance is the provider/endpoint.
 * TEMPORAL provenance requires positive time evidence vs per-game cutoff.
 *
 * PRE_GAME may be asserted only when:
 * - sourceTimestamp is a valid ISO and sourceTimestamp < cutoff, OR
 * - sourceTimestamp is missing AND the provider response is admissible (ok)
 *   AND capturedAt is a valid ISO and capturedAt < cutoff.
 *
 * Missing/ambiguous proof → UNKNOWN. Never PRE_GAME from lineup shape alone.
 * sourceTimestamp >= cutoff → POST_GAME_OR_LATE (even if captured earlier).
 */
export function resolveRefreshTemporalProvenance(input: {
  sourceTimestamp: string | null;
  capturedAt: string | null;
  cutoffTime: string | null;
  admissibleProviderResponse: boolean;
}): {
  collectionPhase: LineupRefreshCollectionPhase;
  beforeCutoff: boolean | null;
  temporalProof: LineupRefreshTemporalProof;
  warnings: string[];
} {
  const cutoffRaw = input.cutoffTime?.trim() || "";
  const cutoffMs = Date.parse(cutoffRaw);
  if (!cutoffRaw || !Number.isFinite(cutoffMs)) {
    return {
      collectionPhase: "UNKNOWN",
      beforeCutoff: null,
      temporalProof: "NONE",
      warnings: [TEMPORAL_PROVENANCE_UNPROVEN],
    };
  }

  const sourceRaw = input.sourceTimestamp?.trim() || "";
  const sourceMs = Date.parse(sourceRaw);
  if (sourceRaw && Number.isFinite(sourceMs)) {
    if (sourceMs < cutoffMs) {
      return {
        collectionPhase: "PRE_GAME",
        beforeCutoff: true,
        temporalProof: "SOURCE_TIMESTAMP",
        warnings: [],
      };
    }
    return {
      collectionPhase: "POST_GAME_OR_LATE",
      beforeCutoff: false,
      temporalProof: "SOURCE_TIMESTAMP",
      warnings: [],
    };
  }

  const capRaw = input.capturedAt?.trim() || "";
  const capMs = Date.parse(capRaw);
  if (
    input.admissibleProviderResponse &&
    capRaw &&
    Number.isFinite(capMs)
  ) {
    if (capMs < cutoffMs) {
      return {
        collectionPhase: "PRE_GAME",
        beforeCutoff: true,
        temporalProof: "CAPTURE_TIMESTAMP",
        warnings: [],
      };
    }
    return {
      collectionPhase: "POST_GAME_OR_LATE",
      beforeCutoff: false,
      temporalProof: "CAPTURE_TIMESTAMP",
      warnings: [],
    };
  }

  return {
    collectionPhase: "UNKNOWN",
    beforeCutoff: null,
    temporalProof: "NONE",
    warnings: [TEMPORAL_PROVENANCE_UNPROVEN],
  };
}

export function selectAdmissiblePregameSnapshot(
  snapshots: LineupRawSnapshotV1[],
): LineupSelectedSnapshotV1 {
  const gamePk = snapshots[0]?.gamePk ?? 0;
  const best = latestAdmissiblePregameSnapshot(snapshots);
  if (!best) {
    const latest = [...snapshots].sort((a, b) =>
      (b.capturedAt ?? b.fetchedAt ?? "").localeCompare(
        a.capturedAt ?? a.fetchedAt ?? "",
      ),
    )[0];
    const unknown = snapshots.some((s) => s.collectionPhase === "UNKNOWN");
    const post = snapshots.some(
      (s) => s.collectionPhase === "POST_GAME_OR_LATE",
    );
    return {
      gamePk,
      selected: false,
      observationId: latest?.observationId ?? null,
      payloadHash: latest?.payloadHash ?? null,
      capturedAt: latest?.capturedAt ?? null,
      fetchedAt: latest?.fetchedAt ?? null,
      sourceTimestamp: latest?.sourceTimestamp ?? null,
      temporalProof: latest?.temporalProof ?? null,
      collectionPhase: latest?.collectionPhase ?? null,
      collectionStatus: latest?.collectionStatus ?? null,
      confirmed: false,
      playerIdCount: 0,
      why: "NO_PREGAME_ADMISSIBLE_SNAPSHOT",
      blocker: unknown
        ? "TEMPORAL_PROVENANCE_UNPROVEN"
        : post
          ? "POST_CUTOFF"
          : "NO_SNAPSHOT",
    };
  }
  const confirmedAdmitted =
    best.collectionStatus === "CONFIRMED" && best.confirmed === true;
  return {
    gamePk: best.gamePk,
    selected: true,
    observationId: best.observationId,
    payloadHash: best.payloadHash,
    capturedAt: best.capturedAt,
    fetchedAt: best.fetchedAt,
    sourceTimestamp: best.sourceTimestamp,
    temporalProof: best.temporalProof,
    collectionPhase: best.collectionPhase,
    collectionStatus: best.collectionStatus,
    confirmed: confirmedAdmitted,
    playerIdCount: best.playerIds.length,
    why: `PRE_GAME+${best.collectionStatus}+${best.observationId.slice(0, 12)}`,
    blocker:
      best.collectionStatus === "CONFIRMED"
        ? null
        : best.collectionStatus === "PARTIAL"
          ? "PARTIAL_NOT_COMPLETE"
          : "LINEUP_NOT_RELEASED",
  };
}

export function temporalForSnapshot(input: {
  sourceTimestamp: string | null;
  capturedAt?: string | null;
  cutoffTime: string | null;
  admissibleProviderResponse?: boolean;
}): ReturnType<typeof resolveRefreshTemporalProvenance> {
  return resolveRefreshTemporalProvenance({
    sourceTimestamp: input.sourceTimestamp,
    capturedAt: input.capturedAt ?? null,
    cutoffTime: input.cutoffTime,
    admissibleProviderResponse: input.admissibleProviderResponse === true,
  });
}
