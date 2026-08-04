/**
 * Derive MONEYLINE_3WAY_1X2 from regular time ONLY.
 * Extra time / penalties never change oneXTwoOutcome.
 */
import type {
  FootballAdvancementWinner,
  FootballOneXTwoOutcome,
  FootballResultStatus,
  FootballScorePair,
} from "./types";

export function isFinalStatus(status: FootballResultStatus): boolean {
  return (
    status === "FINAL" ||
    status === "FINAL_AFTER_EXTRA_TIME" ||
    status === "FINAL_AFTER_PENALTIES"
  );
}

export function isNonGradableTerminal(status: FootballResultStatus): boolean {
  return (
    status === "POSTPONED" ||
    status === "CANCELLED" ||
    status === "VOID" ||
    status === "SUSPENDED" ||
    status === "ABANDONED"
  );
}

export function deriveOneXTwoOutcome(input: {
  status: FootballResultStatus;
  regularTime: FootballScorePair;
}): FootballOneXTwoOutcome {
  const { status, regularTime } = input;

  if (status === "VOID") return "VOID";
  if (
    status === "POSTPONED" ||
    status === "CANCELLED" ||
    status === "SUSPENDED" ||
    status === "ABANDONED" ||
    status === "SCHEDULED" ||
    status === "LIVE" ||
    status === "HALFTIME" ||
    status === "UNKNOWN"
  ) {
    return "NOT_FINAL";
  }

  if (!isFinalStatus(status)) return "NOT_FINAL";

  const h = regularTime.home;
  const a = regularTime.away;
  if (
    typeof h !== "number" ||
    typeof a !== "number" ||
    !Number.isInteger(h) ||
    !Number.isInteger(a) ||
    h < 0 ||
    a < 0
  ) {
    return "UNRESOLVED";
  }

  if (h > a) return "HOME";
  if (h < a) return "AWAY";
  return "DRAW";
}

/**
 * Advancement winner priority:
 * Penalties → Extra Time Final → Regular Time Final → Provider explicit → UNRESOLVED
 */
export function deriveAdvancementWinner(input: {
  status: FootballResultStatus;
  regularTime: FootballScorePair;
  extraTime: FootballScorePair;
  penalties: FootballScorePair;
  providerAdvancementWinner?: FootballAdvancementWinner | null;
}): {
  winner: FootballAdvancementWinner;
  reasonCodes: string[];
  conflict: boolean;
} {
  const reasonCodes: string[] = [];
  const { status, regularTime, extraTime, penalties, providerAdvancementWinner } =
    input;

  if (!isFinalStatus(status)) {
    return { winner: "NONE", reasonCodes: ["NOT_FINAL_NO_ADVANCEMENT"], conflict: false };
  }

  let derived: FootballAdvancementWinner = "UNRESOLVED";

  const penH = penalties.home;
  const penA = penalties.away;
  const hasPen =
    typeof penH === "number" &&
    typeof penA === "number" &&
    Number.isInteger(penH) &&
    Number.isInteger(penA);

  if (hasPen) {
    if (penH === penA) {
      reasonCodes.push("PENALTIES_TIE");
      derived = "UNRESOLVED";
    } else {
      derived = penH! > penA! ? "HOME" : "AWAY";
      reasonCodes.push("ADVANCEMENT_FROM_PENALTIES");
    }
  } else if (
    typeof extraTime.home === "number" &&
    typeof extraTime.away === "number" &&
    Number.isInteger(extraTime.home) &&
    Number.isInteger(extraTime.away)
  ) {
    if (extraTime.home === extraTime.away) {
      // ET draw without penalties → unresolved advancement (or NONE for league)
      derived = "NONE";
      reasonCodes.push("ET_DRAW_NO_PENALTIES");
    } else {
      derived = extraTime.home > extraTime.away ? "HOME" : "AWAY";
      reasonCodes.push("ADVANCEMENT_FROM_EXTRA_TIME");
    }
  } else if (
    typeof regularTime.home === "number" &&
    typeof regularTime.away === "number" &&
    Number.isInteger(regularTime.home) &&
    Number.isInteger(regularTime.away)
  ) {
    if (regularTime.home === regularTime.away) {
      derived = "NONE";
      reasonCodes.push("FT_DRAW_NO_ET_PEN");
    } else {
      derived = regularTime.home > regularTime.away ? "HOME" : "AWAY";
      reasonCodes.push("ADVANCEMENT_FROM_REGULAR_TIME");
    }
  } else {
    derived = "UNRESOLVED";
    reasonCodes.push("ADVANCEMENT_UNRESOLVED_SCORES");
  }

  if (
    providerAdvancementWinner &&
    providerAdvancementWinner !== "NONE" &&
    providerAdvancementWinner !== "UNRESOLVED"
  ) {
    if (derived === "UNRESOLVED" || derived === "NONE") {
      derived = providerAdvancementWinner;
      reasonCodes.push("ADVANCEMENT_FROM_PROVIDER");
    } else if (derived !== providerAdvancementWinner) {
      reasonCodes.push("RESULT_CONFLICT");
      return { winner: derived, reasonCodes, conflict: true };
    }
  }

  return { winner: derived, reasonCodes, conflict: false };
}
