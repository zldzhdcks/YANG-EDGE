/**
 * Research slate source freeze.
 *
 *   npm run research:slate-source-freeze -- --date 2026-09-19
 *
 * Explicit --date YYYY-MM-DD required. No implicit today.
 * Does not invent an operator slate when input is missing.
 */
import {
  assertExplicitDateKst,
  freezeResearchSlateSource,
} from "../src/lib/research/slate-source-freeze";

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

  const result = await freezeResearchSlateSource({ dateKst });

  console.log(`DATE=${dateKst}`);
  console.log(`INPUT_PATH=${result.inputPath ?? "NONE"}`);
  console.log(`INPUT_STATUS=${result.status}`);
  console.log(`INPUT_REVIEW_STATUS=${result.inputReviewStatus ?? "NONE"}`);
  console.log(
    `SCOPE_COMPLETENESS_STATUS=${result.scopeCompletenessStatus ?? "NONE"}`,
  );
  console.log(
    `SOURCE_GAME_COUNT=${
      result.sourceGameCountAuthoritative
        ? String(result.sourceGameCount)
        : "NOT_AUTHORITATIVE"
    }`,
  );
  console.log(
    `SOURCE_GAME_COUNT_AUTHORITATIVE=${result.sourceGameCountAuthoritative}`,
  );
  console.log(`SOURCE_RAW_SHA256=${result.sourceRawSha256 ?? "NONE"}`);
  console.log(`FREEZE_STATUS=${result.status}`);
  console.log(`FREEZE_CREATED=${result.freezeCreated}`);
  console.log(`OUTPUT_PATH=${result.outputPath ?? "NONE"}`);
  console.log(`NETWORK_CALLS=${result.networkCalls}`);
  console.log(`PROVIDER_CALLS=${result.providerCalls}`);
  console.log(`EXCLUSIVE_CREATE=wx`);
  console.log(`MESSAGE=${result.message}`);

  if (
    result.status === "SOURCE_FREEZE_INPUT_MISSING" ||
    result.status === "SOURCE_FREEZE_INPUT_INVALID" ||
    result.status === "SOURCE_FREEZE_NOT_VERIFIED" ||
    result.status === "SOURCE_FREEZE_CONFLICT"
  ) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
