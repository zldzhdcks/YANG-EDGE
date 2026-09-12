import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,existsSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {digest,writeSeal,storeRoot} from "../football-v31-r1-prospective-v1/store-v1";
import {artifactPath,type ExpectedSeal,type PostgamePayload,type ModelGrade} from "../football-v31-r1-prospective-postgame-v1/grader-v1";
import {
  classifyConsensus,
  loadResearchConsole,
  projectModel,
  readFixtureView,
  researchAccess,
  resolveLocalResearchRoot,
  assertNoClientPathLeak,
  type ModelView,
} from "./console-v1";

const here = fileURLToPath(new URL(".", import.meta.url));
const cutoff = "2026-09-12T10:00:00.000Z";
const kickoff = "2026-09-12T13:00:00.000Z";
const later = "2026-09-12T18:00:00.000Z";
const target = {
  fixtureId: 1550119,
  leagueId: 135,
  season: 2026,
  kickoffUtc: kickoff,
  homeTeamId: 495,
  awayTeamId: 512,
};

function tempRoot(): string {
  return join(mkdtempSync(join(tmpdir(), "research-console-")), "football-v31-r1-prospective-shadow-v1");
}

function hashed<T extends object>(payload: T): {payload: T; sha256: string} {
  return {payload, sha256: digest(payload)};
}

function pred(
  status: "PREDICTED" | "PASS",
  cls: "HOME" | "DRAW" | "AWAY" | null,
  probabilities: [number, number, number] | null,
) {
  return hashed({
    targetIdentity: target,
    cutoffAt: cutoff,
    predictionCreatedAt: cutoff,
    status,
    passReason: status === "PASS" ? ["MISSING_FEATURE"] : [],
    probabilities,
    class: cls,
  });
}

const HOME = pred("PREDICTED", "HOME", [0.6, 0.25, 0.15]);
const DRAW = pred("PREDICTED", "DRAW", [0.2, 0.55, 0.25]);
const AWAY = pred("PREDICTED", "AWAY", [0.2, 0.2, 0.6]);
const PASS = pred("PASS", null, null);

function sealBundle(
  root: string,
  v1 = HOME,
  h2 = HOME,
  r1 = HOME,
  fixture = target,
): {expected: ExpectedSeal; dir: string} {
  const v1p = fixture === target ? v1 : hashed({...v1.payload, targetIdentity: fixture});
  const h2p = fixture === target ? h2 : hashed({...h2.payload, targetIdentity: fixture});
  const r1p = fixture === target ? r1 : hashed({...r1.payload, targetIdentity: fixture});
  const dir = join(storeRoot(root), "fixtures", String(fixture.fixtureId));
  const input = writeSeal(join(dir, "input.json"), {selected: true, fixtureId: fixture.fixtureId});
  const snapshot = {
    targetIdentity: fixture,
    cutoffAt: cutoff,
    predictionCreatedAt: cutoff,
    inputSnapshotHash: input.sha256,
    sameCutoffV1: v1p,
    sameCutoffH2: h2p,
    r1: r1p,
    sealedAt: cutoff,
  };
  const snap = writeSeal(join(dir, "snapshot.json"), snapshot);
  return {
    dir,
    expected: {
      ...fixture,
      cutoffAt: cutoff,
      predictionCreatedAt: cutoff,
      snapshotHash: snap.sha256,
      v1PredictionHash: v1p.sha256,
      h2PredictionHash: h2p.sha256,
      r1PredictionHash: r1p.sha256,
      inputHash: input.sha256,
    },
  };
}

function grade(
  status: ModelGrade["status"],
  predictedClass: string | null,
  actualClass: string,
  correct: boolean | null,
  probabilities: ModelGrade["probabilities"],
  logLoss: number | null,
  brier: number | null,
): ModelGrade {
  return {
    status,
    predictionStatus: status === "PREGAME_PASS_PRESERVED" ? "PASS" : "PREDICTED",
    predictedClass,
    actualClass,
    correct,
    probabilities,
    logLoss,
    multiclassBrier: brier,
  };
}

function writePostgame(root: string, expected: ExpectedSeal, r1: ModelGrade, v1?: ModelGrade, h2?: ModelGrade) {
  const payload: PostgamePayload = {
    schemaVersion: "FOOTBALL_V31_R1_PROSPECTIVE_POSTGAME_V1",
    fixture: {
      fixtureId: expected.fixtureId,
      leagueId: expected.leagueId,
      season: expected.season,
      kickoffUtc: expected.kickoffUtc,
      homeTeamId: expected.homeTeamId,
      awayTeamId: expected.awayTeamId,
    },
    kickoffUtc: expected.kickoffUtc,
    cutoffAt: expected.cutoffAt,
    predictionCreatedAt: expected.predictionCreatedAt,
    result: {
      fixtureStatus: "FT",
      regularTime: {home: 2, away: 1},
      actualClass: "HOME",
      sourceHash: "c".repeat(64),
    },
    resultObservedAt: later,
    providerFetchedAt: later,
    pregameSnapshotHash: expected.snapshotHash,
    v1PredictionHash: expected.v1PredictionHash,
    h2PredictionHash: expected.h2PredictionHash,
    r1PredictionHash: expected.r1PredictionHash,
    v1Grade: v1 ?? grade("GRADED", "HOME", "HOME", true, {HOME: 0.6, DRAW: 0.25, AWAY: 0.15}, 0.5108, 0.245),
    h2Grade: h2 ?? grade("GRADED", "HOME", "HOME", true, {HOME: 0.6, DRAW: 0.25, AWAY: 0.15}, 0.5108, 0.245),
    r1Grade: r1,
    artifactCreatedAt: later,
  };
  writeSeal(artifactPath(root, expected.fixtureId), payload);
}

const predictedView = (cls: "HOME" | "DRAW" | "AWAY"): ModelView =>
  projectModel(cls === "HOME" ? HOME : cls === "DRAW" ? DRAW : AWAY);

test("valid sealed snapshot parse", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const row = readFixtureView(root, expected);
  assert.equal(row.integrity, "verified");
  assert.equal(row.fixtureId, 1550119);
  assert.equal(row.league, "Serie A");
  assert.equal(row.homeTeam, "Genoa");
  assert.equal(row.awayTeam, "Frosinone");
  assert.match(row.kickoffKst, /2026-09-12 22:00 KST/);
});

test("V1/H2/R1 probabilities render", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root, HOME, DRAW, AWAY);
  const row = readFixtureView(root, expected);
  assert.equal(row.v1.status, "PREDICTED");
  assert.equal(row.v1.homePct, 0.6);
  assert.equal(row.v1.drawPct, 0.25);
  assert.equal(row.v1.awayPct, 0.15);
  assert.equal(row.v1.predictedClass, "HOME");
  assert.equal(row.h2.predictedClass, "DRAW");
  assert.equal(row.r1.predictedClass, "AWAY");
  assert.equal(row.h2.drawPct, 0.55);
  assert.equal(row.r1.awayPct, 0.6);
});

test("PASS render", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root, PASS, PASS, PASS);
  const row = readFixtureView(root, expected);
  assert.equal(row.v1.status, "PASS");
  assert.equal(row.h2.status, "PASS");
  assert.equal(row.r1.status, "PASS");
  assert.equal(row.v1.homePct, null);
  assert.equal(row.r1.predictedClass, null);
  assert.equal(row.consensus, "PASS");
  assert.equal(row.evidence, "PASS");
});

test("triple consensus classification", () => {
  assert.equal(
    classifyConsensus(predictedView("HOME"), predictedView("HOME"), predictedView("HOME")),
    "TRIPLE_CONSENSUS",
  );
  const root = tempRoot();
  const {expected} = sealBundle(root, HOME, HOME, HOME);
  assert.equal(readFixtureView(root, expected).consensus, "TRIPLE_CONSENSUS");
});

test("split classification", () => {
  assert.equal(
    classifyConsensus(predictedView("HOME"), predictedView("DRAW"), predictedView("AWAY")),
    "SPLIT",
  );
  assert.equal(
    classifyConsensus(predictedView("HOME"), predictedView("AWAY"), predictedView("AWAY")),
    "H2_R1_CONSENSUS",
  );
});

test("pending result", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
  });
  assert.equal(view.gate, "OK");
  assert.equal(view.summary.resultPending, 1);
  assert.equal(view.summary.resultGraded, 0);
  assert.equal(view.pending[0].postgame.status, "RESULT_PENDING");
  assert.equal(view.graded.length, 0);
});

test("valid postgame grade", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root, HOME, HOME, HOME);
  writePostgame(
    root,
    expected,
    grade("GRADED", "HOME", "HOME", true, {HOME: 0.6, DRAW: 0.25, AWAY: 0.15}, 0.5108, 0.245),
  );
  const row = readFixtureView(root, expected);
  assert.equal(row.evidence, "GRADED");
  assert.equal(row.postgame.status, "GRADED");
  if (row.postgame.status !== "GRADED") throw new Error("expected grade");
  assert.equal(row.postgame.actualResult, "2-1");
  assert.equal(row.postgame.actualClass, "HOME");
  assert.equal(row.postgame.r1.correct, true);
  assert.equal(row.postgame.r1.logLoss, 0.5108);
  assert.equal(row.postgame.r1.brier, 0.245);
  const passRoot = tempRoot();
  const passSeal = sealBundle(passRoot, PASS, PASS, PASS);
  writePostgame(
    passRoot,
    passSeal.expected,
    grade("PREGAME_PASS_PRESERVED", null, "HOME", null, null, null, null),
    grade("PREGAME_PASS_PRESERVED", null, "HOME", null, null, null, null),
    grade("PREGAME_PASS_PRESERVED", null, "HOME", null, null, null, null),
  );
  const passRow = readFixtureView(passRoot, passSeal.expected);
  assert.equal(passRow.postgame.status, "GRADED");
  if (passRow.postgame.status !== "GRADED") throw new Error("expected grade");
  assert.equal(passRow.postgame.r1.status, "PREGAME_PASS_PRESERVED");
  assert.equal(passRow.postgame.r1.correct, null);
});

test("integrity mismatch fail closed", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const row = readFixtureView(root, {...expected, snapshotHash: "0".repeat(64)});
  assert.equal(row.integrity, "INTEGRITY_BLOCKED");
  assert.equal(row.evidence, "INTEGRITY_BLOCKED");
  assert.equal(row.v1.status, "INTEGRITY_BLOCKED");
  assert.equal(row.v1.homePct, null);
  assert.equal(row.consensus, "INTEGRITY_BLOCKED");
  assert.equal(row.postgame.status, "INTEGRITY_BLOCKED");
});

test("missing local root fail closed", () => {
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root: join(tmpdir(), "missing-football-v31-r1-prospective-shadow-v1"),
    expectedTargets: [],
  });
  assert.equal(view.gate, "LOCAL_RESEARCH_DATA_UNAVAILABLE");
  assert.equal(view.pending.length, 0);
  assert.equal(view.summary.sealedTargets, 0);
});

const consoleSources = [
  join(here, "console-v1.ts"),
  join(here, "labels-v1.ts"),
  resolve(here, "../../src/app/internal/football/research/page.tsx"),
  resolve(here, "../../src/components/internal/football/FootballV31ResearchConsoleView.tsx"),
  resolve(here, "../../src/lib/football/v31-internal-research-console-v1/load-console-v1.ts"),
];

test("no provider/network call", () => {
  for (const file of consoleSources) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\bfetch\s*\(/);
    assert.doesNotMatch(text, /https:\/\//);
    assert.doesNotMatch(text, /FOOTBALL_API|api-sports/);
    assert.doesNotMatch(text, /\bwatch\(|\bdaemon\b/i);
  }
});

test("production access blocked", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const view = loadResearchConsole({
    env: {NODE_ENV: "production"},
    root,
    expectedTargets: [expected],
  });
  assert.equal(researchAccess({NODE_ENV: "production"}), "INTERNAL_RESEARCH_DISABLED");
  assert.equal(view.gate, "INTERNAL_RESEARCH_DISABLED");
  assert.equal(view.pending.length, 0);
  assert.equal(view.summary.sealedTargets, 0);
  assert.equal(view.graded.length, 0);
});

test("absolute local path not exposed client-side", () => {
  const clientFiles = [
    resolve(here, "../../src/app/internal/football/research/page.tsx"),
    resolve(here, "../../src/components/internal/football/FootballV31ResearchConsoleView.tsx"),
    resolve(here, "../../src/lib/football/v31-internal-research-console-v1/load-console-v1.ts"),
  ];
  for (const file of clientFiles) {
    const text = readFileSync(file, "utf8");
    assert.equal(assertNoClientPathLeak(text), true, file);
    assert.doesNotMatch(text, /C:\\\\Users|\/Users\/TCTCTC/);
  }
  assert.equal(
    resolveLocalResearchRoot({NODE_ENV: "test"}, "/tmp/repo").includes("YANG-EDGE-INBOX"),
    true,
  );
  assert.doesNotMatch(resolveLocalResearchRoot({NODE_ENV: "test"}, "/tmp/repo"), /^[A-Za-z]:\\/);
});

test("existing pregame files unchanged", () => {
  const root = tempRoot();
  const {expected, dir} = sealBundle(root);
  const before = {
    input: readFileSync(join(dir, "input.json")),
    snapshot: readFileSync(join(dir, "snapshot.json")),
    names: readdirSync(dir).sort(),
  };
  loadResearchConsole({env: {NODE_ENV: "test"}, root, expectedTargets: [expected]});
  readFixtureView(root, expected);
  assert.deepEqual(readFileSync(join(dir, "input.json")), before.input);
  assert.deepEqual(readFileSync(join(dir, "snapshot.json")), before.snapshot);
  assert.deepEqual(readdirSync(dir).sort(), before.names);
  assert.equal(existsSync(artifactPath(root, expected.fixtureId)), false);
});

test("no model/refit imports", () => {
  for (const file of consoleSources) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /\b(predictFootball|fitRates|predictRates|kernel|compare|loadParameters|joint|appendGrade|predict)\s*\(/,
    );
    assert.doesNotMatch(text, /football-forward|run-development|comparator-v1|adapter-v1/);
    assert.doesNotMatch(text, /from ['"][^'"]*recommendation[^'"]*['"]/);
  }
});

test("no recommendation engine imports", () => {
  const ui = readFileSync(
    resolve(here, "../../src/components/internal/football/FootballV31ResearchConsoleView.tsx"),
    "utf8",
  );
  for (const file of consoleSources) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /from ['"][^'"]*recommendation[^'"]*['"]/);
    assert.doesNotMatch(text, /EDGE PICK|베스트픽|강승부|적중 보장/);
    assert.doesNotMatch(text, /src\/lib\/.*recommendation/);
  }
  assert.doesNotMatch(ui, /추천|수익|확정/);
  assert.match(ui, /\{data\.disclaimer\}/);
  assert.match(
    readFileSync(join(here, "console-v1.ts"), "utf8"),
    /Prospective research evidence — not a validated recommendation model/,
  );
});
