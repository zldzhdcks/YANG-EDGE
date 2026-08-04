/**
 * Football Identity Risk Register v0 (≥10).
 */
export type RiskSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type FootballIdentityRisk = {
  id: string;
  title: string;
  severity: RiskSeverity;
  mitigation: string;
};

export const FOOTBALL_IDENTITY_RISK_REGISTER_V0: FootballIdentityRisk[] = [
  {
    id: "RISK-SAME-DISPLAY-NAME",
    title: "동일 팀명(displayName) 충돌",
    severity: "HIGH",
    mitigation: "providerTeamId만 SoT; 동명이인 자동 병합 금지",
  },
  {
    id: "RISK-DUPLICATE-FIXTURE",
    title: "중복 Fixture ID / 재수집 충돌",
    severity: "CRITICAL",
    mitigation: "matchId=soccer-provider-fixtureId 고정; revision으로 덮어쓰기 추적",
  },
  {
    id: "RISK-CUP-LEAGUE-MIX",
    title: "Cup / League 혼합 식별",
    severity: "HIGH",
    mitigation: "competitionId를 모든 행에 필수; 팀 ID 재사용 ≠ match 공유",
  },
  {
    id: "RISK-NEUTRAL-VENUE",
    title: "Neutral Venue 홈/원정 왜곡",
    severity: "MEDIUM",
    mitigation: "neutralVenue 플래그 + identityHash 포함",
  },
  {
    id: "RISK-KICKOFF-CHANGE",
    title: "Kickoff 변경",
    severity: "HIGH",
    mitigation: "kickoffUtc 변경 시 identityHash 재계산; 구 revision 보존",
  },
  {
    id: "RISK-PROVIDER-FIXTURE-MERGE",
    title: "Provider Fixture Merge/Split",
    severity: "CRITICAL",
    mitigation: "fixtureId 변경은 신규 matchId; 구 ID deprecate 로그",
  },
  {
    id: "RISK-ABANDONED",
    title: "Abandoned 경기",
    severity: "MEDIUM",
    mitigation: "status=ABANDONED; Prediction/Review 별도 정책",
  },
  {
    id: "RISK-POSTPONED",
    title: "Postponed 경기",
    severity: "MEDIUM",
    mitigation: "status=POSTPONED; kickoff 재확정 전 READY 금지",
  },
  {
    id: "RISK-ET",
    title: "연장전(ET) 결과 혼동",
    severity: "HIGH",
    mitigation: "Result taxonomy에서 FT/ET 분리 (후속 Result Foundation)",
  },
  {
    id: "RISK-PENALTY",
    title: "승부차기(PEN) 결과 혼동",
    severity: "HIGH",
    mitigation: "PEN은 FT/ET와 분리; 1X2는 정규시간 계약 명시",
  },
  {
    id: "RISK-UI-SLUG-AS-ID",
    title: "UI slug/팀명으로 identity 생성",
    severity: "CRITICAL",
    mitigation: "buildFootballMatchId는 fixtureId만 허용; slug 경로 금지",
  },
  {
    id: "RISK-UI-LEAGUES-AS-SOT",
    title: "football-leagues.ts를 Research SoT로 오인",
    severity: "MEDIUM",
    mitigation: "Competition Registry만 SoT; UI 목록은 읽기 전용 참조",
  },
];
