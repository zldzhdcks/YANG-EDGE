/**
 * CLI: Football 90-minute 1X2 Research Odds Dataset v1
 *
 *   npm run research:football-1x2-odds -- --date 2026-08-14
 *   npm run research:football-1x2-odds -- --date 2026-08-14 --dry-run
 *
 * --dry-run: zero artifact writes AND zero Odds Provider calls.
 * Live collect calls The Odds API only when an ELIGIBLE_FORMAT row has
 * an explicit sport-key mapping AND both teams on the Odds team bridge.
 */
import { getOddsProvider, resolveOddsProviderKind } from "../src/lib/odds";
import { buildFootball1x2OddsV1 } from "../src/lib/football/odds-1x2-v1";

function usage(): string {
  return `Usage:
  npm run research:football-1x2-odds -- --date YYYY-MM-DD [--dry-run] [--json]
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
        "DUMMY_ODDS_PROVIDER_NOT_RESEARCH: refuse dummy OddsProvider for research collect",
      );
    }
  }

  const result = await buildFootball1x2OddsV1({
    dateKst: args.dateKst,
    observedAt,
    generatedAt,
    dryRun: args.dryRun,
    fetchOdds: args.dryRun
      ? undefined
      : async (sportKey) => {
          const provider = getOddsProvider();
          if (provider.kind === "dummy") {
            throw new Error("DUMMY_ODDS_PROVIDER_NOT_RESEARCH");
          }
          const got = await provider.getOdds({
            sportKey,
            markets: "h2h",
            regions: "eu",
          });
          return { events: got.events, usage: got.usage };
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
    providerSportKeysRequested: m.providerSportKeysRequested,
    scheduleEligibleGames: m.scheduleEligibleGames,
    providerEventsFetched: m.providerEventsFetched,
    joinedGames: m.joinedGames,
    notJoinedGames: m.notJoinedGames,
    ambiguousGames: m.ambiguousGames,
    complete1x2Games: m.complete1x2Games,
    partial1x2Games: m.partial1x2Games,
    pregameUsableGames: m.pregameUsableGames,
    lateGames: m.lateGames,
    skipped: m.skipped,
    requestsUsed: m.requestsUsed,
    requestsRemaining: m.requestsRemaining,
    requestCost: m.requestCost,
    artifactHash: m.artifactHash,
    sourceScheduleArtifactHash: m.sourceScheduleArtifactHash,
    researchOnly: m.researchOnly,
    legalStatus: m.legalStatus,
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
        `scheduleEligibleGames=${m.scheduleEligibleGames}`,
        `joinedGames=${m.joinedGames}`,
        `notJoinedGames=${m.notJoinedGames}`,
        `pregameUsableGames=${m.pregameUsableGames}`,
        `skipped.notSupportedFormat=${m.skipped.notSupportedFormat}`,
        `skipped.sportKeyNotMapped=${m.skipped.sportKeyNotMapped}`,
        `skipped.teamBridgeMissing=${m.skipped.teamBridgeMissing}`,
        `skipped.missedPregameWindow=${m.skipped.missedPregameWindow}`,
        `artifactHash=${m.artifactHash}`,
      ].join("\n"),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
