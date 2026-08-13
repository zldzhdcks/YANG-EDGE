/**
 * CLI: MLB Research Scorecard v1 (read-only / additive).
 *
 *   npm run scorecard:mlb-research-v1 -- --date 2026-08-12
 *   npm run scorecard:mlb-research-v1 -- --dates 2026-08-12,2026-08-13,2026-08-14 --cumulative
 *
 * Writes only research-scorecard-v1 artifacts. Historical inputs unchanged.
 */
import {
  buildMlbResearchScorecardV1,
  buildMlbResearchScorecardV1Cumulative,
} from "../src/lib/mlb/research-scorecard-v1";

function usage(): string {
  return `Usage:
  npm run scorecard:mlb-research-v1 -- --date YYYY-MM-DD [options]
  npm run scorecard:mlb-research-v1 -- --dates YYYY-MM-DD,YYYY-MM-DD [--cumulative]

Options:
  --date <YYYY-MM-DD>     Single slate
  --dates <csv>           Multiple slates
  --cumulative            Also write research-scorecard-v1-cumulative.json
  --dry-run               Compute; write 0
  --json                  Print documents
  --help
`;
}

function parseArgs(argv: string[]) {
  let dates: string[] = [];
  let dryRun = false;
  let json = false;
  let cumulative = false;
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
    if (a === "--cumulative") {
      cumulative = true;
      continue;
    }
    if (a === "--date") {
      const v = argv[++i];
      if (!v) throw new Error("--date requires YYYY-MM-DD");
      dates.push(v);
      continue;
    }
    if (a === "--dates") {
      const v = argv[++i];
      if (!v) throw new Error("--dates requires csv");
      dates.push(...v.split(",").map((s) => s.trim()).filter(Boolean));
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a)) {
      dates.push(a);
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  dates = [...new Set(dates)];
  if (dates.length === 0) throw new Error("HELP");
  return { dates, dryRun, json, cumulative };
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
    console.error(usage());
    process.exit(1);
  }

  const runGeneratedAt = new Date().toISOString();
  console.log(`runGeneratedAt=${runGeneratedAt}`);

  for (const dateKst of args.dates) {
    const { document, wrote, outRel } = await buildMlbResearchScorecardV1({
      dateKst,
      dryRun: args.dryRun,
      generatedAt: runGeneratedAt,
    });
    console.log(
      [
        dateKst,
        `rows=${document.meta.scheduleGames}`,
        `graded=${document.meta.gradedResearchN}`,
        `awaiting=${document.meta.awaitingResults}`,
        `status=${document.researchStatus.overall}`,
        args.dryRun ? "dry-run" : wrote ? `wrote ${outRel}` : "no-write",
      ].join(" "),
    );
    if (args.json) console.log(JSON.stringify(document, null, 2));
  }

  if (args.cumulative) {
    const { document, wrote, outRel } =
      await buildMlbResearchScorecardV1Cumulative({
        dates: args.dates,
        dryRun: args.dryRun,
        generatedAt: runGeneratedAt,
      });
    console.log(
      [
        "CUMULATIVE",
        `dates=${document.meta.dates.join(",")}`,
        `rows=${document.rowCount}`,
        `graded=${document.calibration.gradedN}`,
        `awaitingExcluded=${document.awaitingExcludedFromOutcomes}`,
        args.dryRun ? "dry-run" : wrote ? `wrote ${outRel}` : "no-write",
      ].join(" "),
    );
    if (args.json) console.log(JSON.stringify(document, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
