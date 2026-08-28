/**
 * Football Team Alias Registry v1 — exact operator-label tests.
 * No provider calls. No sealed 2026-08-29 mutation. No Engine/Weight change.
 *
 * Run: npm run test:football-team-alias-registry-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { FOOTBALL_COMPETITION_REGISTRY_V0 } from "../src/lib/football/foundation/competition-registry";
import {
  TEAM_ALIASES,
  getTeamDisplayName,
  normalizeTeamName,
} from "../src/lib/teams";
import type { TeamAliasEntry } from "../src/lib/teams";

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel)))
    .digest("hex");
}

function footballEntries(): TeamAliasEntry[] {
  return TEAM_ALIASES.filter((e) => e.sport === "football");
}

function findByOriginal(raw: string, league: string): TeamAliasEntry | undefined {
  const key = normalizeTeamName(raw);
  return footballEntries().find(
    (e) =>
      e.league === league &&
      e.originalNames.some((n) => normalizeTeamName(n) === key),
  );
}

function expectExact(
  raw: string,
  league: string,
  displayName: string,
  providerTeamId: string,
) {
  const hit = findByOriginal(raw, league);
  assert.ok(hit, `missing alias for ${raw} in ${league}`);
  assert.equal(hit.displayName, displayName, raw);
  assert.equal(hit.sport, "football");
  assert.equal(hit.league, league);
  const ext = hit.externalIds?.find((x) => x.provider === "api-football");
  assert.equal(ext?.id, providerTeamId, `${raw} provider id`);
  assert.equal(
    getTeamDisplayName({
      originalName: raw,
      sport: "football",
      league,
    }),
    displayName,
    `label ${raw}`,
  );
  assert.equal(
    getTeamDisplayName({
      originalName: "WRONG",
      provider: "api-football",
      externalTeamId: providerTeamId,
    }),
    displayName,
    `id ${providerTeamId}`,
  );
}

function main() {
  assert.equal(FOOTBALL_COMPETITION_REGISTRY_V0.length, 13);

  expectExact("라싱산탄", "라리가", "라싱산탄", "4665");
  expectExact("엘체", "라리가", "엘체", "797");
  expectExact("알라베스", "라리가", "알라베스", "542");
  expectExact("비야레알", "라리가", "비야레알", "533");
  expectExact("Racing Santander", "라리가", "라싱산탄", "4665");
  expectExact("Elche", "라리가", "엘체", "797");
  expectExact("Alaves", "라리가", "알라베스", "542");
  expectExact("Villarreal", "라리가", "비야레알", "533");

  expectExact("맨체스C", "프리미어리그", "맨시티", "50");
  expectExact("크리스털", "프리미어리그", "크리스털", "52");
  expectExact("바이뮌헨", "분데스리가", "바이에른", "157");
  expectExact("흐로닝언", "에레디비시에", "흐로닝언", "202");
  expectExact("F시타르", "에레디비시에", "F시타르", "205");
  expectExact("에스파뇰", "라리가", "에스파뇰", "540");

  assert.equal(
    getTeamDisplayName({
      originalName: "양에지미지팀",
      sport: "football",
      league: "라리가",
    }),
    "양에지미지팀",
  );
  assert.equal(findByOriginal("양에지미지팀", "라리가"), undefined);

  for (const near of ["라싱산탄X", "엘체FC", "알라베", "비야레알CF", "라싱"]) {
    assert.equal(
      getTeamDisplayName({
        originalName: near,
        sport: "football",
        league: "라리가",
      }),
      near,
      `near-miss ${near}`,
    );
    assert.equal(findByOriginal(near, "라리가"), undefined, `near-miss hit ${near}`);
  }

  assert.equal(
    getTeamDisplayName({
      originalName: "서울",
      sport: "football",
      league: "라리가",
    }),
    "서울",
  );
  assert.equal(
    getTeamDisplayName({
      originalName: "서울",
      sport: "football",
      league: "K리그1",
    }),
    "서울",
  );
  const seoul = findByOriginal("서울", "K리그1");
  assert.equal(seoul?.externalIds?.[0]?.id, "2766");

  assert.equal(findByOriginal("시티", "프리미어리그"), undefined);
  assert.equal(findByOriginal("유나이티드", "프리미어리그"), undefined);
  assert.equal(findByOriginal("시티", "MLS"), undefined);
  assert.equal(findByOriginal("맨체스C", "프리미어리그")?.externalIds?.[0]?.id, "50");
  assert.equal(
    getTeamDisplayName({
      originalName: "맨체스C",
      sport: "football",
      league: "프리미어리그",
    }),
    "맨시티",
  );

  assert.equal(
    getTeamDisplayName({ originalName: "두산", sport: "baseball", league: "KBO" }),
    "두산",
  );
  assert.equal(
    getTeamDisplayName({
      originalName: "울산",
      sport: "football",
      league: "K리그1",
    }),
    "울산",
  );
  assert.equal(
    getTeamDisplayName({
      originalName: "히로카프",
      sport: "baseball",
      league: "NPB",
    }),
    "히로시마",
  );

  const providerIds = new Map<string, string[]>();
  for (const entry of footballEntries()) {
    for (const ext of entry.externalIds ?? []) {
      if (ext.provider !== "api-football") continue;
      const list = providerIds.get(ext.id) ?? [];
      list.push(entry.displayName);
      providerIds.set(ext.id, list);
    }
  }
  const duplicateIds = [...providerIds.entries()].filter(([, names]) => names.length > 1);
  assert.deepEqual(duplicateIds, [], JSON.stringify(duplicateIds));

  const nameKeys = new Map<string, string[]>();
  for (const entry of footballEntries()) {
    for (const name of entry.originalNames) {
      const key = `${entry.league ?? ""}::${normalizeTeamName(name)}`;
      const list = nameKeys.get(key) ?? [];
      list.push(entry.displayName);
      nameKeys.set(key, list);
    }
  }
  const duplicateNames = [...nameKeys.entries()].filter(([, names]) => {
    return new Set(names).size > 1 || names.length > 1;
  }).filter(([, names]) => new Set(names).size > 1);
  assert.deepEqual(duplicateNames, [], JSON.stringify(duplicateNames));

  const aliasSrc = [
    readFileSync(path.join(process.cwd(), "src/lib/teams/get-team-display-name.ts"), "utf8"),
    readFileSync(path.join(process.cwd(), "src/lib/teams/team-aliases.ts"), "utf8"),
  ].join("\n");
  assert.equal(aliasSrc.includes("Levenshtein"), false);
  assert.equal(aliasSrc.toLowerCase().includes("fuzzy"), false);
  assert.equal(/originalName\.includes\(/.test(aliasSrc), false);
  assert.equal(/label\.includes\(/.test(aliasSrc), false);

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
    "git diff --name-only -- src/lib/engine src/lib/mlb/prediction-v0 src/lib/football/foundation/competition-registry.ts src/lib/teams/get-team-display-name.ts",
    { encoding: "utf8" },
  ).trim();
  assert.equal(engineDiff, "");

  const AUDIT_REL = "data/audits/football-team-alias-registry-v1.json";
  const audit = JSON.parse(readFileSync(path.join(process.cwd(), AUDIT_REL), "utf8"));
  assert.equal(audit.schemaVersion, "yang-edge-football-team-alias-registry-v1");
  assert.equal(audit.baseCommit, "a6b419d7aec03c0b8f629ab06e1000e5ae452ac7");
  assert.equal(audit.historicalMutation, false);
  assert.equal(audit.resultDataUsed, false);
  assert.equal(audit.fuzzyMatchingUsed, false);
  assert.equal(audit.engineModified, false);
  assert.equal(audit.weightsModified, false);
  assert.equal(audit.summary.footballAliasCountBefore, 51);
  assert.equal(audit.summary.footballAliasCountAfter, footballEntries().length);
  assert.equal(audit.summary.footballAliasCountAfter, 71);
  assert.equal(audit.summary.newEntryCount, 20);
  assert.equal(audit.summary.modifiedEntryCount, 11);
  assert.equal(audit.summary.admittedAliasCount, audit.admittedAliases.length);
  assert.equal(audit.summary.collisionCount, 0);
  assert.equal(audit.summary.providerIdConflictCount, 0);
  assert.equal(audit.resolverContract.modified, false);

  const allowedMethods = new Set([
    "EXACT_COMPETITION_KICKOFF_PAIR_PROVIDER_ID",
    "PREVIOUS_DETERMINISTIC_PREGAME_MAPPING_PROVIDER_ID",
    "EXISTING_PROVIDER_ID_WITH_NEW_OPERATOR_LABEL_EVIDENCE",
  ]);
  const footballById = new Map<string, TeamAliasEntry>();
  for (const entry of footballEntries()) {
    for (const ext of entry.externalIds ?? []) {
      if (ext.provider === "api-football") footballById.set(ext.id, entry);
    }
  }
  for (const row of audit.admittedAliases) {
    assert.equal(row.resultDataUsed, false, row.rawOperatorLabel);
    assert.equal(row.admissionStatus, "ADMITTED", row.rawOperatorLabel);
    assert.equal(allowedMethods.has(row.identityMethod), true, row.rawOperatorLabel);
    const entry = footballById.get(row.providerTeamId);
    assert.ok(entry, `missing registry entry for ${row.rawOperatorLabel} id=${row.providerTeamId}`);
    assert.equal(entry.displayName, row.displayName, row.rawOperatorLabel);
    assert.equal(
      entry.originalNames.some((n) => normalizeTeamName(n) === normalizeTeamName(row.rawOperatorLabel)),
      true,
      `originalName missing ${row.rawOperatorLabel}`,
    );
    assert.equal(existsSync(path.join(process.cwd(), row.sourceOperatorArtifact)), true, row.sourceOperatorArtifact);
    assert.equal(
      existsSync(path.join(process.cwd(), row.sourceFixtureOrMappingArtifact)),
      true,
      row.sourceFixtureOrMappingArtifact,
    );
  }
  for (const src of audit.sourceArtifacts) {
    const abs = path.join(process.cwd(), src.path);
    assert.equal(existsSync(abs), true, src.path);
    assert.equal(sha256File(src.path), src.sha256, src.path);
  }
  assert.equal(
    audit.unresolvedAliases.some((row: { rawOperatorLabel: string }) => row.rawOperatorLabel === "데포아코"),
    true,
  );
  assert.equal(
    audit.unresolvedAliases.some((row: { rawOperatorLabel: string }) => row.rawOperatorLabel === "RC랑스"),
    true,
  );
  assert.equal(findByOriginal("시티", "프리미어리그"), undefined);
  assert.equal(findByOriginal("데포아코", "라리가"), undefined);
  assert.equal(findByOriginal("카디프C", "EFL 챔피언십"), undefined);
  assert.equal(findByOriginal("RC랑스", "리그 1"), undefined);

  console.log(
    JSON.stringify({
      footballAliasCount: footballEntries().length,
      duplicateProviderIds: duplicateIds.length,
      duplicateOriginalNames: duplicateNames.length,
      auditAdmitted: audit.admittedAliases.length,
    }),
  );
  console.log("PASS test-football-team-alias-registry-v1");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
