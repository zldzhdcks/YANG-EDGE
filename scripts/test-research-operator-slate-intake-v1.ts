/**
 * Manual operator slate intake — focused suite.
 *
 *   npm run test:research-operator-slate-intake-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertExplicitDateKst } from "../src/lib/research/slate-source-freeze";
import { freezeResearchSlateSource } from "../src/lib/research/slate-source-freeze";
import { lockResearchTargetScope } from "../src/lib/research/daily-scope-lock";
import {
  initOperatorSlateDraft,
  validateOperatorSlateIntake,
} from "../src/lib/betman/daily-slate/operator-slate-intake";
import { betmanDailySlateInputPath } from "../src/lib/betman/daily-slate/validate-betman-daily-slate-v1";
import { scheduledStartRepresentsDateKst } from "../src/lib/betman/daily-slate/schedule-date-kst";
import { researchSlateSourceFreezeRel } from "../src/lib/research/slate-source-freeze";

function makeCwd(label: string): string {
  const dir = join(
    tmpdir(),
    `ye-intake-${label}-${process.pid}-${Date.now()}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSlate(
  cwd: string,
  dateKst: string,
  games: unknown[],
  extras: Record<string, unknown> = {},
) {
  const abs = betmanDailySlateInputPath(dateKst, cwd);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(
    abs,
    `${JSON.stringify(
      {
        schemaVersion: "betman-daily-slate-v1",
        targetDateKst: dateKst,
        sourceType: "OPERATOR_MANUAL",
        capturedAt: null,
        enteredAt: "2026-09-19T00:00:00.000Z",
        reviewedAt: "2026-09-19T01:00:00.000Z",
        reviewStatus: "VERIFIED",
        scopeCompletenessStatus: "COMPLETE",
        games,
        ...extras,
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
    marketRuleStatus: null,
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

test("1 explicit date required", () => {
  assert.throws(() => assertExplicitDateKst(""), /EXPLICIT_DATE/);
});

test("2 invalid date rejected", () => {
  assert.throws(() => assertExplicitDateKst("2026-13-99"), /INVALID_DATE/);
});

test("3-5 init draft creates DRAFT/UNVERIFIED/empty; never COMPLETE/VERIFIED", async () => {
  const cwd = makeCwd("init");
  try {
    const r = await initOperatorSlateDraft({
      dateKst: "2026-09-19",
      cwd,
      enteredAt: "2026-09-19T00:00:00.000Z",
    });
    assert.equal(r.status, "DRAFT_CREATED");
    assert.equal(r.document?.reviewStatus, "DRAFT");
    assert.equal(r.document?.scopeCompletenessStatus, "UNVERIFIED");
    assert.deepEqual(r.document?.games, []);
    assert.notEqual(r.document?.reviewStatus, "VERIFIED");
    assert.notEqual(r.document?.scopeCompletenessStatus, "COMPLETE");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("6 existing canonical file is not overwritten", async () => {
  const cwd = makeCwd("exists");
  try {
    writeSlate(cwd, "2026-09-19", [sampleGame("KEEP")]);
    const before = readFileSync(
      betmanDailySlateInputPath("2026-09-19", cwd),
      "utf8",
    );
    const r = await initOperatorSlateDraft({ dateKst: "2026-09-19", cwd });
    assert.equal(r.status, "INPUT_ALREADY_EXISTS");
    assert.equal(
      readFileSync(betmanDailySlateInputPath("2026-09-19", cwd), "utf8"),
      before,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("7 missing input validates as INPUT_MISSING", async () => {
  const cwd = makeCwd("miss");
  try {
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.intakeStatus, "INPUT_MISSING");
    assert.equal(r.freezeReady, false);
    assert.equal(r.totalGamesAuthoritative, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("8 wrong schema blocked", async () => {
  const cwd = makeCwd("schema");
  try {
    writeSlate(cwd, "2026-09-19", [], { schemaVersion: "nope" });
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.freezeReady, false);
    assert.ok(r.blockingReasons.includes("INVALID_SCHEMA_VERSION"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("9 wrong target date blocked", async () => {
  const cwd = makeCwd("tdate");
  try {
    writeSlate(cwd, "2026-09-19", [], { targetDateKst: "2026-09-18" });
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.ok(r.blockingReasons.includes("DATE_MISMATCH"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("10 sourceType != OPERATOR_MANUAL not freeze-ready", async () => {
  const cwd = makeCwd("stype");
  try {
    writeSlate(cwd, "2026-09-19", [], {
      sourceType: "OCR_OPERATOR_REVIEWED",
    });
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.freezeReady, false);
    assert.ok(
      r.blockingReasons.includes("SOURCE_TYPE_MUST_BE_OPERATOR_MANUAL"),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("11-14 DRAFT/REJECTED/UNVERIFIED/INCOMPLETE not freeze-ready", async () => {
  for (const [label, extras] of [
    ["draft", { reviewStatus: "DRAFT" }],
    ["rej", { reviewStatus: "REJECTED" }],
    ["unv", { scopeCompletenessStatus: "UNVERIFIED" }],
    ["inc", { scopeCompletenessStatus: "INCOMPLETE" }],
  ] as const) {
    const cwd = makeCwd(label);
    try {
      writeSlate(cwd, "2026-09-19", [], extras);
      const r = await validateOperatorSlateIntake({
        dateKst: "2026-09-19",
        cwd,
      });
      assert.equal(r.freezeReady, false, label);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("15 COMPLETE alone insufficient without VERIFIED", async () => {
  const cwd = makeCwd("comp");
  try {
    writeSlate(cwd, "2026-09-19", [], {
      reviewStatus: "DRAFT",
      scopeCompletenessStatus: "COMPLETE",
    });
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.freezeReady, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("16-17 missing/invalid reviewedAt blocked", async () => {
  for (const reviewedAt of [null, "not-a-date"]) {
    const cwd = makeCwd(`rev-${reviewedAt}`);
    try {
      writeSlate(cwd, "2026-09-19", [], { reviewedAt });
      const r = await validateOperatorSlateIntake({
        dateKst: "2026-09-19",
        cwd,
      });
      assert.equal(r.freezeReady, false);
      assert.ok(r.blockingReasons.includes("REVIEWED_AT_REQUIRED"));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("18-27 game identity blockers", async () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["noid", { operatorSlateGameId: "" }, "MISSING_OPERATOR_SLATE_GAME_ID"],
    ["sport", { sport: "" }, "MISSING_SPORT"],
    ["home", { homeTeamRaw: "" }, "MISSING_HOME"],
    ["away", { awayTeamRaw: "" }, "MISSING_AWAY"],
    ["sched", { scheduledStartTimeKst: "" }, "MISSING_SCHEDULED_START"],
    ["badsched", { scheduledStartTimeKst: "nope" }, "INVALID_SCHEDULED_START"],
    [
      "cross",
      { scheduledStartTimeKst: "2026-09-18T10:00:00+09:00" },
      "CROSS_DATE_GAME",
    ],
    ["gdraft", { reviewStatus: "DRAFT" }, "GAME_REVIEW_NOT_VERIFIED"],
    [
      "ha",
      { operatorHomeAwayStatus: "UNVERIFIED" },
      "HOME_AWAY_NOT_VERIFIED",
    ],
  ];
  for (const [label, ov, reason] of cases) {
    const cwd = makeCwd(label);
    try {
      writeSlate(cwd, "2026-09-19", [sampleGame("G1", ov)]);
      const r = await validateOperatorSlateIntake({
        dateKst: "2026-09-19",
        cwd,
      });
      assert.equal(r.freezeReady, false, label);
      assert.ok(r.blockingReasons.includes(reason), `${label}:${reason}`);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }

  const cwdDup = makeCwd("dup");
  try {
    writeSlate(cwdDup, "2026-09-19", [sampleGame("SAME"), sampleGame("SAME")]);
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd: cwdDup,
    });
    assert.ok(r.blockingReasons.includes("DUPLICATE_OPERATOR_GAME_ID"));
  } finally {
    rmSync(cwdDup, { recursive: true, force: true });
  }
});

test("28 identity-ready when all requirements valid", async () => {
  const cwd = makeCwd("idok");
  try {
    writeSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.identityReadyGameCount, 1);
    assert.equal(r.freezeReady, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("29-31 TENNIS allowed; warning only; does not block completeness", async () => {
  const cwd = makeCwd("tennis");
  try {
    writeSlate(cwd, "2026-09-19", [
      sampleGame("T1", { sport: "TENNIS" }),
      sampleGame("S1"),
    ]);
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.freezeReady, true);
    assert.ok(
      r.warnings.some((w) => w.includes("RESEARCH_UNSUPPORTED_SPORT")),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("32 later target-scope still excludes TENNIS after freeze", async () => {
  const cwd = makeCwd("tfilter");
  try {
    writeSlate(cwd, "2026-09-19", [
      sampleGame("T1", { sport: "TENNIS" }),
      sampleGame("S1"),
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
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("33-36 FREEZE_READY empty/non-empty; market/provider optional", async () => {
  const empty = makeCwd("empty");
  try {
    writeSlate(empty, "2026-09-19", []);
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd: empty,
    });
    assert.equal(r.freezeReady, true);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }

  const full = makeCwd("full");
  try {
    writeSlate(full, "2026-09-19", [
      sampleGame("G1", {
        marketSelections: [],
        providerGameId: null,
        providerFixtureId: null,
      }),
    ]);
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd: full,
    });
    assert.equal(r.freezeReady, true);
  } finally {
    rmSync(full, { recursive: true, force: true });
  }
});

test("37 FREEZE_READY=true → freeze succeeds", async () => {
  const cwd = makeCwd("agree-ok");
  try {
    writeSlate(cwd, "2026-09-19", [sampleGame("G1")]);
    const v = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(v.freezeReady, true);
    const f = await freezeResearchSlateSource({
      dateKst: "2026-09-19",
      cwd,
      frozenAt: "2026-09-19T02:00:00.000Z",
    });
    assert.equal(f.freezeCreated, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("38 FREEZE_READY=false → freeze does not create artifact", async () => {
  const cwd = makeCwd("agree-bad");
  try {
    writeSlate(cwd, "2026-09-19", [sampleGame("G1")], {
      reviewStatus: "DRAFT",
    });
    const v = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(v.freezeReady, false);
    const f = await freezeResearchSlateSource({ dateKst: "2026-09-19", cwd });
    assert.equal(f.freezeCreated, false);
    assert.equal(
      existsSync(join(cwd, researchSlateSourceFreezeRel("2026-09-19"))),
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("KST semantic: UTC instant on KST date is accepted", async () => {
  assert.equal(
    scheduledStartRepresentsDateKst("2026-09-18T16:00:00.000Z", "2026-09-19"),
    true,
  );
  const cwd = makeCwd("kstutc");
  try {
    writeSlate(cwd, "2026-09-19", [
      sampleGame("G1", {
        scheduledStartTimeKst: "2026-09-18T16:00:00.000Z",
      }),
    ]);
    const r = await validateOperatorSlateIntake({
      dateKst: "2026-09-19",
      cwd,
    });
    assert.equal(r.freezeReady, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("39-45 no forbidden imports in intake modules", () => {
  const files = [
    "src/lib/betman/daily-slate/operator-slate-intake.ts",
    "src/lib/betman/daily-slate/validate-betman-daily-slate-v1.ts",
    "src/lib/betman/daily-slate/schedule-date-kst.ts",
    "scripts/research-operator-slate-intake-v1.ts",
  ];
  const source = files
    .map((f) => readFileSync(join(process.cwd(), f), "utf8"))
    .join("\n");
  for (const bad of [
    "/api/games",
    "api-football-provider",
    "the-odds-api",
    "getMlbGamesForDate",
    "axios",
    "puppeteer",
    "playwright",
    "cheerio",
    "tesseract",
  ]) {
    assert.equal(source.includes(bad), false, bad);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
});
