/**
 * MLB 종료 경기 채점 → Failure/Success flow review → 사이트 Feedback/Learning
 *
 * 1) grade-mlb-research-predictions.ts
 * 2) review-mlb-failed-game-flow.ts
 * 3) review-mlb-success-game-flow.ts
 * 4) refresh-site-feedback-learning.ts (export + dashboard)
 *
 * 예측 불변 필드 / Engine / weights / 가계부 / 홈 /games /picks UI 미수정.
 *
 * 실행:
 *   tsx --env-file=.env.local scripts/run-mlb-postgame-pipeline.ts [YYYY-MM-DD]
 *   npm run research:postgame -- YYYY-MM-DD
 */
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";
import { getKstToday } from "../src/lib/datetime/kst";

const dateKst = process.argv[2]?.trim() || getKstToday();

async function main() {
  console.log(`=== MLB Postgame Pipeline (${dateKst}) ===\n`);

  const steps: Array<{ name: string; script: string; args: string[] }> = [
    {
      name: "1. Grade (research)",
      script: "scripts/grade-mlb-research-predictions.ts",
      args: [dateKst],
    },
    {
      name: "2. Failure flow review",
      script: "scripts/review-mlb-failed-game-flow.ts",
      args: [dateKst],
    },
    {
      name: "3. Success flow review",
      script: "scripts/review-mlb-success-game-flow.ts",
      args: [dateKst],
    },
    {
      name: "4. Site Feedback/Learning refresh",
      script: "scripts/refresh-site-feedback-learning.ts",
      args: [dateKst],
    },
  ];

  for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    const code = await spawnLocalTsxScript(step.script, step.args);
    if (code !== 0) {
      console.error(
        `FAILED at step ${step.name} (exit ${code}). Later steps skipped.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n=== Pipeline complete ===");
  console.log(`Failure: data/predictions/mlb/${dateKst}-failure-flow-review.json`);
  console.log(`Success: data/predictions/mlb/${dateKst}-success-flow-review.json`);
  console.log("Feedback: data/predictions/" + dateKst + "-mlb-review.json");
  console.log("Learning: data/learning/dashboard.json");
  console.log("UI: /feedback , /learning");
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
