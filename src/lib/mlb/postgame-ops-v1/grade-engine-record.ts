/**
 * Grade ENGINE recommendation delivery record against official results / graded predictions.
 * Does not recompute Prediction — sealed record is Source of Truth for which picks count.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { abbreviateTeamName } from "@/lib/mlb/review-classify-v2";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  engineRecommendationRecordRel,
  loadEngineRecommendationRecord,
  type EngineRecommendationRecordV1,
} from "@/lib/mlb/recommendation-provenance-v1";
import type { GoodPickGameFeedback } from "@/lib/mlb/good-pick-feedback-v1";
import type {
  EngineGoodPickRow,
  EngineGoodPickScorecard,
} from "./types";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function countMode(labels: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const l of labels) {
    if (!l) continue;
    counts[l] = (counts[l] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} (n=${top[1]})` : null;
}

export async function gradeEngineRecommendationRecord(input: {
  dateKst: string;
  cwd?: string;
  generatedBeforeGame: boolean | null;
  /** Optional feedback rows for Before/After learning text */
  feedbackGames?: GoodPickGameFeedback[];
}): Promise<EngineGoodPickScorecard> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const record = await loadEngineRecommendationRecord({ dateKst, cwd });
  const pathRel = engineRecommendationRecordRel(dateKst);

  if (!record) {
    return {
      recordStatus: "ABSENT",
      recordPath: null,
      total: 0,
      correct: 0,
      incorrect: 0,
      pending: 0,
      accuracyPercent: null,
      rows: [],
      topSuccessCandidate: null,
      topFailureCandidate: null,
    };
  }

  if (record.sourceType !== "ENGINE_SNAPSHOT") {
    return {
      recordStatus: "NOT_ELIGIBLE",
      recordPath: pathRel,
      total: 0,
      correct: 0,
      incorrect: 0,
      pending: 0,
      accuracyPercent: null,
      rows: [],
      topSuccessCandidate: null,
      topFailureCandidate: null,
    };
  }

  let gradedById = new Map<string, Record<string, unknown>>();
  let resultById = new Map<string, Record<string, unknown>>();
  try {
    const graded = asRecord(
      JSON.parse(
        await readFile(
          path.join(
            cwd,
            "data",
            "research",
            "mlb",
            `${dateKst}-graded-predictions-v1.json`,
          ),
          "utf8",
        ),
      ),
    );
    for (const raw of asArr(graded?.games)) {
      const row = asRecord(raw);
      const id = asString(row?.gameId);
      if (row && id) gradedById.set(id, row);
    }
  } catch {
    /* pending */
  }
  try {
    const results = asRecord(
      JSON.parse(
        await readFile(
          path.join(
            cwd,
            "data",
            "research",
            "mlb",
            `${dateKst}-official-results-v1.json`,
          ),
          "utf8",
        ),
      ),
    );
    for (const raw of asArr(results?.games)) {
      const row = asRecord(raw);
      const id = asString(row?.internalGameId) ?? asString(row?.gameId);
      if (row && id) resultById.set(id, row);
    }
  } catch {
    /* pending */
  }

  const fbById = new Map(
    (input.feedbackGames ?? []).map((g) => [g.gameId, g] as const),
  );

  const rows: EngineGoodPickRow[] = [];
  const successLabels: string[] = [];
  const failureLabels: string[] = [];

  for (const pick of record.picks) {
    if (pick.sourceType !== "ENGINE_SNAPSHOT") continue;
    const g = gradedById.get(pick.gameId) ?? null;
    const res = resultById.get(pick.gameId) ?? null;
    const fb = fbById.get(pick.gameId) ?? null;
    const resultStatus = (asString(res?.status) ?? "").toUpperCase();
    const isFinal = resultStatus === "FINAL";

    const researchGrade = asRecord(g?.researchGrade);
    const gradeRaw = asString(g?.grade) ?? asString(researchGrade?.result);

    const eligibleForRecord =
      pick.sourceType === "ENGINE_SNAPSHOT" &&
      input.generatedBeforeGame === true &&
      isFinal &&
      (gradeRaw === "CORRECT" || gradeRaw === "INCORRECT");

    let grade: EngineGoodPickRow["grade"] = "PENDING";
    if (!isFinal && !g) grade = "PENDING";
    else if (gradeRaw === "CORRECT") grade = "CORRECT";
    else if (gradeRaw === "INCORRECT") grade = "INCORRECT";
    else if (!isFinal) grade = "PENDING";
    else grade = "UNKNOWN";

    if (!eligibleForRecord && (grade === "CORRECT" || grade === "INCORRECT")) {
      // Result not FINAL yet or generatedBeforeGame false → not record-eligible
      if (!isFinal || input.generatedBeforeGame !== true) {
        grade = grade === "CORRECT" || grade === "INCORRECT" ? grade : "PENDING";
      }
    }
    if (input.generatedBeforeGame !== true) {
      grade = "INELIGIBLE";
    }

    const homeScore =
      asNumber(g?.homeScore) ?? asNumber(res?.homeScore);
    const awayScore =
      asNumber(g?.awayScore) ?? asNumber(res?.awayScore);
    const homeTeam =
      asString(g?.homeTeam) ?? asString(res?.homeTeam) ?? "Home";
    const awayTeam =
      asString(g?.awayTeam) ?? asString(res?.awayTeam) ?? "Away";
    const finalScore =
      homeScore != null && awayScore != null
        ? `${abbreviateTeamName(awayTeam)} ${awayScore} – ${abbreviateTeamName(homeTeam)} ${homeScore}`
        : fb?.finalScore ?? null;

    const whyCorrectLabels = (fb?.whyCorrect ?? []).map((c) => c.label);
    const whyIncorrectLabels = (fb?.whyIncorrect ?? []).map((c) => c.label);
    if (grade === "CORRECT") successLabels.push(...whyCorrectLabels);
    if (grade === "INCORRECT") failureLabels.push(...whyIncorrectLabels);

    rows.push({
      gameId: pick.gameId,
      gamePk: pick.gamePk,
      pick: pick.pick,
      tier: pick.tier,
      probability: pick.probability,
      confidence: pick.confidence,
      researchOnly: pick.researchOnly,
      finalScore,
      grade,
      eligibleForRecord,
      primaryReviewCandidate: fb?.primaryReviewCandidate ?? null,
      secondaryReviewCandidates: fb?.secondaryReviewCandidates ?? [],
      whyCorrectLabels,
      whyIncorrectLabels,
      beforeSignals: (fb?.beforeSignals ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        plain: s.plain,
      })),
      afterPlain: fb?.whatWeLearned ?? null,
    });
  }

  const correct = rows.filter(
    (r) => r.grade === "CORRECT" && r.eligibleForRecord,
  ).length;
  const incorrect = rows.filter(
    (r) => r.grade === "INCORRECT" && r.eligibleForRecord,
  ).length;
  const pending = rows.filter(
    (r) => r.grade === "PENDING" || r.grade === "UNKNOWN",
  ).length;
  const gradedN = correct + incorrect;
  const accuracyPercent =
    gradedN > 0 ? Math.round((correct / gradedN) * 1000) / 10 : null;

  return {
    recordStatus: "SEALED",
    recordPath: pathRel,
    total: rows.length,
    correct,
    incorrect,
    pending,
    accuracyPercent,
    rows,
    topSuccessCandidate: countMode(successLabels),
    topFailureCandidate: countMode(failureLabels),
  };
}

export type { EngineRecommendationRecordV1 };
