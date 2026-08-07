/**
 * NPB Manual Starter Intake v0 tests.
 * Run: npm run test:npb-manual-starter-intake-v0
 *
 * Example starter names are test fixtures only — not hardcoded in product code.
 * Does not mutate Prediction / Engine. Schedule seed mtime may be read-only audited.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadNpbScheduleGames,
  loadNpbStarterResearchOverlay,
  saveNpbStarterConfirmation,
} from "../src/lib/npb/manual-starter-intake-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

/** Test-only fixture — admin example slate for 2026-08-07. */
const FIXTURE_STARTERS: Array<{
  internalGameId: string;
  awayOriginal: string;
  homeOriginal: string;
}> = [
  {
    internalGameId: "npb-tokyo-yakult-swallows-yomiuri-giants",
    awayOriginal: "S. Howard",
    homeOriginal: "奥川 恭伸",
  },
  {
    internalGameId: "npb-hiroshima-toyo-carp-yokohama-dena-baystars",
    awayOriginal: "平良 拳太郎",
    homeOriginal: "森下 暢仁",
  },
  {
    internalGameId: "npb-chunichi-dragons-hanshin-tigers",
    awayOriginal: "才木 浩人",
    homeOriginal: "髙橋 宏斗",
  },
  {
    internalGameId:
      "npb-tohoku-rakuten-golden-eagles-hokkaido-nippon-ham-fighters",
    awayOriginal: "達 孝太",
    homeOriginal: "J. Ureña",
  },
  {
    internalGameId: "npb-fukuoka-softbank-hawks-saitama-seibu-lions",
    awayOriginal: "髙橋 光成",
    homeOriginal: "松本 晴",
  },
  {
    internalGameId: "npb-orix-buffaloes-chiba-lotte-marines",
    awayOriginal: "廣池 康志郎",
    homeOriginal: "寺西 成騎",
  },
];

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-07";
  const scheduleRel = `data/research/npb/${dateKst}-schedule-v1.json`;
  assert.ok(
    existsSync(scheduleRel),
    "2026-08-07 NPB schedule required for intake join",
  );
  const scheduleBefore = sha256File(scheduleRel);
  const scheduleMtime = statSync(scheduleRel).mtimeMs;

  // Prefer isolated cwd for mutation-safe path; also seal repo operator-input for acceptance
  const tmp = mkdtempSync(path.join(tmpdir(), "npb-starter-intake-"));
  mkdirSync(path.join(tmp, "data/research/npb"), { recursive: true });
  mkdirSync(path.join(tmp, "data/operator-input/npb"), { recursive: true });
  cpSync(path.join(root, scheduleRel), path.join(tmp, scheduleRel));

  // Optional: empty provider starter dataset to prove overlay does not mutate it
  const starterDsRel = `data/research/npb/${dateKst}-starter-dataset-v1.json`;
  const starterDsDoc = {
    schemaVersion: "npb-starter-v1",
    date: dateKst,
    games: [],
    note: "provider empty — must remain unchanged",
  };
  writeFileSync(
    path.join(tmp, starterDsRel),
    `${JSON.stringify(starterDsDoc, null, 2)}\n`,
  );
  const starterDsBefore = sha256File(path.join(tmp, starterDsRel));

  const schedule = await loadNpbScheduleGames({ dateKst, cwd: tmp });
  assert.equal(schedule.exists, true);
  assert.equal(schedule.games.length, 6);
  assert.ok(schedule.games.every((g) => g.joinStatus === "MATCHED"));

  const verifiedAt = "2026-08-07T03:00:00.000Z"; // before 09:00Z first pitch
  const drafts = FIXTURE_STARTERS.map((row) => ({
    internalGameId: row.internalGameId,
    awayStarter: { originalName: row.awayOriginal },
    homeStarter: { originalName: row.homeOriginal },
  }));

  const saved = await saveNpbStarterConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt,
    sourceLabel: "수동 확인 · MANUAL VERIFIED",
    drafts,
  });
  assert.equal(saved.ok, true);
  assert.ok(saved.document);
  assert.equal(saved.document!.games.length, 6);
  assert.equal(saved.document!.summary.matchedGames, 6);
  assert.equal(saved.document!.summary.confirmedStarters, 12);
  assert.equal(saved.document!.summary.missingStarters, 0);
  assert.equal(saved.document!.summary.joinErrors, 0);
  assert.equal(saved.document!.summary.lateGames, 0);
  assert.equal(saved.document!.summary.preGameVerifiedStarters, 12);
  assert.equal(saved.document!.sourceType, "MANUAL_VERIFIED");
  assert.equal(saved.document!.enteredBy, "OPERATOR");

  // Japanese originals preserved
  const okugawa = saved.document!.games.find((g) =>
    g.homeStarter?.originalName.includes("奥川"),
  );
  assert.ok(okugawa);
  assert.equal(okugawa!.homeStarter!.originalName, "奥川 恭伸");
  assert.ok(okugawa!.homeStarter!.normalizedName.includes("奥川"));

  for (const g of saved.document!.games) {
    assert.equal(g.joinStatus, "MATCHED");
    assert.equal(g.cutoffLabel, "PRE_GAME_VERIFIED");
    assert.equal(g.isBeforeFirstPitch, true);
    assert.equal(g.uiStatus, "CONFIRMED");
    assert.equal(g.awayStarter!.sourceType, "MANUAL_VERIFIED");
    assert.equal(g.homeStarter!.providerPlayerId, null);
  }

  const overlay = await loadNpbStarterResearchOverlay({ dateKst, cwd: tmp });
  assert.equal(overlay.availableStarters, 12);
  assert.equal(overlay.totalStarterSlots, 12);
  assert.match(overlay.line, /12\/12 AVAILABLE/);
  assert.equal(overlay.sourceLabel, "MANUAL VERIFIED");

  // Late input blocked
  const late = await saveNpbStarterConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt: "2026-08-07T12:00:00.000Z",
    drafts: drafts.slice(0, 1),
    allowLate: false,
  });
  assert.equal(late.ok, false);
  assert.ok(late.errors.some((e) => e.startsWith("LATE_OPERATOR_INPUT")));

  // Unmatched game blocked
  const unmatched = await saveNpbStarterConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt,
    drafts: [
      {
        internalGameId: "npb-fake-unmatched-game",
        awayStarter: { originalName: "Test A" },
        homeStarter: { originalName: "Test B" },
      },
    ],
  });
  assert.equal(unmatched.ok, false);
  assert.ok(unmatched.errors.some((e) => e.startsWith("NOT_MATCHED")));

  // Mutation audit — schedule + provider starter dataset untouched in tmp
  assert.equal(sha256File(path.join(tmp, scheduleRel)), scheduleBefore);
  assert.equal(sha256File(path.join(tmp, starterDsRel)), starterDsBefore);

  // Seal acceptance artifact into repo operator-input (overlay only)
  const repoSaved = await saveNpbStarterConfirmation({
    dateKst,
    cwd: root,
    verifiedAt,
    sourceLabel: "수동 확인 · MANUAL VERIFIED",
    drafts,
  });
  assert.equal(repoSaved.ok, true);
  assert.equal(repoSaved.document!.summary.confirmedStarters, 12);

  // Repo schedule unchanged
  assert.equal(sha256File(scheduleRel), scheduleBefore);
  assert.equal(statSync(scheduleRel).mtimeMs, scheduleMtime);

  const repoOverlay = await loadNpbStarterResearchOverlay({ dateKst });
  assert.match(repoOverlay.line, /12\/12 AVAILABLE/);

  console.log("=== NPB STARTER INTAKE ===\n");
  console.log(`Date: ${dateKst}`);
  console.log(`Games: ${repoSaved.document!.summary.scheduleGames}`);
  console.log(`Matched: ${repoSaved.document!.summary.matchedGames}`);
  console.log(
    `Starter Confirmed: ${repoSaved.document!.summary.confirmedStarters}`,
  );
  console.log(`Missing: ${repoSaved.document!.summary.missingStarters}`);
  console.log(`Late: ${repoSaved.document!.summary.lateGames}`);
  console.log(`Join Errors: ${repoSaved.document!.summary.joinErrors}`);
  console.log("\nSource:");
  console.log("MANUAL_VERIFIED");
  console.log(`\n${repoOverlay.line}`);
  console.log("\ntest:npb-manual-starter-intake-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
