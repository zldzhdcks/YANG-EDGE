/**
 * Postgame preflight — refuse if no verified pregame snapshot.
 * Never creates Prediction artifacts.
 */
import { auditSchedule } from "@/lib/mlb/daily-pregame-v0/audit-artifacts";
import {
  assessSlateRecommendationProvenance,
  engineRecommendationRecordRel,
  loadEngineRecommendationRecord,
} from "@/lib/mlb/recommendation-provenance-v1";
import type { MlbPostgameFailure, MlbPostgameLifecycleStatus } from "./types";

export type MlbPostgamePreflight = {
  ok: boolean;
  lifecycle: MlbPostgameLifecycleStatus;
  failure: MlbPostgameFailure | null;
  provenance: Awaited<
    ReturnType<typeof assessSlateRecommendationProvenance>
  >;
  scheduleExists: boolean;
  snapshotVerified: boolean;
  recommendationRecord: "SEALED" | "ABSENT" | "NOT_ELIGIBLE";
  recommendationRecordPath: string | null;
};

export async function preflightMlbPostgameOps(input: {
  dateKst: string;
  cwd?: string;
}): Promise<MlbPostgamePreflight> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const schedule = await auditSchedule(dateKst, cwd);
  const provenance = await assessSlateRecommendationProvenance({
    dateKst,
    cwd,
  });
  const delivery = await loadEngineRecommendationRecord({ dateKst, cwd });

  const snapshotVerified =
    provenance.status === "PRE_GAME_SNAPSHOT_VERIFIED" &&
    provenance.generatedBeforeGame === true &&
    provenance.hashVerified;

  let recommendationRecord: MlbPostgamePreflight["recommendationRecord"] =
    "ABSENT";
  if (delivery) recommendationRecord = "SEALED";
  else if (!provenance.allowEngineRecommendations)
    recommendationRecord = "NOT_ELIGIBLE";

  if (provenance.status === "NO_PREGAME_SNAPSHOT") {
    return {
      ok: false,
      lifecycle: "NO_PREGAME_SNAPSHOT",
      failure: {
        stage: "PREFLIGHT",
        reason: "NO_PREGAME_SNAPSHOT",
        nextAction:
          "사후 Prediction 생성 금지 · 다음 슬레이트에서 ops:mlb-daily 로 사전 Snapshot 확보",
      },
      provenance,
      scheduleExists: schedule.exists,
      snapshotVerified: false,
      recommendationRecord,
      recommendationRecordPath: null,
    };
  }

  if (!snapshotVerified) {
    return {
      ok: false,
      lifecycle: "OPS_FAILURE",
      failure: {
        stage: "PREFLIGHT",
        reason: provenance.status,
        nextAction: "INSPECT_SNAPSHOT_PROVENANCE — 사후 Snapshot/재구성 추천 금지",
      },
      provenance,
      scheduleExists: schedule.exists,
      snapshotVerified: false,
      recommendationRecord,
      recommendationRecordPath: delivery
        ? engineRecommendationRecordRel(dateKst)
        : null,
    };
  }

  if (!schedule.exists) {
    return {
      ok: false,
      lifecycle: "OPS_FAILURE",
      failure: {
        stage: "PREFLIGHT",
        reason: "SCHEDULE_MISSING",
        nextAction: "RUN_SCHEDULE_COLLECTION",
      },
      provenance,
      scheduleExists: false,
      snapshotVerified: true,
      recommendationRecord,
      recommendationRecordPath: delivery
        ? engineRecommendationRecordRel(dateKst)
        : null,
    };
  }

  return {
    ok: true,
    lifecycle: "PREGAME_READY",
    failure: null,
    provenance,
    scheduleExists: true,
    snapshotVerified: true,
    recommendationRecord,
    recommendationRecordPath: delivery
      ? engineRecommendationRecordRel(dateKst)
      : null,
  };
}
