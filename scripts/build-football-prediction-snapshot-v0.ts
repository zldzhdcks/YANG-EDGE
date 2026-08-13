/**
 * CLI: Football Prediction Input Snapshot v0
 *
 *   npm run research:football-prediction-snapshot -- --date 2026-08-14
 *   npm run research:football-prediction-snapshot -- --date 2026-08-14 --dry-run
 *
 * Reads Schedule + Odds research artifacts only.
 * No Provider. No Odds builder. freezeAt = now.
 */
import { buildFootballPredictionSnapshotV0 } from "../src/lib/football/prediction-snapshot-v0";

function usage(): string {
  return `Usage:
  npm run research:football-prediction-snapshot -- --date YYYY-MM-DD [--dry-run] [--json]
`;
}

function parseArgs(argv: string[]) {
  let dateKst = "";
  let dryRun = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--date") {
      const v = argv[++i];
      if (!v) throw new Error("--date requires YYYY-MM-DD");
      dateKst = v;
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a)) {
      dateKst = a;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) throw new Error("HELP");
  return { dateKst, dryRun, json };
}

async function main() {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(msg);
    console.log(usage());
    process.exit(1);
  }

  const freezeAt = new Date().toISOString();
  const generatedAt = new Date().toISOString();
  console.log(`freezeAt=${freezeAt}`);
  console.log(`generatedAt=${generatedAt}`);
  console.log(`dryRun=${args.dryRun}`);

  const result = await buildFootballPredictionSnapshotV0({
    dateKst: args.dateKst,
    freezeAt,
    generatedAt,
    dryRun: args.dryRun,
  });

  const m = result.document.meta;
  const frozen = result.document.matches.filter(
    (row) => row.snapshotStatus === "FROZEN",
  );
  const summary = {
    dateKst: m.dateKst,
    rel: result.rel,
    wrote: result.wrote,
    dryRun: args.dryRun,
    freezeAt: m.freezeAt,
    selectionPolicy: m.selectionPolicy,
    prediction: m.prediction,
    engine: m.engine,
    scheduleGames: m.scheduleGames,
    eligibleGames: m.eligibleGames,
    frozenGames: m.frozenGames,
    noUsableOddsGames: m.noUsableOddsGames,
    notEligibleGames: m.notEligibleGames,
    blockedGames: m.blockedGames,
    missedFreezeWindowGames: m.missedFreezeWindowGames,
    sourceScheduleArtifactHashAtFreeze: m.sourceScheduleArtifactHashAtFreeze,
    sourceOddsArtifactHashAtFreeze: m.sourceOddsArtifactHashAtFreeze,
    snapshotHash: m.snapshotHash,
    frozen: frozen.map((row) => ({
      matchId: row.matchId,
      snapshotStatus: row.snapshotStatus,
      selectedOddsObservationId: row.selectedOddsObservationId,
      selectedOddsObservationHash: row.selectedOddsObservationHash,
      observedAt: row.frozenOddsObservation?.observedAt ?? null,
    })),
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      [
        `rel=${result.rel}`,
        `wrote=${result.wrote}`,
        `frozenGames=${m.frozenGames}`,
        `notEligibleGames=${m.notEligibleGames}`,
        `snapshotHash=${m.snapshotHash}`,
      ].join("\n"),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
