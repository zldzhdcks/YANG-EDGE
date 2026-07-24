/**
 * EDGE Engine v1 스모크 테스트
 * 실행: npx tsx scripts/test-edge-engine.ts
 */
import {
  DummyAnalysisData,
  listDummyEngineGameIds,
  getDummyEngineAnalysis,
} from "../src/constants/dummyAnalysisData";
import { runEdgeEngine } from "../src/lib/edge";
import { buildAnalysisView } from "../src/lib/edge/to-analysis-view";
import { BASEBALL_EDGE_WEIGHTS, WEIGHT_TOTAL } from "../src/lib/edge/weights";
import { buildGameId } from "../src/lib/game-id";

function main() {
  const result1 = runEdgeEngine(DummyAnalysisData);
  const result2 = runEdgeEngine(DummyAnalysisData);
  const deterministic = JSON.stringify(result1) === JSON.stringify(result2);

  console.log("=== YANG EDGE Engine v1 (multi-game) ===\n");
  console.log("가중치 총합:", WEIGHT_TOTAL);
  console.log(
    "gameId 규칙 예시:",
    buildGameId("NPB", "소프트뱅크", "오릭스"),
  );
  console.log("");

  for (const gameId of listDummyEngineGameIds()) {
    const input = getDummyEngineAnalysis(gameId);
    if (!input) continue;
    const view = buildAnalysisView(input);
    console.log(`--- ${gameId} ---`);
    console.log(
      `  pick=${view.pickTeam} win=${view.winProbability}% edge=+${view.edgeScore} grade=${view.grade} explain=${view.explainability}%`,
    );
  }

  console.log("\n결정성:", deterministic ? "OK" : "FAIL");
  console.log("startingPitcher weight:", BASEBALL_EDGE_WEIGHTS.startingPitcher);
  if (!deterministic) process.exitCode = 1;
}

main();
