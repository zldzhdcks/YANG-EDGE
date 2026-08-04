/**
 * Odds usability — artifact exists ≠ usable.
 */
import { createHash } from "node:crypto";
import { computeOneXTwoDevig } from "./compute-devig-probabilities";
import { joinOddsRowToIdentity } from "./identity-join";
import { validateCollectOnlyRow, validateOneXTwoOddsRow } from "./validate-one-x-two-odds";
import type { FootballMatchIdentity } from "../foundation/types";
import type {
  FootballCollectOnlyOddsRow,
  FootballOddsGateResult,
  FootballOddsUsabilityStatus,
  FootballOneXTwoOddsRow,
} from "./types";

export type ResolveOddsUsabilityInput = {
  /** null = artifact missing */
  overseasRows: FootballOneXTwoOddsRow[] | null;
  domesticRows?: FootballOneXTwoOddsRow[] | null;
  collectOnlyRows?: FootballCollectOnlyOddsRow[] | null;
  /** Identity map by matchId — required for usable join */
  identitiesByMatchId: Map<string, FootballMatchIdentity>;
  /** Expected match count for FULLY_USABLE (optional) */
  expectedMatchCount?: number | null;
};

export type ResolvedOddsRow = {
  row: FootballOneXTwoOddsRow;
  namespace: "OVERSEAS" | "DOMESTIC";
  usable: boolean;
  reasonCodes: string[];
  overround: number | null;
};

export type ResolveOddsUsabilityResult = {
  usability: FootballOddsUsabilityStatus;
  gate: FootballOddsGateResult;
  resolved: ResolvedOddsRow[];
  usableOverseasCount: number;
  usableDomesticCount: number;
  /** Domestic never replaces overseas prior */
  namespacesSeparated: true;
  collectOnlyExcludedFromPrediction: true;
  artifactHash: string;
};

function hashPayload(parts: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(parts), "utf8")
    .digest("hex");
}

function evaluateRow(
  row: FootballOneXTwoOddsRow,
  identitiesByMatchId: Map<string, FootballMatchIdentity>,
): { usable: boolean; reasonCodes: string[]; overround: number | null } {
  const identity = identitiesByMatchId.get(row.matchId);
  if (!identity) {
    return {
      usable: false,
      reasonCodes: ["IDENTITY_MISSING_FOR_MATCH", "IDENTITY_UNRESOLVED"],
      overround: null,
    };
  }

  const join = joinOddsRowToIdentity(row, identity);
  if (!join.ok) {
    return {
      usable: false,
      reasonCodes: join.reasonCodes,
      overround: null,
    };
  }

  const validation = validateOneXTwoOddsRow(row);
  if (!validation.predictionEligible) {
    return {
      usable: false,
      reasonCodes: validation.reasonCodes,
      overround: null,
    };
  }

  const devig = computeOneXTwoDevig({
    homeDecimal: row.homeDecimal!,
    drawDecimal: row.drawDecimal!,
    awayDecimal: row.awayDecimal!,
  });
  if (devig.overroundLevel === "BLOCKED") {
    return {
      usable: false,
      reasonCodes: [...devig.reasonCodes, "OVERROUND_BLOCKED"],
      overround: devig.overround,
    };
  }

  const reasons = [...devig.reasonCodes];
  return {
    usable: true,
    reasonCodes: reasons,
    overround: devig.overround,
  };
}

function plainForUsability(
  u: FootballOddsUsabilityStatus,
  usable: number,
): string {
  switch (u) {
    case "ARTIFACT_MISSING":
      return "축구 1X2 배당 구조는 준비됐지만 실제 배당 데이터는 아직 수집되지 않았습니다.";
    case "ARTIFACT_PRESENT_NO_USABLE_ROWS":
      return "배당 파일은 있으나 사용 가능한 1X2 행이 없어 Prediction에 쓸 수 없습니다.";
    case "PARTIAL_USABLE":
      return `일부 경기만 1X2 배당을 사용할 수 있습니다 (${usable}경기).`;
    case "FULLY_USABLE":
      return `오늘 사용 가능한 1X2 배당 경기 ${usable}건입니다.`;
    case "AFTER_CUTOFF":
      return "킥오프 이후 수집된 배당이라 Pregame 연구에 사용할 수 없습니다.";
    case "IDENTITY_FAILED":
      return "배당과 경기 Identity가 맞지 않아 연결하지 않았습니다.";
    case "INVALID_FORMAT":
      return "배당 형식이 올바르지 않습니다.";
    case "UNSUPPORTED_MARKET":
      return "Prediction 대상이 아닌 시장입니다.";
    default:
      return "축구 배당 상태를 확인할 수 없습니다.";
  }
}

export function resolveFootballOddsUsability(
  input: ResolveOddsUsabilityInput,
): ResolveOddsUsabilityResult {
  const reasons: string[] = [];
  const resolved: ResolvedOddsRow[] = [];

  // Collect-only: validate contract, never count as usable prediction
  for (const c of input.collectOnlyRows ?? []) {
    validateCollectOnlyRow(c);
    reasons.push(`COLLECT_ONLY_EXCLUDED:${c.marketType}`);
  }

  if (input.overseasRows == null && input.domesticRows == null) {
    const usability: FootballOddsUsabilityStatus = "ARTIFACT_MISSING";
    const gate: FootballOddsGateResult = {
      status: "OFF",
      predictionAllowed: false,
      usableMatches: 0,
      blockedMatches: 0,
      reasons: ["ARTIFACT_MISSING"],
      usability,
      stage: "NOT_STARTED",
      plainLanguage: plainForUsability(usability, 0),
      progressPercent: null,
    };
    return {
      usability,
      gate,
      resolved,
      usableOverseasCount: 0,
      usableDomesticCount: 0,
      namespacesSeparated: true,
      collectOnlyExcludedFromPrediction: true,
      artifactHash: hashPayload({ v: 1, empty: true }),
    };
  }

  const overseas = input.overseasRows ?? [];
  const domestic = input.domesticRows ?? [];

  // Namespace separation: process independently; never overwrite
  let usableOverseas = 0;
  let usableDomestic = 0;
  let identityFailed = 0;
  let afterCutoff = 0;
  let invalidFormat = 0;
  let unsupported = 0;

  for (const row of overseas) {
    const ev = evaluateRow(row, input.identitiesByMatchId);
    if (ev.usable) usableOverseas += 1;
    if (ev.reasonCodes.includes("IDENTITY_UNRESOLVED")) identityFailed += 1;
    if (ev.reasonCodes.includes("CAPTURED_AFTER_OR_AT_KICKOFF")) afterCutoff += 1;
    if (ev.reasonCodes.includes("INVALID_FORMAT")) invalidFormat += 1;
    if (ev.reasonCodes.includes("UNSUPPORTED_MARKET")) unsupported += 1;
    resolved.push({
      row,
      namespace: "OVERSEAS",
      usable: ev.usable,
      reasonCodes: ev.reasonCodes,
      overround: ev.overround,
    });
  }

  for (const row of domestic) {
    const ev = evaluateRow(row, input.identitiesByMatchId);
    // Domestic is research-comparable but does NOT grant overseas prior replacement.
    // For Prediction eligibility in foundation: only OVERSEAS usable counts toward predictionAllowed.
    if (ev.usable) usableDomestic += 1;
    if (ev.reasonCodes.includes("IDENTITY_UNRESOLVED")) identityFailed += 1;
    resolved.push({
      row,
      namespace: "DOMESTIC",
      usable: ev.usable,
      reasonCodes: [...ev.reasonCodes, "DOMESTIC_NOT_OVERSEAS_PRIOR"],
      overround: ev.overround,
    });
  }

  const usableMatches = usableOverseas; // Prediction path: overseas only
  const totalRows = overseas.length + domestic.length;
  const blockedMatches = Math.max(0, overseas.length - usableOverseas);

  let usability: FootballOddsUsabilityStatus;
  if (totalRows === 0) {
    usability = "ARTIFACT_PRESENT_NO_USABLE_ROWS";
    reasons.push("ARTIFACT_PRESENT_EMPTY_ROWS");
  } else if (unsupported > 0 && usableMatches === 0) {
    usability = "UNSUPPORTED_MARKET";
  } else if (invalidFormat > 0 && usableMatches === 0) {
    usability = "INVALID_FORMAT";
  } else if (identityFailed > 0 && usableMatches === 0) {
    usability = "IDENTITY_FAILED";
  } else if (afterCutoff > 0 && usableMatches === 0) {
    usability = "AFTER_CUTOFF";
  } else if (usableMatches === 0) {
    usability = "ARTIFACT_PRESENT_NO_USABLE_ROWS";
    reasons.push("NO_USABLE_1X2_ROWS");
  } else if (
    input.expectedMatchCount != null &&
    usableMatches >= input.expectedMatchCount &&
    input.expectedMatchCount > 0
  ) {
    usability = "FULLY_USABLE";
  } else if (usableMatches > 0 && blockedMatches === 0 && overseas.length === usableMatches) {
    usability = "FULLY_USABLE";
  } else {
    usability = "PARTIAL_USABLE";
  }

  reasons.push(`USABLE_OVERSEAS=${usableOverseas}`);
  reasons.push(`USABLE_DOMESTIC=${usableDomestic}`);
  reasons.push("NAMESPACES_SEPARATED");
  reasons.push("DOMESTIC_DOES_NOT_REPLACE_OVERSEAS_PRIOR");

  const predictionAllowed =
    usableMatches > 0 &&
    (usability === "FULLY_USABLE" || usability === "PARTIAL_USABLE");

  let status: FootballOddsGateResult["status"];
  let stage: FootballOddsGateResult["stage"];
  if (
    usability === "ARTIFACT_PRESENT_NO_USABLE_ROWS" ||
    usability === "IDENTITY_FAILED" ||
    usability === "AFTER_CUTOFF" ||
    usability === "INVALID_FORMAT" ||
    usability === "UNSUPPORTED_MARKET"
  ) {
    status = "BLOCKED";
    stage = "BLOCKED";
  } else if (usability === "PARTIAL_USABLE") {
    status = "WARNING";
    stage = "PARTIAL";
  } else {
    status = "READY";
    stage = "READY";
  }

  const gate: FootballOddsGateResult = {
    status,
    predictionAllowed: predictionAllowed && status !== "BLOCKED",
    usableMatches,
    blockedMatches,
    reasons: [...reasons, ...resolved.flatMap((r) => r.reasonCodes)].slice(0, 40),
    usability,
    stage,
    plainLanguage: plainForUsability(usability, usableMatches),
    progressPercent: null,
  };

  return {
    usability,
    gate,
    resolved,
    usableOverseasCount: usableOverseas,
    usableDomesticCount: usableDomestic,
    namespacesSeparated: true,
    collectOnlyExcludedFromPrediction: true,
    artifactHash: hashPayload({
      overseas: overseas.map((r) => ({
        matchId: r.matchId,
        identityHash: r.identityHash,
        h: r.homeDecimal,
        d: r.drawDecimal,
        a: r.awayDecimal,
        capturedAt: r.capturedAt,
        ns: r.sourceNamespace,
      })),
      domestic: domestic.map((r) => ({
        matchId: r.matchId,
        identityHash: r.identityHash,
        h: r.homeDecimal,
        d: r.drawDecimal,
        a: r.awayDecimal,
        capturedAt: r.capturedAt,
        ns: r.sourceNamespace,
      })),
    }),
  };
}
