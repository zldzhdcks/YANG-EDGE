import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { validateKboOperatorMarketInputV2 } from "../src/lib/kbo/operator-input-v2/validate-kbo-operator-market-input-v2";

function targetDate(): string {
  return process.argv[2]?.trim() || getKstToday();
}

async function main() {
  const dateKst = targetDate();
  const { input, identity, audit } = await validateKboOperatorMarketInputV2({
    dateKst,
  });

  const outPath = path.join(
    process.cwd(),
    "data/audits",
    `${dateKst}-kbo-operator-markets-v2-audit.json`,
  );

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    `${JSON.stringify(
      {
        ...audit,
        targetDateKst: dateKst,
        identityGamesAvailable: identity.rows.length,
        identityResultHash: identity.meta.resultHashSha256,
        topLevelReviewStatus: input.reviewStatus,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("=== KBO Operator Market Input v2 Validation ===");
  console.log("");
  console.log("Games entered:");
  console.log(String(audit.gamesEntered));
  console.log("");
  console.log("Markets entered:");
  console.log(String(audit.marketsEntered));
  console.log("");
  console.log("Selections entered:");
  console.log(String(audit.selectionsEntered));
  console.log("");
  console.log("Games matched:");
  console.log(String(audit.gamesMatched));
  console.log("");
  console.log("Games unmatched:");
  console.log(String(audit.gamesUnmatched));
  console.log("");
  console.log("Input status:");
  console.log(audit.inputStatus);
  console.log("");
  console.log("Blocking reasons:");
  for (const reason of audit.blockingReasons) {
    console.log(`- ${reason}`);
  }
  console.log("");
  console.log(`Audit: ${outPath}`);
  console.log("KBO_OPERATOR_MARKET_INPUT_V2_READY");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
