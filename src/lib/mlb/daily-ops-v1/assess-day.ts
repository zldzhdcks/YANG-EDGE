/**
 * Read-only MLB Daily Ops day assessment from existing artifacts.
 * Never mutates Prediction / Engine / datasets.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  artifactPaths,
  auditSchedule,
  auditSummary,
} from "@/lib/mlb/daily-pregame-v0/audit-artifacts";
import { loadDailyPicksV1 } from "@/lib/mlb/daily-picks-v1";
import {
  assessSlateRecommendationProvenance,
  engineRecommendationRecordRel,
  loadEngineRecommendationRecord,
} from "@/lib/mlb/recommendation-provenance-v1";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import type {
  MlbDailyOpsCoverageLine,
  MlbDailyOpsDayAssessment,
  MlbDailyOpsLifecycleStatus,
  MlbDailyOpsPickLine,
} from "./types";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

async function loadCoverage(dateKst: string, cwd: string): Promise<{
  percent: number | null;
  games: number;
  starter: MlbDailyOpsCoverageLine;
  odds: MlbDailyOpsCoverageLine;
  lineup: MlbDailyOpsCoverageLine;
}> {
  const schedule = await auditSchedule(dateKst, cwd);
  const games = schedule.totalGames;

  let percent: number | null = null;
  let starter: MlbDailyOpsCoverageLine = {
    label: "Starter",
    ready: 0,
    total: games * 2,
    detail: null,
  };
  let odds: MlbDailyOpsCoverageLine = {
    label: "Odds",
    ready: 0,
    total: games,
    detail: null,
  };
  let lineup: MlbDailyOpsCoverageLine = {
    label: "Lineup",
    ready: 0,
    total: games,
    detail: null,
  };

  // Prefer daily research summary (artifact source of truth for operator numbers)
  try {
    const summaryRel = artifactPaths(dateKst).summary;
    const doc = asRecord(
      JSON.parse(await readFile(path.join(cwd, summaryRel), "utf8")),
    );
    const ready = asRecord(doc?.researchReady);
    percent = asNumber(ready?.percent);
    for (const raw of asArr(ready?.datasets)) {
      const d = asRecord(raw);
      const name = asString(d?.dataset);
      const detail = asString(d?.detail) ?? "";
      if (name === "Starter") {
        const m = detail.match(/probable=(\d+)/i);
        const miss = detail.match(/missing=(\d+)/i);
        const probable = m ? Number(m[1]) : 0;
        const missing = miss ? Number(miss[1]) : 0;
        starter = {
          label: "Starter",
          ready: probable,
          total: probable + missing || games * 2,
          detail,
        };
      }
      if (name === "Odds") {
        const m = detail.match(/(\d+)\s*\/\s*(\d+)/);
        odds = {
          label: "Odds",
          ready: m ? Number(m[1]) : 0,
          total: m ? Number(m[2]) : games,
          detail,
        };
      }
      if (name === "Lineup") {
        // "15/15 not released" → 0 confirmed ready
        if (/not released/i.test(detail)) {
          lineup = {
            label: "Lineup",
            ready: 0,
            total: games,
            detail,
          };
        } else {
          const m = detail.match(/(\d+)\s*\/\s*(\d+)/);
          lineup = {
            label: "Lineup",
            ready: m ? Number(m[1]) : 0,
            total: m ? Number(m[2]) : games,
            detail,
          };
        }
      }
    }
  } catch {
    /* fall through to dataset summaries */
  }

  // Fallback: starter / odds / lineup dataset summaries
  try {
    const st = asRecord(
      JSON.parse(
        await readFile(path.join(cwd, artifactPaths(dateKst).starter), "utf8"),
      ),
    );
    const sum = asRecord(st?.summary);
    const probable = asNumber(sum?.probableRows);
    const totalRows = asNumber(sum?.totalRows);
    if (probable != null && totalRows != null) {
      starter = {
        label: "Starter",
        ready: probable,
        total: totalRows,
        detail: starter.detail,
      };
    }
  } catch {
    /* keep */
  }

  try {
    const od = asRecord(
      JSON.parse(
        await readFile(path.join(cwd, artifactPaths(dateKst).odds), "utf8"),
      ),
    );
    let collected = 0;
    for (const raw of asArr(od?.rows)) {
      const r = asRecord(raw);
      if (asString(r?.collectionStatus) === "COLLECTED") collected++;
    }
    if (odds.ready === 0 && collected > 0) {
      odds = {
        label: "Odds",
        ready: collected,
        total: games || collected,
        detail: odds.detail,
      };
    }
  } catch {
    /* keep */
  }

  try {
    const lu = asRecord(
      JSON.parse(
        await readFile(path.join(cwd, artifactPaths(dateKst).lineup), "utf8"),
      ),
    );
    const sum = asRecord(lu?.summary);
    const confirmed = asNumber(sum?.confirmedGames);
    if (confirmed != null) {
      lineup = {
        label: "Lineup",
        ready: confirmed,
        total: games || asNumber(sum?.totalGames) || confirmed,
        detail: lineup.detail,
      };
    }
  } catch {
    /* keep */
  }

  return { percent, games, starter, odds, lineup };
}

function resolveLifecycle(input: {
  hasSchedule: boolean;
  hasSummary: boolean;
  provenanceStatus: string;
  snapshotVerified: boolean;
  recordSealed: boolean;
  hasResults: boolean;
}): MlbDailyOpsLifecycleStatus {
  if (input.provenanceStatus === "NO_PREGAME_SNAPSHOT") {
    if (!input.hasSchedule && !input.hasSummary) return "NOT_STARTED";
    return "NO_PREGAME_SNAPSHOT";
  }
  if (
    input.provenanceStatus === "HASH_MISMATCH" ||
    input.provenanceStatus === "SNAPSHOT_AFTER_START"
  ) {
    return "OPS_FAILURE";
  }
  if (!input.snapshotVerified) {
    if (input.hasSchedule || input.hasSummary) return "IN_PROGRESS";
    return "NOT_STARTED";
  }
  if (input.hasResults) return "REVIEW_READY";
  if (input.recordSealed || input.snapshotVerified) return "AWAITING_RESULT";
  return "READY";
}

export async function assessMlbDailyOpsDay(input: {
  dateKst: string;
  cwd?: string;
  /** Default false — assess is read-only. */
  sealDeliveryRecord?: boolean;
}): Promise<MlbDailyOpsDayAssessment> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const schedule = await auditSchedule(dateKst, cwd);
  const summary = await auditSummary(dateKst, cwd);
  const coverage = await loadCoverage(dateKst, cwd);
  const provenance = await assessSlateRecommendationProvenance({
    dateKst,
    cwd,
  });

  // Seal (optional) first, then read filesystem state — never report ABSENT
  // for a record that loadDailyPicksV1 just sealed in this same assessment.
  const picks = await loadDailyPicksV1({
    dateKst,
    cwd,
    sealDeliveryRecord: input.sealDeliveryRecord === true,
  });

  const delivery = await loadEngineRecommendationRecord({ dateKst, cwd });

  const engineCards = [...picks.strongPicks, ...picks.goodPicks].filter(
    (c) => c.provenance.sourceType === "ENGINE_SNAPSHOT",
  );
  const enginePicks: MlbDailyOpsPickLine[] = engineCards.map((c, i) => ({
    rank: i + 1,
    team: c.pickTeam ?? "—",
    probability: c.modelProbabilityPercent,
    confidence: c.confidence,
    researchOnly: c.researchOnly,
    tier: c.tier === "STRONG" ? "STRONG" : "GOOD",
    gameId: c.gameId,
  }));

  const snapshotVerified =
    provenance.status === "PRE_GAME_SNAPSHOT_VERIFIED" &&
    provenance.generatedBeforeGame === true &&
    provenance.hashVerified;

  let recommendationRecord: MlbDailyOpsDayAssessment["recommendationRecord"] =
    "ABSENT";
  if (delivery) recommendationRecord = "SEALED";
  else if (!provenance.allowEngineRecommendations)
    recommendationRecord = "NOT_ELIGIBLE";

  let hasResults = false;
  try {
    const raw = await readFile(
      path.join(cwd, artifactPaths(dateKst).results),
      "utf8",
    );
    const doc = asRecord(JSON.parse(raw));
    hasResults = asArr(doc?.games).length > 0 || asArr(doc?.rows).length > 0;
  } catch {
    hasResults = false;
  }

  const lifecycle = resolveLifecycle({
    hasSchedule: schedule.exists,
    hasSummary: summary.exists,
    provenanceStatus: provenance.status,
    snapshotVerified,
    recordSealed: Boolean(delivery),
    hasResults,
  });

  let nextAction = "RUN_OPS_MLB_DAILY";
  if (lifecycle === "NO_PREGAME_SNAPSHOT") {
    nextAction = "RUN_PREDICTION_V0_BEFORE_FIRST_PITCH";
  } else if (lifecycle === "AWAITING_RESULT") {
    nextAction = "AWAIT_POSTGAME_RESULT";
  } else if (lifecycle === "REVIEW_READY") {
    nextAction = "RUN_REVIEW_MLB_DAILY";
  } else if (lifecycle === "OPS_FAILURE") {
    nextAction = "INSPECT_SNAPSHOT_PROVENANCE";
  } else if (lifecycle === "IN_PROGRESS") {
    nextAction = "CONTINUE_OPS_MLB_DAILY";
  }

  return {
    dateKst,
    lifecycle,
    provenanceStatus: provenance.status,
    predictionHash: provenance.predictionHash,
    predictionHashShort: provenance.predictionHashShort,
    generatedBeforeGame: provenance.generatedBeforeGame,
    snapshotVerified,
    games: coverage.games || schedule.totalGames,
    starter: coverage.starter,
    odds: coverage.odds,
    lineup: coverage.lineup,
    researchReadyPercent: coverage.percent,
    strongPickCount: picks.strongPicks.filter(
      (c) => c.provenance.sourceType === "ENGINE_SNAPSHOT",
    ).length,
    goodPickCount: picks.goodPicks.filter(
      (c) => c.provenance.sourceType === "ENGINE_SNAPSHOT",
    ).length,
    enginePicks,
    recommendationRecord,
    recommendationRecordPath: delivery
      ? engineRecommendationRecordRel(dateKst)
      : null,
    nextAction,
    line: [
      lifecycle,
      snapshotVerified ? "PRE_GAME_SNAPSHOT_VERIFIED" : provenance.status,
      recommendationRecord === "SEALED" ? "RECORD_SEALED" : null,
      enginePicks.length ? `ENGINE_PICKS_${enginePicks.length}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export async function assessRecentMlbDailyOpsDays(input: {
  dates: string[];
  cwd?: string;
}): Promise<MlbDailyOpsDayAssessment[]> {
  const out: MlbDailyOpsDayAssessment[] = [];
  for (const dateKst of input.dates) {
    out.push(
      await assessMlbDailyOpsDay({
        dateKst,
        cwd: input.cwd,
        sealDeliveryRecord: false,
      }),
    );
  }
  return out;
}
