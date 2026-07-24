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
 * 화면/Route는 구현체를 모르고 이 인터페이스만 호출한다.
 */
export interface SportsProvider {
  readonly kind: SportsProviderKind;

  getGames(params?: GetGamesParams): Promise<GameData[]>;
  getAnalysis(gameId: string): Promise<AnalysisData | null>;
  getToto(): Promise<TotoData>;
  getTodayPick(): Promise<TodayPickData>;
  getTodayGames(): Promise<SportData[]>;
  getFeatured(): Promise<FeatureData[]>;
}
