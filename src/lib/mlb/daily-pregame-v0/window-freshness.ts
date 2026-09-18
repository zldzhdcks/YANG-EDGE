/**
 * MLB Daily Ops window + freshness contract v1.
 *
 * Controls COLLECTION only. Consumer gates still own PREDICTION eligibility.
 * Freshness is operations/scheduler window-entry, not an Engine threshold.
 */
import { isMlbOpsWindowFresh, mlbOpsWindowEnteredAtMs } from "@/lib/scheduler/windows";
import type { LineupSlateClass } from "./audit-artifacts";
import type {
  CollectionDecisionCode,
  MlbDailyOpsWindow,
} from "./types";
import { MLB_DAILY_OPS_WINDOWS } from "./types";

export type MlbDailyCollectDataset = "SCHEDULE" | "STARTER" | "ODDS" | "LINEUP";

export type MlbCollectionDecision = {
  dataset: MlbDailyCollectDataset;
  /** Policy wants a collector run (missing collect or refresh). */
  spawnRequested: boolean;
  /**
   * Collector may actually spawn. Refresh with unknown quota is requested
   * but not spawned (QUOTA_DECISION_EXTERNAL). First-collect missing still
   * allowed at policy level; caller honors noProvider/dryRun.
   */
  spawnAllowed: boolean;
  action: "SKIP" | "COLLECT" | "REFRESH" | "BLOCK";
  code: CollectionDecisionCode;
  /** ARTIFACT_EXISTS */
  exists: boolean;
  /** ARTIFACT_FRESH — null when existence-only skip (T90) or N/A */
  fresh: boolean | null;
  providerPolicy: "NONE" | "PROVIDER_REQUIRED" | "QUOTA_DECISION_EXTERNAL";
  notes: string[];
};

export function parseMlbDailyOpsWindow(raw: string): MlbDailyOpsWindow {
  const v = raw.trim().toUpperCase();
  if ((MLB_DAILY_OPS_WINDOWS as readonly string[]).includes(v)) {
    return v as MlbDailyOpsWindow;
  }
  throw new Error(
    `Invalid --window ${raw}. Expected T90|T60|T45|T30|LOCK`,
  );
}

export function isMlbDailyOpsWindow(
  v: string | null | undefined,
): v is MlbDailyOpsWindow {
  return (
    typeof v === "string" &&
    (MLB_DAILY_OPS_WINDOWS as readonly string[]).includes(v)
  );
}

export function windowAllowsPredictionPersist(
  window: MlbDailyOpsWindow | null | undefined,
): boolean {
  if (window == null) return true;
  return window === "LOCK";
}

export function windowForbidsCollectorSpawn(
  window: MlbDailyOpsWindow | null | undefined,
): boolean {
  return window === "LOCK";
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

export function observationIsWindowFresh(input: {
  observedAtIso: string | null | undefined;
  earliestStartIso: string | null | undefined;
  window: MlbDailyOpsWindow;
}): boolean {
  return isMlbOpsWindowFresh({
    observedAtMs: parseMs(input.observedAtIso ?? null),
    scheduledStartIso: input.earliestStartIso ?? null,
    window: input.window,
  });
}

function refreshProviderPolicy(input: {
  quotaRemaining: number | null;
}): Pick<MlbCollectionDecision, "spawnAllowed" | "providerPolicy"> {
  if (input.quotaRemaining == null) {
    return {
      spawnAllowed: false,
      providerPolicy: "QUOTA_DECISION_EXTERNAL",
    };
  }
  if (input.quotaRemaining <= 0) {
    return {
      spawnAllowed: false,
      providerPolicy: "QUOTA_DECISION_EXTERNAL",
    };
  }
  return { spawnAllowed: true, providerPolicy: "NONE" };
}

function base(
  dataset: MlbDailyCollectDataset,
  exists: boolean,
  extra: Omit<MlbCollectionDecision, "dataset" | "exists">,
): MlbCollectionDecision {
  return { dataset, exists, ...extra };
}

/**
 * Legacy (no `--window`): artifact exists → skip spawn; missing → collect.
 * Does not distinguish FRESH vs EXISTS.
 */
export function decideLegacyCollection(input: {
  dataset: MlbDailyCollectDataset;
  exists: boolean;
  scheduleDateValid?: boolean;
}): MlbCollectionDecision {
  const exists =
    input.dataset === "SCHEDULE"
      ? input.exists && input.scheduleDateValid !== false
      : input.exists;
  if (exists) {
    return base(input.dataset, true, {
      spawnRequested: false,
      spawnAllowed: false,
      action: "SKIP",
      code: "SKIP_EXISTS",
      fresh: null,
      providerPolicy: "NONE",
      notes: ["LEGACY_ARTIFACT_EXISTS"],
    });
  }
  return base(input.dataset, false, {
    spawnRequested: true,
    spawnAllowed: true,
    action: "COLLECT",
    code: "COLLECT_MISSING",
    fresh: null,
    providerPolicy: "NONE",
    notes: ["LEGACY_ARTIFACT_MISSING"],
  });
}

export function decideMlbDailyCollection(input: {
  window: MlbDailyOpsWindow | null | undefined;
  dataset: MlbDailyCollectDataset;
  exists: boolean;
  scheduleDateValid?: boolean;
  observedAtIso?: string | null;
  earliestStartIso?: string | null;
  cutoffBlocked?: boolean;
  lineupClass?: LineupSlateClass;
  quotaRemaining?: number | null;
}): MlbCollectionDecision {
  const window = input.window ?? null;
  if (window == null) {
    return decideLegacyCollection({
      dataset: input.dataset,
      exists: input.exists,
      scheduleDateValid: input.scheduleDateValid,
    });
  }

  const quotaRemaining = input.quotaRemaining ?? null;
  const cutoffBlocked = Boolean(input.cutoffBlocked);
  const scheduleOk =
    input.dataset !== "SCHEDULE" || input.scheduleDateValid !== false;
  const exists =
    input.dataset === "SCHEDULE" ? input.exists && scheduleOk : input.exists;

  if (window === "LOCK") {
    return base(input.dataset, exists, {
      spawnRequested: false,
      spawnAllowed: false,
      action: "BLOCK",
      code: cutoffBlocked ? "BLOCKED_AFTER_START" : "BLOCKED_LOCK_WINDOW",
      fresh: null,
      providerPolicy: "NONE",
      notes: ["LOCK_IS_FREEZE_NOT_COLLECTION"],
    });
  }

  if (cutoffBlocked) {
    return base(input.dataset, exists, {
      spawnRequested: false,
      spawnAllowed: false,
      action: "BLOCK",
      code: "BLOCKED_AFTER_START",
      fresh: null,
      providerPolicy: "NONE",
      notes: ["EXISTING_CUTOFF_POLICY"],
    });
  }

  if (input.dataset === "SCHEDULE") {
    if (exists) {
      return base("SCHEDULE", true, {
        spawnRequested: false,
        spawnAllowed: false,
        action: "SKIP",
        code: "SKIP_EXISTS",
        fresh: null,
        providerPolicy: "NONE",
        notes: [],
      });
    }
    return base("SCHEDULE", false, {
      spawnRequested: true,
      spawnAllowed: true,
      action: "COLLECT",
      code: "COLLECT_MISSING",
      fresh: null,
      providerPolicy: "NONE",
      notes: [],
    });
  }

  if (input.dataset === "STARTER") {
    if (exists) {
      return base("STARTER", true, {
        spawnRequested: false,
        spawnAllowed: false,
        action: "SKIP",
        code: "PRESERVE_EXISTING",
        fresh: null,
        providerPolicy: "NONE",
        notes: ["STARTER_IMMUTABLE_V1_NO_UNLINK"],
      });
    }
    return base("STARTER", false, {
      spawnRequested: true,
      spawnAllowed: true,
      action: "COLLECT",
      code: "COLLECT_MISSING",
      fresh: null,
      providerPolicy: "NONE",
      notes: ["STARTER_MISSING_PREGAME"],
    });
  }

  if (input.dataset === "ODDS") {
    if (!exists) {
      return base("ODDS", false, {
        spawnRequested: true,
        spawnAllowed: true,
        action: "COLLECT",
        code: "COLLECT_MISSING",
        fresh: false,
        providerPolicy: "NONE",
        notes: [],
      });
    }
    if (window === "T90" || window === "T45") {
      return base("ODDS", true, {
        spawnRequested: false,
        spawnAllowed: false,
        action: "SKIP",
        code: "SKIP_EXISTS",
        fresh: null,
        providerPolicy: "NONE",
        notes: window === "T45" ? ["T45_ODDS_EXISTING_SKIP"] : ["T90_ODDS_EXISTING_SKIP"],
      });
    }
    // T60 / T30: refresh only if not fresh for this window.
    const fresh = observationIsWindowFresh({
      observedAtIso: input.observedAtIso,
      earliestStartIso: input.earliestStartIso,
      window,
    });
    if (fresh) {
      return base("ODDS", true, {
        spawnRequested: false,
        spawnAllowed: false,
        action: "SKIP",
        code: "SKIP_FRESH",
        fresh: true,
        providerPolicy: "NONE",
        notes: [`ODDS_FRESH_FOR_${window}`],
      });
    }
    const provider = refreshProviderPolicy({ quotaRemaining });
    return base("ODDS", true, {
      spawnRequested: true,
      spawnAllowed: provider.spawnAllowed,
      action: "REFRESH",
      code: "REFRESH_STALE",
      fresh: false,
      providerPolicy: provider.providerPolicy,
      notes: ["ODDS_OBSERVATION_BEFORE_WINDOW_ENTRY"],
    });
  }

  // LINEUP
  if (!exists) {
    return base("LINEUP", false, {
      spawnRequested: true,
      spawnAllowed: true,
      action: "COLLECT",
      code: "COLLECT_MISSING",
      fresh: false,
      providerPolicy: "NONE",
      notes: [],
    });
  }

  if (window === "T90" || window === "T60") {
    return base("LINEUP", true, {
      spawnRequested: false,
      spawnAllowed: false,
      action: "SKIP",
      code: "SKIP_EXISTS",
      fresh: null,
      providerPolicy: "NONE",
      notes: [`${window}_LINEUP_EXISTING_SKIP`],
    });
  }

  // T45 / T30 — lineup refresh is StatsAPI research cache, not Odds quota.
  const lineupClass = input.lineupClass ?? "NOT_COLLECTED";
  if (lineupClass === "PARTIAL") {
    return base("LINEUP", true, {
      spawnRequested: true,
      spawnAllowed: true,
      action: "REFRESH",
      code: "REFRESH_PARTIAL",
      fresh: false,
      providerPolicy: "NONE",
      notes: ["LINEUP_PARTIAL"],
    });
  }
  if (lineupClass === "NOT_RELEASED" || lineupClass === "NOT_COLLECTED") {
    return base("LINEUP", true, {
      spawnRequested: true,
      spawnAllowed: true,
      action: "REFRESH",
      code: "REFRESH_NOT_RELEASED",
      fresh: false,
      providerPolicy: "NONE",
      notes: ["LINEUP_NOT_RELEASED_OR_NOT_COLLECTED"],
    });
  }

  const fresh = observationIsWindowFresh({
    observedAtIso: input.observedAtIso,
    earliestStartIso: input.earliestStartIso,
    window,
  });
  if (fresh) {
    return base("LINEUP", true, {
      spawnRequested: false,
      spawnAllowed: false,
      action: "SKIP",
      code: "SKIP_FRESH",
      fresh: true,
      providerPolicy: "NONE",
      notes: ["LINEUP_CONFIRMED_COMPLETE_FRESH"],
    });
  }
  return base("LINEUP", true, {
    spawnRequested: true,
    spawnAllowed: true,
    action: "REFRESH",
    code: "REFRESH_STALE",
    fresh: false,
    providerPolicy: "NONE",
    notes: ["LINEUP_CONFIRMED_COMPLETE_BEFORE_WINDOW_ENTRY"],
  });
}

export function decidePredictionPersist(input: {
  window: MlbDailyOpsWindow | null | undefined;
  predictionExists: boolean;
  cutoffBlocked: boolean;
}): {
  persist: boolean;
  code: CollectionDecisionCode | "ELIGIBLE";
} {
  const window = input.window ?? null;
  if (window != null && window !== "LOCK") {
    return { persist: false, code: "NON_LOCK_WINDOW_NO_PREDICTION" };
  }
  if (input.cutoffBlocked) {
    return { persist: false, code: "BLOCKED_AFTER_START" };
  }
  if (window === "LOCK" && input.predictionExists) {
    return { persist: false, code: "ALREADY_LOCKED" };
  }
  return { persist: true, code: "ELIGIBLE" };
}

export function parseMlbDailyOpsQuotaRemaining(raw: string): number {
  const v = raw.trim();
  if (!/^(0|[1-9]\d*)$/.test(v)) {
    throw new Error(
      `Invalid --quota-remaining ${raw}. Expected non-negative integer.`,
    );
  }
  return Number(v);
}

export function mlbOddsCacheFreshSinceIso(input: {
  window: MlbDailyOpsWindow | null | undefined;
  earliestStartIso: string | null | undefined;
}): string | null {
  const window = input.window ?? null;
  if (window !== "T60" && window !== "T30") return null;
  if (!input.earliestStartIso) return null;
  const entered = mlbOpsWindowEnteredAtMs(input.earliestStartIso, window);
  if (entered == null) return null;
  return new Date(entered).toISOString();
}

export type MlbWindowRunOutcome =
  | "SUCCESS"
  | "ACTION_REQUIRED"
  | "BLOCKED"
  | "FAILED";

const COLLECTOR_STAGES = new Set(["SCHEDULE", "STARTER", "ODDS", "LINEUP"]);

/**
 * Collection-window run result. Does not require a Prediction snapshot.
 */
export function evaluateCollectionWindowRun(pregame: {
  stages: Array<{
    stage: string;
    status: string;
    blockers: string[];
    errorCode?: string | null;
    detail?: Record<string, unknown>;
  }>;
  blockingIssues: string[];
}): {
  outcome: MlbWindowRunOutcome;
  reason: string | null;
  stage: string | null;
  nextAction: string | null;
} {
  const afterStart =
    pregame.blockingIssues.includes("BLOCKED_AFTER_START") ||
    pregame.stages.some(
      (s) =>
        s.blockers.includes("BLOCKED_AFTER_START") ||
        s.detail?.collectionDecision === "BLOCKED_AFTER_START",
    );
  if (afterStart) {
    return {
      outcome: "BLOCKED",
      reason: "BLOCKED_AFTER_START",
      stage: "PREDICTION_V0",
      nextAction: "WAIT_NEXT_SLATE_BEFORE_COMMENCE",
    };
  }

  for (const s of pregame.stages) {
    if (!COLLECTOR_STAGES.has(s.stage)) continue;
    if (s.status === "FAILED") {
      return {
        outcome: "FAILED",
        reason: s.errorCode ?? "COLLECTOR_FAILED",
        stage: s.stage,
        nextAction: "INSPECT_PREGAME_REPORT",
      };
    }
  }

  for (const s of pregame.stages) {
    if (!COLLECTOR_STAGES.has(s.stage)) continue;
    const d = s.detail ?? {};
    const spawnRequested = d.spawnRequested === true;
    const spawned = s.status === "SUCCESS" || s.status === "PARTIAL";
    if (!spawnRequested || spawned) continue;

    const policy = String(d.providerPolicy ?? "");
    const decision = String(d.collectionDecision ?? "");
    if (policy === "QUOTA_DECISION_EXTERNAL") {
      return {
        outcome: "ACTION_REQUIRED",
        reason: "QUOTA_DECISION_EXTERNAL",
        stage: s.stage,
        nextAction: "SUPPLY_QUOTA_REMAINING_THEN_RERUN",
      };
    }
    if (policy === "PROVIDER_REQUIRED") {
      return {
        outcome: "ACTION_REQUIRED",
        reason: "PROVIDER_REQUIRED",
        stage: s.stage,
        nextAction: "RERUN_WITH_PROVIDER_AND_QUOTA",
      };
    }
    if (
      decision === "COLLECT_MISSING" ||
      decision === "REFRESH_STALE" ||
      decision === "REFRESH_PARTIAL" ||
      decision === "REFRESH_NOT_RELEASED"
    ) {
      return {
        outcome: "ACTION_REQUIRED",
        reason: decision,
        stage: s.stage,
        nextAction: "COMPLETE_WINDOW_COLLECTION",
      };
    }
  }

  return {
    outcome: "SUCCESS",
    reason: null,
    stage: null,
    nextAction: null,
  };
}
