/**
 * Current-date research target scope lock.
 *
 *   npm run research:daily-scope-lock -- --date 2026-09-19
 *
 * Explicit --date YYYY-MM-DD is required. No implicit today.
 * Does not invent a slate or create a fake empty lock when source is missing.
 */
import {
  assertExplicitDateKst,
  lockResearchTargetScope,
  verifyDecisionCoverage,
} from "../src/lib/research/daily-scope-lock";

function parseArgs(argv: string[]): { date: string | null } {
  let date: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") {
      date = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--date=")) {
      date = arg.slice("--date=".length);
    }
  }
  return { date };
}

async function main() {
  const { date } = parseArgs(process.argv.slice(2));
  if (!date) {
    console.error("EXPLICIT_DATE_REQUIRED: pass --date YYYY-MM-DD");
    process.exitCode = 2;
    return;
  }

  let dateKst: string;
  try {
    dateKst = assertExplicitDateKst(date);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
    return;
  }

  const result = await lockResearchTargetScope({ dateKst });
  const coverage = verifyDecisionCoverage({
    scopeLock: result.document,
    sealedDecisionTargetIds: [],
    sourceMissing: result.status === "TARGET_SCOPE_SOURCE_MISSING",
  });

  console.log(`DATE=${dateKst}`);
  console.log(`SOURCE_STATUS=${result.sourceStatus}`);
  console.log(`LOCK_STATUS=${result.status}`);
  console.log(
    `TARGET_COUNT=${
      result.targetCountAuthoritative ? String(result.targetCount) : "NOT_AUTHORITATIVE"
    }`,
  );
  console.log(`EXCLUDED_COUNT=${result.excludedCount}`);
  console.log(`OUTPUT_PATH=${result.outputPath ?? "NONE"}`);
  console.log(`LOCK_CREATED=${result.lockCreated}`);
  console.log(`COVERAGE_STATUS=${coverage.status}`);
  console.log(`MESSAGE=${result.message}`);

  if (
    result.status === "TARGET_SCOPE_SOURCE_MISSING" ||
    result.status === "TARGET_SCOPE_SOURCE_INVALID" ||
    result.status === "TARGET_SCOPE_CONFLICT" ||
    result.status === "SCOPE_LOCK_CONFLICT"
  ) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
