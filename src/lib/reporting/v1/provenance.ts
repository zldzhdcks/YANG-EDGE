/**
 * Sport-specific provenance chains.
 * Reporting does not force one filename sequence onto every sport.
 * Prefer metadata hashes / matchId / fixtureId over basename guessing.
 */
import type { MandatoryStageId, SportId } from "./types";

export type ArtifactKind =
  | "SCHEDULE"
  | "STARTER"
  | "ODDS"
  | "LINEUP"
  | "IDENTITY"
  | "DAILY_RESEARCH_SUMMARY"
  | "PREDICTION_SNAPSHOT"
  | "RECOMMENDATION_SEAL"
  | "MARKET_BASELINE"
  | "OFFICIAL_RESULT"
  | "GRADED_PREDICTION"
  | "SUCCESS_REVIEW"
  | "FAILURE_REVIEW"
  | "DAILY_REVIEW_SUMMARY"
  | "RESEARCH_SCORECARD"
  | "STARTER_POSTGAME_REVIEW"
  | "AUDIT"
  | "UNKNOWN"
  | "PRESENTATION_NON_SOURCE"
  | "WEEKLY_REPORT_NON_SOURCE"
  | "MONTHLY_REPORT_NON_SOURCE";

export type JoinKey =
  | "matchId"
  | "gamePk"
  | "internalGameId"
  | "providerMatchId"
  | "fixtureId"
  | "sourceArtifactHash"
  | "sourceSnapshotHash"
  | "predictionHash";

export type ProvenanceBinding = {
  mandatoryStage: MandatoryStageId;
  artifactKinds: ArtifactKind[];
  joinKeys: JoinKey[];
};

export type SportProvenanceChain = {
  sport: SportId;
  bindings: ProvenanceBinding[];
};

export const MLB_PROVENANCE_CHAIN: SportProvenanceChain = {
  sport: "MLB",
  bindings: [
    {
      mandatoryStage: "A_SLATE_SCHEDULE",
      artifactKinds: ["SCHEDULE"],
      joinKeys: ["gamePk", "internalGameId"],
    },
    {
      mandatoryStage: "B_PREGAME_INPUT",
      artifactKinds: ["STARTER", "ODDS", "LINEUP", "DAILY_RESEARCH_SUMMARY"],
      joinKeys: ["gamePk", "internalGameId"],
    },
    {
      mandatoryStage: "C_PREGAME_FREEZE",
      artifactKinds: ["PREDICTION_SNAPSHOT"],
      joinKeys: ["gamePk", "internalGameId", "predictionHash"],
    },
    {
      mandatoryStage: "D_PREGAME_GIT_SEAL",
      artifactKinds: ["PREDICTION_SNAPSHOT", "RECOMMENDATION_SEAL"],
      joinKeys: ["predictionHash"],
    },
    {
      mandatoryStage: "E_RESULT_GRADE",
      artifactKinds: ["OFFICIAL_RESULT", "GRADED_PREDICTION"],
      joinKeys: ["gamePk", "internalGameId", "predictionHash"],
    },
    {
      mandatoryStage: "F_REVIEW_SCORECARD",
      artifactKinds: [
        "SUCCESS_REVIEW",
        "FAILURE_REVIEW",
        "DAILY_REVIEW_SUMMARY",
        "RESEARCH_SCORECARD",
      ],
      joinKeys: ["gamePk", "internalGameId"],
    },
    {
      mandatoryStage: "G_DAILY_CLOSE",
      artifactKinds: ["DAILY_REVIEW_SUMMARY", "AUDIT"],
      joinKeys: ["predictionHash"],
    },
  ],
};

export const FOOTBALL_PROVENANCE_CHAIN: SportProvenanceChain = {
  sport: "FOOTBALL",
  bindings: [
    {
      mandatoryStage: "A_SLATE_SCHEDULE",
      artifactKinds: ["SCHEDULE"],
      joinKeys: ["matchId", "providerMatchId", "fixtureId"],
    },
    {
      mandatoryStage: "B_PREGAME_INPUT",
      artifactKinds: ["ODDS", "IDENTITY"],
      joinKeys: ["matchId", "providerMatchId", "sourceArtifactHash"],
    },
    {
      mandatoryStage: "C_PREGAME_FREEZE",
      artifactKinds: ["PREDICTION_SNAPSHOT", "MARKET_BASELINE"],
      joinKeys: ["matchId", "sourceSnapshotHash"],
    },
    {
      mandatoryStage: "D_PREGAME_GIT_SEAL",
      artifactKinds: ["PREDICTION_SNAPSHOT", "MARKET_BASELINE"],
      joinKeys: ["sourceSnapshotHash"],
    },
    {
      mandatoryStage: "E_RESULT_GRADE",
      artifactKinds: ["OFFICIAL_RESULT"],
      joinKeys: ["matchId", "fixtureId", "sourceArtifactHash"],
    },
    {
      mandatoryStage: "F_REVIEW_SCORECARD",
      artifactKinds: ["RESEARCH_SCORECARD", "DAILY_REVIEW_SUMMARY"],
      joinKeys: ["matchId"],
    },
    {
      mandatoryStage: "G_DAILY_CLOSE",
      artifactKinds: ["OFFICIAL_RESULT", "AUDIT"],
      joinKeys: ["matchId"],
    },
  ],
};

export function provenanceChainFor(sport: SportId): SportProvenanceChain | null {
  if (sport === "MLB") return MLB_PROVENANCE_CHAIN;
  if (sport === "FOOTBALL") return FOOTBALL_PROVENANCE_CHAIN;
  return null;
}

export function isNonSourceKind(kind: ArtifactKind): boolean {
  return (
    kind === "PRESENTATION_NON_SOURCE" ||
    kind === "WEEKLY_REPORT_NON_SOURCE" ||
    kind === "MONTHLY_REPORT_NON_SOURCE"
  );
}
