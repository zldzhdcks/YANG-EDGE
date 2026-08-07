/** Warning / status code → Korean·English plain labels (display only). */

const WARNING_PLAIN: Record<string, string> = {
  LINEUP_NOT_CONFIRMED: "라인업이 확정되지 않았습니다",
  BULLPEN_WEIGHT_DISABLED_V0: "불펜 가중치는 현재 연구 모델에서 비활성입니다",
  STARTER_SAMPLE_PARTIAL: "선발 표본이 부분적입니다",
  INPUT_QUALITY_LIMITED_INPUT: "입력 품질이 제한적입니다 (LIMITED_INPUT)",
  CONFIRMED_LINEUP: "확정 라인업",
  HOME_STARTER_EDGE: "홈 선발 우위 신호가 있었습니다",
  MARKET_SUPPORTS_HOME: "시장이 홈을 지지했습니다",
  MARKET_SUPPORTS_AWAY: "시장이 원정을 지지했습니다",
  PROBABILITY_CLAMP_APPLIED: "확률 클램프가 적용됐습니다",
  LINEUP_NOT_CONFIRMED_DETAIL: "확정 라인업 없음",
};

export function plainWarning(code: string): string {
  return WARNING_PLAIN[code] ?? code.replace(/_/g, " ").toLowerCase();
}

export function toneLabel(tone: string): string {
  switch (tone) {
    case "ADVANTAGE":
      return "우세";
    case "DISADVANTAGE":
      return "열세";
    case "NEUTRAL":
      return "중립";
    case "HOLD":
      return "보류";
    case "NOT_AVAILABLE":
      return "데이터 없음";
    case "RESEARCH_NOT_CONNECTED":
      return "연구 미연결";
    default:
      return tone;
  }
}

export function reviewCandidatePlain(
  code: string,
  role: "primary" | "secondary",
): string {
  const rank = role === "primary" ? "주요" : "보조";
  switch (code) {
    case "STARTER":
      return `선발 평가 영향 가능성이 ${rank} 복기 후보로 분류됐습니다. 추가 확인이 필요합니다.`;
    case "BULLPEN":
      return `불펜 영향 가능성이 ${rank} 복기 후보로 분류됐습니다. 불펜 운영은 추가 확인이 필요합니다.`;
    case "LINEUP":
      return `라인업 차이/미확정 영향 가능성이 ${rank} 복기 후보로 분류됐습니다.`;
    case "MARKET":
      return `시장 정렬 이슈가 ${rank} 복기 후보로 분류됐습니다.`;
    case "ONE_RUN_GAME":
      return `1점차 경기 변동성이 ${rank} 복기 후보로 분류됐습니다. 확정 원인으로 단정하지 않습니다.`;
    case "BLOWOUT":
      return `대량 득점(블로우아웃) 양상이 ${rank} 복기 후보로 분류됐습니다.`;
    case "EXTRA_INNINGS":
      return `연장전 양상이 ${rank} 복기 후보로 분류됐습니다.`;
    case "MODEL_ALIGNMENT":
      return `모델 확률 정렬이 ${rank} 성공 후보로 표시됐습니다.`;
    case "INPUT_QUALITY":
      return `입력 품질 신호가 ${rank} 성공 후보로 표시됐습니다.`;
    default:
      return `${code} 항목이 ${rank} 복기/성공 후보로 분류됐습니다. 확정 원인이 아닙니다.`;
  }
}
