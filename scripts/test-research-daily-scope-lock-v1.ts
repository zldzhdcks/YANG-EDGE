/**
 * Research target scope lock — regression after source-freeze wiring.
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
import { freezeResearchSlateSource } from "../src/lib/research/slate-source-freeze";
import {
  assertExplicitDateKst,
  classifyScopeLockDocument,
  isLegacyDailyScopeLockDocument,
  isResearchTargetScopeLockDocument,
  legacyDailyScopeLockRel,
  lockResearchTargetScope,
  operatorBetmanDailySlateRel,
  researchSlateSourceFreezeRel,
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
    `ye-scope-wired-${label}-${process.pid}-${Date.now()}`,
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
        reviewedAt: "2026-09-19T01:00:00.000Z",
        reviewStatus: "VERIFIED",
        scopeCompletenessStatus: "COMPLETE",
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

async function freezeThenLock(
  cwd: string,
  games: unknown[],
) {
  writeOperatorSlate(cwd, "2026-09-19", games);
  await freezeResearchSlateSource({
    dateKst: "2026-09-19",
    cwd,
    frozenAt: "2026-09-19T02:00:00.000Z",
  });
  return lockResearchTargetScope({
    dateKst: "2026-09-19",
    cwd,
    createdAt: "2026-09-19T03:00:00.000Z",
  });
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
      class: "RESEARCH_SLATE_SOURCE_FREEZE",
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
  return JSON.parse(
    readFileSync(join(process.cwd(), legacyDailyScopeLockRel(date)), "utf8"),
  );
}

test("explicit date required", async () => {
  await assert.rejects(
    () => lockResearchTargetScope({ dateKst: "" }),
    /EXPLICIT_DATE_KST_REQUIRED/,
  );
  assert.equal(assertExplicitDateKst("2026-09-19"), "2026-09-19");
});

test("raw operator without freeze → SOURCE_MISSING", async () => {
  const cwd = makeCwd("raw");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(result.status, "TARGET_SCOPE_SOURCE_MISSING");
    assert.equal(
      existsSync(join(cwd, researchTargetScopeLockRel("2026-09-19"))),
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("freeze → lock creates LOCKED cohort", async () => {
  const cwd = makeCwd("ok");
  try {
    const result = await freezeThenLock(cwd, [
      sampleGame("G-B", { sport: "BASEBALL" }),
      sampleGame("G-A", { sport: "SOCCER" }),
    ]);
    assert.equal(result.status, "LOCKED");
    assert.equal(result.document?.source.class, "RESEARCH_SLATE_SOURCE_FREEZE");
    assert.deepEqual(
      result.document?.targets.map((t) => t.targetId),
      ["G-B", "G-A"],
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("zero freeze → NO_ADMISSIBLE authoritative", async () => {
  const cwd = makeCwd("zero");
  try {
    const result = await freezeThenLock(cwd, []);
    assert.equal(result.status, "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS");
    assert.equal(result.targetCountAuthoritative, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("tennis preserved in freeze, excluded at lock", async () => {
  const cwd = makeCwd("tennis");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("T1", { sport: "TENNIS" }),
      sampleGame("S1"),
    ]);
    const freeze = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(freeze.document?.sourceGameCount, 2);
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T03:00:00.000Z",
    });
    assert.equal(lock.targetCount, 1);
    assert.ok(
      lock.document?.exclusions.some((e) => e.reason === "UNSUPPORTED_SPORT"),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("idempotent + conflict on new path", async () => {
  const cwd = makeCwd("idem");
  try {
    await freezeThenLock(cwd, [sampleGame("G1")]);
    const abs = join(cwd, researchTargetScopeLockRel("2026-09-19"));
    const hash1 = sha256File(abs);
    const second = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T99:00:00.000Z",
    });
    assert.equal(second.status, "IDEMPOTENT_EXISTING");
    assert.equal(sha256File(abs), hash1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("legacy detection + hashes unchanged", async () => {
  for (const d of ["2026-08-26", "2026-08-29", "2026-08-30"]) {
    const doc = loadLegacy(d);
    assert.equal(classifyScopeLockDocument(doc), "LEGACY_DAILY_SCOPE_LOCK");
    assert.equal(isLegacyDailyScopeLockDocument(doc), true);
    assert.equal(isResearchTargetScopeLockDocument(doc), false);
  }
  const before = ["2026-08-26", "2026-08-29", "2026-08-30"].map((d) => ({
    d,
    hash: sha256File(join(process.cwd(), legacyDailyScopeLockRel(d))),
  }));
  await lockResearchTargetScope({ dateKst: "2026-08-26" });
  for (const row of before) {
    assert.equal(
      sha256File(join(process.cwd(), legacyDailyScopeLockRel(row.d))),
      row.hash,
    );
  }
});

test("paths distinct", () => {
  assert.notEqual(
    legacyDailyScopeLockRel("2026-09-19"),
    researchTargetScopeLockRel("2026-09-19"),
  );
  assert.notEqual(
    researchSlateSourceFreezeRel("2026-09-19"),
    researchTargetScopeLockRel("2026-09-19"),
  );
});

test("coverage semantics preserved", () => {
  assert.equal(
    verifyDecisionCoverage({
      scopeLock: null,
      sealedDecisionTargetIds: [],
      scopeResolution: "TARGET_SCOPE_SOURCE_MISSING",
    }).status,
    "TARGET_SCOPE_SOURCE_MISSING",
  );
  assert.equal(
    verifyDecisionCoverage({
      scopeLock: null,
      sealedDecisionTargetIds: [],
      scopeResolution: "TARGET_SCOPE_SOURCE_INVALID",
    }).status,
    "COVERAGE_NOT_EVALUABLE",
  );
  assert.equal(
    verifyDecisionCoverage({
      scopeLock: fakeLock([]),
      sealedDecisionTargetIds: [],
      scopeResolution: "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS",
    }).status,
    "COVERAGE_COMPLETE",
  );
  assert.equal(
    verifyDecisionCoverage({
      scopeLock: null,
      sealedDecisionTargetIds: [],
      scopeResolution: null,
    }).reason,
    "SCOPE_RESOLUTION_UNKNOWN",
  );
});

test("coverage rejects duplicate and out-of-scope terminal decisions", () => {
  for (const ids of [["A", "A"], ["A", "OUTSIDE"]]) {
    assert.equal(verifyDecisionCoverage({
      scopeLock: fakeLock(["A"]),
      sealedDecisionTargetIds: ids,
      scopeResolution: "LOCKED",
    }).status, "COVERAGE_INCOMPLETE");
  }
  assert.equal(verifyDecisionCoverage({
    scopeLock: fakeLock(["A", "A"]),
    sealedDecisionTargetIds: ["A"],
    scopeResolution: "LOCKED",
  }).status, "COVERAGE_INCOMPLETE");
});

test("coverage consumes one-shot iterable once and preserves exact counts", () => {
  function* decisions() { yield "A"; yield "B"; }
  const result = verifyDecisionCoverage({
    scopeLock: fakeLock(["A", "B"]),
    sealedDecisionTargetIds: decisions(),
    scopeResolution: "LOCKED",
  });
  assert.equal(result.status, "COVERAGE_COMPLETE");
  assert.equal(result.sealedDecisionCount, 2);
  const duplicate = verifyDecisionCoverage({
    scopeLock: fakeLock(["A"]),
    sealedDecisionTargetIds: ["A", "A"],
    scopeResolution: "LOCKED",
  });
  assert.equal(duplicate.sealedDecisionCount, 2);
});

test("coverage rejects denominator mismatch and unexpected decisions on empty scope", () => {
  for (const field of ["targetCount", "officialDenominator"] as const) {
    const lock = fakeLock(["A"]);
    lock[field] = 2;
    assert.equal(verifyDecisionCoverage({
      scopeLock: lock,
      sealedDecisionTargetIds: ["A"],
      scopeResolution: "LOCKED",
    }).status, "COVERAGE_INCOMPLETE");
  }
  assert.equal(verifyDecisionCoverage({
    scopeLock: fakeLock([]),
    sealedDecisionTargetIds: ["OUTSIDE"],
    scopeResolution: "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS",
  }).status, "COVERAGE_INCOMPLETE");
});

test("stable ordering helper", () => {
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
});

test("schema version distinct from legacy", () => {
  assert.notEqual(
    RESEARCH_TARGET_SCOPE_LOCK_SCHEMA_VERSION,
    LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
  );
  assert.equal(isResearchTargetScopeLockDocument(fakeLock(["A"])), true);
});

test("writer never touches legacy Daily C path", async () => {
  const cwd = makeCwd("nolegacy");
  try {
    const legacyRel = legacyDailyScopeLockRel("2026-09-19");
    mkdirSync(join(cwd, legacyRel, ".."), { recursive: true });
    writeFileSync(
      join(cwd, legacyRel),
      JSON.stringify({
        schemaVersion: LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
        dateKst: "2026-09-19",
        marker: "LEGACY",
      }),
      "utf8",
    );
    const hash = sha256File(join(cwd, legacyRel));
    await freezeThenLock(cwd, [sampleGame("G1")]);
    assert.equal(sha256File(join(cwd, legacyRel)), hash);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
