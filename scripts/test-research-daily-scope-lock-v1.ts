/**
 * Research target scope lock — focused + semantic hotfix suite.
 *
 *   npm run test:research-daily-scope-lock-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertExplicitDateKst,
  classifyScopeLockDocument,
  isLegacyDailyScopeLockDocument,
  isResearchTargetScopeLockDocument,
  legacyDailyScopeLockRel,
  lockResearchTargetScope,
  operatorBetmanDailySlateRel,
  researchTargetScopeLockRel,
  sortTargetsDeterministic,
  verifyDecisionCoverage,
  RESEARCH_TARGET_SCOPE_LOCK_MECHANISM,
  RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION,
  RESEARCH_TARGET_SCOPE_LOCK_SCHEMA_VERSION,
  LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
  type ResearchTargetScopeLockDocument,
} from "../src/lib/research/daily-scope-lock";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function makeCwd(label: string): string {
  const dir = join(
    tmpdir(),
    `ye-scope-hotfix-${label}-${process.pid}-${Date.now()}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeOperatorSlate(
  cwd: string,
  dateKst: string,
  games: unknown[],
) {
  const rel = operatorBetmanDailySlateRel(dateKst);
  mkdirSync(join(cwd, rel, ".."), { recursive: true });
  writeFileSync(
    join(cwd, rel),
    `${JSON.stringify(
      {
        schemaVersion: "betman-daily-slate-v1",
        targetDateKst: dateKst,
        sourceType: "OPERATOR_MANUAL",
        capturedAt: null,
        enteredAt: null,
        reviewedAt: null,
        reviewStatus: "VERIFIED",
        games,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function sampleGame(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operatorSlateGameId: id,
    sport: "SOCCER",
    competitionNameRaw: "EPL",
    competitionNameKo: null,
    operatorGameNumber: null,
    operatorMarketId: null,
    homeTeamRaw: "Home",
    awayTeamRaw: "Away",
    scheduledStartTimeKst: "2026-09-19T19:00:00+09:00",
    operatorHomeAwayStatus: "VERIFIED",
    marketTypeRaw: null,
    marketRuleStatus: "VERIFIED",
    marketSelections: [],
    capturedAt: null,
    reviewStatus: "VERIFIED",
    sourceReference: null,
    providerGameId: null,
    providerFixtureId: null,
    manualIdentityReference: null,
    notes: null,
    ...overrides,
  };
}

function fakeLock(targets: string[]): ResearchTargetScopeLockDocument {
  return {
    schemaVersion: RESEARCH_TARGET_SCOPE_LOCK_SCHEMA_VERSION,
    lockMechanism: RESEARCH_TARGET_SCOPE_LOCK_MECHANISM,
    policyVersion: RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION,
    dateKst: "2026-09-19",
    lockStatus: "LOCKED",
    scopeLockStatus: targets.length === 0 ? "EMPTY_ADMISSIBLE" : "COMPLETE",
    status:
      targets.length === 0 ? "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS" : "LOCKED",
    createdAt: "2026-09-19T00:00:00.000Z",
    scopeLockedAt: "2026-09-19T00:00:00.000Z",
    source: {
      class: "OPERATOR_BETMAN_DAILY_SLATE",
      rel: "x",
      sha256: "y",
    },
    targetCount: targets.length,
    officialDenominator: targets.length,
    targets: targets.map((id) => ({
      targetId: id,
      operatorSlateGameId: id,
      sport: "SOCCER",
      competitionNameRaw: null,
      homeTeamRaw: "H",
      awayTeamRaw: "A",
      scheduledStartTimeKst: null,
      providerGameId: null,
      providerFixtureId: null,
    })),
    exclusions: [],
    sports: targets.length ? ["SOCCER"] : [],
    observedScope: {
      total: targets.length,
      bySport: targets.length ? { SOCCER: targets.length } : {},
    },
    scopeShrinkAfterLockForbidden: true,
    researchOnly: true,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    predictionInput: false,
    engineAdmission: "PROHIBITED",
    fuzzyMatchingUsed: false,
    invariant:
      "EVERY_LOCKED_TARGET_REQUIRES_EXACTLY_ONE_SEALED_PREDICTION_OR_PASS",
    note: "test",
  };
}

function loadLegacy(date: string): unknown {
  const abs = join(process.cwd(), legacyDailyScopeLockRel(date));
  return JSON.parse(readFileSync(abs, "utf8"));
}

// --- core date/source ---

test("explicit date required", async () => {
  await assert.rejects(
    () => lockResearchTargetScope({ dateKst: "" }),
    /EXPLICIT_DATE_KST_REQUIRED/,
  );
});

test("valid YYYY-MM-DD accepted", () => {
  assert.equal(assertExplicitDateKst("2026-09-19"), "2026-09-19");
});

test("invalid date rejected", () => {
  assert.throws(() => assertExplicitDateKst("2026-13-40"), /INVALID_DATE_KST/);
});

test("missing source → TARGET_SCOPE_SOURCE_MISSING; no lock", async () => {
  const cwd = makeCwd("missing");
  try {
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(result.status, "TARGET_SCOPE_SOURCE_MISSING");
    assert.equal(result.lockCreated, false);
    assert.equal(result.targetCountAuthoritative, false);
    assert.equal(
      existsSync(join(cwd, researchTargetScopeLockRel("2026-09-19"))),
      false,
    );
    assert.equal(
      existsSync(join(cwd, legacyDailyScopeLockRel("2026-09-19"))),
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("malformed source → TARGET_SCOPE_SOURCE_INVALID", async () => {
  const cwd = makeCwd("invalid");
  try {
    const rel = operatorBetmanDailySlateRel("2026-09-19");
    mkdirSync(join(cwd, rel, ".."), { recursive: true });
    writeFileSync(join(cwd, rel), "{not-json", "utf8");
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(result.status, "TARGET_SCOPE_SOURCE_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("zero admissible distinct from source missing", async () => {
  const missingCwd = makeCwd("m");
  const zeroCwd = makeCwd("z");
  try {
    const missing = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd: missingCwd,
    });
    writeOperatorSlate(zeroCwd, "2026-09-19", []);
    const zero = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd: zeroCwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(missing.status, "TARGET_SCOPE_SOURCE_MISSING");
    assert.equal(zero.status, "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS");
    assert.notEqual(missing.status, zero.status);
    assert.equal(
      zero.document?.schemaVersion,
      RESEARCH_TARGET_SCOPE_LOCK_SCHEMA_VERSION,
    );
  } finally {
    rmSync(missingCwd, { recursive: true, force: true });
    rmSync(zeroCwd, { recursive: true, force: true });
  }
});

test("deterministic targets + ordering + conflict/dedupe", async () => {
  const cwd = makeCwd("det");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G-B", { sport: "BASEBALL" }),
      sampleGame("G-A", { sport: "SOCCER" }),
    ]);
    const a = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T01:00:00.000Z",
    });
    assert.equal(a.status, "LOCKED");
    assert.deepEqual(
      a.document?.targets.map((t) => t.targetId),
      ["G-B", "G-A"],
    );
    assert.equal(
      a.outputPath,
      researchTargetScopeLockRel("2026-09-19"),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }

  assert.deepEqual(
    sortTargetsDeterministic([
      {
        targetId: "Z",
        operatorSlateGameId: "Z",
        sport: "SOCCER",
        competitionNameRaw: null,
        homeTeamRaw: "H",
        awayTeamRaw: "A",
        scheduledStartTimeKst: null,
        providerGameId: null,
        providerFixtureId: null,
      },
      {
        targetId: "A",
        operatorSlateGameId: "A",
        sport: "BASEBALL",
        competitionNameRaw: null,
        homeTeamRaw: "H",
        awayTeamRaw: "A",
        scheduledStartTimeKst: null,
        providerGameId: null,
        providerFixtureId: null,
      },
    ]).map((t) => t.targetId),
    ["A", "Z"],
  );

  const dup = makeCwd("dup");
  try {
    writeOperatorSlate(dup, "2026-09-19", [
      sampleGame("SAME", { homeTeamRaw: "Alpha" }),
      sampleGame("SAME", { homeTeamRaw: "Beta" }),
    ]);
    const conflict = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd: dup,
    });
    assert.equal(conflict.status, "TARGET_SCOPE_CONFLICT");
  } finally {
    rmSync(dup, { recursive: true, force: true });
  }
});

test("idempotent + conflict on new path only", async () => {
  const cwd = makeCwd("idem");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    const abs = join(cwd, researchTargetScopeLockRel("2026-09-19"));
    const hash1 = sha256File(abs);
    const second = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T99:00:00.000Z",
    });
    assert.equal(second.status, "IDEMPOTENT_EXISTING");
    assert.equal(sha256File(abs), hash1);
    assert.equal(existsSync(join(cwd, legacyDailyScopeLockRel("2026-09-19"))), false);

    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G2")]);
    const conflict = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(conflict.status, "SCOPE_LOCK_CONFLICT");
    assert.equal(sha256File(abs), hash1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- legacy detection 1-5 ---

test("1 legacy 08-26 detected as LEGACY_DAILY_SCOPE_LOCK", () => {
  const doc = loadLegacy("2026-08-26");
  assert.equal(classifyScopeLockDocument(doc), "LEGACY_DAILY_SCOPE_LOCK");
  assert.equal(isLegacyDailyScopeLockDocument(doc), true);
});

test("2 legacy 08-29 detected as LEGACY_DAILY_SCOPE_LOCK", () => {
  const doc = loadLegacy("2026-08-29");
  assert.equal(classifyScopeLockDocument(doc), "LEGACY_DAILY_SCOPE_LOCK");
});

test("3 legacy 08-30 detected as LEGACY_DAILY_SCOPE_LOCK", () => {
  const doc = loadLegacy("2026-08-30");
  assert.equal(classifyScopeLockDocument(doc), "LEGACY_DAILY_SCOPE_LOCK");
});

test("4 none of legacy locks accepted as ResearchTargetScopeLockDocument", () => {
  for (const d of ["2026-08-26", "2026-08-29", "2026-08-30"]) {
    assert.equal(isResearchTargetScopeLockDocument(loadLegacy(d)), false);
  }
});

test("5 legacy hashes unchanged after lock attempts", async () => {
  const dates = ["2026-08-26", "2026-08-29", "2026-08-30"];
  const before = dates.map((d) => ({
    d,
    hash: sha256File(join(process.cwd(), legacyDailyScopeLockRel(d))),
  }));
  for (const d of dates) {
    await lockResearchTargetScope({ dateKst: d });
  }
  for (const row of before) {
    assert.equal(
      sha256File(join(process.cwd(), legacyDailyScopeLockRel(row.d))),
      row.hash,
    );
  }
});

// --- schema tests 6-12 ---

test("6 legacy schema cannot pass new type guard", () => {
  assert.equal(
    isResearchTargetScopeLockDocument({
      schemaVersion: LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
      dateKst: "2026-08-30",
      lockStatus: "LOCKED",
      officialDenominator: 44,
    }),
    false,
  );
});

test("7 new schema missing targets[] fails validation", () => {
  const doc = { ...fakeLock(["A"]) } as Record<string, unknown>;
  delete doc.targets;
  assert.equal(isResearchTargetScopeLockDocument(doc), false);
});

test("8 new schema malformed source fails validation", () => {
  const doc = { ...fakeLock(["A"]), source: { class: "X" } };
  assert.equal(isResearchTargetScopeLockDocument(doc), false);
});

test("9 new valid target-scope document passes validation", () => {
  assert.equal(isResearchTargetScopeLockDocument(fakeLock(["A"])), true);
});

test("10 legacy and new artifact paths are distinct", () => {
  assert.notEqual(
    legacyDailyScopeLockRel("2026-09-19"),
    researchTargetScopeLockRel("2026-09-19"),
  );
  assert.equal(
    researchTargetScopeLockRel("2026-09-19"),
    "data/audits/2026-09-19-research-target-scope-lock-v1.json",
  );
});

test("11 new writer never overwrites legacy Daily C file", async () => {
  const cwd = makeCwd("nolegacy");
  try {
    const legacyRel = legacyDailyScopeLockRel("2026-09-19");
    mkdirSync(join(cwd, legacyRel, ".."), { recursive: true });
    writeFileSync(
      join(cwd, legacyRel),
      JSON.stringify({
        schemaVersion: LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
        dateKst: "2026-09-19",
        marker: "LEGACY_SENTINEL",
      }),
      "utf8",
    );
    const hash = sha256File(join(cwd, legacyRel));
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(result.lockCreated, true);
    assert.equal(result.outputPath, researchTargetScopeLockRel("2026-09-19"));
    assert.equal(sha256File(join(cwd, legacyRel)), hash);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("12 new idempotence checks only the new target-scope artifact", async () => {
  const cwd = makeCwd("idem-new");
  try {
    const legacyRel = legacyDailyScopeLockRel("2026-09-19");
    mkdirSync(join(cwd, legacyRel, ".."), { recursive: true });
    writeFileSync(
      join(cwd, legacyRel),
      JSON.stringify({
        schemaVersion: LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
        dateKst: "2026-09-19",
      }),
      "utf8",
    );
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const first = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(first.lockCreated, true);
    const second = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T01:00:00.000Z",
    });
    assert.equal(second.status, "IDEMPOTENT_EXISTING");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- coverage 13-20 ---

test("13 SOURCE_MISSING → TARGET_SCOPE_SOURCE_MISSING", () => {
  const r = verifyDecisionCoverage({
    scopeLock: null,
    sealedDecisionTargetIds: [],
    scopeResolution: "TARGET_SCOPE_SOURCE_MISSING",
  });
  assert.equal(r.status, "TARGET_SCOPE_SOURCE_MISSING");
  assert.equal(r.reason, "TARGET_SCOPE_SOURCE_MISSING");
});

test("14 SOURCE_INVALID → COVERAGE_NOT_EVALUABLE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: null,
    sealedDecisionTargetIds: [],
    scopeResolution: "TARGET_SCOPE_SOURCE_INVALID",
  });
  assert.equal(r.status, "COVERAGE_NOT_EVALUABLE");
  assert.equal(r.reason, "TARGET_SCOPE_SOURCE_INVALID");
});

test("15 TARGET_SCOPE_CONFLICT → COVERAGE_NOT_EVALUABLE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: null,
    sealedDecisionTargetIds: [],
    scopeResolution: "TARGET_SCOPE_CONFLICT",
  });
  assert.equal(r.status, "COVERAGE_NOT_EVALUABLE");
  assert.equal(r.reason, "TARGET_SCOPE_CONFLICT");
});

test("16 SCOPE_LOCK_CONFLICT → COVERAGE_NOT_EVALUABLE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: null,
    sealedDecisionTargetIds: [],
    scopeResolution: "SCOPE_LOCK_CONFLICT",
  });
  assert.equal(r.status, "COVERAGE_NOT_EVALUABLE");
  assert.equal(r.reason, "SCOPE_LOCK_CONFLICT");
});

test("17 valid locked target missing decision → COVERAGE_INCOMPLETE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock(["A", "B"]),
    sealedDecisionTargetIds: ["A"],
    scopeResolution: "LOCKED",
  });
  assert.equal(r.status, "COVERAGE_INCOMPLETE");
  assert.deepEqual(r.missingTargetIds, ["B"]);
});

test("18 valid locked all decided → COVERAGE_COMPLETE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock(["A", "B"]),
    sealedDecisionTargetIds: ["B", "A"],
    scopeResolution: "LOCKED",
  });
  assert.equal(r.status, "COVERAGE_COMPLETE");
});

test("19 valid zero-target cohort → COVERAGE_COMPLETE 0/0", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock([]),
    sealedDecisionTargetIds: [],
    scopeResolution: "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS",
  });
  assert.equal(r.status, "COVERAGE_COMPLETE");
  assert.equal(r.lockedTargetCount, 0);
  assert.equal(r.targetCountAuthoritative, true);
});

test("20 null scope without resolution → NOT_EVALUABLE not SOURCE_MISSING", () => {
  const r = verifyDecisionCoverage({
    scopeLock: null,
    sealedDecisionTargetIds: [],
    scopeResolution: null,
  });
  assert.equal(r.status, "COVERAGE_NOT_EVALUABLE");
  assert.equal(r.reason, "SCOPE_RESOLUTION_UNKNOWN");
  assert.notEqual(r.status, "TARGET_SCOPE_SOURCE_MISSING");
});

test("boundary: no forbidden imports", () => {
  const dir = join(process.cwd(), "src/lib/research/daily-scope-lock");
  const source = [
    "admit-source.ts",
    "coverage.ts",
    "index.ts",
    "lock.ts",
    "paths.ts",
    "policy.ts",
    "types.ts",
  ]
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  for (const bad of [
    "/api/games",
    "getFootballGamesForDate",
    "api-football-provider",
    "the-odds-api",
    "getMlbGamesForDate",
    "forward-shadow",
    "axios",
  ]) {
    assert.equal(source.includes(bad), false, bad);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
});
