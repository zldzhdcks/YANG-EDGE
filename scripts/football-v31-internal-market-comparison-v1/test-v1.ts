import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,writeFileSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {digest,writeSeal,storeRoot} from "../football-v31-r1-prospective-v1/store-v1";
import {type ExpectedSeal} from "../football-v31-r1-prospective-postgame-v1/grader-v1";
import {
  loadResearchConsole,
  readFixtureView,
  assertNoClientPathLeak,
} from "../football-v31-internal-research-console-v1/console-v1";
import {
  HANDICAP_COMPARISON_ENABLED,
  MARKET_DISCLAIMER,
  MARKET_INPUT_TO_MODEL,
  MARKET_TYPE,
  ROUND_IDENTITY_CONFIRMED,
  TOTALS_RECOMMENDATION_ENABLED,
  type OwnerOnlyMarketRow,
} from "./contract-v1";
import {loadOwnerOnlyMarkets,resolveMarketEvidenceFile} from "./local-evidence-v1";
import {compareSealedToMarket} from "./compare-v1";
import {normalize1x2} from "./normalize-v1";
import {classifyMarketJoin} from "./identity-v1";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../..");
const cutoff = "2026-09-12T10:00:00.000Z";
const kickoff = "2026-09-12T13:00:00.000Z";
const SHA = "a".repeat(64);
const target = {
  fixtureId: 1550119,
  leagueId: 135,
  season: 2026,
  kickoffUtc: kickoff,
  homeTeamId: 495,
  awayTeamId: 512,
};

const marketSources = [
  join(here, "contract-v1.ts"),
  join(here, "local-evidence-v1.ts"),
  join(here, "identity-v1.ts"),
  join(here, "normalize-v1.ts"),
  join(here, "compare-v1.ts"),
];
const clientFiles = [
  resolve(here, "../../src/app/internal/football/research/page.tsx"),
  resolve(here, "../../src/components/internal/football/FootballV31ResearchConsoleView.tsx"),
  resolve(here, "../../src/lib/football/v31-internal-research-console-v1/load-console-v1.ts"),
];
const consoleSources = [
  resolve(here, "../football-v31-internal-research-console-v1/console-v1.ts"),
  resolve(here, "../football-v31-internal-research-console-v1/labels-v1.ts"),
  ...clientFiles,
  ...marketSources,
];

function tempRoot(): string {
  return join(mkdtempSync(join(tmpdir(), "market-console-")), "football-v31-r1-prospective-shadow-v1");
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

function sealBundle(root: string): {expected: ExpectedSeal; dir: string} {
  const dir = join(storeRoot(root), "fixtures", String(target.fixtureId));
  const input = writeSeal(join(dir, "input.json"), {selected: true, fixtureId: target.fixtureId});
  const snapshot = {
    targetIdentity: target,
    cutoffAt: cutoff,
    predictionCreatedAt: cutoff,
    inputSnapshotHash: input.sha256,
    sameCutoffV1: HOME,
    sameCutoffH2: HOME,
    r1: HOME,
    sealedAt: cutoff,
  };
  const snap = writeSeal(join(dir, "snapshot.json"), snapshot);
  return {
    dir,
    expected: {
      ...target,
      cutoffAt: cutoff,
      predictionCreatedAt: cutoff,
      snapshotHash: snap.sha256,
      v1PredictionHash: HOME.sha256,
      h2PredictionHash: HOME.sha256,
      r1PredictionHash: HOME.sha256,
      inputHash: input.sha256,
    },
  };
}

function marketRow(extra: Partial<OwnerOnlyMarketRow> = {}): OwnerOnlyMarketRow {
  return {
    fixtureId: target.fixtureId,
    leagueId: target.leagueId,
    season: target.season,
    kickoffUtc: target.kickoffUtc,
    homeTeamId: target.homeTeamId,
    awayTeamId: target.awayTeamId,
    observedAt: "2026-09-12T02:43:25.527Z",
    marketType: "1X2",
    line: null,
    selection: "HOME_DRAW_AWAY",
    odds: {home: 1.96, draw: 3.15, away: 3.1},
    sourceSha256: SHA,
    roundIdentityConfirmed: false,
    captureTimeVerified: false,
    ...extra,
  };
}

function writeMarketFile(rows: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "owner-only-market-"));
  const file = join(dir, "owner-only-1x2-v1.json");
  writeFileSync(file, JSON.stringify({schema: "FOOTBALL_V31_INTERNAL_MARKET_COMPARISON_V1", rows}));
  return file;
}

test("valid fixture market join", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const file = writeMarketFile([marketRow()]);
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: file,
  });
  const row = view.pending[0];
  assert.equal(view.marketType, "1X2_ONLY");
  assert.equal(row.marketComparison.status, "MATCHED");
  assert.equal(row.marketComparison.homeOdds, 1.96);
  assert.equal(row.marketComparison.drawOdds, 3.15);
  assert.equal(row.marketComparison.awayOdds, 3.1);
  assert.equal(view.marketSummary.matched, 1);
  assert.equal(view.marketSummary.unmatched, 0);
  assert.equal(view.marketSummary.identityBlocked, 0);
  assert.equal(classifyMarketJoin(expected, [marketRow()]), "MATCHED");
});

test("identity mismatch blocked", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const wrong = marketRow({homeTeamId: 1, awayTeamId: 2});
  const file = writeMarketFile([wrong]);
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: file,
  });
  assert.equal(view.pending[0].marketComparison.status, "MARKET_IDENTITY_UNCERTAIN");
  assert.equal(view.marketSummary.identityBlocked, 1);
  assert.equal(classifyMarketJoin(expected, [wrong]), "MARKET_IDENTITY_UNCERTAIN");
});

test("market does not affect model probability", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const none = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: join(tmpdir(), "missing-owner-only-1x2-v1.json"),
  });
  const withMarket = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([marketRow()]),
  });
  const a = none.pending[0];
  const b = withMarket.pending[0];
  assert.deepEqual(a.v1, b.v1);
  assert.deepEqual(a.h2, b.h2);
  assert.deepEqual(a.r1, b.r1);
  assert.equal(a.v1.homePct, 0.6);
  assert.equal(b.marketComparison.status, "MATCHED");
  assert.notEqual(a.marketComparison.status, b.marketComparison.status);
});

test("market adapter local-only", () => {
  for (const file of marketSources) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\bfetch\s*\(/);
    assert.doesNotMatch(text, /https:\/\//);
    assert.doesNotMatch(text, /FOOTBALL_API|api-sports/);
    assert.doesNotMatch(text, /\bwatch\(|\bdaemon\b/i);
  }
  const local = resolveMarketEvidenceFile({NODE_ENV: "test"}, "/tmp/repo");
  assert.match(local, /owner-only-1x2-v1\.json$/);
  assert.doesNotMatch(local, /^https?:/);
  const override = resolveMarketEvidenceFile(
    {NODE_ENV: "test", FOOTBALL_V31_INTERNAL_MARKET_EVIDENCE: "/tmp/local.json"},
    "/tmp/repo",
  );
  assert.equal(override, "/tmp/local.json");
});

test("round identity remains unconfirmed", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const confirmed = {
    ...marketRow(),
    roundIdentityConfirmed: true,
  };
  const file = writeMarketFile([confirmed, marketRow()]);
  const loaded = loadOwnerOnlyMarkets(file);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].roundIdentityConfirmed, false);
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: file,
  });
  assert.equal(view.roundIdentityConfirmed, ROUND_IDENTITY_CONFIRMED);
  assert.equal(view.roundIdentityConfirmed, "NO");
  assert.equal(view.pending[0].marketComparison.roundIdentityConfirmed, "NO");
  assert.equal(view.marketInputToModel, MARKET_INPUT_TO_MODEL);
  assert.equal(view.marketDisclaimer, MARKET_DISCLAIMER);
});

test("normalized 1X2 margin calculation", () => {
  const rawHome = 1 / 1.96;
  const rawDraw = 1 / 3.15;
  const rawAway = 1 / 3.1;
  const sum = rawHome + rawDraw + rawAway;
  const got = normalize1x2(1.96, 3.15, 3.1);
  assert.equal(got.status, "OK");
  if (got.status !== "OK") throw new Error("expected OK");
  assert.ok(Math.abs(got.raw.home - rawHome) < 1e-12);
  assert.ok(Math.abs(got.normalized.home - rawHome / sum) < 1e-12);
  assert.ok(Math.abs(got.normalized.home + got.normalized.draw + got.normalized.away - 1) < 1e-12);
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const compared = compareSealedToMarket(
    expected,
    {v1: {status: "PREDICTED", homePct: 0.6, drawPct: 0.25, awayPct: 0.15}, h2: {status: "PREDICTED", homePct: 0.6, drawPct: 0.25, awayPct: 0.15}, r1: {status: "PREDICTED", homePct: 0.6, drawPct: 0.25, awayPct: 0.15}},
    [marketRow()],
  );
  assert.equal(compared.status, "MATCHED");
  assert.ok(compared.v1);
  assert.ok(Math.abs((compared.v1.home ?? 0) - (0.6 - rawHome / sum)) < 1e-12);
  assert.equal(compared.v1.fairOdds.home, 1 / 0.6);
});

test("missing odds handled", () => {
  const missing = normalize1x2(1.96, null, 3.1);
  assert.equal(missing.status, "MISSING");
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([marketRow({odds: {home: 1.96, draw: null, away: 3.1}})]),
  });
  assert.equal(view.pending[0].marketComparison.status, "MARKET_INCOMPLETE");
  assert.equal(view.pending[0].marketComparison.impliedNormalized, null);
});

test("malformed odds blocked", () => {
  assert.equal(normalize1x2(1, 3.15, 3.1).status, "MALFORMED");
  assert.equal(normalize1x2(0, 3.15, 3.1).status, "MALFORMED");
  assert.equal(normalize1x2(-2, 3.15, 3.1).status, "MALFORMED");
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([marketRow({odds: {home: 1, draw: 3.15, away: 3.1}})]),
  });
  assert.equal(view.pending[0].marketComparison.status, "MARKET_MALFORMED");
});

test("absolute path client leak blocked", () => {
  for (const file of clientFiles) {
    const text = readFileSync(file, "utf8");
    assert.equal(assertNoClientPathLeak(text), true, file);
    assert.doesNotMatch(text, /C:\\\\Users|\/Users\/TCTCTC/);
    assert.doesNotMatch(text, /YANG-EDGE-INBOX/);
  }
});

test("raw screenshot not exposed", () => {
  for (const file of [...clientFiles, resolve(here, "../../src/app/page.tsx")]) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\.png\b/i);
    assert.doesNotMatch(text, /screenshot|스크린샷/i);
    assert.doesNotMatch(text, /2026\\108|2026\/108/);
  }
});

test("production console remains disabled", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const view = loadResearchConsole({
    env: {NODE_ENV: "production"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([marketRow()]),
  });
  assert.equal(view.gate, "INTERNAL_RESEARCH_DISABLED");
  assert.equal(view.pending.length, 0);
  assert.equal(view.marketSummary.matched, 0);
});

test("recommendation imports absent", () => {
  const ui = readFileSync(clientFiles[1], "utf8");
  for (const file of consoleSources) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /from ['"][^'"]*recommendation[^'"]*['"]/);
    assert.doesNotMatch(text, /EDGE PICK|베스트픽|강승부|적중 보장|Top pick|Best value/);
    assert.doesNotMatch(text, /src\/lib\/.*recommendation/);
  }
  assert.doesNotMatch(ui, /추천|수익|확정/);
  assert.match(ui, /Probability difference/);
  assert.match(ui, /\{data\.marketDisclaimer\}/);
  assert.match(readFileSync(join(here, "contract-v1.ts"), "utf8"), /Market screenshot evidence; not current live odds/);
  assert.doesNotMatch(ui, /A\/B\/C grade|추천 순위/);
});

test("totals comparison disabled", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const totals = marketRow({
    marketType: "TOTAL",
    line: "2.5",
    selection: "OVER",
    odds: {home: 1.9, draw: null, away: 1.9},
  });
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([totals, marketRow()]),
  });
  assert.equal(view.totalsRecommendationEnabled, TOTALS_RECOMMENDATION_ENABLED);
  assert.equal(view.totalsRecommendationEnabled, "NO");
  assert.equal(view.pending[0].marketComparison.totalsComparisonEnabled, "NO");
  assert.equal(view.pending[0].marketComparison.status, "MATCHED");
  assert.equal(view.pending[0].marketComparison.marketType, MARKET_TYPE);
  const totalsOnly = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([totals]),
  });
  assert.equal(totalsOnly.pending[0].marketComparison.status, "MARKET_ABSENT");
});

test("handicap comparison disabled", () => {
  const root = tempRoot();
  const {expected} = sealBundle(root);
  const handicap = marketRow({
    marketType: "HANDICAP",
    line: "-1.0",
    selection: "HANDICAP_HOME",
    odds: {home: 1.85, draw: null, away: 1.95},
  });
  const view = loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([handicap]),
  });
  assert.equal(view.handicapComparisonEnabled, HANDICAP_COMPARISON_ENABLED);
  assert.equal(view.handicapComparisonEnabled, "NO");
  assert.equal(view.pending[0].marketComparison.handicapComparisonEnabled, "NO");
  assert.equal(view.pending[0].marketComparison.status, "MARKET_ABSENT");
});

test("pregame snapshots unchanged", () => {
  const root = tempRoot();
  const {expected, dir} = sealBundle(root);
  const before = {
    input: readFileSync(join(dir, "input.json")),
    snapshot: readFileSync(join(dir, "snapshot.json")),
    names: readdirSync(dir).sort(),
  };
  loadResearchConsole({
    env: {NODE_ENV: "test"},
    root,
    expectedTargets: [expected],
    marketFile: writeMarketFile([marketRow()]),
  });
  readFixtureView(root, expected);
  assert.deepEqual(readFileSync(join(dir, "input.json")), before.input);
  assert.deepEqual(readFileSync(join(dir, "snapshot.json")), before.snapshot);
  assert.deepEqual(readdirSync(dir).sort(), before.names);
});

test("existing console tests regression", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/football-v31-internal-research-console-v1/test-v1.ts"],
    {cwd: repoRoot, encoding: "utf8"},
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("grader tests regression", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/football-v31-r1-prospective-postgame-v1/test-v1.ts"],
    {cwd: repoRoot, encoding: "utf8"},
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
