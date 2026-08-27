/**
 * Stage E terminal coverage-gap classifier v2.
 * Distinguishes operational close from final Result coverage.
 * Does not invent scores. Does not fuzzy-match. Does not mutate B1/C.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  STAGE_E_FOOTBALL_RECOVERY_REL,
  STAGE_E_FOOTBALL_SCHEDULE_REL,
} from "./paths";
import type {
  DailyStageECloseClass,
  DailyStageECoverageGapClass,
  DailyStageEGameRowV1,
  DailyStageEStageResult,
  StageEB1Game,
  StageECgame,
} from "./types";

export type FootballRecoveryRow = {
  operatorGame: string;
  operatorCompetitionLabel: string;
  providerFixtureId: string | null;
  candidateCount: number;
  kickoffCandidateCount: number;
  decision: string;
  reasons: string[];
};

export type StageETerminalGapContext = {
  b1ByOperatorId: Map<string, StageEB1Game>;
  recoveryByOperatorKey: Map<string, FootballRecoveryRow>;
  kLeague1930ScheduleCount: number;
};

const ACTIVE_STATES = new Set(["LIVE", "SCHEDULED", "PENDING", "NOT_RESOLVED", "SUSPENDED"]);
const PROVIDER_CONFIRMED_TERMINAL_STATES = new Set([
  "FINAL",
  "POSTPONED",
  "CANCELLED",
  "ABANDONED",
]);

function recoveryKey(home: string, away: string): string {
  return `${home.trim()} : ${away.trim()}`;
}

export async function loadStageETerminalGapContext(
  cwd: string,
  b1ByOperatorId: Map<string, StageEB1Game>,
): Promise<StageETerminalGapContext> {
  const recoveryRaw = await readFile(path.join(cwd, STAGE_E_FOOTBALL_RECOVERY_REL), "utf8");
  const scheduleRaw = await readFile(path.join(cwd, STAGE_E_FOOTBALL_SCHEDULE_REL), "utf8");
  const recovery = JSON.parse(recoveryRaw) as { rows: FootballRecoveryRow[] };
  const schedule = JSON.parse(scheduleRaw) as {
    rows: Array<{
      providerMatchId?: string;
      kickoffTimeUtc?: string;
      competitionId?: string;
    }>;
  };
  const recoveryByOperatorKey = new Map<string, FootballRecoveryRow>();
  for (const row of recovery.rows) {
    recoveryByOperatorKey.set(row.operatorGame, row);
  }
  const kLeague1930ScheduleCount = schedule.rows.filter(
    (r) =>
      r.competitionId === "fb-comp-api-football-292" &&
      r.kickoffTimeUtc === "2026-08-26T10:30:00.000Z",
  ).length;
  return { b1ByOperatorId, recoveryByOperatorKey, kLeague1930ScheduleCount };
}

function isActivePendingState(resultState: DailyStageEGameRowV1["resultState"]): boolean {
  return ACTIVE_STATES.has(resultState);
}

export function isProviderConfirmedTerminalState(
  resultState: DailyStageEGameRowV1["resultState"],
): boolean {
  return PROVIDER_CONFIRMED_TERMINAL_STATES.has(resultState);
}

export function classifyStageECloseV2(input: {
  observation: Omit<
    DailyStageEGameRowV1,
    | "closeClass"
    | "exactResultLookupAvailable"
    | "coverageGapClass"
    | "coverageGapReasons"
    | "coverageGapEvidence"
    | "pregameIdentityProvenance"
    | "fuzzyMatchingUsed"
  >;
  cGame: StageECgame;
  ctx: StageETerminalGapContext;
}): Pick<
  DailyStageEGameRowV1,
  | "closeClass"
  | "exactResultLookupAvailable"
  | "coverageGapClass"
  | "coverageGapReasons"
  | "coverageGapEvidence"
  | "pregameIdentityProvenance"
  | "fuzzyMatchingUsed"
> {
  const { observation, cGame, ctx } = input;
  const b1 = ctx.b1ByOperatorId.get(observation.operatorGameId);
  const exactResultLookupAvailable = Boolean(observation.providerFixtureId);
  const pregameIdentityProvenance = [
    `C:${cGame.cState}`,
    ...(b1?.status ? [`B1:${b1.status}`] : []),
    ...(b1?.reasons ?? []).map((r) => `B1_REASON:${r}`),
  ];
  const recovery = b1
    ? ctx.recoveryByOperatorKey.get(recoveryKey(b1.rawHome ?? "", b1.rawAway ?? ""))
    : undefined;

  if (observation.resultState === "LIVE" || observation.resultState === "SCHEDULED") {
    return {
      closeClass: "ACTIVE_RESULT_PENDING",
      exactResultLookupAvailable,
      coverageGapClass: null,
      coverageGapReasons: exactResultLookupAvailable
        ? ["EXACT_PROVIDER_FIXTURE_LOOKUP_STILL_AVAILABLE", `RESULT_STATE:${observation.resultState}`]
        : [`RESULT_STATE:${observation.resultState}`],
      coverageGapEvidence: [],
      pregameIdentityProvenance,
      fuzzyMatchingUsed: false,
    };
  }

  if (isActivePendingState(observation.resultState)) {
    return {
      closeClass: "ACTIVE_RESULT_PENDING",
      exactResultLookupAvailable,
      coverageGapClass: null,
      coverageGapReasons: exactResultLookupAvailable
        ? ["EXACT_PROVIDER_FIXTURE_LOOKUP_STILL_AVAILABLE", `RESULT_STATE:${observation.resultState}`]
        : [`RESULT_STATE:${observation.resultState}`],
      coverageGapEvidence: [],
      pregameIdentityProvenance,
      fuzzyMatchingUsed: false,
    };
  }

  if (isProviderConfirmedTerminalState(observation.resultState)) {
    return {
      closeClass: "PROVIDER_CONFIRMED_TERMINAL",
      exactResultLookupAvailable,
      coverageGapClass: null,
      coverageGapReasons: [],
      coverageGapEvidence: [],
      pregameIdentityProvenance,
      fuzzyMatchingUsed: false,
    };
  }

  if (
    observation.sport === "VOLLEYBALL" &&
    observation.resultState === "UNSUPPORTED" &&
    observation.resultIdentityState === "PROVIDER_NOT_SUPPORTED" &&
    !exactResultLookupAvailable &&
    (cGame.cState === "PASS_PROVIDER_NOT_SUPPORTED" ||
      observation.resultState === "UNSUPPORTED")
  ) {
    const coverageGapClass: DailyStageECoverageGapClass =
      "RESULT_PROVIDER_UNSUPPORTED_TERMINAL";
    const closeClass: DailyStageECloseClass = coverageGapClass;
    return {
      closeClass,
      exactResultLookupAvailable: false,
      coverageGapClass,
      coverageGapReasons: [
        "NO_LAWFUL_EXISTING_RESULT_PIPELINE",
        "KNOWN_PREGAME_PROVIDER_COVERAGE_GAP",
        "NO_SCORE_INVENTED",
        "NO_PROVIDER_PURCHASED_FOR_CLOSE",
      ],
      coverageGapEvidence: [
        "data/audits/2026-08-26-prediction-pass-reconciliation-v1.json#PASS_PROVIDER_NOT_SUPPORTED",
        "C:PASS_PROVIDER_NOT_SUPPORTED",
      ],
      pregameIdentityProvenance,
      fuzzyMatchingUsed: false,
    };
  }

  const identityUnresolved =
    observation.resultState === "IDENTITY_UNRESOLVED" &&
    observation.resultIdentityState === "IDENTITY_UNRESOLVED";
  if (identityUnresolved && exactResultLookupAvailable) {
    return {
      closeClass: "ACTIVE_RESULT_PENDING",
      exactResultLookupAvailable: true,
      coverageGapClass: null,
      coverageGapReasons: [
        "EXACT_PROVIDER_FIXTURE_ID_PRESENT_NOT_A_TERMINAL_GAP",
        "DETERMINISTIC_LOOKUP_STILL_EXISTS",
      ],
      coverageGapEvidence: [],
      pregameIdentityProvenance,
      fuzzyMatchingUsed: false,
    };
  }

  if (identityUnresolved && !exactResultLookupAvailable) {
    const b1Review =
      b1?.status === "IDENTITY_REVIEW_REQUIRED" ||
      (b1?.reasons ?? []).some(
        (r) =>
          r.includes("IDENTITY") ||
          r.includes("UNREGISTERED_COMPETITION") ||
          r.includes("NO_FUZZY") ||
          r.includes("ALIAS_MISSING"),
      );
    const kickoffAmbiguous =
      (recovery != null && recovery.kickoffCandidateCount > 1) ||
      (observation.league === "K리그1" && ctx.kLeague1930ScheduleCount > 1);
    const capturedInspected =
      recovery != null ||
      (observation.league === "K리그1" && ctx.kLeague1930ScheduleCount > 0);
    const noFuzzyDocumented =
      (b1?.reasons ?? []).some((r) => r.includes("NO_FUZZY")) ||
      (recovery?.reasons ?? []).some((r) => r.includes("NO_FUZZY"));
    const eligible =
      Boolean(b1Review) && capturedInspected && kickoffAmbiguous && noFuzzyDocumented;

    if (eligible) {
      const coverageGapClass: DailyStageECoverageGapClass =
        "RESULT_IDENTITY_UNRESOLVED_TERMINAL";
      const closeClass: DailyStageECloseClass = coverageGapClass;
      const coverageGapReasons = [
        "LOCKED_SCOPE_ROW",
        "RESULT_ATTEMPTED_VIA_EXISTING_CAPTURED_EVIDENCE",
        "NO_DETERMINISTIC_UNIQUE_PROVIDER_FIXTURE_IDENTITY",
        "NO_FUZZY_NAME_MATCHING",
        "NO_NEAREST_KICKOFF_GUESS",
        "NO_CANONICAL_TEAM_APPROVAL_FORCED",
        "NO_SCORE_INVENTED",
        ...(recovery?.reasons ?? []),
        ...(b1?.reasons ?? []),
      ];
      const coverageGapEvidence = [
        "data/audits/2026-08-26-schedule-identity-reconciliation-v1.json",
        ...(recovery
          ? [
              "data/audits/2026-08-26-football-competition-recovery-v1.json",
              "data/research/football/2026-08-26-fixtures-captured-v1.json",
              `RECOVERY_KICKOFF_CANDIDATE_COUNT:${recovery.kickoffCandidateCount}`,
            ]
          : [
              "data/research/football/2026-08-26-schedule-v1.json",
              `K_LEAGUE_19_30_SCHEDULE_COUNT:${ctx.kLeague1930ScheduleCount}`,
            ]),
        `C:${cGame.cState}`,
      ];
      return {
        closeClass,
        exactResultLookupAvailable: false,
        coverageGapClass,
        coverageGapReasons,
        coverageGapEvidence,
        pregameIdentityProvenance,
        fuzzyMatchingUsed: false,
      };
    }
  }

  return {
    closeClass: "ACTIVE_RESULT_PENDING",
    exactResultLookupAvailable,
    coverageGapClass: null,
    coverageGapReasons: ["TERMINAL_GAP_ELIGIBILITY_NOT_SATISFIED"],
    coverageGapEvidence: [],
    pregameIdentityProvenance,
    fuzzyMatchingUsed: false,
  };
}

export function attachStageECloseV2(
  games: Array<
    Omit<
      DailyStageEGameRowV1,
      | "closeClass"
      | "exactResultLookupAvailable"
      | "coverageGapClass"
      | "coverageGapReasons"
      | "coverageGapEvidence"
      | "pregameIdentityProvenance"
      | "fuzzyMatchingUsed"
    >
  >,
  cByOperatorId: Map<string, StageECgame>,
  ctx: StageETerminalGapContext,
): DailyStageEGameRowV1[] {
  return games.map((observation) => {
    const cGame = cByOperatorId.get(observation.operatorGameId);
    if (!cGame) {
      throw new Error(`STAGE_E_C_ROW_MISSING: ${observation.operatorGameId}`);
    }
    return {
      ...observation,
      ...classifyStageECloseV2({ observation, cGame, ctx }),
    };
  });
}

export function deriveDailyStageEStatusFromCloseClasses(
  games: DailyStageEGameRowV1[],
): "CANDIDATE_COMPLETE" | "PARTIAL" {
  const activePendingCount = games.filter((g) => g.closeClass === "ACTIVE_RESULT_PENDING").length;
  const operationallyClosedCount = games.filter((g) => g.closeClass !== "ACTIVE_RESULT_PENDING")
    .length;
  return activePendingCount === 0 && operationallyClosedCount === games.length
    ? "CANDIDATE_COMPLETE"
    : "PARTIAL";
}

export function deriveDailyStageEStageResult(
  games: DailyStageEGameRowV1[],
): DailyStageEStageResult {
  const eStatus = deriveDailyStageEStatusFromCloseClasses(games);
  const gapCount = games.filter((g) => g.coverageGapClass != null).length;
  const finalCount = games.filter((g) => g.resultState === "FINAL").length;
  if (eStatus === "PARTIAL") return "PARTIAL_ACTIVE_RESULT_PENDING";
  if (gapCount > 0) return "COMPLETED_WITH_RESULT_COVERAGE_GAPS_AND_NOT_GRADABLE";
  if (finalCount === games.length) return "COMPLETED_ALL_FINAL_NOT_GRADABLE";
  return "COMPLETED_WITH_RESULT_COVERAGE_GAPS_AND_NOT_GRADABLE";
}
