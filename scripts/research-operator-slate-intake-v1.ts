/**
 * Manual operator slate intake.
 *
 *   npm run research:operator-slate-intake -- --date 2026-09-19 --mode validate
 *   npm run research:operator-slate-intake -- --date 2026-09-19 --mode readiness
 *   npm run research:operator-slate-intake -- --date 2026-09-19 --mode init-draft
 *
 * Explicit --date required. No implicit today.
 * init-draft must NOT be run against production for 2026-09-19 in this mission.
 *
 * Workflow:
 * 1 init-draft → 2 manual entry → 3 validate → 4–9 human review/attest
 * → 10 validate → 11 research:slate-source-freeze
 * Do not auto-perform review/attestation steps.
 */
import {
  assertExplicitDateKst,
} from "../src/lib/research/slate-source-freeze";
import {
  betmanDailySlateInputPath,
  initOperatorSlateDraft,
  validateOperatorSlateIntake,
} from "../src/lib/betman/daily-slate/operator-slate-intake";

function parseArgs(argv: string[]): {
  date: string | null;
  mode: string | null;
} {
  let date: string | null = null;
  let mode: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") {
      date = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--date=")) date = arg.slice("--date=".length);
    if (arg === "--mode") {
      mode = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--mode=")) mode = arg.slice("--mode=".length);
  }
  return { date, mode };
}

async function main() {
  const { date, mode } = parseArgs(process.argv.slice(2));
  if (!date) {
    console.error("EXPLICIT_DATE_REQUIRED: pass --date YYYY-MM-DD");
    process.exitCode = 2;
    return;
  }
  if (!mode) {
    console.error(
      "MODE_REQUIRED: pass --mode init-draft|validate|readiness",
    );
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

  const inputPath = betmanDailySlateInputPath(dateKst);

  if (mode === "init-draft") {
    const result = await initOperatorSlateDraft({ dateKst });
    console.log(`DATE=${dateKst}`);
    console.log(`INPUT_PATH=${inputPath}`);
    console.log(`INPUT_STATUS=${result.status}`);
    console.log(`REVIEW_STATUS=${result.document?.reviewStatus ?? "NONE"}`);
    console.log(
      `SCOPE_COMPLETENESS_STATUS=${
        result.document?.scopeCompletenessStatus ?? "NONE"
      }`,
    );
    console.log(`TOTAL_GAMES=${result.document ? 0 : "NONE"}`);
    console.log(`FREEZE_READY=false`);
    console.log(`NETWORK_CALLS=0`);
    console.log(`PROVIDER_CALLS=0`);
    if (result.status === "INPUT_ALREADY_EXISTS") process.exitCode = 1;
    return;
  }

  if (mode !== "validate" && mode !== "readiness") {
    console.error(`UNKNOWN_MODE:${mode}`);
    process.exitCode = 2;
    return;
  }

  const result = await validateOperatorSlateIntake({ dateKst });

  console.log(`DATE=${dateKst}`);
  console.log(`INPUT_PATH=${inputPath}`);
  console.log(`INPUT_STATUS=${result.intakeStatus}`);
  console.log(
    `REVIEW_STATUS=${result.input?.reviewStatus ?? "NONE"}`,
  );
  console.log(
    `SCOPE_COMPLETENESS_STATUS=${result.scopeCompletenessStatus ?? "NONE"}`,
  );
  console.log(
    `TOTAL_GAMES=${
      result.totalGamesAuthoritative
        ? String(result.totalGames)
        : "NOT_AUTHORITATIVE"
    }`,
  );
  console.log(`IDENTITY_READY_GAMES=${result.identityReadyGameCount}`);
  console.log(`BLOCKED_GAMES=${result.blockedGameCount}`);
  console.log(
    `DUPLICATE_IDS=${result.duplicateOperatorGameIds.join(",") || "NONE"}`,
  );
  console.log(
    `CROSS_DATE_GAMES=${result.crossDateGameIds.join(",") || "NONE"}`,
  );
  console.log(
    `UNVERIFIED_GAMES=${result.unverifiedGameIds.join(",") || "NONE"}`,
  );
  console.log(`FREEZE_READY=${result.freezeReady}`);
  console.log(
    `BLOCKING_REASONS=${
      result.blockingReasons.length
        ? result.blockingReasons.join("|")
        : result.intakeStatus === "INPUT_MISSING"
          ? "OPERATOR_INPUT_NOT_ENTERED"
          : "NONE"
    }`,
  );
  console.log(`NETWORK_CALLS=0`);
  console.log(`PROVIDER_CALLS=0`);

  if (!result.freezeReady) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
