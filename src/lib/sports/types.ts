import type { AnalysisData } from "@/types/analysis";
import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import type { BudgetOption, TotoRoundData } from "@/types/toto";

export type SportsProviderKind = "dummy" | "thesportsdb" | "apisports";

export type GetGamesParams = {
  date?: string;
  sport?: GameData["sport"] | "all";
};

export type TotoData = {
  round: TotoRoundData;
  budgetOptions: BudgetOption[];
};

/**
 * 스포츠 데이터 소스 추상화.
 * Home 피드는 getTodayPick / getFeaturedGames / getTodayGames 로만 소비한다.
 */
export interface SportsProvider {
  readonly kind: SportsProviderKind;

  getGames(params?: GetGamesParams): Promise<GameData[]>;
  getAnalysis(gameId: string): Promise<AnalysisData | null>;
  getToto(): Promise<TotoData>;

  /** EDGE Score 최댓값 경기 */
  getTodayPick(): Promise<TodayPickData | null>;
  /** EDGE Score 상위 경기 (Featured) */
  getFeaturedGames(): Promise<FeatureData[]>;
  /** 종목별 오늘 경기 + Engine 분석 수 */
  getTodayGames(): Promise<SportData[]>;

  /** @deprecated getFeaturedGames 사용 */
  getFeatured(): Promise<FeatureData[]>;
}
