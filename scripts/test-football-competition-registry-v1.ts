/**
 * Football Competition Registry v1 — OWNER operator-label exact-match tests.
 * No provider calls. No sealed 2026-08-29 mutation. No Engine/Weight change.
 *
 * Run: npm run test:football-competition-registry-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { FOOTBALL_LEAGUES } from "../src/constants/football-leagues";
import {
  FOOTBALL_COMPETITION_REGISTRY_V0,
  findCompetitionByOperatorLabel,
  getCompetitionByProviderId,
  listCompetitionLabelCollisions,
  listDuplicateProviderCompetitionIds,
} from "../src/lib/football/foundation/competition-registry";

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel)))
    .digest("hex");
}

function expectProvider(label: string, providerCompetitionId: string) {
  const hit = findCompetitionByOperatorLabel(label);
  assert.ok(hit, `expected exact match for ${label}`);
  assert.equal(hit.provider, "api-football");
  assert.equal(hit.providerCompetitionId, providerCompetitionId, label);
}

function main() {
  const collisions = listCompetitionLabelCollisions();
  assert.deepEqual(collisions, [], JSON.stringify(collisions));
  const dupIds = listDuplicateProviderCompetitionIds();
  assert.deepEqual(dupIds, [], JSON.stringify(dupIds));

  for (const c of FOOTBALL_COMPETITION_REGISTRY_V0) {
    const aliases = c.operatorDisplayAliases ?? [];
    assert.equal(new Set(aliases).size, aliases.length, c.competitionId);
    assert.equal(aliases.includes(c.displayName), false, `alias duplicates displayName ${c.competitionId}`);
    assert.equal(aliases.includes(c.officialName), false, `alias duplicates officialName ${c.competitionId}`);
  }

  expectProvider("EPL", "39");
  expectProvider("Premier League", "39");
  expectProvider("프리미어리그", "39");
  expectProvider("라리가", "140");
  expectProvider("La Liga", "140");
  expectProvider("분데스리", "78");
  expectProvider("분데스리가", "78");
  expectProvider("세리에A", "135");
  expectProvider("세리에 A", "135");
  expectProvider("프리그1", "61");
  expectProvider("UCL", "2");
  expectProvider("UEL", "3");
  expectProvider("K리그1", "292");
  expectProvider("J1리그", "98");
  expectProvider("에레디비", "88");
  expectProvider("Eredivisie", "88");
  expectProvider("EFL챔", "40");
  expectProvider("EFL Championship", "40");
  expectProvider("MLS", "253");
  expectProvider("Major League Soccer", "253");

  assert.equal(getCompetitionByProviderId("api-football", "88")?.officialName, "Eredivisie");
  assert.equal(getCompetitionByProviderId("api-football", "40")?.officialName, "EFL Championship");
  assert.equal(getCompetitionByProviderId("api-football", "253")?.officialName, "Major League Soccer");
  assert.equal(getCompetitionByProviderId("api-football", "40")?.country, "England");

  assert.equal(findCompetitionByOperatorLabel("Championship"), null);
  assert.equal(findCompetitionByOperatorLabel("epl"), null);
  assert.equal(findCompetitionByOperatorLabel("분데스"), null);
  assert.equal(findCompetitionByOperatorLabel("세리에"), null);
  assert.equal(findCompetitionByOperatorLabel("프리미어"), null);
  assert.equal(findCompetitionByOperatorLabel("축구"), null);
  assert.equal(findCompetitionByOperatorLabel(""), null);
  assert.equal(findCompetitionByOperatorLabel("EPL Championship"), null);

  const source = readFileSync(
    path.join(process.cwd(), "src/lib/football/foundation/competition-registry.ts"),
    "utf8",
  );
  assert.equal(source.includes(".includes(n.toLowerCase"), false);
  assert.equal(source.includes("Levenshtein"), false);
  assert.equal(source.includes("fuzzy"), false);
  assert.equal(/label\.includes\(/.test(source), false);

  const registryIds = new Set(
    FOOTBALL_COMPETITION_REGISTRY_V0.map((c) => Number(c.providerCompetitionId)),
  );
  const uiIds = new Set(FOOTBALL_LEAGUES.map((l) => l.providerLeagueId));
  for (const id of [2, 3, 39, 140, 78, 135, 61, 292, 98, 253]) {
    assert.equal(registryIds.has(id), true, `research missing ${id}`);
    assert.equal(uiIds.has(id), true, `ui missing ${id}`);
  }
  assert.equal(uiIds.has(24), false);
  assert.equal(uiIds.has(88), false);
  assert.equal(uiIds.has(40), false);
  assert.equal(registryIds.has(24), true);

  for (const ui of FOOTBALL_LEAGUES) {
    const research = getCompetitionByProviderId("api-football", String(ui.providerLeagueId));
    if (!research) continue;
    assert.equal(research.displayName, ui.displayName, `displayName drift id=${ui.providerLeagueId}`);
  }

  const sealed = {
    "data/audits/2026-08-29-daily-scope-lock-v1.json":
      "c6a898ad16dbde921bc5ace9c086d5e3ccd9c5907d00c2d420ed088638e64e53",
    "data/audits/2026-08-29-schedule-identity-reconciliation-v1.json":
      "c6baf2466302b2f57d3864fb1c048944cbc74611bbc5a4016d01e3648a7aaf1f",
    "data/audits/2026-08-29-pregame-input-coverage-v1.json":
      "c769e56eeb7fbe7afc895b7253ed0f81585f0a3d86b218dc2abe4c9b5aafd838",
    "data/audits/2026-08-29-prediction-pass-reconciliation-v1.json":
      "5d4ffb21788140bceeee24904f5f7992f59be0bb087b9255e5a125410dac0dac",
    "data/audits/2026-08-29-pregame-prediction-snapshot-v1.json":
      "f78ce2e18ad834d4e40d55d2df57a241bab7aad26dfa7ddf547e922783d76d84",
  };
  for (const [rel, hash] of Object.entries(sealed)) {
    assert.equal(sha256File(rel), hash, rel);
  }
  const recon = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data/audits/2026-08-29-prediction-pass-reconciliation-v1.json"),
      "utf8",
    ),
  );
  assert.equal(recon.predictionCount, 0);
  assert.equal(recon.passCount, 29);
  assert.equal(recon.officialRecommendationCount, 0);

  const engineDiff = execSync(
    "git diff --name-only -- src/lib/engine src/lib/mlb/prediction-v0",
    { encoding: "utf8" },
  ).trim();
  assert.equal(engineDiff, "");

  console.log("PASS test-football-competition-registry-v1");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
