/**
 * Resolve KBO game operating status for T45 personnel requirements.
 * Avoids unsafe substring matches (e.g. /STARTED/ matching "Not Started").
 */

export type KboGameOperatingStatus =
  | "ACTIVE_PREGAME"
  | "CANCELLED"
  | "POSTPONED"
  | "STARTED"
  | "FINAL"
  | "UNKNOWN";

export type KboGameOperatingStatusInput = {
  statusAbstract?: string | null;
  statusDetailed?: string | null;
  codedGameState?: string | null;
  clockState?: string | null;
  cancellationStatus?: string | null;
  scheduledStartTime?: string | null;
  nowMs?: number;
};

function norm(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function fieldList(input: KboGameOperatingStatusInput): string[] {
  return [
    input.cancellationStatus,
    input.clockState,
    input.statusAbstract,
    input.statusDetailed,
    input.codedGameState,
  ]
    .map(norm)
    .filter(Boolean);
}

function isCancelToken(u: string): boolean {
  if (!u) return false;
  if (u === "CANCELLED" || u === "CANCELED" || u === "CANC") return true;
  if (u.startsWith("CANCELLED ") || u.startsWith("CANCELED ")) return true;
  // "Cancelled - Extreme Heat"
  if (/\bCANCELLED\b|\bCANCELED\b/.test(u) && !/\bNOT\s+CANCELLED\b/.test(u)) {
    return true;
  }
  return false;
}

function isPostponeToken(u: string): boolean {
  if (!u) return false;
  if (u === "POSTPONED" || u === "POSTP" || u === "PST" || u === "POST") return true;
  if (u.startsWith("POSTPONED ")) return true;
  if (/\bPOSTPONED\b/.test(u)) return true;
  return false;
}

function isFinalToken(u: string): boolean {
  if (!u) return false;
  if (u === "FINAL" || u === "FT" || u === "FINISHED" || u === "ENDED") return true;
  if (/\bFINAL\b|\bFINISHED\b/.test(u)) return true;
  return false;
}

function isLiveStartedToken(u: string): boolean {
  if (!u) return false;
  // Explicitly exclude "Not Started" before any STARTED check
  if (/\bNOT\s+STARTED\b/.test(u)) return false;
  if (u === "NS" || u === "NOT STARTED" || u === "SCHEDULED" || u === "PREGAME") {
    return false;
  }
  if (u === "STARTED" || u === "LIVE" || u === "IN PROGRESS" || u === "INPROGRESS") {
    return true;
  }
  if (/\bIN\s*PROGRESS\b/.test(u) || /\bLIVE\b/.test(u)) return true;
  // Whole-word STARTED only (never bare /STARTED/)
  if (/(^|\s)STARTED(\s|$)/.test(u) && !/\bNOT\s+STARTED\b/.test(u)) {
    return true;
  }
  return false;
}

function isPregameToken(u: string): boolean {
  if (!u) return false;
  if (
    u === "NS" ||
    u === "NOT STARTED" ||
    u === "SCHEDULED" ||
    u === "PREGAME" ||
    u === "PREGAME OPEN" ||
    u === "OPEN"
  ) {
    return true;
  }
  if (/\bNOT\s+STARTED\b/.test(u)) return true;
  if (u === "PREGAME OPEN" || u.startsWith("PREGAME")) return true;
  return false;
}

/**
 * Single operating-status resolver for T45 validators / workflow / admin.
 */
export function resolveKboGameOperatingStatus(
  input: KboGameOperatingStatusInput,
): KboGameOperatingStatus {
  const fields = fieldList(input);

  if (fields.some(isCancelToken)) return "CANCELLED";
  if (fields.some(isPostponeToken)) return "POSTPONED";
  if (fields.some(isFinalToken)) return "FINAL";
  if (fields.some(isLiveStartedToken)) return "STARTED";

  if (fields.length === 0) {
    // No status evidence — do not invent ACTIVE from clock alone
    return "UNKNOWN";
  }

  if (fields.some(isPregameToken)) return "ACTIVE_PREGAME";

  // Ambiguous leftover tokens
  return "UNKNOWN";
}

export function personnelRequirementsApplicable(
  status: KboGameOperatingStatus,
): boolean {
  return status === "ACTIVE_PREGAME" || status === "UNKNOWN";
}
