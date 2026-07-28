/**
 * KBO Starter Operator Input v1 validator.
 *
 *   npm run research:kbo-starter-input -- YYYY-MM-DD
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import {
  ensureKboStarterConfirmationDraftFile,
  validateKboStarterOperatorInputV1,
} from "../src/lib/kbo/operator-starter/validate-kbo-starter-operator-input-v1";

function targetDate(): string {
  return process.argv[2]?.trim() || getKstToday();
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readHashIfExists(rel: string): Promise<string | null> {
  try {
    return sha256(await readFile(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const dateKst = targetDate();
  const cwd = process.cwd();

  const before = {
    kboIdentity: await readHashIfExists(
      `data/research/kbo/${dateKst}-schedule-result-identity-v1-api-baseball.json`,
    ),
    operatorMarketsV2: await readHashIfExists(
      `data/operator-input/kbo/${dateKst}-operator-markets-v2.json`,
    ),
    oddsComparison: await readHashIfExists(
      `data/research/kbo/${dateKst}-odds-comparison-v1.json`,
    ),
    marketFeedback: await readHashIfExists(
      `data/research/kbo/${dateKst}-market-result-feedback-v1.json`,
    ),
    mlbPrediction: await readHashIfExists("data/predictions/mlb/2026-07-27.json"),
  };

  const scaffold = await ensureKboStarterConfirmationDraftFile({
    dateKst,
    cwd,
  });
  if (scaffold.created) {
    console.log(`Draft scaffold created: ${scaffold.path}`);
  }

  const { audit } = await validateKboStarterOperatorInputV1({ dateKst, cwd });

  const outPath = path.join(
    cwd,
    "data/audits",
    `${dateKst}-kbo-starter-operator-input-v1-audit.json`,
  );

  const after = {
    kboIdentity: await readHashIfExists(
      `data/research/kbo/${dateKst}-schedule-result-identity-v1-api-baseball.json`,
    ),
    operatorMarketsV2: await readHashIfExists(
      `data/operator-input/kbo/${dateKst}-operator-markets-v2.json`,
    ),
    oddsComparison: await readHashIfExists(
      `data/research/kbo/${dateKst}-odds-comparison-v1.json`,
    ),
    marketFeedback: await readHashIfExists(
      `data/research/kbo/${dateKst}-market-result-feedback-v1.json`,
    ),
    mlbPrediction: await readHashIfExists("data/predictions/mlb/2026-07-27.json"),
  };

  const fullAudit = {
    ...audit,
    regression: {
      before,
      after,
      unchanged:
        before.kboIdentity === after.kboIdentity &&
        before.operatorMarketsV2 === after.operatorMarketsV2 &&
        before.oddsComparison === after.oddsComparison &&
        before.marketFeedback === after.marketFeedback &&
        before.mlbPrediction === after.mlbPrediction,
    },
    scaffoldCreated: scaffold.created,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(fullAudit, null, 2)}\n`, "utf8");

  console.log("=== KBO Starter Operator Input v1 ===");
  console.log("");
  console.log(`target date KST: ${dateKst}`);
  console.log(`identity Provider: ${audit.identityProvider ?? "NONE"}`);
  console.log(`identity games: ${audit.identityGames}`);
  console.log(`input games: ${audit.inputGames}`);
  console.log(`matched games: ${audit.matchedGames}`);
  console.log(`unmatched games: ${audit.unmatchedGames}`);
  console.log(`starters entered: away=${audit.awayStartersEntered} home=${audit.homeStartersEntered}`);
  console.log(`confirmed starters: ${audit.confirmedStarters}`);
  console.log(`probable starters: ${audit.probableStarters}`);
  console.log(`input status: ${audit.inputStatus}`);
  console.log(`cutoff violations: ${audit.cutoffViolations}`);
  console.log(`source references missing: ${audit.sourceReferenceMissing}`);
  console.log(`stable input hash: ${audit.stableInputHashSha256 ?? "null"}`);
  console.log("");
  if (audit.missing.length > 0) {
    console.log("Missing:");
    for (const item of audit.missing) console.log(`- ${item}`);
    console.log("");
  }
  if (audit.blockingReasons.length > 0) {
    console.log("Blocking reasons:");
    for (const reason of audit.blockingReasons) console.log(`- ${reason}`);
    console.log("");
  }
  console.log(`Audit: ${outPath}`);
  console.log("KBO_STARTER_OPERATOR_INPUT_V1_READY");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
