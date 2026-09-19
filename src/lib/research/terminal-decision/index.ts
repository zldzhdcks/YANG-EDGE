import assert from "node:assert/strict";
import { closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { canonical, envelope, loadScope, readEnvelope, sha, time } from "./evidence";
import { validatePredictionReference, type PredictionReference } from "./prediction-reference";
export { loadScope } from "./evidence";
export type { PredictionReference } from "./prediction-reference";

// Existing Daily C reason vocabulary; no new model or PASS policy.
export const PASS_REASONS = ["PASS_ENGINE_NOT_APPROVED", "PASS_IDENTITY_REVIEW_REQUIRED", "PASS_COMPETITION_REVIEW_REQUIRED", "PASS_PROVIDER_NOT_SUPPORTED", "PASS_REQUIRED_PREGAME_DATA_MISSING", "PASS_PREGAME_WINDOW_MISSED"] as const;
export type PassReason = typeof PASS_REASONS[number];
export type Request = { dateKst: string; targetId: string; scopeSha256: string } & (
  { type: "PASS"; reason: PassReason } | { type: "PREDICTION"; predictionReference: PredictionReference }
);
type Decision = Request & { schemaVersion: "yang-edge-terminal-decision-v1"; createdAt: string };
export const terminalRoot = (cwd: string, date: string) => join(cwd, "data/research/terminal-decisions", date);
export function pregameEligibility(scheduled: string, attempt: string) { return time(attempt) < time(scheduled) ? "OPEN" : "PREGAME_WINDOW_MISSED"; }

/** Publish complete bytes exclusively. An interrupted attempt is never accepted without its receipt. */
function publish(dir: string, name: string, payload: unknown) {
  const temp = join(dir, `.pending-${randomUUID()}`);
  const fd = openSync(temp, "wx");
  try { writeFileSync(fd, JSON.stringify(envelope(payload), null, 2) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  try { linkSync(temp, join(dir, name)); } finally { unlinkSync(temp); }
}
function validate(cwd: string, scope: ReturnType<typeof loadScope>, d: Decision) {
  const keys = ["dateKst", "targetId", "scopeSha256", "type", "schemaVersion", "createdAt", d.type === "PASS" ? "reason" : "predictionReference"];
  assert.equal(canonical(Object.keys(d).sort()), canonical(keys.sort()), "UNSUPPORTED_DECISION_FIELDS");
  assert.equal(d.schemaVersion, "yang-edge-terminal-decision-v1");
  assert.equal(d.dateKst, scope.doc.dateKst); assert.equal(d.scopeSha256, scope.hash);
  const target = scope.doc.targets.find(t => t.targetId === d.targetId); assert.ok(target, "OUT_OF_SCOPE");
  assert.ok(time(d.createdAt) >= time(scope.doc.scopeLockedAt));
  assert.ok(target.scheduledStartTimeKst, "START_REQUIRED");
  const missed = pregameEligibility(target.scheduledStartTimeKst, d.createdAt) !== "OPEN";
  if (d.type === "PASS") {
    assert.ok(PASS_REASONS.includes(d.reason)); assert.ok(!("predictionReference" in d));
    assert.equal(d.reason === "PASS_PREGAME_WINDOW_MISSED", missed, "PASS_TIME_REASON_MISMATCH");
  } else {
    assert.equal(d.type, "PREDICTION"); assert.ok(!("reason" in d)); assert.ok(!missed, "PREGAME_WINDOW_MISSED");
    validatePredictionReference(cwd, target, scope.hash, d.predictionReference, d.createdAt);
  }
}
function readDecision(cwd: string, scope: ReturnType<typeof loadScope>, dir: string) {
  assert.ok(!existsSync(join(dir, "invalid.json")), "INVALID_SEAL_MARKER");
  const e = readEnvelope(join(dir, "decision.json")); const d = e.payload as Decision;
  validate(cwd, scope, d);
  assert.equal(dir, join(terminalRoot(cwd, d.dateKst), sha(d.targetId)), "WRONG_TARGET_DIRECTORY");
  const receipt = readEnvelope(join(dir, "seal.json")).payload;
  assert.equal(receipt.decisionHash, e.sha256); assert.ok(time(receipt.sealedAt) >= time(d.createdAt));
  if (d.type === "PREDICTION") assert.ok(time(receipt.sealedAt) < time(scope.doc.targets.find(t => t.targetId === d.targetId)!.scheduledStartTimeKst!), "LATE_SEAL");
  return d;
}
const semantic = (d: Decision) => { const { createdAt: _time, schemaVersion: _schema, ...request } = d; return canonical(request); };

/** Clock injection is for synthetic tests; the production entry point never accepts a timestamp. */
export function createTerminalWriter(cwd: string, clock: () => number = Date.now) {
  return function seal(request: Request): { status: "SUCCESS" | "IDEMPOTENT" | "CONFLICT"; path: string } {
    const scope = loadScope(cwd, request.dateKst);
    assert.equal(request.scopeSha256, scope.hash); assert.ok(scope.doc.targets.some(t => t.targetId === request.targetId), "OUT_OF_SCOPE");
    const dir = join(terminalRoot(cwd, request.dateKst), sha(request.targetId));
    if (existsSync(dir)) {
      const prior = readDecision(cwd, scope, dir); // Incomplete/corrupt seals fail closed, never repaired automatically.
      return { status: semantic(prior) === canonical(request) ? "IDEMPOTENT" : "CONFLICT", path: dir };
    }
    const d: Decision = { ...request, schemaVersion: "yang-edge-terminal-decision-v1", createdAt: new Date(clock()).toISOString() };
    validate(cwd, scope, d);
    mkdirSync(terminalRoot(cwd, request.dateKst), { recursive: true });
    // Exclusive reservation also excludes concurrent different decisions for the same target.
    try { mkdirSync(dir); } catch (error: any) { if (error.code === "EEXIST") return { status: "CONFLICT", path: dir }; throw error; }
    assert.equal(loadScope(cwd, request.dateKst).hash, scope.hash);
    publish(dir, "decision.json", d);
    const sealedAt = new Date(clock()).toISOString();
    assert.ok(time(sealedAt) >= time(d.createdAt), "CLOCK_REGRESSION");
    if (d.type === "PREDICTION") assert.equal(pregameEligibility(scope.doc.targets.find(t => t.targetId === d.targetId)!.scheduledStartTimeKst!, sealedAt), "OPEN", "LATE_SEAL");
    publish(dir, "seal.json", { decisionHash: envelope(d).sha256, sealedAt });
    const completedAt = new Date(clock()).toISOString();
    if (time(completedAt) < time(sealedAt) || (d.type === "PREDICTION" && pregameEligibility(scope.doc.targets.find(t => t.targetId === d.targetId)!.scheduledStartTimeKst!, completedAt) !== "OPEN")) {
      publish(dir, "invalid.json", { reason: "PUBLICATION_CLOCK_INVALID", completedAt });
      throw Error("PUBLICATION_CLOCK_INVALID");
    }
    readDecision(cwd, scope, dir);
    return { status: "SUCCESS", path: dir };
  };
}
export const sealTerminalDecision = (request: Request, cwd = process.cwd()) => {
  // Existing evidence is still validated by the original reader. The new policy
  // affects new production writes only; it never invalidates historical PASS.
  const existing = existsSync(join(terminalRoot(cwd, request.dateKst), sha(request.targetId)));
  if (!existing && request.type === "PASS") {
    assert.ok(!["PASS_IDENTITY_REVIEW_REQUIRED", "PASS_COMPETITION_REVIEW_REQUIRED", "PASS_REQUIRED_PREGAME_DATA_MISSING"].includes(request.reason), "RECOVERABLE_BLOCKER_IS_NON_TERMINAL");
  }
  return createTerminalWriter(cwd)(request);
};

/** Read-only; malformed files and abandoned reservations are visible invalid decisions. */
export function readDecisionCoverage(cwd: string, dateKst: string) {
  let scope: ReturnType<typeof loadScope>;
  try { scope = loadScope(cwd, dateKst); } catch (e) { return { status: "BLOCKED_NO_SCOPE", TARGET_COUNT: null, TERMINAL_DECISION_COUNT: null, UNIQUE_DECISION_TARGET_COUNT: null, SEALED_PREDICTION_COUNT: null, SEALED_PASS_COUNT: null, UNRESOLVED_COUNT: null, DUPLICATE_TARGET_COUNT: null, OUT_OF_SCOPE_DECISION_COUNT: null, INVALID_DECISION_COUNT: null, reason: String(e), networkCalls: 0, providerCalls: 0 }; }
  const root = terminalRoot(cwd, dateKst);
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
  const counts = new Map<string, number>(); const valid = new Map<string, Decision>(); const errors: string[] = [];
  let outside = 0, invalid = 0;
  for (const entry of entries) {
    const dir = join(root, entry.name);
    try {
      // Count identities even when the hash/receipt is invalid, exposing duplicate attempts.
      const raw = JSON.parse(readFileSync(join(dir, "decision.json"), "utf8"));
      const id = raw?.payload?.targetId;
      if (typeof id === "string") {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (!scope.doc.targets.some(t => t.targetId === id)) outside++;
      }
      const d = readDecision(cwd, scope, dir); valid.set(d.targetId, d);
    } catch (e) { invalid++; errors.push(`${entry.name}:${String(e)}`); }
  }
  const duplicate = [...counts.values()].filter(n => n > 1).length;
  const unresolved = scope.doc.targets.filter(t => !valid.has(t.targetId)).map(t => t.targetId);
  const predicted = [...valid.values()].filter(d => d.type === "PREDICTION").length;
  return {
    status: invalid || duplicate || outside ? "COVERAGE_INVALID" : unresolved.length ? "COVERAGE_INCOMPLETE" : "COVERAGE_COMPLETE",
    TARGET_COUNT: scope.doc.targetCount, TERMINAL_DECISION_COUNT: entries.length, UNIQUE_DECISION_TARGET_COUNT: counts.size,
    SEALED_PREDICTION_COUNT: predicted, SEALED_PASS_COUNT: valid.size - predicted, UNRESOLVED_COUNT: unresolved.length,
    DUPLICATE_TARGET_COUNT: duplicate, OUT_OF_SCOPE_DECISION_COUNT: outside, INVALID_DECISION_COUNT: invalid,
    unresolvedTargetIds: unresolved, errors, scopeSha256: scope.hash, networkCalls: 0, providerCalls: 0,
  };
}
