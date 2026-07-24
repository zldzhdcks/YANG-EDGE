import { getAnalysisByGameId } from "@/constants/analysis";
import { GAMES } from "@/constants/games";
import { TOTO_BUDGET_OPTIONS, TOTO_ROUND } from "@/constants/toto";
import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import { buildHomeFeed } from "@/lib/home/build-home-feed";
import type {
  GetGamesParams,
  SportsProvider,
  TotoData,
} from "./types";

/**
 * constants 기반 더미 Provider.
 * Home 피드는 buildHomeFeed(getGames()) → Engine 결과로 생성한다.
 */
export class DummyProvider implements SportsProvider {
  readonly kind = "dummy" as const;

  async getGames(params: GetGamesParams = {}): Promise<GameData[]> {
    let games = [...GAMES];

    if (params.date) {
      games = games.filter((game) => game.date === params.date);
    }

    if (params.sport && params.sport !== "all") {
      games = games.filter((game) => game.sport === params.sport);
    }

    return games;
  }

  async getAnalysis(gameId: string) {
    return getAnalysisByGameId(gameId) ?? null;
  }

  async getToto(): Promise<TotoData> {
    return {
      round: TOTO_ROUND,
      budgetOptions: TOTO_BUDGET_OPTIONS,
    };
  }

  async getTodayPick(): Promise<TodayPickData | null> {
    const feed = await buildHomeFeed(await this.getGames());
    return feed.pick;
  }

  async getFeaturedGames(): Promise<FeatureData[]> {
    const feed = await buildHomeFeed(await this.getGames());
    return feed.featured;
  }

  async getTodayGames(): Promise<SportData[]> {
    const feed = await buildHomeFeed(await this.getGames());
    return feed.sports;
  }

  async getFeatured(): Promise<FeatureData[]> {
    return this.getFeaturedGames();
  }
}
