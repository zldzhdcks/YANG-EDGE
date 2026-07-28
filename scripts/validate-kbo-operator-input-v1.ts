/**
 * Validate KBO operator scope / proto odds input v1.
 *
 * If files are missing, exits successfully with NOT_ENTERED audit.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { validateKboOperatorInput } from "../src/lib/kbo/operator-input/validate-kbo-operator-input";

function targetDate(): string {
  return process.argv[2]?.trim() || getKstToday();
}

async function main() {
  const dateKst = targetDate();
  const { identity, betmanScope, protoOdds, validation } =
    await validateKboOperatorInput({ dateKst });

  const audit = {
    targetDateKst: dateKst,
    betmanScopeFile: validation.betmanScopeFile,
    protoOddsFile: validation.protoOddsFile,
    scopeGamesEntered: validation.scopeGamesEntered,
    scopeGamesVerified: validation.scopeGamesVerified,
    scopeGamesMatched: validation.scopeGamesMatched,
    scopeGamesUnmatched: validation.scopeGamesUnmatched,
    scopeGamesAmbiguous: validation.scopeGamesAmbiguous,
    oddsRowsEntered: validation.oddsRowsEntered,
    oddsRowsVerified: validation.oddsRowsVerified,
    oddsRowsRejected: validation.oddsRowsRejected,
    oddsGamesMatched: validation.oddsGamesMatched,
    duplicateRows: validation.duplicateRows,
    invalidOdds: validation.invalidOdds,
    identityGamesAvailable: validation.identityGamesAvailable,
    operatorOnlyGames: validation.operatorOnlyGames,
    blockingReasons: validation.blockingReasons,
    inputReadyStatus: validation.inputReadyStatus,
    generatedAt: validation.generatedAt,
    legalStatus: {
      usage: "INTERNAL_RESEARCH_ONLY",
      publicDisplay: "LEGAL_CLEARANCE_PENDING",
      commercialUse: "LEGAL_CLEARANCE_PENDING",
      betmanCollection: "MANUAL_ONLY",
      protoOddsCollection: "MANUAL_ONLY",
    },
    identityResultHash: identity.meta.resultHashSha256,
    betmanEntered: betmanScope != null,
    protoOddsEntered: protoOdds != null,
  };

  const outPath = path.join(
    process.cwd(),
    "data/audits",
    `${dateKst}-kbo-operator-input-v1-audit.json`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log("=== KBO Operator Input Validation ===");
  console.log("");
  console.log("Scope games entered:");
  console.log(String(validation.scopeGamesEntered));
  console.log("");
  console.log("Identity matched:");
  console.log(String(validation.scopeGamesMatched));
  console.log("");
  console.log("Identity missing:");
  console.log(String(validation.scopeGamesUnmatched));
  console.log("");
  console.log("Odds rows verified:");
  console.log(String(validation.oddsRowsVerified));
  console.log("");
  console.log("Input status:");
  console.log(validation.inputReadyStatus);
  console.log("");
  console.log("Blocking reasons:");
  if (validation.blockingReasons.length === 0) {
    console.log("- none");
  } else {
    for (const reason of validation.blockingReasons) {
      console.log(`- ${reason}`);
    }
  }
  console.log("");
  console.log("찬양님 확인 필요:");
  console.log("- 미매칭 경기의 Provider Identity 확보");
  console.log("- 배당 원문과 입력값 재확인");
  console.log(`Audit: ${outPath}`);
  console.log("KBO_OPERATOR_INPUT_V1_READY");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
