import type { AnalysisData } from "@/types/analysis";
import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import type {
  GetGamesParams,
  SportsProvider,
  TotoData,
} from "./types";

/**
 * API-Sports Provider (준비용 스텁)
 *
 * TODO: fixtures 연동 후 buildHomeFeed(getGames()) 동일 흐름 적용
 */
export class ApiSportsProvider implements SportsProvider {
  readonly kind = "apisports" as const;

  constructor(
    private readonly baseUrl?: string,
    private readonly apiKey?: string,
  ) {}

  async getGames(params: GetGamesParams = {}): Promise<GameData[]> {
    void this.baseUrl;
    void this.apiKey;
    void params;
    throw new Error("ApiSportsProvider.getGames is not implemented yet");
  }

  async getAnalysis(gameId: string): Promise<AnalysisData | null> {
    void gameId;
    throw new Error("ApiSportsProvider.getAnalysis is not implemented yet");
  }

  async getToto(): Promise<TotoData> {
    throw new Error("ApiSportsProvider.getToto is not implemented yet");
  }

  async getTodayPick(): Promise<TodayPickData | null> {
    throw new Error("ApiSportsProvider.getTodayPick is not implemented yet");
  }

  async getFeaturedGames(): Promise<FeatureData[]> {
    throw new Error("ApiSportsProvider.getFeaturedGames is not implemented yet");
  }

  async getTodayGames(): Promise<SportData[]> {
    throw new Error("ApiSportsProvider.getTodayGames is not implemented yet");
  }

  async getFeatured(): Promise<FeatureData[]> {
    return this.getFeaturedGames();
  }
}
