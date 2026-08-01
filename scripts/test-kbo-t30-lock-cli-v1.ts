/**
 * KBO T-30 CLI + lineage validation fixture tests.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildInputLineageManifest,
  buildKboT30ArtifactPaths,
  isRevisionPath,
  parseKboT30LockArgs,
  resolveKboT30PriorRunId,
  revisionFilename,
  sha256Json,
} from "../src/lib/kbo/kbo-t30-lock-cli";
import { kboAction } from "../src/lib/scheduler/league-adapters/kbo";

function writeJson(fp: string, doc: unknown) {
  mkdirSync(path.dirname(fp), { recursive: true });
  writeFileSync(fp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

async function main() {
  assert.throws(() => parseKboT30LockArgs([]), /MISSING_DATE/);
  assert.equal(isRevisionPath("x.rev-1.json"), true);
  assert.equal(
    revisionFilename("/x/a.json", "2026-08-01T10-00-00-000Z"),
    "/x/a.rev-2026-08-01T10-00-00-000Z.json",
  );

  const dateKst = "2026-08-01";
  const tip = "2026-08-01T10-00-00-000Z";
  const prior = "2026-08-01T09-00-00-000Z";

  // 1) Same runId → VERIFIED
  {
    const cwd = mkdtempSync(path.join(tmpdir(), "kbo-same-"));
    const p = buildKboT30ArtifactPaths(dateKst, cwd);
    const games = [{ gameId: "kbo-1" }];
    for (const [fp, type] of [
      [p.prediction, "kbo-prediction-snapshot-v1"],
      [p.schedule, "kbo-schedule-v1"],
      [p.starter, "kbo-starter-v1"],
      [p.odds, "kbo-odds-history-v1"],
      [p.lineup, "kbo-lineup-v1"],
    ] as const) {
      writeJson(fp, { schemaVersion: type, date: dateKst, runId: tip, games });
    }
    writeJson(p.prediction, {
      schemaVersion: "kbo-prediction-snapshot-v1",
      date: dateKst,
      runId: tip,
      games,
      inputLineageManifest: buildInputLineageManifest({
        snapshotRunId: tip,
        priorSnapshotRunId: null,
        createdAt: "2026-08-01T10:00:00.000Z",
        lockedAt: "2026-08-01T10:00:00.000Z",
        entries: [
          {
            artifactType: "schedule",
            path: path.relative(cwd, p.schedule).replace(/\\/g, "/"),
            runId: tip,
            hash: sha256Json(games),
            generatedAt: null,
          },
          {
            artifactType: "starter",
            path: path.relative(cwd, p.starter).replace(/\\/g, "/"),
            runId: tip,
            hash: sha256Json(games),
            generatedAt: null,
          },
          {
            artifactType: "odds",
            path: path.relative(cwd, p.odds).replace(/\\/g, "/"),
            runId: tip,
            hash: sha256Json(games),
            generatedAt: null,
          },
          {
            artifactType: "lineup",
            path: path.relative(cwd, p.lineup).replace(/\\/g, "/"),
            runId: tip,
            hash: sha256Json(games),
            generatedAt: null,
          },
        ],
      }),
    });
    const r = await resolveKboT30PriorRunId({
      dateKst,
      explicit: null,
      paths: p,
      cwd,
    });
    assert.equal(r.resolutionStatus, "VERIFIED");
    assert.equal(r.lineageValidationStatus, "VERIFIED");
    assert.equal(r.priorSnapshotRunId, tip);
  }

  // 2) Mixed runId with manifest hash → RUN_ID_DIFFERENT_LINEAGE_VERIFIED
  {
    const cwd = mkdtempSync(path.join(tmpdir(), "kbo-mixed-"));
    const p = buildKboT30ArtifactPaths(dateKst, cwd);
    const schedGames = [{ gameId: "kbo-1", home: "A", away: "B" }];
    writeJson(p.schedule, {
      schemaVersion: "kbo-schedule-v1",
      date: dateKst,
      runId: prior,
      games: schedGames,
    });
    writeJson(p.starter, {
      schemaVersion: "kbo-starter-v1",
      date: dateKst,
      runId: tip,
      games: [],
    });
    writeJson(p.odds, {
      schemaVersion: "kbo-odds-history-v1",
      date: dateKst,
      runId: tip,
      games: [],
    });
    writeJson(p.lineup, {
      schemaVersion: "kbo-lineup-v1",
      date: dateKst,
      runId: tip,
      games: [],
    });
    writeJson(p.prediction, {
      schemaVersion: "kbo-prediction-snapshot-v1",
      date: dateKst,
      runId: tip,
      priorSnapshotRunId: prior,
      games: [{ gameId: "kbo-1" }],
      inputLineageManifest: buildInputLineageManifest({
        snapshotRunId: tip,
        priorSnapshotRunId: prior,
        createdAt: "2026-08-01T10:00:00.000Z",
        lockedAt: "2026-08-01T10:00:00.000Z",
        entries: [
          {
            artifactType: "schedule",
            path: path.relative(cwd, p.schedule).replace(/\\/g, "/"),
            runId: prior,
            hash: sha256Json(schedGames),
            generatedAt: null,
          },
        ],
      }),
    });
    const r = await resolveKboT30PriorRunId({
      dateKst,
      explicit: null,
      paths: p,
      cwd,
    });
    assert.equal(r.resolutionStatus, "VERIFIED");
    assert.equal(
      r.lineageValidationStatus,
      "RUN_ID_DIFFERENT_LINEAGE_VERIFIED",
    );
  }

  // 3) Mixed runId without evidence → LINEAGE_UNPROVEN
  {
    const cwd = mkdtempSync(path.join(tmpdir(), "kbo-unproven-"));
    const p = buildKboT30ArtifactPaths(dateKst, cwd);
    writeJson(p.schedule, {
      schemaVersion: "kbo-schedule-v1",
      date: dateKst,
      runId: prior,
      games: [{ gameId: "kbo-1" }],
    });
    writeJson(p.starter, {
      schemaVersion: "kbo-starter-v1",
      date: dateKst,
      runId: tip,
      games: [],
    });
    writeJson(p.odds, {
      schemaVersion: "kbo-odds-history-v1",
      date: dateKst,
      runId: tip,
      games: [],
    });
    writeJson(p.lineup, {
      schemaVersion: "kbo-lineup-v1",
      date: dateKst,
      runId: tip,
      games: [],
    });
    writeJson(p.prediction, {
      schemaVersion: "kbo-prediction-snapshot-v1",
      date: dateKst,
      runId: tip,
      games: [{ gameId: "kbo-1" }],
      // schedule runId differs and is NOT priorSnapshotRunId, no hashes
    });
    const r = await resolveKboT30PriorRunId({
      dateKst,
      explicit: null,
      paths: p,
      cwd,
    });
    assert.equal(r.resolutionStatus, "FAILED");
    assert.equal(r.lineageValidationStatus, "LINEAGE_UNPROVEN");
    assert.equal(r.errorCode, "LINEAGE_UNPROVEN");
  }

  // 4) Hash mismatch
  {
    const cwd = mkdtempSync(path.join(tmpdir(), "kbo-hash-"));
    const p = buildKboT30ArtifactPaths(dateKst, cwd);
    const games = [{ gameId: "kbo-1" }];
    writeJson(p.schedule, {
      schemaVersion: "kbo-schedule-v1",
      date: dateKst,
      runId: tip,
      games,
    });
    writeJson(p.prediction, {
      schemaVersion: "kbo-prediction-snapshot-v1",
      date: dateKst,
      runId: tip,
      games,
      inputLineageManifest: buildInputLineageManifest({
        snapshotRunId: tip,
        priorSnapshotRunId: null,
        createdAt: "2026-08-01T10:00:00.000Z",
        lockedAt: "2026-08-01T10:00:00.000Z",
        entries: [
          {
            artifactType: "schedule",
            path: path.relative(cwd, p.schedule).replace(/\\/g, "/"),
            runId: tip,
            hash: "deadbeef",
            generatedAt: null,
          },
        ],
      }),
    });
    const r = await resolveKboT30PriorRunId({
      dateKst,
      explicit: null,
      paths: p,
      cwd,
    });
    assert.equal(r.errorCode, "PRIOR_RUN_ARTIFACT_MISMATCH");
  }

  // 5) Revision only → PRIOR_RUN_NOT_RESOLVED
  {
    const cwd = mkdtempSync(path.join(tmpdir(), "kbo-revonly-"));
    const p = buildKboT30ArtifactPaths(dateKst, cwd);
    writeJson(
      path.join(p.predictionsRoot, `${dateKst}.rev-${tip}.json`),
      { schemaVersion: "kbo-prediction-snapshot-v1", date: dateKst, runId: tip },
    );
    const r = await resolveKboT30PriorRunId({
      dateKst,
      explicit: null,
      paths: p,
      cwd,
    });
    assert.equal(r.errorCode, "PRIOR_RUN_NOT_RESOLVED");
  }

  // 6) Historical 07-31 read-only (if present)
  {
    const repo = process.cwd();
    const p = buildKboT30ArtifactPaths("2026-07-31", repo);
    const r = await resolveKboT30PriorRunId({
      dateKst: "2026-07-31",
      explicit: null,
      paths: p,
      cwd: repo,
    });
    assert.equal(r.priorSnapshotRunId, "2026-07-31T09-08-50-735Z");
    assert.equal(r.priorRunSource, "PRIMARY_PREDICTION");
    assert.ok(
      r.lineageValidationStatus === "VERIFIED_LEGACY_LINEAGE" ||
        r.lineageValidationStatus === "RUN_ID_DIFFERENT_LINEAGE_VERIFIED" ||
        r.lineageValidationStatus === "LINEAGE_UNPROVEN",
      `unexpected lineage ${r.lineageValidationStatus}`,
    );
    if (r.lineageValidationStatus === "LINEAGE_UNPROVEN") {
      console.log("07-31 lineage unproven details", r.unprovenArtifacts);
    } else {
      assert.equal(r.resolutionStatus, "VERIFIED");
    }
    const sched = r.artifacts.find((a) => a.artifactType === "schedule");
    assert.ok(sched);
    assert.equal(sched!.artifactRunId, "2026-07-31T09-01-59-411Z");
  }

  const action = kboAction({
    stage: "T30_FINAL_CHECK",
    dateKst,
    gameId: "kbo-1",
    includePostgame: false,
    noProvider: false,
  });
  assert.equal(action.actionId, "RUN_KBO_T30_FINAL_LOCK");
  assert.deepEqual(action.args, ["--date", dateKst]);

  console.log("test:kbo-t30-cli OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
