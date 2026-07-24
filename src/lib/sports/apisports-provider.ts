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
 * TODO:
 * - API-Sports 베이스 URL / 헤더(x-apisports-key) 연동
 * - fixtures → GameData 매핑
 * - NPB / KBO / 축구 / 농구 리그 ID 정리
 * - getAnalysis / getToto / getTodayPick 등 EDGE 전용 데이터 전략 결정
 *
 * 현재는 모든 메서드가 throw → FallbackProvider가 DummyProvider로 넘긴다.
 */
export class ApiSportsProvider implements SportsProvider {
  readonly kind = "apisports" as const;

  // TODO: baseUrl / apiKey 주입 후 실제 HTTP 클라이언트 구성
  constructor(
    private readonly baseUrl?: string,
    private readonly apiKey?: string,
  ) {}

  async getGames(params: GetGamesParams = {}): Promise<GameData[]> {
    void this.baseUrl;
    void this.apiKey;
    void params;
    // TODO: API-Sports fixtures 엔드포인트 호출 후 GameData[] 매핑
    throw new Error("ApiSportsProvider.getGames is not implemented yet");
  }

  async getAnalysis(gameId: string): Promise<AnalysisData | null> {
    void gameId;
    // TODO: API-Sports 기반 분석 데이터 또는 별도 EDGE 엔진 연동
    throw new Error("ApiSportsProvider.getAnalysis is not implemented yet");
  }

  async getToto(): Promise<TotoData> {
    // TODO: EDGE Combo 데이터 소스 결정
    throw new Error("ApiSportsProvider.getToto is not implemented yet");
  }

  async getTodayPick(): Promise<TodayPickData> {
    // TODO: EDGE Pick 선정 로직
    throw new Error("ApiSportsProvider.getTodayPick is not implemented yet");
  }

  async getTodayGames(): Promise<SportData[]> {
    // TODO: 홈 종목 요약 집계
    throw new Error("ApiSportsProvider.getTodayGames is not implemented yet");
  }

  async getFeatured(): Promise<FeatureData[]> {
    // TODO: FEATURED는 Dummy 유지 여부 결정
    throw new Error("ApiSportsProvider.getFeatured is not implemented yet");
  }
}
