/**
 * CLI: Football Observed Slate v0 (research overlay).
 *
 *   npm run research:football-observed-slate -- --date 2026-08-16
 *
 * Does not mutate football-schedule-v1. Does not run Prediction.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildFootballObservedSlateV0,
  footballObservedSlateV0Rel,
} from "../src/lib/football/observed-slate-v0";

function parseArgs(argv: string[]) {
  let dateKst = "2026-08-16";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--date") {
      dateKst = argv[++i] ?? dateKst;
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a)) {
      dateKst = a;
    }
  }
  return { dateKst };
}

async function main() {
  const { dateKst } = parseArgs(process.argv.slice(2));
  if (dateKst !== "2026-08-16") {
    throw new Error(
      `OBSERVED_SLATE_DATE_UNSUPPORTED: v0 builder is sealed to batch-2207 / 2026-08-16 (got ${dateKst})`,
    );
  }
  const document = await buildFootballObservedSlateV0({});
  const rel = footballObservedSlateV0Rel(dateKst);
  const abs = path.join(process.cwd(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        wrote: rel,
        ...document.summary,
        competitionGap: document.competitionGap.map((g) => ({
          id: g.providerCompetitionId,
          name: g.providerCompetitionName,
          fixtures: g.observedFixtureCount,
          candidate: g.registrationCandidateStatus,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
