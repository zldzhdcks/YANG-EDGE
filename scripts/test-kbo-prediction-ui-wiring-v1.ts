/**
 * Regression: KBO Prediction Snapshot → Analysis UI wiring.
 * Run: npx tsx scripts/test-kbo-prediction-ui-wiring-v1.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Module from "node:module";
import {
  buildViewFromOfficial,
  resolveResearchPrediction,
} from "../src/lib/research/load-research-prediction";
import {
  buildResearchPredictionView,
  researchPredictionScore,
} from "../src/lib/research/research-prediction-view";

const cwd = process.cwd();
const DATE = "2026-07-31";

async function sha256File(rel: string): Promise<string> {
  const buf = await readFile(path.join(cwd, rel));
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  // 1) KBO PASS Snapshot
  const pass = buildViewFromOfficial({
    officialStatus: "PASS",
    officialPick: null,
    passReasons: [
      "KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED",
      "PROVIDER_QUOTA_GUARD",
    ],
  });
  assert.equal(pass.debugStatus, "PASS");
  assert.notEqual(pass.debugStatus, "FAIL");
  assert.equal(researchPredictionScore(pass).status, "PASS_RECORDED");
  assert.equal(researchPredictionScore(pass).score, 0);

  // 2) Eligible Pick
  const eligible = buildViewFromOfficial({
    officialStatus: "ELIGIBLE",
    officialPick: "HOME",
  });
  assert.equal(eligible.debugStatus, "AVAILABLE");
  assert.equal(researchPredictionScore(eligible).score, 20);
  assert.equal(researchPredictionScore(eligible).status, "OK");

  // 3) Blocked
  const blocked = buildViewFromOfficial({
    officialStatus: "BLOCKED",
    officialPick: null,
  });
  assert.equal(blocked.debugStatus, "BLOCKED");

  // 4) Missing artifact
  const missing = await resolveResearchPrediction({
    gameId: "kbo-999999",
    cwd,
  });
  assert.ok(missing);
  assert.equal(missing!.loadReason, "GAME_ID_NOT_FOUND");
  assert.equal(missing!.view.debugStatus, "FAIL");

  // 5) Revision exclusion — primary selected
  const names = await readdir(path.join(cwd, "data/predictions/kbo"));
  assert.ok(names.includes(`${DATE}.json`));
  assert.ok(names.some((n) => n.includes(".rev-")));
  const lg = await resolveResearchPrediction({
    gameId: "kbo-181917",
    cwd,
    predictionHashFn: (pred) =>
      createHash("sha256").update(JSON.stringify(pred.gameId)).digest("hex"),
  });
  assert.equal(lg?.loadReason, "OK");
  assert.equal(lg?.pathRel, `data/predictions/kbo/${DATE}.json`);
  assert.ok(!lg?.pathRel.includes(".rev-"));
  assert.equal(lg?.view.officialStatus, "PASS");
  assert.equal(lg?.view.officialPick, null);
  assert.ok(
    lg?.view.passReasons.includes("KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED"),
  );

  // 6) Wrong gameId
  assert.equal(missing!.loadReason, "GAME_ID_NOT_FOUND");

  // 7) MLB regression — primary mlb folder still resolvable pattern
  const mlbFiles = await readdir(path.join(cwd, "data/predictions/mlb")).catch(
    () => [] as string[],
  );
  const mlbPrimary = mlbFiles.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n));
  if (mlbPrimary.length > 0) {
    const mlbDoc = JSON.parse(
      await readFile(
        path.join(cwd, "data/predictions/mlb", mlbPrimary[0]),
        "utf8",
      ),
    ) as { predictions?: Array<Record<string, unknown>> };
    const first = mlbDoc.predictions?.[0];
    if (first && typeof first.gameId === "string") {
      // MLB path uses existing findPrediction matching; view builder must not FAIL on baseline pick
      const mlbView = buildResearchPredictionView({
        pred: first,
        pathRel: `data/predictions/mlb/${mlbPrimary[0]}`,
        runId: null,
        predictionHash: "x",
      });
      assert.notEqual(mlbView.debugStatus, "FAIL");
    }
  }

  // 5 games live resolve
  for (const id of [
    "kbo-181917",
    "kbo-181918",
    "kbo-181919",
    "kbo-181920",
    "kbo-181921",
  ]) {
    const r = await resolveResearchPrediction({ gameId: id, cwd });
    assert.equal(r?.loadReason, "OK", id);
    assert.equal(r?.view.officialStatus, "PASS", id);
    assert.equal(r?.view.officialPick, null, id);
    assert.equal(r?.view.debugStatus, "PASS", id);
  }

  // Snapshot hash immutability
  const targets = [
    `data/predictions/kbo/${DATE}.json`,
    `data/predictions/kbo/${DATE}.rev-2026-07-31T09-01-59-411Z.json`,
  ];
  const before = await Promise.all(targets.map(sha256File));
  await resolveResearchPrediction({ gameId: "kbo-181917", cwd });
  const after = await Promise.all(targets.map(sha256File));
  assert.deepEqual(before, after);

  // Analysis view wiring (stub server-only)
  const stub = path.resolve("scripts/stub-server-only.cjs");
  const original = (
    Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
    function (request: unknown, ...args: unknown[]) {
      if (request === "server-only") return stub;
      return original.call(this, request, ...args);
    };
  const { loadResearchAnalysisView } = await import(
    "../src/lib/research/load-research-analysis-view"
  );
  const view = await loadResearchAnalysisView("kbo-181917");
  assert.equal(view.researchPrediction.debugStatus, "PASS");
  assert.equal(view.researchPrediction.officialStatus, "PASS");
  assert.equal(view.prediction.availability, "COLLECTED");
  const predScore = view.researchScore.items.find((i) => i.label === "Prediction");
  assert.equal(predScore?.status, "PASS_RECORDED");
  assert.equal(predScore?.score, 0);
  assert.ok(view.sources.predictionPath?.endsWith("2026-07-31.json"));

  console.log("PASS test-kbo-prediction-ui-wiring-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
