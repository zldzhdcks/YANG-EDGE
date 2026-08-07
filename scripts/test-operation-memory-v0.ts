/**
 * Operation Memory & Decision Center v0 — invariants.
 * Read-only. No artifact mutation.
 * Run: npm run test:operation-memory-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildOperationMemoryV0,
  plainLanguageForCode,
  researchSampleEligibleFromValidity,
} from "../src/lib/internal/operation-memory-v0/build-operation-memory-view";
import {
  APPROVAL_REQUEST_REGISTRY_V0,
  DECISION_LOG_REGISTRY_V0,
} from "../src/lib/internal/operation-memory-v0/decision-registry";
import { buildFeatureUsefulnessAudit } from "../src/lib/internal/operation-memory-v0/feature-usefulness-audit";
import { loadOperationMemorySources } from "../src/lib/internal/operation-memory-v0/load-operation-memory";
import type { OperationMemoryItem } from "../src/lib/internal/operation-memory-v0/types";
import type { YangEdgeOsPresentation } from "../src/lib/internal/yang-edge-os-presenter";

const ROOT = process.cwd();

function stubOs(dateKst: string): YangEdgeOsPresentation {
  return {
    dateKst,
    overallLevel: "BLOCKED",
    overallLabel: "차단",
    canPredictToday: false,
    canPredictReason: "stub",
    predictionContinuity: {
      status: "UNKNOWN",
      snapshotExists: false,
      generatedAt: null,
      createdBeforeFirstStart: null,
      predictionHashSha256: null,
      opsFailure: false,
      plainLanguage: "stub",
    },
    mlbDailyOps: null,
    leagueStatuses: [],
    checklist: [],
    progressPercent: null,
    progressLabel: "DATA_NOT_AVAILABLE",
    risks: [],
    aiBrief: "stub AI brief — not a decision",
    weekSummaryLines: [],
    missions: [],
    cto: {
      sampleGrowth: "DATA_NOT_AVAILABLE",
      accuracy: "DATA_NOT_AVAILABLE",
      brier: "DATA_NOT_AVAILABLE",
      logLoss: "DATA_NOT_AVAILABLE",
      engineChanged: "없음",
      recommendations: [],
      failureTop: [],
      successTop: [],
      footballProgress: "NOT_STARTED",
      nextWeekGoals: [],
    },
    dataCenter: [],
    engines: [],
    researchFocus: {
      pipelines: [],
      coverageNote: "",
      reviewPending: null,
      predictionNote: "",
    },
    developerNotes: ["MULTIPLE_PREGAME_GATES_FAILED"],
    deprecated: [],
    naturalAlerts: [],
  };
}

function assertItemsHaveSources(items: OperationMemoryItem[], label: string): void {
  for (const item of items) {
    assert.ok(
      item.sourceRefs.length > 0,
      `${label}: item ${item.id} must have at least one sourceRef`,
    );
  }
}

export async function runOperationMemoryV0Tests(): Promise<void> {
  const dateKst = "2026-08-03";
  const sources = await loadOperationMemorySources({ dateKst, cwd: ROOT });
  const os = stubOs(dateKst);
  const memory = buildOperationMemoryV0({ dateKst, sources, os });

  // invalid pregame is not a normal research sample
  assert.ok(sources.validity);
  assert.equal(sources.validity.researchValidity, "INVALID_FOR_PREGAME");
  assert.equal(researchSampleEligibleFromValidity(sources.validity), false);
  assert.equal(
    memory.today.blocked.some((b) => b.id.includes("invalid-pregame")),
    true,
    "08-03 invalid must surface as blocked / isolated",
  );
  assert.equal(
    memory.thisWeek.keyAchievements.some(
      (a) =>
        a.dateKst === "2026-08-03" &&
        (a.title.includes("Review VALID") || a.title.includes("Review 완료")),
    ),
    false,
    "08-03 invalid pregame must not appear as a normal Review achievement",
  );
  assert.equal(
    memory.today.completed.some((c) => c.id.includes(`completed-review-${dateKst}`)),
    false,
    "invalid day must not create VALID review completion",
  );

  // official vs research not mixed as service recommendation
  for (const item of [
    ...memory.today.completed,
    ...memory.today.pending,
    ...memory.today.blocked,
    ...memory.thisWeek.keyAchievements,
    ...memory.thisWeek.keyFailures,
  ]) {
    assert.notEqual(item.kind, "AI_PROPOSAL");
    assert.equal(
      /공식 성과|서비스 추천/.test(item.title),
      false,
      `title must not claim service KPI: ${item.title}`,
    );
  }
  assert.match(memory.thisWeek.researchObservationNote, /연구 관찰/);

  // proposed approvals never APPROVED
  for (const a of APPROVAL_REQUEST_REGISTRY_V0) {
    assert.notEqual(a.status, "APPROVED");
  }
  for (const d of DECISION_LOG_REGISTRY_V0) {
    if (d.status === "APPROVED") {
      assert.equal(d.owner, "OWNER");
    }
  }
  assert.ok(memory.approvalRequests.every((a) => a.status !== "APPROVED"));
  assert.ok(
    memory.dashboardSummary.decisionTop.every((d) => d.status === "APPROVED"),
  );
  assert.ok(
    memory.dashboardSummary.approvalTop.every(
      (a) => a.status === "NEEDS_OWNER_DECISION",
    ),
  );
  assert.ok(
    memory.aiProposals.every((p) => p.kind === "AI_PROPOSAL"),
  );

  // source-less memory items forbidden
  assertItemsHaveSources(memory.today.completed, "today.completed");
  assertItemsHaveSources(memory.today.pending, "today.pending");
  assertItemsHaveSources(memory.today.blocked, "today.blocked");
  assertItemsHaveSources(memory.thisWeek.keyAchievements, "week.achievements");
  assertItemsHaveSources(memory.thisWeek.keyFailures, "week.failures");
  assertItemsHaveSources(memory.thisWeek.lessons, "week.lessons");

  // Dashboard / CTO / Mission share same source of truth counts
  const shared = buildOperationMemoryV0({ dateKst, sources, os });
  assert.equal(shared.dashboardSummary.completedCount, memory.today.completed.length);
  assert.equal(shared.dashboardSummary.pendingCount, memory.today.pending.length);
  assert.equal(shared.dashboardSummary.blockedCount, memory.today.blocked.length);
  assert.equal(shared.today.completed.length, memory.today.completed.length);
  assert.equal(shared.today.pending.length, memory.today.pending.length);
  assert.equal(shared.today.blocked.length, memory.today.blocked.length);
  assert.equal(shared.approvalRequests.length, memory.approvalRequests.length);
  assert.equal(
    shared.approvalRequests.filter((a) => a.status === "NEEDS_OWNER_DECISION").length,
    memory.approvalRequests.filter((a) => a.status === "NEEDS_OWNER_DECISION").length,
  );

  // developer codes not in owner-facing titles/summaries by default
  const ownerText = [
    ...memory.today.completed,
    ...memory.today.pending,
    ...memory.today.blocked,
    ...memory.currentRisks,
  ]
    .map((x) => `${x.title} ${"plainLanguage" in x ? x.plainLanguage : ""}`)
    .join("\n");
  assert.equal(ownerText.includes("MULTIPLE_PREGAME_GATES_FAILED"), false);
  assert.equal(ownerText.includes("NON_DETERMINISTIC_HASH_INPUT"), false);
  assert.match(
    plainLanguageForCode("MULTIPLE_PREGAME_GATES_FAILED"),
    /연구 표본에서 제외/,
  );
  assert.match(
    plainLanguageForCode("NON_DETERMINISTIC_HASH_INPUT"),
    /예측 입력으로 사용하지 않았습니다/,
  );

  // usefulness audit deterministic
  const rowsA = buildFeatureUsefulnessAudit();
  const rowsB = buildFeatureUsefulnessAudit();
  const serialize = (rows: typeof rowsA) =>
    rows.map((r) => `${r.id}|${r.classification}|${r.location}|${r.suggestion}`).join("\n");
  assert.equal(serialize(rowsA), serialize(rowsB));
  assert.equal(
    createHash("sha256").update(serialize(rowsA)).digest("hex"),
    createHash("sha256").update(serialize(rowsB)).digest("hex"),
  );
  assert.ok(rowsA.some((r) => r.classification === "PLACEHOLDER_ONLY"));
  assert.ok(rowsA.some((r) => r.classification === "DEVELOPER_ONLY"));

  // no mutation of prediction/review artifacts during load
  const validityPath = path.join(
    ROOT,
    "data",
    "research",
    "mlb",
    "2026-08-03-prediction-validity-v0.json",
  );
  const before = fs.readFileSync(validityPath);
  await loadOperationMemorySources({ dateKst, cwd: ROOT });
  const after = fs.readFileSync(validityPath);
  assert.equal(Buffer.compare(before, after), 0);

  for (const d of memory.recentDecisions.filter((x) => x.status === "APPROVED")) {
    assert.ok(
      d.engineImpact === "NONE" ||
        d.engineImpact === "PROHIBITED" ||
        d.engineImpact === "SEPARATE_MISSION_REQUIRED",
    );
  }

  console.log("PASS test-operation-memory-v0");
  console.log(
    JSON.stringify(
      {
        dateKst,
        today: {
          completed: memory.today.completed.length,
          pending: memory.today.pending.length,
          blocked: memory.today.blocked.length,
        },
        approvalsNeedsDecision: memory.dashboardSummary.approvalTop.length,
        decisionsApprovedTop: memory.dashboardSummary.decisionTop.length,
        goal: memory.currentGoal.title,
        usefulnessRows: rowsA.length,
        researchEligible: researchSampleEligibleFromValidity(sources.validity),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  runOperationMemoryV0Tests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
