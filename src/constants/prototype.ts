/**
 * 서비스 고지 문구.
 * 분석/배당 데이터의 성격과 책임 한계를 안내한다.
 * SHOW_PROTOTYPE_DISCLAIMER 를 false 로 바꾸면 페이지 내 안내가 숨겨진다.
 */
export const SHOW_PROTOTYPE_DISCLAIMER = true;

export const PROTOTYPE_DISCLAIMER_TEXT =
  "분석 결과와 배당 정보는 참고용이며, 정확도와 수익을 보장하지 않습니다. " +
  "실제 이용에 대한 판단과 책임은 사용자에게 있으며, " +
  "데이터 제공처에 따라 정보가 지연되거나 달라질 수 있습니다.";

/** 사이트 하단 이용 안내 (푸터) */
export const LEGAL_NOTICE_TITLE = "이용 안내";

export const LEGAL_NOTICE_ITEMS = [
  "YANG EDGE의 분석 결과는 참고용 정보입니다.",
  "경기 결과 및 예측의 정확도를 보장하지 않습니다.",
  "베팅 참여나 수익을 권유하거나 보장하지 않습니다.",
  "최종 판단과 이용에 따른 책임은 이용자에게 있습니다.",
  "경기 일정, 통계, 배당 등 외부 데이터의 권리는 각 데이터 제공자에게 있습니다.",
  "데이터는 공식 API 또는 적법한 이용 권한이 확인된 출처만 사용하는 것을 원칙으로 합니다.",
] as const;
