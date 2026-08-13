import type { FootballScheduleRowV1 } from "../core/types";
import { computeFootball1x2OddsObservationHash } from "../odds-1x2-v1/hash";
import type { Football1x2OddsObservationV1 } from "../odds-1x2-v1/types";
import { assertFrozenOddsObservationProvenance } from "./provenance";
import type {
  FootballSnapshotMatchStatus,
  FootballSnapshotMatchV0,
} from "./types";

function parseMs(iso: string): number {
  return Date.parse(iso);
}

export function isUsablePregameObservation(input: {
  observation: Football1x2OddsObservationV1;
  matchId: string;
  freezeAt: string;
  kickoffTimeUtc: string;
}): boolean {
  const obs = input.observation;
  if (obs.matchId !== input.matchId) return false;
  if (obs.joinStatus !== "JOINED") return false;
  if (obs.marketStatus !== "COMPLETE_1X2") return false;
  if (obs.pregameUsable !== true) return false;
  const observedMs = parseMs(obs.observedAt);
  const freezeMs = parseMs(input.freezeAt);
  const kickoffMs = parseMs(input.kickoffTimeUtc);
  if (!Number.isFinite(observedMs) || !Number.isFinite(freezeMs)) return false;
  if (!Number.isFinite(kickoffMs)) return false;
  if (observedMs > freezeMs) return false;
  if (observedMs >= kickoffMs) return false;
  return true;
}

export function snapshotStatusForEligibility(
  eligibility: FootballScheduleRowV1["predictionEligibility"],
): FootballSnapshotMatchStatus | null {
  if (eligibility === "ELIGIBLE_FORMAT") return null;
  if (eligibility === "NOT_SUPPORTED_FORMAT") return "NOT_ELIGIBLE_FORMAT";
  if (eligibility === "COMPETITION_BLOCKED") return "COMPETITION_BLOCKED";
  if (eligibility === "IDENTITY_BLOCKED") return "IDENTITY_BLOCKED";
  return "UNKNOWN_ELIGIBILITY";
}

export function selectFrozenOddsObservation(input: {
  row: FootballScheduleRowV1;
  observations: Football1x2OddsObservationV1[];
  freezeAt: string;
  scheduleArtifactHash: string;
}): FootballSnapshotMatchV0 {
  const frozenScheduleRow = structuredClone(input.row);
  const afterFreezeObservationCount = input.observations.filter((obs) => {
    if (obs.matchId !== input.row.matchId) return false;
    const observedMs = parseMs(obs.observedAt);
    const freezeMs = parseMs(input.freezeAt);
    return Number.isFinite(observedMs) && observedMs > freezeMs;
  }).length;

  const base = {
    matchId: input.row.matchId,
    frozenScheduleRow,
    afterFreezeObservationCount,
    researchOnly: true as const,
  };

  const ineligible = snapshotStatusForEligibility(
    input.row.predictionEligibility,
  );
  if (ineligible) {
    return {
      ...base,
      snapshotStatus: ineligible,
      frozenOddsObservation: null,
      selectedOddsObservationId: null,
      selectedOddsObservationHash: null,
      reasonCodes: [`SCHEDULE_${input.row.predictionEligibility}`],
    };
  }

  const kickoff = input.row.kickoffTimeUtc;
  const freezeMs = parseMs(input.freezeAt);
  const kickoffMs = kickoff ? parseMs(kickoff) : NaN;
  if (
    !kickoff ||
    !Number.isFinite(kickoffMs) ||
    !Number.isFinite(freezeMs) ||
    freezeMs >= kickoffMs
  ) {
    return {
      ...base,
      snapshotStatus: "MISSED_SNAPSHOT_FREEZE_WINDOW",
      frozenOddsObservation: null,
      selectedOddsObservationId: null,
      selectedOddsObservationHash: null,
      reasonCodes: ["FREEZE_AT_NOT_BEFORE_KICKOFF"],
    };
  }

  const candidates = input.observations.filter((observation) =>
    isUsablePregameObservation({
      observation,
      matchId: input.row.matchId,
      freezeAt: input.freezeAt,
      kickoffTimeUtc: kickoff,
    }),
  );

  if (candidates.length === 0) {
    return {
      ...base,
      snapshotStatus: "NO_USABLE_ODDS_BEFORE_FREEZE",
      frozenOddsObservation: null,
      selectedOddsObservationId: null,
      selectedOddsObservationHash: null,
      reasonCodes: ["NO_USABLE_ODDS_BEFORE_FREEZE"],
    };
  }

  let latestMs = -Infinity;
  for (const c of candidates) {
    const ms = parseMs(c.observedAt);
    if (ms > latestMs) latestMs = ms;
  }
  const latest = candidates.filter((c) => parseMs(c.observedAt) === latestMs);
  if (latest.length !== 1) {
    throw new Error(
      `AMBIGUOUS_ODDS_OBSERVATION_SELECTION: matchId=${input.row.matchId} observedAt=${latest[0]?.observedAt} count=${latest.length}`,
    );
  }

  const selected = latest[0]!;
  assertFrozenOddsObservationProvenance({
    row: input.row,
    observation: selected,
    scheduleArtifactHash: input.scheduleArtifactHash,
  });
  const frozen = structuredClone(selected);
  return {
    ...base,
    snapshotStatus: "FROZEN",
    frozenOddsObservation: frozen,
    selectedOddsObservationId: frozen.observationId,
    selectedOddsObservationHash: computeFootball1x2OddsObservationHash(frozen),
    reasonCodes: [],
  };
}
