/**
 * MLB Research Ops Pipeline v1 — read-only research artifact chain.
 *
 * 1) audit-dataset-correlation-v1.ts
 * 2) build-contradiction-ledger-v1.ts
 * 3) build-contradiction-severity-audit-v1.ts
 * 4) build-dataset-coverage-dashboard-v1.ts
 * 5) summarize-mlb-starter-accumulation-v1.ts
 *
 * Reuses existing scripts only. No Engine / prediction / dataset mutation.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/run-mlb-research-ops-pipeline-v1.ts [YYYY-MM-DD]
 *   npm run research:ops -- YYYY-MM-DD
 */
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";

const dateKst =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

async function main() {
  console.log(`=== MLB Research Ops Pipeline v1 (${dateKst}) ===\n`);

  const steps: Array<{ name: string; script: string; args: string[] }> = [
    {
      name: "1. Dataset correlation audit",
      script: "scripts/audit-dataset-correlation-v1.ts",
      args: [dateKst],
    },
    {
      name: "2. Contradiction ledger",
      script: "scripts/build-contradiction-ledger-v1.ts",
      args: [dateKst],
    },
    {
      name: "3. Contradiction severity audit",
      script: "scripts/build-contradiction-severity-audit-v1.ts",
      args: [dateKst],
    },
    {
      name: "4. Dataset coverage dashboard",
      script: "scripts/build-dataset-coverage-dashboard-v1.ts",
      args: [dateKst],
    },
    {
      name: "5. Starter accumulation summary",
      script: "scripts/summarize-mlb-starter-accumulation-v1.ts",
      args: [],
    },
  ];

  for (const step of steps) {
    console.log(`\n--- START: ${step.name} ---`);
    const code = await spawnLocalTsxScript(step.script, step.args);
    if (code !== 0) {
      console.error(
        `\nFAILED: ${step.name} (exit ${code}). Later steps skipped.`,
      );
      process.exitCode = code;
      return;
    }
    console.log(`--- OK: ${step.name} ---`);
  }

  console.log("\n=== Research Ops Pipeline complete ===");
  console.log(`Correlation: data/audits/dataset-correlation-audit-v1-${dateKst}.json`);
  console.log("Contradiction ledger: data/research/contradiction-ledger-v1.json");
  console.log(
    "Severity: data/research/contradiction-severity-audit-v1.json",
  );
  console.log("Dashboard: data/research/dataset-coverage-dashboard-v1.json");
  console.log(
    "Starter summary: data/audits/starter-dataset-v1-accumulation-summary.json",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
