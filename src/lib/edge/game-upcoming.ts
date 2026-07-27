import { kstMs } from "@/lib/betting/purchase-window";

const FINISHED_STATUSES = new Set([
  "graded",
  "final",
  "cancelled",
  "postponed",
  "suspended",
  "inconclusive",
]);

const LIVE_STATUSES = new Set(["live", "in_progress", "in progress"]);

export function gameStartMs(dateKst: string, startTimeKst: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) return null;
  if (!/^\d{2}:\d{2}$/.test(startTimeKst)) return null;
  return kstMs(dateKst, startTimeKst);
}

export function isFinishedResultStatus(resultStatus: string): boolean {
  return FINISHED_STATUSES.has(resultStatus.toLowerCase());
}

export function isLiveResultStatus(resultStatus: string): boolean {
  return LIVE_STATUSES.has(resultStatus.toLowerCase());
}

export function isUpcomingGame(input: {
  dateKst: string;
  startTimeKst: string;
  resultStatus: string;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  if (isFinishedResultStatus(input.resultStatus)) return false;

  const startMs = gameStartMs(input.dateKst, input.startTimeKst);
  if (startMs == null) return false;
  return startMs > nowMs;
}

export function upcomingExclusionReason(input: {
  dateKst: string;
  startTimeKst: string;
  resultStatus: string;
  nowMs?: number;
}): string | null {
  const status = input.resultStatus.toLowerCase();
  if (status === "graded" || status === "final") return "GAME_FINISHED";
  if (status === "cancelled") return "GAME_CANCELLED";
  if (status === "postponed") return "GAME_POSTPONED";
  if (status === "suspended") return "GAME_SUSPENDED";
  if (status === "inconclusive") return "GAME_INCONCLUSIVE";

  const startMs = gameStartMs(input.dateKst, input.startTimeKst);
  const nowMs = input.nowMs ?? Date.now();

  if (startMs != null && startMs <= nowMs) {
    if (isLiveResultStatus(status)) return null;
    if (status === "pending" || status === "awaiting_result") {
      return "PREDICTION_PENDING";
    }
    return "GAME_ALREADY_STARTED";
  }

  if (startMs == null) return "START_TIME_UNKNOWN";
  return null;
}
