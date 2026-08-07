import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import type {
  PreGameRiskCode,
  PreGameSignal,
  SignalPolarity,
} from "./types";

function polarityFromComponent(
  v: number | null,
  pickSide: "HOME" | "AWAY" | null,
): SignalPolarity {
  if (v == null || pickSide == null) return "NEUTRAL";
  // components are typically home-relative; align to pick side
  const aligned = pickSide === "HOME" ? v : -v;
  if (Math.abs(aligned) < 0.015) return "NEUTRAL";
  return aligned > 0 ? "POSITIVE" : "NEGATIVE";
}

/**
 * BEFORE signals — Prediction snapshot only (no postgame).
 */
export function buildBeforeSignals(
  pred: Record<string, unknown>,
  pickSide: "HOME" | "AWAY" | null,
): PreGameSignal[] {
  const warnings = Array.isArray(pred.inputWarnings)
    ? pred.inputWarnings.map(String)
    : [];
  const used = Array.isArray(pred.usedFactors)
    ? pred.usedFactors.map(String)
    : [];
  const missing = Array.isArray(pred.missingFactors)
    ? pred.missingFactors.map(String)
    : [];
  const ml = asRecord(
    (Array.isArray(pred.marketPredictions) ? pred.marketPredictions : []).find(
      (m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY",
    ),
  );
  const components = asRecord(ml?.components);
  const starterComp = asNumber(components?.starter);
  const bullpenComp = asNumber(components?.bullpen);
  const lineupComp = asNumber(components?.lineup);
  const homeComp = asNumber(components?.homeAdvantage);
  const marketComp = asNumber(components?.marketPrior);
  const edge = asNumber(pred.edgeScore) ?? asNumber(pred.valueEdge);
  const inputStatus = asString(pred.inputStatus);

  const signals: PreGameSignal[] = [];

  // Starter
  if (warnings.some((w) => /STARTER_SAMPLE_PARTIAL|STARTER_STATS_MISSING|STARTER_MISSING/i.test(w))) {
    signals.push({
      id: "starter",
      label: "Starter",
      polarity: "LIMITED",
      plain: "선발 입력이 부분적·제한적이었습니다 (Prediction 시점).",
    });
  } else if (used.includes("startingPitcher") || starterComp != null) {
    const pol = polarityFromComponent(starterComp, pickSide);
    signals.push({
      id: "starter",
      label: "Starter",
      polarity: pol === "NEUTRAL" && starterComp == null ? "NEUTRAL" : pol,
      plain:
        pol === "POSITIVE"
          ? "선발 신호가 Pick 방향과 같았습니다."
          : pol === "NEGATIVE"
            ? "선발 신호가 Pick과 다른 방향이었습니다."
            : "선발이 사용되었으나 강한 방향 신호는 없었습니다.",
    });
  } else {
    signals.push({
      id: "starter",
      label: "Starter",
      polarity: "NOT_AVAILABLE",
      plain: "선발 세부 근거가 Snapshot에 없습니다.",
    });
  }

  // Bullpen
  if (warnings.some((w) => /BULLPEN_WEIGHT_DISABLED/i.test(w))) {
    signals.push({
      id: "bullpen",
      label: "Bullpen",
      polarity: "NOT_CONNECTED",
      plain: "불펜 가중치는 연구 베이스라인에 연결되어 있지 않았습니다.",
    });
  } else if (bullpenComp != null && bullpenComp !== 0) {
    signals.push({
      id: "bullpen",
      label: "Bullpen",
      polarity: polarityFromComponent(bullpenComp, pickSide),
      plain: "불펜 구성요소 신호가 Snapshot에 있었습니다.",
    });
  } else {
    signals.push({
      id: "bullpen",
      label: "Bullpen",
      polarity: "NOT_AVAILABLE",
      plain: "불펜 방향 신호가 Snapshot에 없습니다.",
    });
  }

  // Lineup
  if (
    warnings.some((w) => /LINEUP_NOT_CONFIRMED|LINEUP_NOT_COLLECTED/i.test(w)) ||
    missing.some((m) => /LINEUP|CONFIRMED_LINEUP/i.test(m))
  ) {
    signals.push({
      id: "lineup",
      label: "Lineup",
      polarity: "LIMITED",
      plain: "라인업이 미확정·미수집 상태였습니다.",
    });
  } else if (used.includes("lineup") || lineupComp != null) {
    signals.push({
      id: "lineup",
      label: "Lineup",
      polarity: polarityFromComponent(lineupComp, pickSide),
      plain: "라인업 관련 입력이 사용되었습니다.",
    });
  } else {
    signals.push({
      id: "lineup",
      label: "Lineup",
      polarity: "NEUTRAL",
      plain: "라인업 경고는 없었으나 강한 신호는 없습니다.",
    });
  }

  // Market
  if (used.includes("marketPrior") || marketComp != null) {
    let pol: SignalPolarity = polarityFromComponent(marketComp, pickSide);
    if (edge != null && edge <= -5) pol = "NEGATIVE";
    else if (edge != null && edge >= 5 && pol === "NEUTRAL") pol = "POSITIVE";
    signals.push({
      id: "market",
      label: "Market",
      polarity: pol,
      plain:
        pol === "POSITIVE"
          ? "시장이 Pick과 같은 방향이거나 모델이 시장 대비 우위였습니다."
          : pol === "NEGATIVE"
            ? "시장과 모델이 충돌하거나 가격 매력이 약했습니다."
            : "시장 prior가 사용되었으나 강한 충돌/동조는 없습니다.",
    });
  } else {
    signals.push({
      id: "market",
      label: "Market",
      polarity: "NOT_AVAILABLE",
      plain: "시장 prior 근거가 Snapshot에 부족합니다.",
    });
  }

  // Home Advantage
  if (used.includes("homeAdvantage") || homeComp != null) {
    const pol =
      pickSide === "HOME"
        ? "POSITIVE"
        : pickSide === "AWAY"
          ? "NEUTRAL"
          : "NEUTRAL";
    signals.push({
      id: "homeAdvantage",
      label: "Home Advantage",
      polarity: pol as SignalPolarity,
      plain:
        pickSide === "HOME"
          ? "홈 어드밴티지가 Pick 측에 포함되었습니다."
          : "홈 어드밴티지 요인이 사용되었으나 Pick은 원정입니다.",
    });
  } else {
    signals.push({
      id: "homeAdvantage",
      label: "Home Advantage",
      polarity: "NOT_AVAILABLE",
      plain: "홈 어드밴티지 사용 근거가 Snapshot에 없습니다.",
    });
  }

  // Input Quality
  if (inputStatus === "LIMITED_INPUT") {
    signals.push({
      id: "inputQuality",
      label: "Input Quality",
      polarity: "LIMITED",
      plain: "입력 상태가 LIMITED_INPUT였습니다.",
    });
  } else if (inputStatus === "BLOCKED") {
    signals.push({
      id: "inputQuality",
      label: "Input Quality",
      polarity: "NEGATIVE",
      plain: "입력 상태가 BLOCKED였습니다.",
    });
  } else if (inputStatus === "ELIGIBLE" || inputStatus === "FULL_INPUT") {
    signals.push({
      id: "inputQuality",
      label: "Input Quality",
      polarity: "POSITIVE",
      plain: `입력 상태 ${inputStatus}.`,
    });
  } else {
    signals.push({
      id: "inputQuality",
      label: "Input Quality",
      polarity: "NEUTRAL",
      plain: inputStatus ? `입력 상태 ${inputStatus}.` : "입력 상태 미표기.",
    });
  }

  return signals;
}

/**
 * Pre-game risks — only from Prediction-time fields.
 */
export function buildPreGameRisks(
  pred: Record<string, unknown>,
): { code: PreGameRiskCode; label: string }[] {
  const risks: { code: PreGameRiskCode; label: string }[] = [];
  const warnings = Array.isArray(pred.inputWarnings)
    ? pred.inputWarnings.map(String)
    : [];
  const modelProb = asNumber(pred.modelProbability);
  const confidence = asNumber(pred.confidence);
  const edge = asNumber(pred.edgeScore) ?? asNumber(pred.valueEdge);
  const inputStatus = asString(pred.inputStatus);

  if (warnings.some((w) => /LINEUP_NOT_CONFIRMED|LINEUP_NOT_COLLECTED/i.test(w))) {
    risks.push({ code: "LINEUP_MISSING", label: "Lineup Missing" });
  }
  if (warnings.some((w) => /STARTER/i.test(w))) {
    risks.push({ code: "STARTER_LIMITED", label: "Starter Limited" });
  }
  if (warnings.some((w) => /BULLPEN_WEIGHT_DISABLED/i.test(w))) {
    risks.push({
      code: "BULLPEN_NOT_CONNECTED",
      label: "Bullpen Not Connected",
    });
  }
  if (edge != null && edge <= -5) {
    risks.push({ code: "MARKET_CONFLICT", label: "Market Conflict" });
  }
  if (inputStatus === "LIMITED_INPUT") {
    risks.push({ code: "INPUT_LIMITED", label: "Input Limited" });
  }
  if (modelProb != null && Math.abs(modelProb - 50) < 3) {
    risks.push({ code: "COIN_FLIP", label: "Coin Flip" });
  }
  if (confidence != null && confidence < 40) {
    risks.push({ code: "LOW_CONFIDENCE", label: "Low Confidence" });
  } else if (confidence != null && confidence < 50) {
    risks.push({ code: "MODEL_UNCERTAIN", label: "Model Uncertain" });
  }
  if (pred.researchOnly === true || pred.officialPick == null) {
    risks.push({ code: "RESEARCH_ONLY_PASS", label: "Research Only / Official PASS" });
  }

  const seen = new Set<string>();
  return risks.filter((r) => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });
}

export function signalArrow(polarity: SignalPolarity): string {
  switch (polarity) {
    case "POSITIVE":
      return "↑";
    case "NEGATIVE":
      return "↓";
    case "LIMITED":
      return "?";
    case "NOT_CONNECTED":
      return "⊘";
    case "NOT_AVAILABLE":
      return "—";
    default:
      return "·";
  }
}
