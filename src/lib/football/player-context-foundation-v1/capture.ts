/**
 * Build immutable raw player-context observations from already-fetched payloads.
 * Does not call the provider. Does not write files. observedAt is caller-supplied.
 */
import { createHash } from "node:crypto";
import type {
  FootballPagingMetaV1,
  FootballPlayerContextEndpoint,
  FootballPlayerContextKind,
  FootballRawPlayerContextObservationV1,
} from "./types";
import { FOOTBALL_PLAYER_CONTEXT_SCHEMA_VERSION } from "./types";

function observationId(input: {
  kind: FootballPlayerContextKind;
  endpoint: FootballPlayerContextEndpoint;
  providerTeamId: string | null;
  season: number | null;
  observedAt: string;
  rawResponse: unknown;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        input.kind,
        input.endpoint,
        input.providerTeamId ?? "",
        input.season == null ? "" : String(input.season),
        input.observedAt,
        JSON.stringify(input.rawResponse),
      ].join("|"),
      "utf8",
    )
    .digest("hex")
    .slice(0, 16);
  return `player-context-${input.kind.toLowerCase()}-${digest}`;
}

export function buildFootballRawPlayerContextObservation(input: {
  kind: FootballPlayerContextKind;
  endpoint: FootballPlayerContextEndpoint;
  providerTeamId: string | null;
  leagueId?: string | null;
  season?: number | null;
  observedAt: string;
  query: Record<string, string>;
  paging?: FootballPagingMetaV1 | null;
  rawResponse: unknown;
  syntheticTestData: boolean;
  schemaValidationResearchOnly?: boolean;
}): FootballRawPlayerContextObservationV1 {
  if (!input.observedAt || !Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("FOOTBALL_PLAYER_CONTEXT_OBSERVED_AT_INVALID");
  }
  if (input.kind === "PLAYERS" && input.endpoint !== "/players") {
    throw new Error("FOOTBALL_PLAYER_CONTEXT_KIND_ENDPOINT_MISMATCH");
  }
  if (input.kind === "SQUADS" && input.endpoint !== "/players/squads") {
    throw new Error("FOOTBALL_PLAYER_CONTEXT_KIND_ENDPOINT_MISMATCH");
  }
  if (input.kind === "COACHES" && input.endpoint !== "/coachs") {
    throw new Error("FOOTBALL_PLAYER_CONTEXT_KIND_ENDPOINT_MISMATCH");
  }

  return {
    schemaVersion: FOOTBALL_PLAYER_CONTEXT_SCHEMA_VERSION,
    observationId: observationId({
      kind: input.kind,
      endpoint: input.endpoint,
      providerTeamId: input.providerTeamId,
      season: input.season ?? null,
      observedAt: input.observedAt,
      rawResponse: input.rawResponse,
    }),
    kind: input.kind,
    provider: "api-football",
    endpoint: input.endpoint,
    providerTeamId: input.providerTeamId,
    leagueId: input.leagueId ?? null,
    season: input.season ?? null,
    observedAt: input.observedAt,
    query: { ...input.query },
    paging: input.kind === "PLAYERS" ? (input.paging ?? null) : null,
    rawResponse: input.rawResponse,
    researchOnly: true,
    predictionInput: false,
    engineInput: false,
    overwriteForbidden: true,
    appendOnly: true,
    syntheticTestData: input.syntheticTestData,
    schemaValidationResearchOnly: Boolean(input.schemaValidationResearchOnly),
  };
}
