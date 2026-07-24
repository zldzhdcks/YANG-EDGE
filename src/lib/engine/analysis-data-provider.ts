import type { AnalysisData } from "@/types/engine-analysis";
import { getDummyEngineAnalysis } from "@/constants/dummyAnalysisData";

/**
 * EDGE Engine 입력(AnalysisData) 공급자.
 * SportsProvider와 분리 — 일정(Provider) vs 엔진 입력(Analysis) 책임을 나눈다.
 */
export interface EngineAnalysisDataProvider {
  getEngineAnalysisData(gameId: string): Promise<AnalysisData | null>;
}

/**
 * Dummy 레코드 기반 Provider.
 * 향후 ApiSports / DB 구현체로 교체 가능.
 */
export class DummyEngineAnalysisProvider implements EngineAnalysisDataProvider {
  async getEngineAnalysisData(gameId: string): Promise<AnalysisData | null> {
    return getDummyEngineAnalysis(gameId);
  }
}

let activeProvider: EngineAnalysisDataProvider = new DummyEngineAnalysisProvider();

/** 테스트·향후 DI용 */
export function setEngineAnalysisDataProvider(
  provider: EngineAnalysisDataProvider,
): void {
  activeProvider = provider;
}

export function getEngineAnalysisDataProvider(): EngineAnalysisDataProvider {
  return activeProvider;
}

export async function getEngineAnalysisData(
  gameId: string,
): Promise<AnalysisData | null> {
  const normalized = (gameId ?? "").trim();
  if (!normalized) return null;
  return getEngineAnalysisDataProvider().getEngineAnalysisData(normalized);
}
