/**
 * CLI: Football Odds Bridge Candidate Intake v1
 *
 *   npm run research:football-odds-bridge-candidates -- --date YYYY-MM-DD
 *   npm run research:football-odds-bridge-candidates -- --date YYYY-MM-DD --dry-run
 *
 * Discovery uses OddsProvider.listEvents only. getOdds is never called.
 * Dummy provider is refused. Does not mutate team-bridge.ts.
 * Does not rewrite Odds / Snapshot / Prediction artifacts.
 *
 * Do not live-run against 2026-08-20 after pregame freeze.
 */
import { getOddsProvider, resolveOddsProviderKind } from "../src/lib/odds";
import {
  assertLiveOddsBridgeIntakeProvider,
  buildFootballOddsBridgeCandidateIntakeV1,
} from "../src/lib/football/odds-bridge-intake-v1";

function usage(): string {
  return `Usage:
  npm run research:football-odds-bridge-candidates -- --date YYYY-MM-DD [--dry-run] [--json]
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

  const observedAt = new Date().toISOString();
  const generatedAt = new Date().toISOString();
  console.log(`observedAt=${observedAt}`);
  console.log(`generatedAt=${generatedAt}`);
  console.log(`dryRun=${args.dryRun}`);

  if (!args.dryRun) {
    const kind = resolveOddsProviderKind();
    if (kind === "dummy") {
      throw new Error(
        "DUMMY_ODDS_PROVIDER_NOT_RESEARCH: refuse dummy OddsProvider for bridge candidate intake",
      );
    }
  }

  const result = await buildFootballOddsBridgeCandidateIntakeV1({
    dateKst: args.dateKst,
    observedAt,
    generatedAt,
    dryRun: args.dryRun,
    writeArtifact: !args.dryRun,
    listEvents: args.dryRun
      ? undefined
      : async (sportKey) => {
          const provider = getOddsProvider();
          assertLiveOddsBridgeIntakeProvider(provider);
          const listed = await provider.listEvents!(sportKey);
          return { events: listed.events };
        },
  });

  const m = result.document.meta;
  const summary = {
    dateKst: m.dateKst,
    rel: result.rel,
    wrote: result.wrote,
    dryRun: args.dryRun,
    wouldCallProvider: result.wouldCallProvider,
    providerCalled: result.providerCalled,
    providerMethod: m.providerMethod,
    providerCalls: m.providerCalls,
    uniqueSportKeysRequested: m.uniqueSportKeysRequested,
    eventsObserved: m.eventsObserved,
    candidateRows: m.candidateRows,
    reviewRequired: m.reviewRequired,
    blockedRows: m.blockedRows,
    counts: m.counts,
    predictionInput: m.predictionInput,
    researchOnly: m.researchOnly,
    legalStatus: m.legalStatus,
    artifactHash: m.artifactHash,
    sourceScheduleArtifactHash: m.sourceScheduleArtifactHash,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      [
        `rel=${result.rel}`,
        `wrote=${result.wrote}`,
        `wouldCallProvider=${result.wouldCallProvider}`,
        `providerCalled=${result.providerCalled}`,
        `providerMethod=${m.providerMethod}`,
        `providerCalls=${m.providerCalls}`,
        `uniqueSportKeys=${m.uniqueSportKeysRequested.join(",") || "-"}`,
        `reviewRequired=${m.reviewRequired}`,
        `blockedRows=${m.blockedRows}`,
        `predictionInput=${m.predictionInput}`,
        `artifactHash=${m.artifactHash}`,
      ].join("\n"),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
