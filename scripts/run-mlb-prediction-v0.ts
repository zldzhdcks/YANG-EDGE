/**
 * CLI: MLB Market-Aware Baseline Prediction v0 (MONEYLINE_2WAY).
 *
 *   npm run predict:mlb-v0 -- --date YYYY-MM-DD --dry-run
 *   npm run predict:mlb-v0 -- --date YYYY-MM-DD
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPredictionSnapshotV0,
  loadAndPredictMlbV0,
  snapshotWriteHash,
} from "../src/lib/mlb/prediction-v0";
import { getKstToday } from "../src/lib/datetime/kst";

function usage(): string {
  return `Usage:
  npm run predict:mlb-v0 -- --date YYYY-MM-DD [options]

Options:
  --date <YYYY-MM-DD>   Required (or defaults to KST today)
  --dry-run             Validate + preview; artifact write 0
  --game-id <id>        Repeatable filter
  --json                Print JSON result
  --observation-only    Force PASS / no official path
  --no-market-prior     Disable market prior contribution
  --help
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let json = false;
  let observationOnly = false;
  let useMarketPrior = true;
  const gameIds: string[] = [];

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
    if (a === "--observation-only") {
      observationOnly = true;
      continue;
    }
    if (a === "--no-market-prior") {
      useMarketPrior = false;
      continue;
    }
    if (a === "--date") {
      dateKst = argv[++i] ?? null;
      continue;
    }
    if (a === "--game-id") {
      const id = argv[++i];
      if (id) gameIds.push(id);
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a) && !dateKst) {
      dateKst = a;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }

  return {
    dateKst: dateKst || getKstToday(),
    dryRun,
    json,
    observationOnly,
    useMarketPrior,
    gameIds,
  };
}

async function main() {
  let opts: ReturnType<typeof parseArgs>;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Error && e.message === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(e instanceof Error ? e.message : e);
    console.error(usage());
    process.exit(1);
  }

  const load = await loadAndPredictMlbV0({
    dateKst: opts.dateKst,
    gameIds: opts.gameIds.length ? opts.gameIds : undefined,
    observationOnly: opts.observationOnly,
    useMarketPrior: opts.useMarketPrior,
  });

  if (load.kind === "blocked") {
    const out = {
      ok: false,
      blocked: true,
      reason: load.reason,
      message: load.message,
      warnings: load.warnings,
      dryRun: opts.dryRun,
      providerCalls: 0,
      written: false,
    };
    console.log(opts.json ? JSON.stringify(out, null, 2) : out.message);
    process.exit(2);
  }

  const generatedAt = new Date().toISOString();
  const snapshot = buildPredictionSnapshotV0({
    load,
    generatedAt,
    dryRun: opts.dryRun,
    observationOnly: opts.observationOnly,
    useMarketPrior: opts.useMarketPrior,
  });

  const outPath = path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${opts.dateKst}.json`,
  );

  let written = false;
  if (!opts.dryRun) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    written = true;
  }

  const preview = {
    ok: true,
    modelVersion: snapshot.meta.modelVersion,
    modelStatus: snapshot.meta.modelStatus,
    dateKst: opts.dateKst,
    dryRun: opts.dryRun,
    written,
    path: outPath.replace(/\\/g, "/"),
    providerCalls: 0,
    configHash: snapshot.meta.configHash,
    inputManifestHash: snapshot.meta.inputManifestHash,
    predictionHashSha256: snapshot.meta.predictionHashSha256,
    writeHash: snapshotWriteHash(snapshot),
    counts: {
      total: snapshot.summary.totalGames,
      eligible: snapshot.meta.eligibleCount,
      pass: snapshot.meta.passCount,
      blocked: snapshot.meta.blockedCount,
      researchBaseline: snapshot.meta.researchBaselineCount,
      officialPick: snapshot.meta.officialPickCount,
    },
    sample: snapshot.predictions.slice(0, 3).map((p) => ({
      gameId: p.gameId,
      matchup: `${p.awayTeam} @ ${p.homeTeam}`,
      homeProbability: (p.marketPredictions as Array<{ homeProbability: number }>)?.[0]
        ?.homeProbability,
      confidence: p.confidence,
      officialStatus: p.officialStatus,
      officialPick: p.officialPick,
      researchBaseline: p.researchBaseline,
    })),
  };

  console.log(JSON.stringify(preview, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
