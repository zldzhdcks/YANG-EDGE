/**
 * CLI: Football Official Result v0
 *
 *   npm run result:football -- --date 2026-08-14
 *   npm run result:football -- --date 2026-08-14 --dry-run
 *   npm run result:football -- --date 2026-08-14 --json
 *
 * Provider-derived only. Manual score flags are rejected.
 */
import { buildFootballOfficialResultV0 } from "../src/lib/football/official-result-v0";

const FORBIDDEN_FLAGS = [
  "--result-score",
  "--home-score",
  "--away-score",
  "--observed-at",
];

function usage(): string {
  return `Usage:
  npm run result:football -- --date YYYY-MM-DD [--dry-run] [--json]
`;
}

function parseArgs(argv: string[]) {
  for (const a of argv) {
    if (FORBIDDEN_FLAGS.includes(a)) {
      throw new Error(
        `FOOTBALL_OFFICIAL_RESULT_MANUAL_SCORE_FORBIDDEN: ${a}`,
      );
    }
  }
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

  const now = new Date().toISOString();
  console.log(`resultObservedAt=${now}`);
  console.log(`generatedAt=${now}`);
  console.log(`dryRun=${args.dryRun}`);

  const result = await buildFootballOfficialResultV0({
    dateKst: args.dateKst,
    generatedAt: now,
    resultObservedAt: now,
    dryRun: args.dryRun,
  });

  const first = result.matchSummaries[0] ?? null;
  const summary = {
    dateKst: args.dateKst,
    rel: result.rel,
    wrote: result.wrote,
    dryRun: args.dryRun,
    outcome: result.outcome,
    terminalFinal: result.terminalFinal,
    providerRequestCount: result.providerRequestCount,
    providerCachedCount: result.providerCachedCount,
    providerStatusRaw: result.providerStatusRaw,
    resultStatus: result.resultStatus,
    regularTime: first?.regularTime ?? null,
    extraTime: first?.extraTime ?? null,
    penalties: first?.penalties ?? null,
    oneXTwoOutcome: first?.oneXTwoOutcome ?? null,
    advancementWinner: first?.advancementWinner ?? null,
    usability: first?.usability ?? null,
    gradingAllowed: first?.gradingAllowed ?? null,
    resultHash: first?.resultHash ?? null,
    resultArtifactHash: result.document?.meta.resultArtifactHash ?? null,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      [
        `outcome=${result.outcome}`,
        `rel=${result.rel}`,
        `wrote=${result.wrote}`,
        `terminalFinal=${result.terminalFinal}`,
        `providerStatusRaw=${result.providerStatusRaw ?? ""}`,
        `regularTime=${first ? `${first.regularTime.home}-${first.regularTime.away}` : ""}`,
        `oneXTwoOutcome=${first?.oneXTwoOutcome ?? ""}`,
        `resultHash=${first?.resultHash ?? ""}`,
        `resultArtifactHash=${result.document?.meta.resultArtifactHash ?? ""}`,
        `providerRequestCount=${result.providerRequestCount}`,
      ].join("\n"),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
