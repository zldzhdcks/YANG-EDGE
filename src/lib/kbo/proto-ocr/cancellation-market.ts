/**
 * Detect cancellation / postponement / void-display signals and unsupported markets.
 * Draft only — never auto-confirms Schedule status or saves void 1.00 prices.
 */

export type CancellationSuspectStatus =
  | "NONE"
  | "CANCELLATION_SUSPECTED"
  | "POSTPONEMENT_SUSPECTED"
  | "VOID_DISPLAY_VALUE_SUSPECTED";

export type DetectedMarketKind =
  | "MONEYLINE_2WAY"
  | "WIN_DRAW_WIN"
  | "HANDICAP"
  | "UNDER_OVER"
  | "SUM"
  | "FIRST_HALF"
  | "UNKNOWN";

export type CancellationMarketSignals = {
  cancellationStatus: CancellationSuspectStatus;
  marketKind: DetectedMarketKind;
  saveAllowed: boolean;
  warnings: string[];
};

const CANCEL_RE = /경기\s*취소|취소(?!\s*수수)/;
const POSTPONE_RE = /연기|순연/;
const VOID_PAIR_RE = /\b1[.,]00\b[\s/|:~-]*\b1[.,]00\b/;
const VOID_PRICE_RE = /\b1[.,]00\b/g;

function hasVoidDisplayPair(text: string): boolean {
  if (VOID_PAIR_RE.test(text)) return true;
  const hits = text.match(VOID_PRICE_RE);
  return (hits?.length ?? 0) >= 2;
}

export function detectCancellationSignals(text: string): CancellationSuspectStatus {
  const t = text.replace(/\u00a0/g, " ");
  const hasCancel = CANCEL_RE.test(t);
  const hasPostpone = POSTPONE_RE.test(t);
  const hasVoidPair = hasVoidDisplayPair(t);

  if (hasCancel) return "CANCELLATION_SUSPECTED";
  if (hasPostpone) return "POSTPONEMENT_SUSPECTED";
  if (hasVoidPair) return "VOID_DISPLAY_VALUE_SUSPECTED";
  return "NONE";
}

export function detectMarketKind(text: string): DetectedMarketKind {
  const t = text.replace(/\u00a0/g, " ");
  if (/승1패|승무패/.test(t)) return "WIN_DRAW_WIN";
  if (/핸디|handicap|핸디캡/i.test(t)) return "HANDICAP";
  if (/언더|오버|under|over|U\/O|우\/오/i.test(t)) return "UNDER_OVER";
  if (/\bSUM\b|합계|총득점/i.test(t)) return "SUM";
  if (/전반|1이닝|first\s*half/i.test(t)) return "FIRST_HALF";
  if (/머니|승패|프로토|ML|moneyline|국내\s*프로토/i.test(t)) {
    return "MONEYLINE_2WAY";
  }
  return "UNKNOWN";
}

/**
 * Combine cancellation + market detection for a line/snippet.
 * MONEYLINE_2WAY only may be saved; unsupported markets get DETECTED_UNSUPPORTED_MARKET.
 * Void 1.00/1.00 alone never auto-confirms cancellation.
 */
export function analyzeCancellationAndMarket(
  text: string,
): CancellationMarketSignals {
  const warnings: string[] = [];
  const cancellationStatus = detectCancellationSignals(text);
  let marketKind = detectMarketKind(text);

  if (cancellationStatus === "CANCELLATION_SUSPECTED") {
    warnings.push("CANCELLATION_SUSPECTED");
  } else if (cancellationStatus === "POSTPONEMENT_SUSPECTED") {
    warnings.push("POSTPONEMENT_SUSPECTED");
  } else if (cancellationStatus === "VOID_DISPLAY_VALUE_SUSPECTED") {
    warnings.push("VOID_DISPLAY_VALUE_SUSPECTED");
    warnings.push("VOID_1_00_NOT_AUTO_CANCEL");
  }

  if (marketKind === "UNKNOWN" && cancellationStatus !== "NONE") {
    // cancelled proto rows often omit market label
    marketKind = "MONEYLINE_2WAY";
  }

  const unsupported =
    marketKind !== "MONEYLINE_2WAY" && marketKind !== "UNKNOWN";
  if (unsupported) {
    warnings.push("DETECTED_UNSUPPORTED_MARKET");
    warnings.push(`UNSUPPORTED_MARKET:${marketKind}`);
  }

  if (
    cancellationStatus === "CANCELLATION_SUSPECTED" ||
    cancellationStatus === "POSTPONEMENT_SUSPECTED" ||
    cancellationStatus === "VOID_DISPLAY_VALUE_SUSPECTED"
  ) {
    warnings.push("PROTO_SAVE_BLOCKED_UNTIL_ADMIN_CANCEL_DECISION");
    warnings.push("SCHEDULE_STATUS_NOT_AUTO_UPDATED");
  }

  const resolvedMarket: DetectedMarketKind = unsupported
    ? marketKind
    : marketKind === "UNKNOWN"
      ? "MONEYLINE_2WAY"
      : marketKind;

  const cancelBlocksSave = cancellationStatus !== "NONE";
  const saveAllowed = !unsupported && !cancelBlocksSave;

  return {
    cancellationStatus,
    marketKind: resolvedMarket,
    saveAllowed,
    warnings: [...new Set(warnings)],
  };
}

/** Admin may explicitly ignore cancel suspicion and save moneyline — separate from Schedule revision. */
export type AdminCancellationDecision =
  | "PENDING"
  | "CONFIRM_CANCEL"
  | "CONFIRM_POSTPONE"
  | "OCR_ERROR"
  | "IGNORE";
