/**
 * Pregame usability / gate evaluation — separates artifact presence from usability.
 */
import { asNumber, asRecord, asString } from "../mlb-review-utils";
import type { DatasetAudit, ScheduleAudit } from "./audit-artifacts";

export type ArtifactUsability =
  | "DATA_COMPLETE"
  | "DATA_PARTIAL"
  | "DATA_MISSING"
  | "ARTIFACT_PRESENT_UNUSABLE"
  | "INTEGRITY_FAILED"
  | "CUTOFF_BLOCKED";

export type OddsUsability = {
  usability: ArtifactUsability;
  collectedGames: number;
  scheduleGames: number;
  reasonCodes: string[];
};

export type StarterUsability = {
  usability: ArtifactUsability;
  bothSidesReady: number;
  scheduleGames: number;
  reasonCodes: string[];
  builderExitCode: number | null;
};

export type CutoffGate = {
  blocked: boolean;
  reasonCodes: string[];
  gamesAfterStart: number;
  totalActive: number;
  earliestStart: string | null;
  latestStart: string | null;
  asOf: string;
};

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function evaluateOddsUsability(
  odds: DatasetAudit,
  scheduleGameCount: number,
): OddsUsability {
  if (!odds.exists) {
    return {
      usability: "DATA_MISSING",
      collectedGames: 0,
      scheduleGames: scheduleGameCount,
      reasonCodes: ["ODDS_ARTIFACT_MISSING"],
    };
  }
  const collected = odds.collectedGames;
  const moneyline = asNumber(odds.detail.moneylineCompleteGames) ?? 0;
  if (collected === 0 && moneyline === 0) {
    return {
      usability: "ARTIFACT_PRESENT_UNUSABLE",
      collectedGames: 0,
      scheduleGames: scheduleGameCount,
      reasonCodes: ["ODDS_MISSING_ALL", "ARTIFACT_EXISTS_NOT_COMPLETE"],
    };
  }
  if (collected < scheduleGameCount || moneyline < scheduleGameCount) {
    return {
      usability: "DATA_PARTIAL",
      collectedGames: collected,
      scheduleGames: scheduleGameCount,
      reasonCodes: ["ODDS_PARTIAL_SLATE"],
    };
  }
  return {
    usability: "DATA_COMPLETE",
    collectedGames: collected,
    scheduleGames: scheduleGameCount,
    reasonCodes: [],
  };
}

export function evaluateStarterUsability(input: {
  starter: DatasetAudit;
  scheduleGameCount: number;
  dailySummary?: unknown;
}): StarterUsability {
  const { starter, scheduleGameCount } = input;
  if (!starter.exists) {
    return {
      usability: "DATA_MISSING",
      bothSidesReady: 0,
      scheduleGames: scheduleGameCount,
      reasonCodes: ["STARTER_ARTIFACT_MISSING"],
      builderExitCode: null,
    };
  }
  const bothSides = asNumber(starter.detail.bothSidesReady) ?? 0;
  const reasons: string[] = [];
  let builderExitCode: number | null = null;

  const summary = asRecord(input.dailySummary);
  const steps = asArr(summary?.steps);
  for (const step of steps) {
    const rec = asRecord(step);
    if ((asString(rec?.step) ?? "").toLowerCase() !== "starter") continue;
    builderExitCode = asNumber(rec?.exitCode);
    const run = (asString(rec?.run) ?? "").toUpperCase();
    if (builderExitCode != null && builderExitCode !== 0) {
      reasons.push("STARTER_BUILDER_EXIT_NONZERO");
    }
    if (run === "FAIL") reasons.push("STARTER_SUMMARY_RUN_FAIL");
    const detail = asString(rec?.detail) ?? "";
    if (/hash/i.test(detail) || /exit 1/i.test(detail)) {
      reasons.push("STARTER_INTEGRITY_SIGNAL");
    }
  }

  if ((asNumber(starter.detail.cutoffViolations) ?? 0) > 0) {
    reasons.push("STARTER_CUTOFF_VIOLATIONS");
  }
  if (starter.warnings.includes("STARTER_TARGET_GAME_IN_STATS")) {
    reasons.push("STARTER_TARGET_GAME_IN_STATS");
  }

  if (reasons.some((r) => r.startsWith("STARTER_BUILDER") || r.includes("INTEGRITY") || r.includes("RUN_FAIL"))) {
    return {
      usability: "INTEGRITY_FAILED",
      bothSidesReady: bothSides,
      scheduleGames: scheduleGameCount,
      reasonCodes: [...new Set(reasons)],
      builderExitCode,
    };
  }

  if (bothSides < scheduleGameCount) {
    return {
      usability: "DATA_PARTIAL",
      bothSidesReady: bothSides,
      scheduleGames: scheduleGameCount,
      reasonCodes: [...new Set(["STARTER_PARTIAL_SIDES", ...reasons])],
      builderExitCode,
    };
  }

  return {
    usability: reasons.length ? "DATA_PARTIAL" : "DATA_COMPLETE",
    bothSidesReady: bothSides,
    scheduleGames: scheduleGameCount,
    reasonCodes: [...new Set(reasons)],
    builderExitCode,
  };
}

export function evaluateCutoffGate(input: {
  schedule: ScheduleAudit;
  asOfIso: string;
  gameIds?: string[];
}): CutoffGate {
  const asOfMs = Date.parse(input.asOfIso);
  const active = input.schedule.games.filter((g) => {
    const st = g.status.toUpperCase();
    if (st.includes("CANCEL") || st.includes("POSTPON")) return false;
    if (input.gameIds?.length && !input.gameIds.includes(g.gameId)) return false;
    return true;
  });
  let gamesAfterStart = 0;
  const starts: string[] = [];
  for (const g of active) {
    if (g.commenceTimeUtc) starts.push(g.commenceTimeUtc);
    if (
      g.commenceTimeUtc &&
      Number.isFinite(asOfMs) &&
      Number.isFinite(Date.parse(g.commenceTimeUtc)) &&
      asOfMs >= Date.parse(g.commenceTimeUtc)
    ) {
      gamesAfterStart += 1;
    }
  }
  starts.sort();
  const blocked = active.length > 0 && gamesAfterStart === active.length;
  const reasonCodes: string[] = [];
  if (blocked) reasonCodes.push("ALL_GAMES_AFTER_START");
  else if (gamesAfterStart > 0) reasonCodes.push("SOME_GAMES_AFTER_START");
  return {
    blocked,
    reasonCodes,
    gamesAfterStart,
    totalActive: active.length,
    earliestStart: starts[0] ?? null,
    latestStart: starts[starts.length - 1] ?? null,
    asOf: input.asOfIso,
  };
}

export function stageStatusForUsability(
  usability: ArtifactUsability,
): "ALREADY_COMPLETE" | "PARTIAL" | "BLOCKED" | "WOULD_RUN" {
  switch (usability) {
    case "DATA_COMPLETE":
      return "ALREADY_COMPLETE";
    case "DATA_PARTIAL":
      return "PARTIAL";
    case "ARTIFACT_PRESENT_UNUSABLE":
    case "INTEGRITY_FAILED":
    case "CUTOFF_BLOCKED":
      return "BLOCKED";
    case "DATA_MISSING":
    default:
      return "WOULD_RUN";
  }
}
