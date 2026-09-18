/**
 * Research slate source freeze — focused suite.
 *
 *   npm run test:research-slate-source-freeze-v1
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
  freezeResearchSlateSource,
  isResearchSlateSourceFreezeDocument,
  operatorBetmanDailySlateRel,
  researchSlateSourceFreezeRel,
  RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION,
} from "../src/lib/research/slate-source-freeze";
import {
  legacyDailyScopeLockRel,
  lockResearchTargetScope,
  researchTargetScopeLockRel,
} from "../src/lib/research/daily-scope-lock";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function makeCwd(label: string): string {
  const dir = join(
    tmpdir(),
    `ye-freeze-${label}-${process.pid}-${Date.now()}`,
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
  mkdirSync(join(cwd, rel, ".."), { recursive: true });
  const doc = {
    schemaVersion: "betman-daily-slate-v1",
    targetDateKst: dateKst,
    sourceType: "OPERATOR_MANUAL",
    capturedAt: null,
    enteredAt: null,
    reviewedAt: "2026-09-19T01:00:00.000Z",
    reviewStatus: "VERIFIED",
    scopeCompletenessStatus: "COMPLETE",
    games,
    ...extras,
  };
  writeFileSync(join(cwd, rel), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
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
    () => freezeResearchSlateSource({ dateKst: "" }),
    /EXPLICIT_DATE_KST_REQUIRED/,
  );
  assert.equal(assertExplicitDateKst("2026-09-19"), "2026-09-19");
});

test("2 missing input → SOURCE_FREEZE_INPUT_MISSING; no artifact", async () => {
  const cwd = makeCwd("miss");
  try {
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_MISSING");
    assert.equal(r.freezeCreated, false);
    assert.equal(r.sourceGameCountAuthoritative, false);
    assert.equal(
      existsSync(join(cwd, researchSlateSourceFreezeRel("2026-09-19"))),
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("3 malformed input → SOURCE_FREEZE_INPUT_INVALID", async () => {
  const cwd = makeCwd("badjson");
  try {
    const rel = operatorBetmanDailySlateRel("2026-09-19");
    mkdirSync(join(cwd, rel, ".."), { recursive: true });
    writeFileSync(join(cwd, rel), "{nope", "utf8");
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("4 wrong targetDateKst rejected", async () => {
  const cwd = makeCwd("wrongdate");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      targetDateKst: "2026-09-18",
    });
    // file path is still 2026-09-19 but body date wrong
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
    assert.match(r.message, /DATE_MISMATCH/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("5 wrong sourceType rejected", async () => {
  const cwd = makeCwd("srctype");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      sourceType: "OCR_OPERATOR_REVIEWED",
    });
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("6 top-level DRAFT rejected", async () => {
  const cwd = makeCwd("draft");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      reviewStatus: "DRAFT",
    });
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_NOT_VERIFIED");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("7 scopeCompletenessStatus UNVERIFIED rejected", async () => {
  const cwd = makeCwd("unv");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      scopeCompletenessStatus: "UNVERIFIED",
    });
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_NOT_VERIFIED");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("8 scopeCompletenessStatus INCOMPLETE rejected", async () => {
  const cwd = makeCwd("inc");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      scopeCompletenessStatus: "INCOMPLETE",
    });
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_NOT_VERIFIED");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("9 missing reviewedAt rejected", async () => {
  const cwd = makeCwd("norev");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      reviewedAt: null,
    });
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("10 game reviewStatus not VERIFIED rejected", async () => {
  const cwd = makeCwd("grev");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G1", { reviewStatus: "DRAFT" }),
    ]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("11 home/away verification not VERIFIED rejected", async () => {
  const cwd = makeCwd("ha");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G1", { operatorHomeAwayStatus: "UNVERIFIED" }),
    ]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("12 missing operatorSlateGameId rejected", async () => {
  const cwd = makeCwd("noid");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G1", { operatorSlateGameId: "" }),
    ]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("13-14 missing home/away rejected", async () => {
  for (const field of ["homeTeamRaw", "awayTeamRaw"] as const) {
    const cwd = makeCwd(field);
    try {
      writeOperatorSlate(cwd, "2026-09-19", [
        sampleGame("G1", { [field]: "" }),
      ]);
      const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
      assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("15 missing/invalid scheduledStartTimeKst rejected", async () => {
  const cwd = makeCwd("sched");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G1", { scheduledStartTimeKst: "" }),
    ]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("16 cross-date game rejected", async () => {
  const cwd = makeCwd("xdate");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("G1", {
        scheduledStartTimeKst: "2026-09-18T19:00:00+09:00",
      }),
    ]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
    assert.match(r.message, /CROSS_DATE/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("17 duplicate operatorSlateGameId rejected", async () => {
  const cwd = makeCwd("dup");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("SAME"),
      sampleGame("SAME"),
    ]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_INPUT_INVALID");
    assert.match(r.message, /DUPLICATE_OPERATOR_SLATE_GAME_ID/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("18 unsupported research sport PRESERVED in freeze", async () => {
  const cwd = makeCwd("tennis");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("T1", { sport: "TENNIS" }),
      sampleGame("S1", { sport: "SOCCER" }),
    ]);
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(r.status, "SOURCE_FREEZE_CREATED");
    assert.equal(r.document?.sourceGameCount, 2);
    assert.ok(r.document?.games.some((g) => g.sport === "TENNIS"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("19 valid complete non-empty input freezes", async () => {
  const cwd = makeCwd("ok");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(r.status, "SOURCE_FREEZE_CREATED");
    assert.equal(r.sourceGameCount, 1);
    assert.equal(r.document?.schemaVersion, RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION);
    assert.equal(isResearchSlateSourceFreezeDocument(r.document), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("20 valid explicit complete empty input freezes as authoritative zero", async () => {
  const cwd = makeCwd("empty");
  try {
    writeOperatorSlate(cwd, "2026-09-19", []);
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(r.status, "SOURCE_FREEZE_CREATED");
    assert.equal(r.sourceGameCount, 0);
    assert.equal(r.sourceGameCountAuthoritative, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("21 raw source SHA-256 stored", async () => {
  const cwd = makeCwd("sha");
  try {
    const rel = writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const expected = sha256File(join(cwd, rel));
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(r.sourceRawSha256, expected);
    assert.equal(r.document?.source.sha256, expected);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("22 same source rerun → IDEMPOTENT_EXISTING", async () => {
  const cwd = makeCwd("idem");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    const abs = join(cwd, researchSlateSourceFreezeRel("2026-09-19"));
    const hash1 = sha256File(abs);
    const second = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T99:00:00.000Z",
    });
    assert.equal(second.status, "IDEMPOTENT_EXISTING");
    assert.equal(sha256File(abs), hash1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("23 changed raw source after freeze → SOURCE_FREEZE_CONFLICT", async () => {
  const cwd = makeCwd("conflict");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    const abs = join(cwd, researchSlateSourceFreezeRel("2026-09-19"));
    const hash1 = sha256File(abs);
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G2")]);
    const r = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "SOURCE_FREEZE_CONFLICT");
    assert.equal(sha256File(abs), hash1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("24 freeze path distinct from legacy Daily C and target-scope", () => {
  const d = "2026-09-19";
  assert.notEqual(researchSlateSourceFreezeRel(d), legacyDailyScopeLockRel(d));
  assert.notEqual(researchSlateSourceFreezeRel(d), researchTargetScopeLockRel(d));
});

test("25 target scope accepts valid source freeze", async () => {
  const cwd = makeCwd("accept");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T03:00:00.000Z",
    });
    assert.equal(lock.status, "LOCKED");
    assert.equal(lock.document?.source.class, "RESEARCH_SLATE_SOURCE_FREEZE");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("26 target scope does NOT accept raw operator input without freeze", async () => {
  const cwd = makeCwd("nobypass");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(lock.status, "TARGET_SCOPE_SOURCE_MISSING");
    assert.equal(lock.lockCreated, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("27 legacy betman-full-slate cannot bypass freeze", async () => {
  const cwd = makeCwd("fullslate");
  try {
    const rel = `data/research/daily-slates/2026-09-19-betman-full-slate-v1.json`;
    mkdirSync(join(cwd, rel, ".."), { recursive: true });
    writeFileSync(
      join(cwd, rel),
      JSON.stringify({
        meta: {
          schemaVersion: "betman-full-slate-v1",
          targetDateKst: "2026-09-19",
          operatorInputStatus: "VERIFIED",
        },
        games: [
          {
            operatorSlateGameId: "G1",
            sport: "SOCCER",
            supportedSport: true,
            homeTeam: "H",
            awayTeam: "A",
          },
        ],
      }),
      "utf8",
    );
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(lock.status, "TARGET_SCOPE_SOURCE_MISSING");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("28 unsupported sport filtered only at target-scope with exclusion", async () => {
  const cwd = makeCwd("filter");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("T1", { sport: "TENNIS" }),
      sampleGame("S1", { sport: "SOCCER" }),
    ]);
    await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T03:00:00.000Z",
    });
    assert.equal(lock.targetCount, 1);
    assert.equal(lock.document?.targets[0]?.targetId, "S1");
    assert.ok(
      lock.document?.exclusions.some(
        (e) =>
          e.reason === "UNSUPPORTED_SPORT" && e.operatorSlateGameId === "T1",
      ),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("29 SOURCE_FREEZE missing → TARGET_SCOPE_SOURCE_MISSING", async () => {
  const cwd = makeCwd("nomiss");
  try {
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(lock.status, "TARGET_SCOPE_SOURCE_MISSING");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("30 valid zero source freeze → authoritative zero-target state", async () => {
  const cwd = makeCwd("zero");
  try {
    writeOperatorSlate(cwd, "2026-09-19", []);
    await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    const lock = await lockResearchTargetScope({
      dateKst: "2026-09-19",
      cwd,
      createdAt: "2026-09-19T03:00:00.000Z",
    });
    assert.equal(lock.status, "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS");
    assert.equal(lock.targetCount, 0);
    assert.equal(lock.targetCountAuthoritative, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("31-32 no fuzzy / no array-position identity", async () => {
  const cwd = makeCwd("ids");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [
      sampleGame("ID-2"),
      sampleGame("ID-1"),
    ]);
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(r.document?.fuzzyMatchingUsed, false);
    for (const g of r.document?.games ?? []) {
      assert.ok(g.operatorSlateGameId.startsWith("ID-"));
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("33-35 provider/network/prediction writes = 0", async () => {
  const cwd = makeCwd("zeroio");
  try {
    writeOperatorSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const r = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(r.providerCalls, 0);
    assert.equal(r.networkCalls, 0);
    assert.equal(r.document?.providerCalls, 0);
    assert.equal(r.document?.networkCalls, 0);
    assert.equal(r.document?.marketDataIncluded, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("historical legacy Daily C hashes unchanged", async () => {
  const dates = ["2026-08-26", "2026-08-29", "2026-08-30"];
  const before = dates.map((d) => ({
    d,
    hash: sha256File(join(process.cwd(), legacyDailyScopeLockRel(d))),
  }));
  await freezeResearchSlateSource({ dateKst: "2026-09-19" });
  for (const row of before) {
    assert.equal(
      sha256File(join(process.cwd(), legacyDailyScopeLockRel(row.d))),
      row.hash,
    );
  }
});

test("boundary: no provider imports in freeze module", () => {
  const dir = join(process.cwd(), "src/lib/research/slate-source-freeze");
  const source = ["freeze.ts", "index.ts", "paths.ts", "types.ts"]
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  for (const bad of [
    "/api/games",
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
