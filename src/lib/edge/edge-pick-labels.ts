const SELECTION_LABELS: Record<string, string> = {
  STARTER_COMPLETE: "선발 데이터 확보",
  BULLPEN_COMPLETE: "불펜 데이터 확보",
  LINEUP_COMPLETE: "라인업 데이터 확보",
  WEATHER_COMPLETE: "날씨 데이터 확보",
  TRAVEL_COMPLETE: "이동·휴식 데이터 확보",
  ODDS_COMPLETE: "시장 배당 확보",
  INJURY_COMPLETE: "부상 데이터 확보",
  LOW_RISK: "낮은 리스크",
  HIGH_CONFIDENCE: "상대적으로 높은 신뢰도",
  VALUE_EDGE_POSITIVE: "AI 확률이 시장 확률보다 높음",
  PREDICTION_SNAPSHOT_VERIFIED: "예측 스냅샷 확인",
  BASELINE_CANDIDATE: "Baseline 후보 조건 충족",
};

const MISSING_LABELS: Record<string, string> = {
  STARTER_NOT_COLLECTED: "선발 데이터 미수집",
  STARTER_PARTIAL: "선발 데이터 일부 미수집",
  BULLPEN_NOT_COLLECTED: "불펜 데이터 미수집",
  BULLPEN_PARTIAL: "불펜 데이터 일부 미수집",
  LINEUP_NOT_COLLECTED: "라인업 데이터 미수집",
  LINEUP_PARTIAL: "경기 전 라인업 일부 미수집",
  WEATHER_NOT_COLLECTED: "날씨 데이터 미수집",
  WEATHER_PARTIAL: "날씨 예보 미수집",
  TRAVEL_NOT_COLLECTED: "이동·휴식 데이터 미수집",
  TRAVEL_PARTIAL: "이동·휴식 데이터 일부 미수집",
  ODDS_NOT_COLLECTED: "배당 데이터 미수집",
  ODDS_PARTIAL: "개장·최신 배당 일부 미수집",
  INJURY_NOT_COLLECTED: "부상 데이터 미수집",
  INJURY_PARTIAL: "부상 정보 일부 미수집",
};

const RESEARCH_MISSING_LABELS: Record<string, string> = {
  BASELINE_NOT_MET: "Baseline 후보 기준 미충족",
  RESEARCH_PARTIAL: "연구 데이터 일부 부족",
  BULLPEN_PENDING: "불펜 데이터 연구 대기 중",
  EDGE_NO_POSITIVE: "Baseline 기준 우위 없음",
  LINEUP_PARTIAL: "경기 전 라인업 일부 미수집",
  WEATHER_PARTIAL: "날씨 예보 미수집",
  ODDS_PARTIAL: "개장·최신 배당 일부 미수집",
  INJURY_PARTIAL: "부상 정보 일부 미수집",
  TRAVEL_PARTIAL: "이동·휴식 데이터 일부 미수집",
};

export function selectionReasonLabel(code: string): string {
  return SELECTION_LABELS[code] ?? code;
}

export function missingReasonLabel(code: string): string {
  return MISSING_LABELS[code] ?? RESEARCH_MISSING_LABELS[code] ?? code;
}

export function researchMissingReasonLabel(code: string): string {
  return RESEARCH_MISSING_LABELS[code] ?? MISSING_LABELS[code] ?? code;
}

export function mapSelectionReasonLabels(codes: string[]): string[] {
  return codes.map(selectionReasonLabel);
}

export function mapMissingReasonLabels(codes: string[]): string[] {
  return codes.map(missingReasonLabel);
}

export function mapResearchMissingReasonLabels(codes: string[]): string[] {
  return codes.map(researchMissingReasonLabel);
}

export function riskDisplayLabel(
  risk: "LOW" | "MEDIUM" | "HIGH",
): string {
  if (risk === "LOW") return "낮음";
  if (risk === "MEDIUM") return "보통";
  return "높음";
}

export function pickTierBadgeLabel(
  tier: "EDGE_PICK" | "RESEARCH_CANDIDATE",
  rank: 1 | 2 | 3,
): string {
  const badge = ["①", "②", "③"][rank - 1] ?? String(rank);
  return tier === "EDGE_PICK" ? `EDGE PICK ${badge}` : `연구 후보 ${badge}`;
}

export function pickTierDescription(
  tier: "EDGE_PICK" | "RESEARCH_CANDIDATE",
): string {
  if (tier === "EDGE_PICK") {
    return "현재 연구 기준을 충족한 EDGE PICK입니다.";
  }
  return "현재 예정 경기 중 분석 우선순위가 높은 연구 후보입니다. 일부 핵심 데이터가 부족하여 정식 EDGE PICK은 아닙니다.";
}
