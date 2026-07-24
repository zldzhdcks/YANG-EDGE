export type FeatureData = {
  id: string;
  title: string;
  description: string;
  icon: "dashboard" | "ai" | "sync" | "engine";
  /** Engine Featured 경기 연결 (선택) */
  gameId?: string;
  edgeScore?: number;
  pickTeamName?: string;
};
