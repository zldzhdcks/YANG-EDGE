import { getAnalysisByGameId } from "@/constants/analysis";
import { FEATURES } from "@/constants/features";
import { GAMES } from "@/constants/games";
import { TODAY_GAMES } from "@/constants/todayGames";
import { TODAY_PICK } from "@/constants/todayPick";
import { TOTO_BUDGET_OPTIONS, TOTO_ROUND } from "@/constants/toto";
import type { GameData } from "@/types/game";
import type {
  GetGamesParams,
  SportsProvider,
  TotoData,
} from "./types";

/**
 * constants 기반 더미 데이터 Provider.
 * 외부 API 키가 없거나 SPORTS_PROVIDER=dummy 일 때 사용.
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

  async getTodayPick() {
    return TODAY_PICK;
  }

  async getTodayGames() {
    return [...TODAY_GAMES];
  }

  async getFeatured() {
    return [...FEATURES];
  }
}
