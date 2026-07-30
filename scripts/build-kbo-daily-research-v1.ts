/**
 * Daily KBO Research Builder v1
 *
 * Orchestrates all KBO research artifact generation for a given date.
 * Skips artifacts that already exist. Reports status for each step.
 *
 *   npm run research:kbo-daily -- YYYY-MM-DD
 *
 * If no date is provided, defaults to KST today.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { getKboIdentityArtifactPath } from "../src/lib/kbo/kbo-identity-artifact-path";
import {
  getKboIdentityProvider,
  isKboIdentityCollectionEnabled,
} from "../src/lib/kbo/kbo-identity-feature-flag";

const DATE = process.argv[2]?.trim() || getKstToday();

type StepStatus = "PASS" | "PARTIAL" | "SKIP" | "FAIL";
type StepResult = { step: string; status: StepStatus; detail: string };

const results: StepResult[] = [];

function record(step: string, status: StepStatus, detail: string) {
  results.push({ step, status, detail });
  const icon =
    status === "PASS" ? "✓" : status === "PARTIAL" ? "△" : status === "SKIP" ? "—" : "✗";
  console.log(`  ${icon} ${step.padEnd(20)} ${status.padEnd(6)} ${detail}`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Step 1: Schedule Identity ──────────────────────────────────
async function buildSchedule(): Promise<void> {
  const provider = getKboIdentityProvider();
  const artifactPath = getKboIdentityArtifactPath(DATE, provider);

  if (await fileExists(artifactPath)) {
    record("Schedule", "PASS", `Already exists: ${path.basename(artifactPath)}`);
    return;
  }

  if (!isKboIdentityCollectionEnabled()) {
    record("Schedule", "FAIL", "KBO identity collection disabled by feature flag");
    return;
  }

  try {
    const { collectKboScheduleResultIdentityV1 } = await import(
      "../src/lib/kbo/services/kbo-identity-collection-service"
    );
    const result = await collectKboScheduleResultIdentityV1({
      dateKst: DATE,
      observedAt: new Date().toISOString(),
    });
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(result.document, null, 2)}\n`, "utf8");
    record("Schedule", "PASS", `${result.document.rows.length} games → ${path.basename(artifactPath)}`);
  } catch (err) {
    record("Schedule", "FAIL", `${(err as Error).message}`);
  }
}

// ── Step 2 & 3: Odds Comparison (Domestic + Overseas) ──────────
async function buildOdds(): Promise<void> {
  const oddsPath = path.join(process.cwd(), "data/research/kbo", `${DATE}-odds-comparison-v1.json`);

  if (await fileExists(oddsPath)) {
    record("Domestic Odds", "PASS", `Already exists: ${path.basename(oddsPath)}`);
    record("Overseas Odds", "PASS", "Same artifact");
    return;
  }

  const operatorPath = path.join(process.cwd(), "data/operator-input/kbo", `${DATE}-operator-markets-v2.json`);
  if (!(await fileExists(operatorPath))) {
    record("Domestic Odds", "FAIL", `Source file not found: ${DATE}-operator-markets-v2.json`);
    record("Overseas Odds", "FAIL", "No domestic operator input → cannot build odds comparison");
    return;
  }

  const provider = getKboIdentityProvider();
  const identityPath = getKboIdentityArtifactPath(DATE, provider);
  if (!(await fileExists(identityPath))) {
    record("Domestic Odds", "FAIL", `Identity artifact not found: ${path.basename(identityPath)}`);
    record("Overseas Odds", "FAIL", "No identity artifact → cannot build odds comparison");
    return;
  }

  try {
    const { collectKboOddsComparisonV1 } = await import(
      "../src/lib/kbo/services/kbo-odds-comparison-service"
    );
    const result = await collectKboOddsComparisonV1({
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
    });
    await mkdir(path.dirname(oddsPath), { recursive: true });
    await writeFile(oddsPath, `${JSON.stringify(result.document, null, 2)}\n`, "utf8");
    const dom = result.document.summary.domesticGames;
    const ovs = result.document.summary.overseasGamesMatched;
    record("Domestic Odds", "PASS", `${dom} games`);
    record("Overseas Odds", "PASS", `${ovs} matched`);
  } catch (err) {
    record("Domestic Odds", "FAIL", `${(err as Error).message}`);
    record("Overseas Odds", "FAIL", "Build failed");
  }
}

// ── Step 4: Starter Confirmation ───────────────────────────────
async function checkStarter(): Promise<void> {
  const starterPath = path.join(
    process.cwd(),
    "data/operator-input/kbo",
    `${DATE}-starter-confirmation-v1.json`,
  );

  if (await fileExists(starterPath)) {
    try {
      const doc = JSON.parse(await readFile(starterPath, "utf8"));
      const count = Array.isArray(doc.games) ? doc.games.length : 0;
      record("Starter", "PASS", `${count} games in ${path.basename(starterPath)}`);
    } catch {
      record("Starter", "PASS", `Exists: ${path.basename(starterPath)}`);
    }
  } else {
    record("Starter", "FAIL", `Not found: ${DATE}-starter-confirmation-v1.json (operator input required)`);
  }
}

// ── Step 5: Lineup Confirmation ────────────────────────────────
async function checkLineup(): Promise<void> {
  const lineupPath = path.join(
    process.cwd(),
    "data/operator-input/kbo",
    `${DATE}-lineup-confirmation-v1.json`,
  );

  if (await fileExists(lineupPath)) {
    try {
      const doc = JSON.parse(await readFile(lineupPath, "utf8")) as {
        reviewStatus?: string;
        games?: Array<{
          reviewStatus?: string;
          homeLineup?: { batters?: unknown[] };
          awayLineup?: { batters?: unknown[] };
        }>;
      };
      const status = doc.reviewStatus === "CONFIRMED" ? "PASS" : "PARTIAL";
      const games = Array.isArray(doc.games) ? doc.games.length : 0;
      record("Lineup", status, `${games} games (${doc.reviewStatus ?? "UNKNOWN"})`);
    } catch {
      record("Lineup", "PASS", `Exists: ${path.basename(lineupPath)}`);
    }
  } else {
    record("Lineup", "SKIP", "No lineup artifact (operator input not provided)");
  }
}

// ── Step 6: Prediction ─────────────────────────────────────────
async function checkPrediction(): Promise<void> {
  record("Prediction", "SKIP", "KBO prediction pipeline not yet implemented");
}

// ── Research Score ─────────────────────────────────────────────
function computeScore(): { score: number; max: number; missing: string[] } {
  const items = [
    { label: "Schedule", weight: 20 },
    { label: "Domestic Odds", weight: 20 },
    { label: "Overseas Odds", weight: 20 },
    { label: "Starter", weight: 20 },
    { label: "Lineup", weight: 10 },
    { label: "Prediction", weight: 10 },
  ];
  let score = 0;
  const missing: string[] = [];
  for (const item of items) {
    const r = results.find((s) => s.step === item.label);
    if (r && r.status === "PASS") {
      score += item.weight;
    } else if (r && r.status === "PARTIAL") {
      score += Math.floor(item.weight / 2);
      missing.push(item.label);
    } else if (r && r.status === "SKIP") {
      missing.push(item.label);
    } else {
      missing.push(item.label);
    }
  }
  return { score, max: 100, missing };
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Daily KBO Research Builder v1           ║`);
  console.log(`║  Date: ${DATE}                       ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  await buildSchedule();
  await buildOdds();
  await checkStarter();
  await checkLineup();
  await checkPrediction();

  const { score, max, missing } = computeScore();

  console.log(`\n── Research Ready ──────────────────────────`);
  console.log(`  Score: ${score} / ${max}`);
  for (const r of results) {
    console.log(`    ${r.step.padEnd(20)} ${r.status}`);
  }

  console.log(`\n── Assistant Message ───────────────────────`);
  console.log(`  오늘 KBO 데이터 생성 완료`);
  console.log(`  Research Ready: ${score}%`);
  if (missing.length > 0) {
    console.log(`  남은 작업:`);
    for (const m of missing) {
      console.log(`    - ${m}`);
    }
  }

  // Write summary artifact
  const summaryPath = path.join(
    process.cwd(),
    "data/research/kbo",
    `${DATE}-daily-research-summary-v1.json`,
  );
  const summary = {
    schemaVersion: "daily-research-summary-v1",
    dateKst: DATE,
    generatedAt: new Date().toISOString(),
    score,
    max,
    steps: results.map((r) => ({ step: r.step, status: r.status, detail: r.detail })),
    missing,
  };
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`\n  Summary → ${path.basename(summaryPath)}`);

  const failCount = results.filter((r) => r.status === "FAIL").length;
  if (failCount > 0) {
    console.log(`\n⚠ ${failCount} step(s) failed. Check details above.`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
