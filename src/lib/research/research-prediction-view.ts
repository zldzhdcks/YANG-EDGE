/**
 * Research Prediction Snapshot view model — display only (no Engine / no mutation).
 */

export type ResearchPredictionOfficialStatus =
  | "ELIGIBLE"
  | "PASS"
  | "BLOCKED"
  | "UNKNOWN";

export type ResearchPredictionPick = "HOME" | "AWAY" | "DRAW" | null;

export type ResearchPredictionDebugStatus =
  | "PASS"
  | "AVAILABLE"
  | "BLOCKED"
  | "FAIL";

export type ResearchPredictionLoadReason =
  | "OK"
  | "PREDICTION_FILE_NOT_FOUND"
  | "GAME_ID_NOT_FOUND"
  | "LEAGUE_NOT_SUPPORTED"
  | "MALFORMED_PREDICTION"
  | "REVISION_ONLY_FOUND";

export type ResearchPredictionView = {
  artifactAvailable: boolean;
  loadReason: ResearchPredictionLoadReason;
  debugStatus: ResearchPredictionDebugStatus;
  debugLabel: string;
  officialStatus: ResearchPredictionOfficialStatus;
  officialPick: ResearchPredictionPick;
  passReasons: string[];
  missingInputs: string[];
  inputWarnings: string[];
  predictedAt: string | null;
  lockedAt: string | null;
  engineVersion: string | null;
  predictionHash: string | null;
  pathRel: string | null;
  runId: string | null;
  researchBaseline: {
    available: boolean;
    researchOnly: boolean;
    pick: string | null;
    confidence: number | null;
  } | null;
};

export function emptyResearchPredictionView(
  reason: ResearchPredictionLoadReason,
): ResearchPredictionView {
  return {
    artifactAvailable: false,
    loadReason: reason,
    debugStatus: "FAIL",
    debugLabel: "Prediction FAIL",
    officialStatus: "UNKNOWN",
    officialPick: null,
    passReasons: [],
    missingInputs: [],
    inputWarnings: [],
    predictedAt: null,
    lockedAt: null,
    engineVersion: null,
    predictionHash: null,
    pathRel: null,
    runId: null,
    researchBaseline: null,
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
}

function normalizeOfficialStatus(v: unknown): ResearchPredictionOfficialStatus {
  const s = asString(v)?.toUpperCase();
  if (s === "ELIGIBLE" || s === "PASS" || s === "BLOCKED") return s;
  return "UNKNOWN";
}

function normalizePick(v: unknown): ResearchPredictionPick {
  const s = asString(v)?.toUpperCase();
  if (s === "HOME" || s === "AWAY" || s === "DRAW") return s;
  return null;
}

export function buildResearchPredictionView(input: {
  pred: Record<string, unknown>;
  pathRel: string;
  runId: string | null;
  predictionHash: string | null;
}): ResearchPredictionView {
  const officialStatus = normalizeOfficialStatus(input.pred.officialStatus);
  // MLB snapshots often omit officialStatus and use baselinePick instead
  const mlbPick =
    asString(input.pred.baselinePick) ?? asString(input.pred.predictedTeam);
  const officialPick =
    normalizePick(input.pred.officialPick) ??
    (mlbPick && !asString(input.pred.officialStatus)
      ? normalizePick(
          mlbPick === "home" || mlbPick.toUpperCase() === "HOME"
            ? "HOME"
            : mlbPick === "away" || mlbPick.toUpperCase() === "AWAY"
              ? "AWAY"
              : null,
        )
      : normalizePick(input.pred.officialPick));

  const passReasons = asStringArray(input.pred.passReasons);
  const missingInputs = asStringArray(input.pred.missingInputs);
  const inputWarnings = asStringArray(input.pred.inputWarnings);

  let debugStatus: ResearchPredictionDebugStatus = "FAIL";
  let debugLabel = "Prediction FAIL";

  if (officialStatus === "ELIGIBLE" && officialPick != null) {
    debugStatus = "AVAILABLE";
    debugLabel = "Prediction AVAILABLE";
  } else if (officialStatus === "BLOCKED") {
    debugStatus = "BLOCKED";
    debugLabel = "Prediction BLOCKED";
  } else if (
    officialStatus === "PASS" &&
    officialPick == null &&
    passReasons.length > 0
  ) {
    debugStatus = "PASS";
    debugLabel = "Prediction Snapshot PASS";
  } else if (
    officialStatus === "PASS" &&
    officialPick == null
  ) {
    debugStatus = "PASS";
    debugLabel = "Prediction Snapshot PASS";
  } else if (!asString(input.pred.officialStatus) && mlbPick) {
    // MLB collected pick snapshot
    debugStatus = "AVAILABLE";
    debugLabel = "Prediction AVAILABLE";
  } else if (!asString(input.pred.officialStatus) && input.pathRel) {
    debugStatus = "PASS";
    debugLabel = "Prediction Snapshot PASS";
  }

  const baselineRaw = asRecord(input.pred.researchBaseline);
  let researchBaseline: ResearchPredictionView["researchBaseline"] = null;
  if (baselineRaw) {
    researchBaseline = {
      available: true,
      researchOnly:
        asString(baselineRaw.researchOnly) === "true" ||
        baselineRaw.researchOnly === true ||
        input.pred.researchOnly === true,
      pick:
        asString(baselineRaw.pick) ??
        asString(baselineRaw.baselinePick) ??
        null,
      confidence: asNumber(baselineRaw.confidence),
    };
  } else if (input.pred.researchBaseline === null) {
    researchBaseline = {
      available: false,
      researchOnly: true,
      pick: null,
      confidence: null,
    };
  }

  return {
    artifactAvailable: true,
    loadReason: "OK",
    debugStatus,
    debugLabel,
    officialStatus:
      officialStatus === "UNKNOWN" && mlbPick ? "ELIGIBLE" : officialStatus,
    officialPick:
      officialPick ??
      (mlbPick && !asString(input.pred.officialStatus) ? null : officialPick),
    passReasons,
    missingInputs,
    inputWarnings,
    predictedAt: asString(input.pred.predictedAt),
    lockedAt: asString(input.pred.lockedAt),
    engineVersion: asString(input.pred.engineVersion),
    predictionHash: input.predictionHash,
    pathRel: input.pathRel,
    runId: input.runId,
    researchBaseline,
  };
}

/** Score points (weight unchanged: max 20). PASS-without-pick does not award points. */
export function researchPredictionScore(view: ResearchPredictionView): {
  score: number;
  status: "OK" | "MISSING" | "PASS_RECORDED" | "BLOCKED" | "NOT_ELIGIBLE";
} {
  if (!view.artifactAvailable) {
    return { score: 0, status: "MISSING" };
  }
  if (view.debugStatus === "AVAILABLE") {
    return { score: 20, status: "OK" };
  }
  if (view.debugStatus === "PASS") {
    return { score: 0, status: "PASS_RECORDED" };
  }
  if (view.debugStatus === "BLOCKED") {
    return { score: 0, status: "BLOCKED" };
  }
  return { score: 0, status: "NOT_ELIGIBLE" };
}
