import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadScope, readDecisionCoverage, sealTerminalDecision, terminalRoot, type PredictionReference } from "./index";
import { sha, time } from "./evidence";

export type Readiness = "PENDING" | "IDENTITY_BLOCKED" | "AS_OF_BLOCKED" | "INPUT_WAITING" | "PIPELINE_BLOCKED";
export type Capability = { reason: "PASS_ENGINE_NOT_APPROVED" | "PASS_PROVIDER_NOT_SUPPORTED"; finalForDate: true; evidence: string };
export function planPregame(input: { scheduledStart: string; now: string; existingTerminal: boolean; readiness: Readiness; prediction?: PredictionReference; hardLimitation?: Capability }) {
  const start = time(input.scheduledStart), now = time(input.now);
  if (input.existingTerminal) return { action: "PRESERVE" as const };
  if (now >= start) return { action: "PASS" as const, reason: "PASS_PREGAME_WINDOW_MISSED" as const };
  if (input.prediction) return { action: "PREDICTION" as const, reference: input.prediction };
  if (input.hardLimitation) {
    assert.equal(input.hardLimitation.finalForDate, true);
    assert.ok(["PASS_ENGINE_NOT_APPROVED", "PASS_PROVIDER_NOT_SUPPORTED"].includes(input.hardLimitation.reason));
    assert.ok(input.hardLimitation.evidence.trim(), "HARD_LIMITATION_EVIDENCE_REQUIRED");
    return { action: "PASS" as const, reason: input.hardLimitation.reason };
  }
  assert.ok(["PENDING", "IDENTITY_BLOCKED", "AS_OF_BLOCKED", "INPUT_WAITING", "PIPELINE_BLOCKED"].includes(input.readiness));
  return { action: "WAIT" as const, readiness: input.readiness };
}

/** Fresh clock and committed scope on every call. WAIT never creates a terminal directory. */
export function advancePregame(cwd: string, dateKst: string, targetId: string, readiness: Readiness, options: { prediction?: PredictionReference; hardLimitation?: Capability; auditOnly?: boolean } = {}) {
  const scope = loadScope(cwd, dateKst);
  const target = scope.doc.targets.find(t => t.targetId === targetId); assert.ok(target, "OUT_OF_SCOPE");
  const coverage = readDecisionCoverage(cwd, dateKst);
  assert.ok(["COVERAGE_COMPLETE", "COVERAGE_INCOMPLETE"].includes(coverage.status), "INVALID_EXISTING_EVIDENCE");
  const checkedAt = new Date().toISOString();
  const existing = existsSync(join(terminalRoot(cwd, dateKst), sha(targetId)));
  const plan = planPregame({ scheduledStart: target.scheduledStartTimeKst!, now: checkedAt, existingTerminal: existing, readiness, ...options });
  const audit = { targetId, lastCheckedAt: checkedAt, terminalDecisionExists: existing, windowStatus: time(checkedAt) < time(target.scheduledStartTimeKst!) ? "WINDOW_OPEN" : "PREGAME_WINDOW_MISSED", readiness, plan, terminalResearchArtifact: false, intermediateIncompleteAllowed: true };
  if (options.auditOnly || plan.action === "WAIT" || plan.action === "PRESERVE") return { audit, write: null };
  const base = { dateKst, targetId, scopeSha256: scope.hash };
  const write = plan.action === "PREDICTION"
    ? sealTerminalDecision({ ...base, type: "PREDICTION", predictionReference: plan.reference }, cwd)
    : sealTerminalDecision({ ...base, type: "PASS", reason: plan.reason }, cwd);
  return { audit, write };
}
