/**
 * Current-date research target scope lock — focused suite.
 * Fixture / temp-dir only. Zero Provider / network / prediction writes.
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
  lockResearchTargetScope,
  operatorBetmanDailySlateRel,
  researchTargetScopeLockRel,
  sortTargetsDeterministic,
  verifyDecisionCoverage,
  type ResearchTargetScopeLockDocument,
} from "../src/lib/research/daily-scope-lock";

const SECRET_MARKERS = ["x-apisports-key", "API_FOOTBALL_KEY", "sk_live"];

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function makeCwd(label: string): string {
  const dir = join(
    tmpdir(),
    `ye-scope-lock-${label}-${process.pid}-${Date.now()}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeOperatorSlate(
  cwd: string,
  dateKst: string,
  games: unknown[],
  extras: Record<string, unknown> = {},
) {
  const rel = operatorBetmanDailySlateRel(dateKst);
  const abs = join(cwd, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(
    abs,
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
        ...extras,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return rel;
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

test("1 explicit date required", async () => {
  await assert.rejects(
    () => lockResearchTargetScope({ dateKst: "" }),
    /EXPLICIT_DATE_KST_REQUIRED/,
  );
});

test("2 valid YYYY-MM-DD accepted", () => {
  assert.equal(assertExplicitDateKst("2026-09-19"), "2026-09-19");
});

test("3 invalid date rejected", () => {
  assert.throws(() => assertExplicitDateKst("2026-13-40"), /INVALID_DATE_KST/);
  assert.throws(() => assertExplicitDateKst("09-19-2026"), /INVALID_DATE_KST/);
  assert.throws(() => assertExplicitDateKst("today"), /INVALID_DATE_KST/);
});

test("4 no implicit current-date fallback", async () => {
  // lockResearchTargetScope requires dateKst; omitting is a TypeScript error.
  // Runtime: empty string rejected (test 1). CLI without --date exits 2 (script).
  const cwd = makeCwd("no-today");
  try {
    const result = await lockResearchTargetScope({
      dateKst: "2099-01-01",
      cwd,
    });
    assert.equal(result.status, "TARGET_SCOPE_SOURCE_MISSING");
    assert.equal(result.dateKst, "2099-01-01");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("5 missing source → TARGET_SCOPE_SOURCE_MISSING", async () => {
  const cwd = makeCwd("missing");
  try {
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(result.status, "TARGET_SCOPE_SOURCE_MISSING");
    assert.equal(result.targetCountAuthoritative, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("6 missing source creates no lock artifact", async () => {
  const cwd = makeCwd("no-lock");
  try {
    await lockResearchTargetScope({ dateKst: "2026-09-19", cwd });
    assert.equal(
      existsSync(join(cwd, researchTargetScopeLockRel("2026-09-19"))),
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("7 malformed source → TARGET_SCOPE_SOURCE_INVALID", async () => {
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
    assert.equal(result.lockCreated, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("8 valid source with zero admissible → TARGET_SCOPE_NO_ADMISSIBLE_TARGETS", async () => {
  const cwd = makeCwd("zero");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("TENNIS-1", { sport: "TENNIS" }),
    ]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(result.status, "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS");
    assert.equal(result.targetCount, 0);
    assert.equal(result.targetCountAuthoritative, true);
    assert.equal(result.lockCreated, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("9 zero admissible is distinct from source missing", async () => {
  const missingCwd = makeCwd("miss-vs-zero-a");
  const zeroCwd = makeCwd("miss-vs-zero-b");
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
    assert.equal(missing.targetCountAuthoritative, false);
    assert.equal(zero.targetCountAuthoritative, true);
  } finally {
    rmSync(missingCwd, { recursive: true, force: true });
    rmSync(zeroCwd, { recursive: true, force: true });
  }
});

test("10 valid fixture produces deterministic targets", async () => {
  const cwd = makeCwd("det");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G-B", {
        homeTeamRaw: "BHome",
        awayTeamRaw: "BAway",
        sport: "BASEBALL",
      }),
      sampleGame("G-A", {
        homeTeamRaw: "AHome",
        awayTeamRaw: "AAway",
        sport: "SOCCER",
      }),
    ]);
    const a = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T01:00:00.000Z",
    });
    assert.equal(a.status, "LOCKED");
    assert.equal(a.targetCount, 2);
    assert.deepEqual(
      a.document?.targets.map((t) => t.targetId),
      ["G-B", "G-A"],
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("11 stable ordering", () => {
  const sorted = sortTargetsDeterministic([
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
  ]);
  assert.deepEqual(
    sorted.map((t) => t.targetId),
    ["A", "Z"],
  );
});

test("12 identical duplicate safely deduped", async () => {
  const cwd = makeCwd("dup-ok");
  try {
    const g = sampleGame("SAME");
    writeOperatorSlate(cwd, "2026-09-19", [g, { ...g }]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(result.status, "LOCKED");
    assert.equal(result.targetCount, 1);
    assert.ok(
      result.document?.exclusions.some((e) => e.reason === "DUPLICATE_IDENTICAL"),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("13 conflicting duplicate → TARGET_SCOPE_CONFLICT", async () => {
  const cwd = makeCwd("dup-bad");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("SAME", { homeTeamRaw: "Alpha" }),
      sampleGame("SAME", { homeTeamRaw: "Beta" }),
    ]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(result.status, "TARGET_SCOPE_CONFLICT");
    assert.equal(result.lockCreated, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("14 unsupported candidate not silently promoted", async () => {
  const cwd = makeCwd("unsup");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("OK"),
      sampleGame("BAD", { sport: "TENNIS" }),
    ]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(result.targetCount, 1);
    assert.equal(result.document?.targets[0]?.targetId, "OK");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("15 excluded candidate records reason", async () => {
  const cwd = makeCwd("excl");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("BAD", { sport: "TENNIS" }),
    ]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(
      result.document?.exclusions[0]?.reason,
      "UNSUPPORTED_SPORT",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("16 no fuzzy matching flag", async () => {
  const cwd = makeCwd("nofuzzy");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(result.document?.fuzzyMatchingUsed, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("17 no array-position identity", async () => {
  const cwd = makeCwd("noidx");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("ID-2"),
      sampleGame("ID-1"),
    ]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    for (const t of result.document?.targets ?? []) {
      assert.equal(t.targetId, t.operatorSlateGameId);
      assert.notEqual(t.targetId, "0");
      assert.notEqual(t.targetId, "1");
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("18 absent valid lock can be created atomically", async () => {
  const cwd = makeCwd("create");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(result.lockCreated, true);
    assert.equal(result.status, "LOCKED");
    assert.equal(
      existsSync(join(cwd, researchTargetScopeLockRel("2026-09-19"))),
      true,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("19 identical existing lock → idempotent no rewrite", async () => {
  const cwd = makeCwd("idem");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const first = await lockResearchTargetScope({
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
    const hash2 = sha256File(abs);
    assert.equal(first.lockCreated, true);
    assert.equal(second.status, "IDEMPOTENT_EXISTING");
    assert.equal(second.lockCreated, false);
    assert.equal(hash1, hash2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("20 different existing lock → SCOPE_LOCK_CONFLICT", async () => {
  const cwd = makeCwd("conflict");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G2")]);
    const abs = join(cwd, researchTargetScopeLockRel("2026-09-19"));
    const hash1 = sha256File(abs);
    const result = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(result.status, "SCOPE_LOCK_CONFLICT");
    assert.equal(sha256File(abs), hash1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function assertHistoricalUntouched(date: string) {
  const rel = `data/audits/${date}-daily-scope-lock-v1.json`;
  const abs = join(process.cwd(), rel);
  assert.equal(existsSync(abs), true, rel);
  return { rel, abs, hash: sha256File(abs) };
}

test("21 historical 08-26 artifact not rewritten", async () => {
  const before = assertHistoricalUntouched("2026-08-26");
  await lockResearchTargetScope({ dateKst: "2026-08-26" });
  assert.equal(sha256File(before.abs), before.hash);
});

test("22 historical 08-29 artifact not rewritten", async () => {
  const before = assertHistoricalUntouched("2026-08-29");
  await lockResearchTargetScope({ dateKst: "2026-08-29" });
  assert.equal(sha256File(before.abs), before.hash);
});

test("23 historical 08-30 artifact not rewritten", async () => {
  const before = assertHistoricalUntouched("2026-08-30");
  await lockResearchTargetScope({ dateKst: "2026-08-30" });
  assert.equal(sha256File(before.abs), before.hash);
});

function fakeLock(
  targets: string[],
): ResearchTargetScopeLockDocument {
  return {
    schemaVersion: "yang-edge-daily-scope-lock-v1",
    lockMechanism: "research-target-scope-lock-v1",
    policyVersion: "research-target-admission-v1",
    dateKst: "2026-09-19",
    lockStatus: "LOCKED",
    scopeLockStatus: "COMPLETE",
    status: "LOCKED",
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
    sports: ["SOCCER"],
    observedScope: { total: targets.length, bySport: { SOCCER: targets.length } },
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

test("24 all locked targets have decisions → COVERAGE_COMPLETE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock(["A", "B"]),
    sealedDecisionTargetIds: ["B", "A"],
  });
  assert.equal(r.status, "COVERAGE_COMPLETE");
  assert.deepEqual(r.missingTargetIds, []);
});

test("25 one missing decision → COVERAGE_INCOMPLETE", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock(["A", "B"]),
    sealedDecisionTargetIds: ["A"],
  });
  assert.equal(r.status, "COVERAGE_INCOMPLETE");
  assert.deepEqual(r.missingTargetIds, ["B"]);
});

test("26 multiple missing decisions return exact IDs", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock(["C", "A", "B"]),
    sealedDecisionTargetIds: [],
  });
  assert.equal(r.status, "COVERAGE_INCOMPLETE");
  assert.deepEqual(r.missingTargetIds, ["A", "B", "C"]);
});

test("27 decision for non-target does not hide missing target", () => {
  const r = verifyDecisionCoverage({
    scopeLock: fakeLock(["A"]),
    sealedDecisionTargetIds: ["X", "Y"],
  });
  assert.equal(r.status, "COVERAGE_INCOMPLETE");
  assert.deepEqual(r.missingTargetIds, ["A"]);
  assert.deepEqual(r.unexpectedDecisionIds, ["X", "Y"]);
});

test("28 no-source day never reports COVERAGE_COMPLETE 0/0", () => {
  const r = verifyDecisionCoverage({
    scopeLock: null,
    sealedDecisionTargetIds: [],
    sourceMissing: true,
  });
  assert.equal(r.status, "TARGET_SCOPE_SOURCE_MISSING");
  assert.notEqual(r.status, "COVERAGE_COMPLETE");
  assert.equal(r.targetCountAuthoritative, false);
});

test("29-40 boundary: no forbidden imports/calls in module source", () => {
  const dir = join(process.cwd(), "src/lib/research/daily-scope-lock");
  const files = [
    "admit-source.ts",
    "coverage.ts",
    "index.ts",
    "lock.ts",
    "paths.ts",
    "policy.ts",
    "types.ts",
  ];
  const source = files
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  for (const bad of [
    "/api/games",
    "app/games",
    "getFootballGamesForDate",
    "api-football-provider",
    "the-odds-api",
    "getMlbGamesForDate",
    "MODEL_FORWARD",
    "forward-shadow",
    "axios",
    "node-fetch",
  ]) {
    assert.equal(source.includes(bad), false, bad);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
  for (const bad of [
    "executePrediction",
    "createPass",
    "gradeFixture",
    "writePrediction",
    "PASS_WRITES",
  ]) {
    assert.equal(source.includes(bad), false, bad);
  }
  for (const marker of SECRET_MARKERS) {
    assert.equal(source.includes(marker), false, marker);
  }
});

test("29b no /games runtime import in CLI", () => {
  const cli = readFileSync(
    join(process.cwd(), "scripts/research-daily-scope-lock-v1.ts"),
    "utf8",
  );
  assert.equal(cli.includes("/api/games"), false);
  assert.equal(cli.includes("getKstToday"), false);
});
