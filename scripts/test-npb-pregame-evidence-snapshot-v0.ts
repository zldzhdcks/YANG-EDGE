/**
 * NPB Pregame Evidence Snapshot v0 tests.
 * Run: npm run test:npb-pregame-evidence-snapshot-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  freezeNpbPregameEvidenceSnapshot,
  loadNpbPregameEvidenceSnapshot,
  loadNpbPregameEvidenceView,
} from "../src/lib/npb/pregame-evidence-snapshot-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-07";

  const scheduleRel = `data/research/npb/${dateKst}-schedule-v1.json`;
  const starterRel = `data/operator-input/npb/${dateKst}-starter-confirmation-v1.json`;
  const oddsRel = `data/operator-input/npb/${dateKst}-market-odds-confirmation-v0.json`;
  assert.ok(existsSync(scheduleRel));
  assert.ok(existsSync(starterRel));
  assert.ok(existsSync(oddsRel));

  const scheduleBefore = sha256File(scheduleRel);
  const starterBefore = sha256File(starterRel);
  const oddsBefore = sha256File(oddsRel);
  const scheduleMtime = statSync(scheduleRel).mtimeMs;
  const starterMtime = statSync(starterRel).mtimeMs;
  const oddsMtime = statSync(oddsRel).mtimeMs;

  const tmp = mkdtempSync(path.join(tmpdir(), "npb-evidence-"));
  for (const rel of [scheduleRel, starterRel, oddsRel]) {
    mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    cpSync(path.join(root, rel), path.join(tmp, rel));
  }

  const asOf = "2026-08-07T03:00:00.000Z";
  const first = await freezeNpbPregameEvidenceSnapshot({
    dateKst,
    cwd: tmp,
    asOf,
  });
  assert.equal(first.wrote, true);
  assert.equal(first.snapshotStatus, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.ok(first.document);
  assert.equal(first.document!.snapshotKind, "PREGAME_EVIDENCE");
  assert.equal(first.document!.enginePolicy, "NO_ENGINE_AVAILABLE");
  assert.equal(first.document!.summary.total, 6);
  assert.equal(first.document!.summary.scheduleReady, 6);
  assert.equal(first.document!.summary.starterConfirmed, 6);
  assert.equal(first.document!.summary.marketVerified, 6);
  assert.equal(first.document!.summary.lineupReleased, 0);
  assert.equal(first.document!.generatedBeforeGameCount, 6);
  assert.equal(first.document!.blockedAfterStartCount, 0);
  assert.ok(first.document!.predictionHashSha256.length === 64);

  for (const g of first.document!.games) {
    assert.equal(g.prediction.officialPick, null);
    assert.equal(g.prediction.researchPick, null);
    assert.equal(g.prediction.modelProbability, null);
    assert.equal(g.prediction.confidence, null);
    assert.equal(g.modelProbability, null);
    assert.equal(g.marketProbability, null);
    assert.equal(g.officialPick, null);
    assert.equal(g.lineup.status, "NOT_RELEASED");
    assert.equal(g.starter.sourceType, "MANUAL_VERIFIED");
    assert.equal(g.market.sourceType, "MANUAL_VERIFIED");
    assert.equal(g.generatedBeforeGame, true);
    assert.ok(g.warnings.includes("NPB_ENGINE_NOT_AVAILABLE"));
    assert.ok(g.warnings.includes("LINEUP_NOT_RELEASED"));
    assert.ok(
      g.status === "PASS" || g.status === "NO_ENGINE_AVAILABLE",
    );
  }

  // Immutable — second freeze does not overwrite
  const hash1 = first.document!.predictionHashSha256;
  const snapPath = path.join(tmp, `data/predictions/npb/${dateKst}.json`);
  const mtime1 = statSync(snapPath).mtimeMs;
  const second = await freezeNpbPregameEvidenceSnapshot({
    dateKst,
    cwd: tmp,
    asOf: "2026-08-07T04:00:00.000Z",
  });
  assert.equal(second.wrote, false);
  assert.equal(second.snapshotStatus, "ALREADY_FROZEN");
  assert.equal(second.document!.predictionHashSha256, hash1);
  assert.equal(statSync(snapPath).mtimeMs, mtime1);
  assert.equal(sha256File(snapPath), sha256File(snapPath));

  // After-start refuse when all blocked
  const tmpLate = mkdtempSync(path.join(tmpdir(), "npb-evidence-late-"));
  for (const rel of [scheduleRel, starterRel, oddsRel]) {
    mkdirSync(path.dirname(path.join(tmpLate, rel)), { recursive: true });
    cpSync(path.join(root, rel), path.join(tmpLate, rel));
  }
  const late = await freezeNpbPregameEvidenceSnapshot({
    dateKst,
    cwd: tmpLate,
    asOf: "2026-08-07T12:00:00.000Z",
  });
  assert.equal(late.wrote, false);
  assert.equal(late.snapshotStatus, "BLOCKED_AFTER_START");
  assert.equal(
    existsSync(path.join(tmpLate, `data/predictions/npb/${dateKst}.json`)),
    false,
  );

  // Seal into repo (acceptance) if not present; if present keep immutable
  const repoPath = `data/predictions/npb/${dateKst}.json`;
  const repoBefore = existsSync(repoPath) ? sha256File(repoPath) : null;
  const repoMtime = existsSync(repoPath) ? statSync(repoPath).mtimeMs : null;
  const repo = await freezeNpbPregameEvidenceSnapshot({
    dateKst,
    cwd: root,
    asOf,
  });
  assert.ok(repo.document);
  assert.ok(
    repo.snapshotStatus === "PRE_GAME_SNAPSHOT_VERIFIED" ||
      repo.snapshotStatus === "ALREADY_FROZEN",
  );
  if (repoBefore != null) {
    assert.equal(sha256File(repoPath), repoBefore);
    assert.equal(statSync(repoPath).mtimeMs, repoMtime);
  } else {
    assert.equal(repo.wrote, true);
  }

  // Input artifacts immutable
  assert.equal(sha256File(scheduleRel), scheduleBefore);
  assert.equal(sha256File(starterRel), starterBefore);
  assert.equal(sha256File(oddsRel), oddsBefore);
  assert.equal(statSync(scheduleRel).mtimeMs, scheduleMtime);
  assert.equal(statSync(starterRel).mtimeMs, starterMtime);
  assert.equal(statSync(oddsRel).mtimeMs, oddsMtime);

  const loaded = await loadNpbPregameEvidenceSnapshot({ dateKst });
  assert.ok(loaded);
  assert.equal(loaded!.snapshotKind, "PREGAME_EVIDENCE");

  const view = await loadNpbPregameEvidenceView({ dateKst });
  assert.equal(view.frozen, true);
  assert.ok(view.lines.some((l) => l.includes("Schedule 6/6")));
  assert.ok(view.lines.some((l) => l.includes("Starter 12/12")));
  assert.ok(view.lines.some((l) => l.includes("Market 6/6")));
  assert.ok(view.lines.some((l) => /Lineup Not Released/i.test(l)));
  assert.ok(view.lines.some((l) => /Prediction Engine Not Available/i.test(l)));
  assert.equal(view.nextAction, "WAIT_FOR_LINEUP");

  const d = loaded!;
  console.log("=== NPB PREGAME EVIDENCE ===\n");
  console.log(`Date: ${d.dateKst}`);
  console.log(`Games: ${d.summary.total}`);
  console.log("");
  console.log(`Schedule: ${d.summary.scheduleReady}/${d.summary.total}`);
  console.log(
    `Starter: ${d.summary.starterConfirmed * 2}/${d.summary.total * 2} MANUAL_VERIFIED`,
  );
  console.log(
    `Market: ${d.summary.marketVerified}/${d.summary.total} MANUAL_VERIFIED`,
  );
  console.log("Lineup: NOT_RELEASED");
  console.log("Prediction: NOT_AVAILABLE");
  console.log("");
  console.log(`Snapshot Status: ${d.snapshotStatus}`);
  console.log(`Created At: ${d.snapshotCreatedAt}`);
  console.log(
    `Before First Pitch: ${d.generatedBeforeGameCount}/${d.summary.total}`,
  );
  console.log(`Hash: ${d.predictionHashSha256.slice(0, 8)}…`);
  console.log("");
  console.log("Next Action:");
  console.log("WAIT_FOR_LINEUP");
  console.log("\ntest:npb-pregame-evidence-snapshot-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
