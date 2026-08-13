/**
 * CLI: Football Schedule Dataset v1
 *
 *   npm run research:football-schedule -- --date 2026-08-13
 *   npm run research:football-schedule -- --date 2026-08-13 --dry-run
 *   npm run research:football-schedule -- --date 2026-08-12 --rejoin
 *
 * --rejoin re-resolves team identity on an existing artifact. No Provider fetch.
 * Dummy provider and product GAMES rows are rejected on live collect.
 */
import {
  getFootballProvider,
  resolveFootballProviderKind,
} from "../src/lib/football";
import {
  buildFootballScheduleV1,
  rejoinFootballScheduleV1,
} from "../src/lib/football/core";

function usage(): string {
  return `Usage:
  npm run research:football-schedule -- --date YYYY-MM-DD [--dry-run] [--json] [--rejoin]
`;
}

function parseArgs(argv: string[]) {
  let dateKst = "";
  let dryRun = false;
  let json = false;
  let rejoin = false;
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
    if (a === "--rejoin") {
      rejoin = true;
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
  return { dateKst, dryRun, json, rejoin };
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

  const runGeneratedAt = new Date().toISOString();
  console.log(`runGeneratedAt=${runGeneratedAt}`);

  if (args.rejoin) {
    const { document, wrote, outRel, before } = await rejoinFootballScheduleV1({
      dateKst: args.dateKst,
      dryRun: args.dryRun,
      generatedAt: runGeneratedAt,
    });
    console.log(
      [
        args.dateKst,
        "rejoin",
        `rows=${before.scheduleGames}→${document.meta.scheduleGames}`,
        `matched=${before.identityMatched}→${document.meta.identityMatched}`,
        `blocked=${before.identityBlocked}→${document.meta.identityBlocked}`,
        `eligibleFormat=${before.formatEligible}→${document.meta.formatEligible}`,
        `notSupported=${before.formatNotSupported}→${document.meta.formatNotSupported}`,
        args.dryRun ? "dry-run" : wrote ? `wrote ${outRel}` : "no-write",
      ].join(" "),
    );
    if (args.json) console.log(JSON.stringify(document, null, 2));
    return;
  }

  const kind = resolveFootballProviderKind();
  if (kind === "dummy") {
    throw new Error(
      "DUMMY_PROVIDER_NOT_RESEARCH: set FOOTBALL_PROVIDER=api-football and FOOTBALL_API_KEY",
    );
  }

  const provider = getFootballProvider();
  const fetched = await provider.getFixtures({
    date: args.dateKst,
    timezone: "Asia/Seoul",
  });

  const { document, wrote, outRel } = await buildFootballScheduleV1({
    dateKst: args.dateKst,
    dryRun: args.dryRun,
    generatedAt: runGeneratedAt,
    fixtures: fetched.fixtures,
    source: "api-football",
  });

  console.log(
    [
      args.dateKst,
      `rows=${document.meta.scheduleGames}`,
      `matched=${document.meta.identityMatched}`,
      `blocked=${document.meta.identityBlocked}`,
      `eligibleFormat=${document.meta.formatEligible}`,
      `notSupported=${document.meta.formatNotSupported}`,
      `dropped=${document.meta.droppedUnregisteredCompetition}`,
      args.dryRun ? "dry-run" : wrote ? `wrote ${outRel}` : "no-write",
    ].join(" "),
  );
  if (args.json) console.log(JSON.stringify(document, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
