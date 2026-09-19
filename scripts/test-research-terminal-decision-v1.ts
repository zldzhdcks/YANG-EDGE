import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { freezeResearchSlateSource } from "../src/lib/research/slate-source-freeze";
import { lockResearchTargetScope, operatorBetmanDailySlateRel } from "../src/lib/research/daily-scope-lock";
import { createTerminalWriter, loadScope, pregameEligibility, readDecisionCoverage, terminalRoot, type Request } from "../src/lib/research/terminal-decision";
import { envelope, sha } from "../src/lib/research/terminal-decision/evidence";

const date = "2030-01-10", now = Date.parse("2030-01-10T08:00:00Z"), start = "2030-01-10T19:00:00+09:00";
function json(file: string, value: unknown) { mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + "\n"); }
async function fixture(t: any, count = 1) {
  const cwd = mkdtempSync(join(tmpdir(), "ye-terminal-test-")); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const games = Array.from({ length: count }, (_, i) => ({ operatorSlateGameId: `synthetic-${i}`, sport: "SOCCER", competitionNameRaw: "EPL", competitionNameKo: null, operatorGameNumber: null, operatorMarketId: null, homeTeamRaw: "Home", awayTeamRaw: "Away", scheduledStartTimeKst: start, operatorHomeAwayStatus: "VERIFIED", marketRuleStatus: "VERIFIED", marketTypeRaw: null, marketSelections: [], reviewStatus: "VERIFIED", sourceReference: null, providerGameId: null, providerFixtureId: "123", capturedAt: null, manualIdentityReference: null, notes: null }));
  json(join(cwd, operatorBetmanDailySlateRel(date)), { schemaVersion: "betman-daily-slate-v1", targetDateKst: date, sourceType: "OPERATOR_MANUAL", capturedAt: null, enteredAt: null, reviewedAt: "2030-01-10T01:00:00Z", reviewStatus: "VERIFIED", scopeCompletenessStatus: "COMPLETE", games });
  await freezeResearchSlateSource({ cwd, dateKst: date, frozenAt: "2030-01-10T02:00:00Z" });
  // Isolated temporary Git fixture only. Never commit in the real repository.
  const git = (...args: string[]) => execFileSync("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, ...args], { cwd, stdio: "pipe" });
  git("init", "--quiet"); git("config", "core.autocrlf", "false"); git("add", "data/research/daily-slates");
  git("-c", "user.name=Synthetic Test", "-c", "user.email=test@invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "synthetic source fixture");
  await lockResearchTargetScope({ cwd, dateKst: date, createdAt: "2030-01-10T03:00:00Z" });
  const scope = loadScope(cwd, date);
  const request: Request = { dateKst: date, targetId: "synthetic-0", scopeSha256: scope.hash, type: "PASS", reason: "PASS_ENGINE_NOT_APPROVED" };
  return { cwd, scope, request };
}
function prediction(cwd: string, scopeHash: string): Request {
  const dir = join(cwd, "data/cache/research/football/forward-shadow-v1/MODEL_FORWARD/fixtures/123");
  const input = envelope({ target: { matchId: "API_FOOTBALL:123", homeTeamId: "1", awayTeamId: "2", competitionId: "39", kickoffAt: start } });
  const snapshot = envelope({ layer: "MODEL_FORWARD", fixtureId: 123, leagueId: 39, homeTeam: { id: 1, name: "Home" }, awayTeam: { id: 2, name: "Away" }, kickoffUtc: start, cutoffAt: "2030-01-10T06:00:00Z", predictionCreatedAt: "2030-01-10T07:00:00Z", status: "PREDICTED", modelVersion: "football-poisson-research-v1", modelSourceHash: "6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf", inputSnapshotHash: input.sha256, pHome: 0.5, pDraw: 0.3, pAway: 0.2, predictedClass: "HOME", TARGET_RESULT_DATA_USED: false, ODDS_USED: false, MARKET_USED: false, PROVIDER_PREDICTION_USED: false, OWNER_SHADOW_USED: false, EXTERNAL_SHADOW_USED: false });
  json(join(dir, "input.json"), input); json(join(dir, "snapshot.json"), snapshot);
  json(join(dir, "seal-receipt.json"), envelope({ fixtureId: 123, snapshotHash: snapshot.sha256, validPregame: true, sealedAt: "2030-01-10T07:01:00Z" }));
  return { dateKst: date, targetId: "synthetic-0", scopeSha256: scopeHash, type: "PREDICTION", predictionReference: { kind: "FOOTBALL_FORWARD_V1", fixtureId: 123, snapshotHash: snapshot.sha256, scopeSha256: scopeHash } };
}
test("missing scope is not authoritative zero", t => {
  const cwd = mkdtempSync(join(tmpdir(), "ye-terminal-missing-")); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  assert.equal(readDecisionCoverage(cwd, date).status, "BLOCKED_NO_SCOPE");
});
test("PASS first write, restart idempotence, conflict, immutable bytes and complete", async t => {
  const { cwd, request } = await fixture(t);
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_INCOMPLETE");
  const result = createTerminalWriter(cwd, () => now)(request); assert.equal(result.status, "SUCCESS");
  const bytes = readFileSync(join(result.path, "decision.json"), "utf8");
  assert.equal(createTerminalWriter(cwd, () => now + 86400000)(request).status, "IDEMPOTENT");
  assert.equal(createTerminalWriter(cwd, () => now)({ ...request, type: "PASS", reason: "PASS_PROVIDER_NOT_SUPPORTED" }).status, "CONFLICT");
  assert.equal(readFileSync(join(result.path, "decision.json"), "utf8"), bytes);
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_COMPLETE");
});
test("verified frozen authoritative empty scope may complete", async t => {
  const { cwd } = await fixture(t, 0); assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_COMPLETE");
});
test("time boundary equality is missed and late PASS uses only missed reason", async t => {
  const { cwd, request } = await fixture(t);
  assert.equal(pregameEligibility(start, "2030-01-10T09:59:59Z"), "OPEN");
  assert.equal(pregameEligibility(start, "2030-01-10T10:00:00Z"), "PREGAME_WINDOW_MISSED");
  assert.throws(() => createTerminalWriter(cwd, () => now)( { ...request, type: "PASS", reason: "PASS_PREGAME_WINDOW_MISSED" }));
  const writer = createTerminalWriter(cwd, () => Date.parse(start)); assert.throws(() => writer(request));
  assert.equal(writer({ ...request, type: "PASS", reason: "PASS_PREGAME_WINDOW_MISSED" }).status, "SUCCESS");
});
test("scope, target and raw draft cannot bypass authority", async t => {
  const { cwd, request } = await fixture(t); const writer = createTerminalWriter(cwd, () => now);
  assert.throws(() => writer({ ...request, scopeSha256: "bad" })); assert.throws(() => writer({ ...request, targetId: "outside" }));
  const file = join(cwd, operatorBetmanDailySlateRel(date)); const raw = JSON.parse(readFileSync(file, "utf8")); raw.reviewStatus = "DRAFT"; json(file, raw);
  assert.throws(() => writer(request)); assert.equal(readDecisionCoverage(cwd, date).status, "BLOCKED_NO_SCOPE");
});
test("existing prediction reference works, no probabilities accepted by writer", async t => {
  const { cwd, scope } = await fixture(t); const request = prediction(cwd, scope.hash);
  assert.throws(() => createTerminalWriter(cwd, () => now)({ ...request, pHome: 0.9 } as any));
  assert.equal(createTerminalWriter(cwd, () => now)(request).status, "SUCCESS");
  assert.equal(readDecisionCoverage(cwd, date).SEALED_PREDICTION_COUNT, 1);
});
test("uncommitted frozen source cannot supply authoritative zero", async t => {
  const { cwd } = await fixture(t, 0);
  rmSync(join(cwd, ".git"), { recursive: true, force: true });
  assert.equal(readDecisionCoverage(cwd, date).status, "BLOCKED_NO_SCOPE");
});
test("prediction and PASS cannot replace each other", async t => {
  const { cwd, scope, request } = await fixture(t); const p = prediction(cwd, scope.hash);
  const writer = createTerminalWriter(cwd, () => now); writer(p);
  assert.equal(writer(request).status, "CONFLICT");
  assert.equal(writer(p).status, "IDEMPOTENT");
});
test("prediction reference hash, scope, identity and deadline rejected", async t => {
  const { cwd, scope } = await fixture(t); const request = prediction(cwd, scope.hash); assert.equal(request.type, "PREDICTION"); if (request.type !== "PREDICTION") return;
  for (const patch of [{ snapshotHash: "wrong" }, { scopeSha256: "wrong" }, { fixtureId: 124 }]) assert.throws(() => createTerminalWriter(cwd, () => now)({ ...request, predictionReference: { ...request.predictionReference, ...patch } }));
  assert.throws(() => createTerminalWriter(cwd, () => Date.parse(start))(request));
});
test("duplicate files and outside targets invalidate full coverage", async t => {
  const { cwd, request } = await fixture(t); const result = createTerminalWriter(cwd, () => now)(request);
  cpSync(result.path, join(terminalRoot(cwd, date), "duplicate"), { recursive: true });
  let c = readDecisionCoverage(cwd, date); assert.equal(c.status, "COVERAGE_INVALID"); assert.equal(c.DUPLICATE_TARGET_COUNT, 1);
  const d = JSON.parse(readFileSync(join(result.path, "decision.json"), "utf8")).payload; d.targetId = "outside";
  json(join(terminalRoot(cwd, date), sha("outside"), "decision.json"), envelope(d));
  c = readDecisionCoverage(cwd, date); assert.equal(c.OUT_OF_SCOPE_DECISION_COUNT, 1);
});
test("interrupted publication cannot count, restart cannot overwrite it", async t => {
  const { cwd, request } = await fixture(t); const dir = join(terminalRoot(cwd, date), sha(request.targetId)); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "decision.json"), "{partial");
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_INVALID"); assert.throws(() => createTerminalWriter(cwd, () => now)(request));
});
test("prediction deadline crossed during publication leaves invalid incomplete seal", async t => {
  const { cwd, scope } = await fixture(t); const request = prediction(cwd, scope.hash); let tick = 0;
  assert.throws(() => createTerminalWriter(cwd, () => tick++ === 0 ? now : Date.parse(start))(request));
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_INVALID");
});
test("receipt tampering is rejected", async t => {
  const { cwd, request } = await fixture(t); const result = createTerminalWriter(cwd, () => now)(request);
  json(join(result.path, "seal.json"), envelope({ decisionHash: "wrong", sealedAt: new Date(now).toISOString() }));
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_INVALID");
});
test("restart completes remaining targets without changing prior seals", async t => {
  const { cwd, request } = await fixture(t, 2); createTerminalWriter(cwd, () => now)(request);
  assert.equal(readDecisionCoverage(cwd, date).UNRESOLVED_COUNT, 1);
  const resumed = createTerminalWriter(cwd, () => now + 1000); assert.equal(resumed(request).status, "IDEMPOTENT");
  resumed({ ...request, targetId: "synthetic-1" }); assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_COMPLETE");
});
test("duplicate predictions and prediction plus PASS are invalid", async t => {
  const { cwd, scope } = await fixture(t); const p = prediction(cwd, scope.hash); const result = createTerminalWriter(cwd, () => now)(p);
  const extra = join(terminalRoot(cwd, date), "extra"); cpSync(result.path, extra, { recursive: true });
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_INVALID");
  const d = JSON.parse(readFileSync(join(extra, "decision.json"), "utf8")).payload;
  delete d.predictionReference; d.type = "PASS"; d.reason = "PASS_ENGINE_NOT_APPROVED"; json(join(extra, "decision.json"), envelope(d));
  const c = readDecisionCoverage(cwd, date); assert.equal(c.status, "COVERAGE_INVALID"); assert.equal(c.DUPLICATE_TARGET_COUNT, 1);
});
test("receipt publication crossing deadline invalidates terminal", async t => {
  const { cwd, scope } = await fixture(t); const p = prediction(cwd, scope.hash); let n = 0;
  assert.throws(() => createTerminalWriter(cwd, () => ++n < 3 ? now : Date.parse(start))(p));
  assert.equal(readDecisionCoverage(cwd, date).status, "COVERAGE_INVALID");
});
