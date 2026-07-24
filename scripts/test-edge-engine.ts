/**
 * EDGE Engine v1 스모크 테스트
 * 실행: npx tsx scripts/test-edge-engine.ts
 */
import { DummyAnalysisData } from "../src/constants/dummyAnalysisData";
import { runEdgeEngine } from "../src/lib/edge";
import { BASEBALL_EDGE_WEIGHTS, WEIGHT_TOTAL } from "../src/lib/edge/weights";

function main() {
  const result1 = runEdgeEngine(DummyAnalysisData);
  const result2 = runEdgeEngine(DummyAnalysisData);
  const deterministic = JSON.stringify(result1) === JSON.stringify(result2);

  console.log("=== YANG EDGE Engine v1 (rule-v1) ===\n");
  console.log("version:", result1.version, "| engineId:", result1.engineId);
  console.log("가중치 총합:", WEIGHT_TOTAL);
  console.log("가중치:", BASEBALL_EDGE_WEIGHTS);
  console.log("");
  console.log("추천 팀:", result1.pickTeamName, `(${result1.pickTeamId})`);
  console.log("승리 확률:", `${result1.winProbability.toFixed(1)}%`);
  console.log("EDGE Score:", result1.edgeScore.toFixed(2));
  console.log("Confidence:", result1.confidence.toFixed(1));
  console.log("Explainability:", result1.explainability.toFixed(1));
  console.log("Grade:", result1.grade, "/", result1.label);

  console.log("\nTopFactors (4):");
  for (const f of result1.topFactors) {
    console.log(
      `  - ${f.key}: score=${f.score}, importance=${f.importance}, impact=${f.impact}, advantage=${f.advantage}`,
    );
  }

  console.log("\nReasons:");
  for (const reason of result1.reasons) {
    console.log(
      `  - [${reason.icon}] ${reason.title} (score ${reason.score}, importance ${reason.importance})`,
    );
    console.log(`    ${reason.description}`);
  }

  console.log("\nRisks:");
  if (result1.risks.length === 0) {
    console.log("  (없음)");
  } else {
    for (const risk of result1.risks) {
      console.log(
        `  - [${risk.severity}/${risk.category}] ${risk.title}: ${risk.description}`,
      );
    }
  }

  console.log("\nFactors (impact 순):");
  for (const f of result1.factors) {
    console.log(
      `  ${f.key.padEnd(16)} score=${String(f.score).padStart(7)} importance=${String(f.importance).padStart(2)} impactValue=${String(f.impactValue).padStart(6)} impact=${f.impact.padEnd(6)} ${f.advantage}`,
    );
  }

  console.log("\n결정성:", deterministic ? "OK" : "FAIL");
  if (!deterministic) process.exitCode = 1;
}

main();
