/**
 * Normalize API-Football /injuries raw response.
 * Pure / deterministic / network-free. observedAt comes from metadata.
 */
import { createHash } from "node:crypto";
import { resolveFootballTeamAttachment } from "./identity-attach";
import { resolveFootballPlayerIdentity } from "./player-identity";
import { classifyFootballObservationPhase } from "./temporal";
import type {
  FootballAvailabilityDatasetV1,
  FootballAvailabilityNormalizeMeta,
  FootballAvailabilityRowV1,
  FootballAvailabilityStatus,
  FootballDatasetQuality,
} from "./types";

type InjuryRaw = {
  player?: { id?: number | null; name?: string | null; type?: string | null; reason?: string | null };
  team?: { id?: number | null; name?: string | null };
  fixture?: { id?: number | null };
};

function asArray(raw: unknown): InjuryRaw[] {
  if (Array.isArray(raw)) return raw as InjuryRaw[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { response?: unknown }).response)) {
    return (raw as { response: InjuryRaw[] }).response;
  }
  return [];
}

function hashRaw(raw: unknown): string {
  return createHash("sha256").update(JSON.stringify(raw), "utf8").digest("hex");
}

/**
 * Conservative mapping. Unrecognized wording stays UNKNOWN with raw preserved.
 * Injuries feed lists unavailability — it does not imply AVAILABLE.
 */
export function mapApiFootballInjuryAvailability(input: {
  typeRaw: string | null;
  reasonRaw: string | null;
}): { availabilityStatus: FootballAvailabilityStatus; reasonNormalized: string | null } {
  const type = (input.typeRaw ?? "").trim().toLowerCase();
  const reason = (input.reasonRaw ?? "").trim().toLowerCase();
  const blob = `${type} ${reason}`;

  if (/\bsuspend/.test(blob) || /\bred card/.test(blob)) {
    return { availabilityStatus: "SUSPENDED", reasonNormalized: "SUSPENDED" };
  }
  if (type === "missing fixture") {
    return { availabilityStatus: "OUT", reasonNormalized: "MISSING_FIXTURE" };
  }
  if (type === "questionable") {
    return { availabilityStatus: "QUESTIONABLE", reasonNormalized: "QUESTIONABLE" };
  }
  if (type === "doubtful") {
    return { availabilityStatus: "DOUBTFUL", reasonNormalized: "DOUBTFUL" };
  }
  return { availabilityStatus: "UNKNOWN", reasonNormalized: null };
}

function qualityForAvailability(input: {
  rawRows: number;
  rows: FootballAvailabilityRowV1[];
  identityBlocked: boolean;
}): FootballDatasetQuality {
  if (input.identityBlocked && input.rows.every((r) => !r.operatorGameAttached)) {
    return "IDENTITY_BLOCKED";
  }
  if (input.rawRows === 0) return "EMPTY_PROVIDER_RESPONSE";
  if (input.rows.length > 0 && input.rows.every((r) => !r.pregameEligible)) {
    return "POST_KICKOFF_ONLY";
  }
  if (
    input.rows.some(
      (r) =>
        r.availabilityStatus === "UNKNOWN" ||
        r.player.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED",
    )
  ) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

export function normalizeApiFootballInjuries(
  raw: unknown,
  meta: FootballAvailabilityNormalizeMeta,
): FootballAvailabilityDatasetV1 {
  const temporal = classifyFootballObservationPhase({
    observedAt: meta.observedAt,
    fixtureKickoff: meta.fixtureKickoff,
  });
  const items = asArray(raw);
  const sourceArtifactHash = meta.sourceArtifactHash || hashRaw(raw);
  const identityBlocked = meta.identityGate.verdict !== "PASS";

  const rows: FootballAvailabilityRowV1[] = items.map((item) => {
    const providerTeamId =
      item.team?.id == null ? null : String(item.team.id);
    const attach = resolveFootballTeamAttachment({
      identityGate: meta.identityGate,
      providerTeamId,
      providerTeamName: item.team?.name ?? null,
    });
    const typeRaw = item.player?.type?.trim() ? item.player.type.trim() : null;
    const reasonRaw = item.player?.reason?.trim() ? item.player.reason.trim() : null;
    const mapped = mapApiFootballInjuryAvailability({ typeRaw, reasonRaw });
    const player = resolveFootballPlayerIdentity({
      providerPlayerId: item.player?.id ?? null,
      providerTeamId,
      canonicalTeamId: attach.canonicalTeamId,
      playerName: item.player?.name ?? null,
    });
    return {
      schemaVersion: "yang-edge-football-availability-row-v1",
      observationId: meta.observationId,
      providerFixtureId: meta.providerFixtureId,
      providerTeamId,
      canonicalTeamId: attach.canonicalTeamId,
      player,
      availabilityStatus: mapped.availabilityStatus,
      reasonRaw,
      reasonNormalized: mapped.reasonNormalized,
      typeRaw,
      observedAt: meta.observedAt,
      fixtureKickoff: meta.fixtureKickoff,
      isBeforeKickoff: temporal.isBeforeKickoff,
      pregameEligible: temporal.pregameEligible,
      observationPhase: temporal.observationPhase,
      sourceProvider: "api-football",
      sourceArtifactHash,
      attachmentKind: attach.attachmentKind,
      operatorGameAttached: attach.operatorGameAttached,
      identityGate: {
        verdict: meta.identityGate.verdict,
        reasonCodes: meta.identityGate.reasonCodes,
        predictionAllowed: meta.identityGate.predictionAllowed,
      },
      predictionInput: false,
      engineInput: false,
      researchOnly: true,
    };
  });

  const teams = new Set(rows.map((r) => r.providerTeamId).filter(Boolean));
  return {
    schemaVersion: "yang-edge-football-availability-dataset-v1",
    foundationVersion: "football-pregame-player-xi-foundation-v1",
    observationId: meta.observationId,
    sourceArtifactHash,
    rows,
    quality: qualityForAvailability({
      rawRows: items.length,
      rows,
      identityBlocked,
    }),
    counts: {
      rawRows: items.length,
      normalizedRows: rows.length,
      unknownPlayerIdentityRows: rows.filter(
        (r) => r.player.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED",
      ).length,
      unknownAvailabilityRows: rows.filter((r) => r.availabilityStatus === "UNKNOWN").length,
      teamsObserved: teams.size,
    },
    engineConnected: false,
    predictionConnected: false,
    predictionInput: false,
    engineInput: false,
  };
}
