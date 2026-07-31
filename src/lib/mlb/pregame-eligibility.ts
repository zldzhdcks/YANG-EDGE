/**
 * Pregame eligibility / hard cutoff helpers (research-only).
 * Used by remaining-pregame runner and fixture tests.
 */

export type PregameEligibilityStatus =
  | "PREGAME_ELIGIBLE"
  | "EXCLUDED_ALREADY_STARTED"
  | "PASS_START_TIME_UNKNOWN"
  | "POSTPONED"
  | "CANCELLED";

export type ClassifyPregameGameInput = {
  commenceTimeUtc: string | null;
  statusAbstract: string | null;
  statusDetailed: string | null;
  codedGameState?: string | null;
  nowMs: number;
};

export function classifyPregameGame(input: ClassifyPregameGameInput): {
  status: PregameEligibilityStatus;
  exclusionReason: string | null;
  pregameEligible: boolean;
} {
  const abstract = (input.statusAbstract ?? "").toLowerCase();
  const detailed = (input.statusDetailed ?? "").toLowerCase();
  const coded = (input.codedGameState ?? "").toLowerCase();

  if (
    /postpon/.test(abstract) ||
    /postpon/.test(detailed) ||
    coded === "d" // postponed coded
  ) {
    return {
      status: "POSTPONED",
      exclusionReason: "schedule status postponed",
      pregameEligible: false,
    };
  }
  if (/cancel/.test(abstract) || /cancel/.test(detailed)) {
    return {
      status: "CANCELLED",
      exclusionReason: "schedule status cancelled",
      pregameEligible: false,
    };
  }

  // Live play / finished — block regardless of clock when detailed/coded says so
  const finished =
    abstract === "final" ||
    /game over|final|completed early/.test(detailed) ||
    coded === "f" ||
    coded === "o";
  if (finished) {
    return {
      status: "EXCLUDED_ALREADY_STARTED",
      exclusionReason: `game finished (${input.statusAbstract}/${input.statusDetailed}/${input.codedGameState ?? ""})`,
      pregameEligible: false,
    };
  }

  // In Progress / challenge — not Warmup/Pre-Game
  if (
    /in progress|manager challenge/.test(detailed) ||
    (abstract === "live" &&
      detailed &&
      !/warmup|pre[- ]?game|scheduled|preview/.test(detailed)) ||
    coded === "i"
  ) {
    return {
      status: "EXCLUDED_ALREADY_STARTED",
      exclusionReason: `live play underway (${input.statusAbstract}/${input.statusDetailed})`,
      pregameEligible: false,
    };
  }

  // Suspended after start — treat as blocked for new official prediction
  if (/suspended/.test(detailed) && abstract === "live") {
    return {
      status: "EXCLUDED_ALREADY_STARTED",
      exclusionReason: `suspended live (${input.statusAbstract}/${input.statusDetailed})`,
      pregameEligible: false,
    };
  }

  if (!input.commenceTimeUtc) {
    return {
      status: "PASS_START_TIME_UNKNOWN",
      exclusionReason: "commenceTimeUtc missing",
      pregameEligible: false,
    };
  }
  const startMs = Date.parse(input.commenceTimeUtc);
  if (!Number.isFinite(startMs)) {
    return {
      status: "PASS_START_TIME_UNKNOWN",
      exclusionReason: "commenceTimeUtc unparseable",
      pregameEligible: false,
    };
  }

  // Hard cutoff: clock past scheduled first pitch
  if (startMs <= input.nowMs) {
    return {
      status: "EXCLUDED_ALREADY_STARTED",
      exclusionReason: `commenceTimeUtc ${input.commenceTimeUtc} <= now`,
      pregameEligible: false,
    };
  }

  // Warmup / Pre-Game / Preview only if still before scheduled start (already checked)
  return {
    status: "PREGAME_ELIGIBLE",
    exclusionReason: null,
    pregameEligible: true,
  };
}
