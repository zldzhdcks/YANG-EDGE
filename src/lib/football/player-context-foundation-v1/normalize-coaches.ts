/**
 * Normalize API-Football /coachs raw response.
 * Pure / deterministic / network-free. observedAt comes from observation metadata.
 *
 * Coach profile ≠ tactics. No scores in P1.
 * Multiple coaches are preserved; no arbitrary first-row selection.
 */
import { resolveFootballCoachIdentity, resolvePlayerContextTeamAttachment } from "./identity";
import { asNullableId, asNullableNumber, asNullableString } from "./read-fields";
import { classifyPlayerContextTemporal } from "./temporal";
import type {
  FootballCoachCareerRowV1,
  FootballCoachProfileV1,
  FootballCoachSnapshotV1,
  FootballPlayerContextDatasetQuality,
  FootballPlayerContextNormalizeMeta,
  FootballRawPlayerContextObservationV1,
} from "./types";

type CoachRaw = {
  id?: unknown;
  name?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  age?: unknown;
  nationality?: unknown;
  photo?: unknown;
  birth?: { date?: unknown; place?: unknown; country?: unknown };
  team?: { id?: unknown; name?: unknown };
  career?: unknown;
};

function extractCoachItems(raw: unknown): CoachRaw[] {
  if (Array.isArray(raw)) {
    return raw.filter((row) => row && typeof row === "object") as CoachRaw[];
  }
  if (raw && typeof raw === "object") {
    const obj = raw as { response?: unknown; raw?: unknown };
    if (Array.isArray(obj.response)) return extractCoachItems(obj.response);
    if (Array.isArray(obj.raw)) return extractCoachItems(obj.raw);
    if ("id" in obj || "career" in obj) return [obj as CoachRaw];
  }
  return [];
}

function careerRows(raw: unknown): FootballCoachCareerRowV1[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const team =
      item.team && typeof item.team === "object"
        ? (item.team as Record<string, unknown>)
        : {};
    return {
      providerTeamId: asNullableId(team.id),
      teamName: asNullableString(team.name),
      start: asNullableString(item.start),
      end: asNullableString(item.end),
    };
  });
}

function qualityForCoaches(input: {
  coaches: FootballCoachProfileV1[];
  identityBlocked: boolean;
  postKickoffOnly: boolean;
}): FootballPlayerContextDatasetQuality {
  if (input.identityBlocked) return "IDENTITY_BLOCKED";
  if (input.postKickoffOnly) return "POST_KICKOFF_ONLY";
  if (input.coaches.length === 0) return "EMPTY_PROVIDER_RESPONSE";
  if (
    input.coaches.some(
      (c) => c.identity.identityStatus === "COACH_IDENTITY_REVIEW_REQUIRED",
    )
  ) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

export function normalizeApiFootballCoaches(
  observation: FootballRawPlayerContextObservationV1,
  meta: FootballPlayerContextNormalizeMeta,
): FootballCoachSnapshotV1 {
  const temporal = classifyPlayerContextTemporal({
    observedAt: observation.observedAt,
    fixtureKickoff: meta.fixtureKickoff,
  });
  const items = extractCoachItems(observation.rawResponse);
  const queryTeamId = observation.providerTeamId;

  const coaches: FootballCoachProfileV1[] = items.map((item) => {
    const currentProviderTeamId = asNullableId(item.team?.id) ?? queryTeamId;
    const currentTeamName = asNullableString(item.team?.name);
    return {
      identity: resolveFootballCoachIdentity({
        providerCoachId: asNullableId(item.id),
        name: asNullableString(item.name),
        firstname: asNullableString(item.firstname),
        lastname: asNullableString(item.lastname),
      }),
      age: asNullableNumber(item.age),
      nationality: asNullableString(item.nationality),
      photo: asNullableString(item.photo),
      birth: {
        date: asNullableString(item.birth?.date),
        place: asNullableString(item.birth?.place),
        country: asNullableString(item.birth?.country),
      },
      currentProviderTeamId,
      currentTeamName,
      career: careerRows(item.career),
      tacticalScore: null,
      coachStrengthScore: null,
      formationScore: null,
      managerRating: null,
    };
  });

  const attach = resolvePlayerContextTeamAttachment({
    providerTeamId: queryTeamId,
    identityGate: meta.identityGate,
  });
  const identityBlocked = !attach.canonicalTeamAttached;
  const postKickoffOnly = temporal.observationPhase === "POST_KICKOFF_INVALID_FOR_PREGAME";

  return {
    schemaVersion: "yang-edge-football-coach-snapshot-v1",
    foundationVersion: "football-player-stats-squad-coach-foundation-v1",
    observationId: observation.observationId,
    providerTeamId: queryTeamId,
    canonicalTeamId: attach.canonicalTeamId,
    canonicalTeamAttached: attach.canonicalTeamAttached,
    operatorGameAttached: attach.operatorGameAttached,
    observedAt: observation.observedAt,
    coaches,
    coach: coaches.length === 1 ? coaches[0]! : null,
    quality: qualityForCoaches({
      coaches,
      identityBlocked,
      postKickoffOnly,
    }),
    pregameEligible: temporal.pregameEligible,
    observationPhase: temporal.observationPhase,
    identityGate: meta.identityGate
      ? {
          verdict: meta.identityGate.verdict,
          reasonCodes: meta.identityGate.reasonCodes,
          predictionAllowed: meta.identityGate.predictionAllowed,
        }
      : null,
    engineConnected: false,
    predictionConnected: false,
    predictionInput: false,
    engineInput: false,
    researchOnly: true,
  };
}
