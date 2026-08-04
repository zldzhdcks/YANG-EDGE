/**
 * Football Identity → Operation Memory / Dashboard ViewModel.
 * No fabricated schedule rows or progress %.
 */
import { listCompetitions } from "./competition-registry";
import { FOOTBALL_IDENTITY_RISK_REGISTER_V0 } from "./risk-register";
import { listTeams } from "./team-registry";
import type {
  FootballFoundationStage,
  FootballIdentityOperationSlice,
  FootballOsLevel,
} from "./types";

export function resolveFootballFoundationStage(input?: {
  /** Future: true when a valid schedule artifact exists for date */
  scheduleArtifactReady?: boolean;
  identitySystemBlocked?: boolean;
}): FootballFoundationStage {
  if (input?.identitySystemBlocked) return "BLOCKED";
  const competitions = listCompetitions().filter((c) => c.researchSupported);
  const teams = listTeams().filter((t) => t.active);
  if (competitions.length === 0 || teams.length === 0) return "NOT_STARTED";
  if (input?.scheduleArtifactReady) return "READY";
  return "FOUNDATION";
}

export function foundationStageToOsLevel(
  stage: FootballFoundationStage,
): FootballOsLevel {
  switch (stage) {
    case "READY":
      return "READY";
    case "FOUNDATION":
      return "WARNING";
    case "BLOCKED":
      return "BLOCKED";
    case "NOT_STARTED":
    default:
      return "OFF";
  }
}

export function buildFootballIdentityOperationSlice(input?: {
  scheduleArtifactReady?: boolean;
  identitySystemBlocked?: boolean;
}): FootballIdentityOperationSlice {
  const stage = resolveFootballFoundationStage(input);
  const osLevel = foundationStageToOsLevel(stage);
  const competitionCount = listCompetitions().length;
  const teamCount = listTeams().filter((t) => t.active).length;

  const plainByStage: Record<FootballFoundationStage, string> = {
    NOT_STARTED: "축구 Identity Registry가 아직 없습니다.",
    FOUNDATION:
      "Identity Layer(Competition/Team/Match/Gate)가 준비되었습니다. Schedule·Odds·Prediction은 아직입니다.",
    READY: "해당 일자 Schedule Artifact가 Identity Gate를 통과했습니다.",
    BLOCKED: "Identity Gate 시스템 문제로 Football 진행이 막혀 있습니다.",
  };

  return {
    stage,
    osLevel,
    label: stage,
    plainLanguage: plainByStage[stage],
    competitionCount,
    teamCount,
    progressPercent: null,
    risksTop: FOOTBALL_IDENTITY_RISK_REGISTER_V0.slice(0, 3).map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
    })),
    sourceRefs: [
      "src/lib/football/foundation/",
      "FOOTBALL_IDENTITY_VERSION=football-identity-v0",
    ],
  };
}
