/**
 * Resolve current pregame stage from clock + game metadata.
 * Hard cutoff beats provider status.
 */

import { DEFAULT_WINDOWS } from "./windows";
import type {
  PregameSchedulerStage,
  SchedulerGameInput,
  StageResolveResult,
  WindowId,
} from "./types";

const LIVE_OR_FINAL = new Set([
  "Live",
  "In Progress",
  "Final",
  "Game Over",
  "Completed",
  "FINAL",
]);

export function secondsUntilStart(
  scheduledStartTime: string,
  now: Date,
): number {
  const startMs = Date.parse(scheduledStartTime);
  if (Number.isNaN(startMs)) {
    throw new Error(`MALFORMED_SCHEDULED_START: ${scheduledStartTime}`);
  }
  return Math.floor((startMs - now.getTime()) / 1000);
}

export function minutesUntilStart(
  scheduledStartTime: string,
  now: Date,
): number {
  return secondsUntilStart(scheduledStartTime, now) / 60;
}

function inWindow(
  minutesUntil: number,
  fromMinutes: number,
  toMinutes: number,
): boolean {
  // from inclusive, to exclusive — except when toMinutes === 0 (LOCK), include 0.
  if (toMinutes === 0) {
    return minutesUntil <= fromMinutes && minutesUntil >= 0;
  }
  return minutesUntil <= fromMinutes && minutesUntil > toMinutes;
}

export function isHardCutoff(
  game: SchedulerGameInput,
  now: Date,
): boolean {
  if (game.pregameLocked || game.lockedPredictionExists) {
    return false; // lock handled separately as ALREADY_LOCKED
  }
  const startMs = Date.parse(game.scheduledStartTime);
  if (!Number.isNaN(startMs) && now.getTime() >= startMs) {
    return true;
  }
  if (game.actualStartTime) {
    const actualMs = Date.parse(game.actualStartTime);
    if (!Number.isNaN(actualMs) && now.getTime() >= actualMs) {
      return true;
    }
  }
  const status = (game.statusAbstract ?? "").trim();
  if (status && LIVE_OR_FINAL.has(status)) {
    const minutes = minutesUntilStart(game.scheduledStartTime, now);
    // Warmup-like labels are not in LIVE_OR_FINAL; if Live but clock still before start, allow LOCK only via window.
    // Spec: game status In Progress / Final / Game Over → hard cutoff.
    if (
      status === "In Progress" ||
      status === "Final" ||
      status === "Game Over" ||
      status === "Completed" ||
      status === "FINAL"
    ) {
      return true;
    }
    // "Live" with clock past start → cutoff; Live before start (warmup broadcast) → allow if still pre-start.
    if (status === "Live" && minutes < 0) {
      return true;
    }
  }
  return false;
}

/**
 * Warmup + start 10 min before → LOCK allowed.
 * Warmup + 1 min after start → BLOCKED.
 * We treat status "Warmup" as non-cutoff while clock is before start.
 */
export function resolveStage(input: {
  game: SchedulerGameInput;
  now: Date;
  forceStage?: PregameSchedulerStage;
}): StageResolveResult {
  const { game, now, forceStage } = input;

  if (game.pregameLocked || game.lockedPredictionExists) {
    // Post-lock: may still surface postgame readiness
    const status = (game.statusAbstract ?? "").trim();
    if (
      status === "Final" ||
      status === "Game Over" ||
      status === "Completed" ||
      status === "FINAL"
    ) {
      return {
        kind: "STAGE",
        stage: "POSTGAME_REVIEW",
        windowId: "POST_START",
        triggerReason: "FINAL_DETECTED",
      };
    }
    if (forceStage && forceStage !== "PREGAME_LOCK") {
      // force cannot bypass lock for pregame stages
      if (
        forceStage === "POSTGAME_COLLECTION" ||
        forceStage === "POSTGAME_REVIEW"
      ) {
        return {
          kind: "STAGE",
          stage: forceStage,
          windowId: "POST_START",
          triggerReason: "FORCE_STAGE",
        };
      }
    }
    return {
      kind: "BLOCKED",
      errorCode: "ALREADY_LOCKED",
      stage: "PREGAME_LOCK",
      triggerReason: "ALREADY_LOCKED",
    };
  }

  if (isHardCutoff(game, now)) {
    return {
      kind: "BLOCKED",
      errorCode: "BLOCKED_AFTER_START",
      stage: "WAITING_FOR_FINAL",
      triggerReason: "HARD_CUTOFF",
    };
  }

  if (forceStage) {
    // forceStage cannot bypass hard cutoff (already checked) or lock (above)
    return {
      kind: "STAGE",
      stage: forceStage,
      windowId: windowForStage(forceStage),
      triggerReason: "FORCE_STAGE",
    };
  }

  const minutes = minutesUntilStart(game.scheduledStartTime, now);

  if (minutes > DEFAULT_WINDOWS.T90.fromMinutes) {
    return {
      kind: "STAGE",
      stage: "SCHEDULE_DISCOVERY",
      windowId: "T90",
      triggerReason: "TIME_WINDOW_ENTERED",
    };
  }
  if (inWindow(minutes, DEFAULT_WINDOWS.T90.fromMinutes, DEFAULT_WINDOWS.T90.toMinutes)) {
    return {
      kind: "STAGE",
      stage: "T90_COLLECTION",
      windowId: "T90",
      triggerReason: "TIME_WINDOW_ENTERED",
    };
  }
  if (inWindow(minutes, DEFAULT_WINDOWS.T60.fromMinutes, DEFAULT_WINDOWS.T60.toMinutes)) {
    return {
      kind: "STAGE",
      stage: "T60_REFRESH",
      windowId: "T60",
      triggerReason: "TIME_WINDOW_ENTERED",
    };
  }
  if (inWindow(minutes, DEFAULT_WINDOWS.T45.fromMinutes, DEFAULT_WINDOWS.T45.toMinutes)) {
    return {
      kind: "STAGE",
      stage: "T45_LINEUP_CHECK",
      windowId: "T45",
      triggerReason: "TIME_WINDOW_ENTERED",
    };
  }
  if (inWindow(minutes, DEFAULT_WINDOWS.T30.fromMinutes, DEFAULT_WINDOWS.T30.toMinutes)) {
    return {
      kind: "STAGE",
      stage: "T30_FINAL_CHECK",
      windowId: "T30",
      triggerReason: "TIME_WINDOW_ENTERED",
    };
  }
  if (inWindow(minutes, DEFAULT_WINDOWS.LOCK.fromMinutes, DEFAULT_WINDOWS.LOCK.toMinutes)) {
    return {
      kind: "STAGE",
      stage: "PREGAME_LOCK",
      windowId: "LOCK",
      triggerReason: "TIME_WINDOW_ENTERED",
    };
  }

  // minutes < 0 should have been hard-cutoff; defensive
  return {
    kind: "BLOCKED",
    errorCode: "BLOCKED_AFTER_START",
    stage: "WAITING_FOR_FINAL",
    triggerReason: "HARD_CUTOFF",
  };
}

function windowForStage(stage: PregameSchedulerStage): WindowId {
  switch (stage) {
    case "SCHEDULE_DISCOVERY":
    case "T90_COLLECTION":
      return "T90";
    case "T60_REFRESH":
      return "T60";
    case "T45_LINEUP_CHECK":
      return "T45";
    case "T30_FINAL_CHECK":
      return "T30";
    case "PREGAME_LOCK":
      return "LOCK";
    default:
      return "POST_START";
  }
}

export function buildLockKey(input: {
  league: string;
  dateKst: string;
  gameId: string;
  stage: PregameSchedulerStage;
}): string {
  return `${input.league}:${input.dateKst}:${input.gameId}:${input.stage}`;
}
