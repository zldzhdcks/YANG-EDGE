/**
 * CLI: MLB frozen prediction identity + edge semantics audit (read-only).
 *
 *   npm run audit:mlb-prediction-identity-v0 -- --date 2026-08-02 --json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditFrozenMlbPredictionIdentityV0 } from "../src/lib/mlb/prediction-v0";

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--date") {
      dateKst = argv[++i] ?? null;
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a)) {
      dateKst = a;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (!dateKst) throw new Error("Usage: --date YYYY-MM-DD [--json]");
  return { dateKst, json };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const audit = await auditFrozenMlbPredictionIdentityV0({
    dateKst: opts.dateKst,
  });

  const report = {
    schemaVersion: "mlb-frozen-prediction-identity-edge-audit-v1",
    generatedAt: new Date().toISOString(),
    ...audit,
    edgeFieldDefinitions: {
      homeModelEdge: "modelHomeProbability - marketHomeProbability",
      awayModelEdge: "modelAwayProbability - marketAwayProbability",
      mostLikelySelection:
        "side with higher model probability (= researchBaseline.selection)",
      selectedSideEdge:
        "modelP(mostLikely) - marketP(mostLikely); may be negative",
      valueSelection:
        "side with larger strictly-positive model−market edge, else null",
      legacyModelEdgeHome:
        "existing marketPredictions[].modelEdgeHome (= homeModelEdge only); NOT selected-side edge",
    },
    snapshotMutation: audit.snapshotMutationRequired
      ? "REQUIRED_REVISION"
      : "NONE",
    notes: [
      "Display convention is away @ home (e.g. Kansas City Royals @ Colorado Rockies).",
      "Labeling Colorado Rockies @ Kansas City Royals would be display-reversed, not snapshot identity error, when home=COL.",
    ],
  };

  const auditRel = `data/audits/${opts.dateKst}-mlb-frozen-prediction-identity-edge-audit-v1.json`;
  await mkdir(path.dirname(path.join(process.cwd(), auditRel)), {
    recursive: true,
  });
  await writeFile(
    path.join(process.cwd(), auditRel),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`verdict=${audit.verdict}`);
    console.log(
      `scheduleMatched=${audit.scheduleMatched} oddsMatched=${audit.oddsMatched} uniquePk=${audit.uniqueGamePk}`,
    );
    console.log(`snapshotMutation=${report.snapshotMutation}`);
    console.log(`audit=${auditRel}`);
    const det = audit.games.find((g) => g.gameId.includes("detroit") || g.semantics.mostLikelySelection === "AWAY");
    const oak = audit.games.find((g) => g.gamePk === 824972);
    if (oak) {
      console.log(
        `DET@OAK mostLikely=${oak.semantics.mostLikelySelection} selectedSideEdge=${oak.semantics.selectedSideEdge} homeModelEdge=${oak.semantics.homeModelEdge} valueSelection=${oak.semantics.valueSelection}`,
      );
    }
    const col = audit.games.find((g) => g.gamePk === 824326);
    if (col) {
      console.log(
        `COL slate display=${col.displayMatchupAwayAtHome} identityOk=${col.identityOk}`,
      );
    }
    void det;
  }

  if (audit.verdict === "SNAPSHOT_HOME_AWAY_MISMATCH") process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
