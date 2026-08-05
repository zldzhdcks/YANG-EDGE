/**
 * Read-only Release checklist parse/load for Dashboard.
 * Run: npx tsx scripts/test-release-checklist-dashboard-v0.ts
 * Mutation: reads EDGE 서류/RELEASE_v0.8_CHECKLIST.md only — no writes.
 */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  buildProgressBar,
  loadReleaseChecklistV0,
  parseReleaseChecklistMarkdown,
  RELEASE_CHECKLIST_RELATIVE_PATH,
} from "../src/lib/internal/release-checklist-v0";

async function main() {
  const abs = path.join(process.cwd(), ...RELEASE_CHECKLIST_RELATIVE_PATH.split("/"));
  const before = statSync(abs).mtimeMs;
  const raw = readFileSync(abs, "utf8");

  const parsed = parseReleaseChecklistMarkdown(raw);
  assert.equal(parsed.readOnly, true);
  assert.equal(parsed.sourceOfTruth, true);
  assert.equal(parsed.loaded, true);
  assert.equal(parsed.currentVersion, "v0.8");
  assert.equal(parsed.targetRelease, "Private Beta");
  assert.equal(parsed.overallStatus, "IN_PROGRESS");
  assert.equal(parsed.privateBetaTotal, 8);
  assert.equal(parsed.privateBetaMet, 2);
  assert.equal(parsed.overallProgressPercent, 25);
  assert.equal(parsed.progressBar, buildProgressBar(25));
  assert.ok(parsed.sections.length === 6);
  assert.deepEqual(
    parsed.sections.map((s) => s.id),
    ["MLB", "Football", "KBO", "OS", "Provider", "Legal"],
  );
  assert.ok(parsed.criticalIssues.length >= 8);
  assert.ok(parsed.currentFocus.length >= 3);
  assert.equal(
    parsed.currentFocus.some((f) => f.includes("하지 않음")),
    false,
  );

  const loaded = await loadReleaseChecklistV0();
  assert.equal(loaded.currentVersion, "v0.8");
  assert.equal(loaded.readOnly, true);

  const after = statSync(abs).mtimeMs;
  assert.equal(after, before, "checklist file must not be mutated");

  console.log("test:release-checklist-dashboard-v0 OK", {
    progress: `${loaded.overallProgressPercent}%`,
    bar: loaded.progressBar,
    focus: loaded.currentFocus.length,
    critical: loaded.criticalIssues.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
