/**
 * CLI: Football 1X2 Pregame Market Comparison v0 (research overlay).
 *
 *   npm run research:football-1x2-market-comparison -- --date 2026-08-16
 *   npm run research:football-1x2-market-comparison -- --date 2026-08-16 --dry-run
 *
 * --dry-run: zero artifact writes AND zero Odds Provider /odds calls.
 * Does not write football-1x2-odds-v1. Does not run Prediction.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getOddsProvider, resolveOddsProviderKind } from "../src/lib/odds";
import type { OddsData, OddsSportInfo, OddsUsageMeta } from "../src/lib/odds/types";
import {
  assembleFootball1x2MarketComparisonV0,
  football1x2MarketComparisonV0Rel,
  loadObservedSlateV0,
  resolveResearchSportKey,
} from "../src/lib/football/1x2-market-comparison-v0";

function usage(): string {
  return `Usage:
  npm run research:football-1x2-market-comparison -- --date 2026-08-16 [--dry-run] [--json]
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

  if (args.dateKst !== "2026-08-16") {
    throw new Error(
      `COMPARISON_DATE_UNSUPPORTED: v0 builder is sealed to batch-2207 / 2026-08-16 (got ${args.dateKst})`,
    );
  }

  const loaded = await loadObservedSlateV0();
  const generatedAt = new Date().toISOString();
  const targets = loaded.slate.games.filter(
    (g) => g.researchUsageEligibility === "FUTURE_RESEARCH_ELIGIBLE",
  );

  let sports: OddsSportInfo[] = [];
  const eventsBySportKey: Record<string, OddsData[]> = {};
  const collectedAtBySportKey: Record<string, string | null> = {};
  const cachedBySportKey: Record<string, boolean> = {};
  let providerCalled = false;
  let usageMeta: OddsUsageMeta | null = null;

  if (!args.dryRun) {
    const kind = resolveOddsProviderKind();
    if (kind === "dummy") {
      throw new Error(
        "DUMMY_ODDS_PROVIDER_NOT_RESEARCH: refuse dummy OddsProvider for research collect",
      );
    }
    const provider = getOddsProvider();
    if (provider.kind === "dummy") {
      throw new Error("DUMMY_ODDS_PROVIDER_NOT_RESEARCH");
    }
    if (!provider.listSports) {
      throw new Error("ODDS_LIST_SPORTS_REQUIRED");
    }

    const nowMs = Date.now();
    const sportsResult = await provider.listSports();
    sports = sportsResult.sports;
    usageMeta = sportsResult.usage;

    const keysToFetch = new Set<string>();
    for (const game of targets) {
      const kickoffMs = game.providerKickoffUtc
        ? Date.parse(game.providerKickoffUtc)
        : NaN;
      if (Number.isFinite(kickoffMs) && nowMs >= kickoffMs) {
        continue;
      }
      const resolved = resolveResearchSportKey({
        providerCompetitionId: game.providerCompetitionId,
        sports,
      });
      if (resolved.status === "MAPPED") keysToFetch.add(resolved.sportKey);
    }

    for (const sportKey of [...keysToFetch].sort()) {
      const got = await provider.getOdds({
        sportKey,
        markets: "h2h",
        regions: "eu",
      });
      eventsBySportKey[sportKey] = got.events;
      collectedAtBySportKey[sportKey] = got.fetchedAt;
      cachedBySportKey[sportKey] = got.cached;
      usageMeta = got.usage;
      providerCalled = true;
    }
  }

  const document = assembleFootball1x2MarketComparisonV0({
    ...loaded,
    generatedAt,
    sports,
    eventsBySportKey,
    collectedAtBySportKey,
    cachedBySportKey,
    providerCalled,
    usage: usageMeta,
  });

  const rel = football1x2MarketComparisonV0Rel(args.dateKst);
  let wrote = false;
  if (!args.dryRun) {
    const abs = path.join(process.cwd(), rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    wrote = true;
  }

  const summary = {
    wrote,
    dryRun: args.dryRun,
    rel,
    providerCalled,
    ...document.summary,
    rows: document.rows.map((r) => ({
      fixtureId: r.fixtureId,
      matchup: r.matchup,
      identityStatus: r.identityStatus,
      cutoff: r.external.cutoffStatus,
      sportKey: r.external.sportKey,
      providerEventId: r.external.providerEventId,
      collectedAt: r.external.collectedAt,
      gapComputed: r.probabilityGap.computed,
    })),
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
