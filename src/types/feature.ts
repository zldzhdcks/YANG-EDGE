export type FeatureData = {
  id: string;
  title: string;
  description: string;
  icon: "dashboard" | "ai" | "sync" | "engine";
  /** Engine Featured 경기 연결 (선택) */
  gameId?: string;
  edgeScore?: number;
  pickTeamName?: string;
  /** UI 표시용 원본 팀명 (한글화는 FeatureCard에서 적용) */
  homeTeam?: string;
  awayTeam?: string;
};
