import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { computeKboIdentityImmutableHash } from "../build-schedule-result-identity-dataset";
import type { KboOddsComparisonDocument } from "../odds-comparison/kbo-odds-comparison-types";
import type {
  KboOperatorGameMarketInput,
  KboOperatorMarketInputV2,
} from "../operator-input-v2/kbo-operator-market-input-types";
import type { KboScheduleResultIdentityDocument } from "../schedule-result-identity-types";
import {
  KBO_MARKET_RESULT_FEEDBACK_BUILDER_VERSION,
  KBO_MARKET_RESULT_FEEDBACK_DATASET_ID,
  KBO_MARKET_RESULT_FEEDBACK_SCHEMA_VERSION,
  type KboMarketDirectionAgreement,
  type KboMarketDirectionMatch,
  type KboMarketFavoredSide,
  type KboMarketResultFeedbackDocument,
  type KboMarketResultFeedbackRow,
} from "./kbo-market-result-feedback-types";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function favoredSide(
  homeOdds: number | null,
  awayOdds: number | null,
): KboMarketFavoredSide {
  if (homeOdds == null || awayOdds == null) return "NONE";
  if (homeOdds === awayOdds) return "NONE";
  return homeOdds < awayOdds ? "HOME" : "AWAY";
}

function directionMatch(
  favored: KboMarketFavoredSide,
  winnerSide: string | null,
): KboMarketDirectionMatch {
  if (favored === "NONE" || winnerSide == null) return "UNKNOWN";
  if (winnerSide === "DRAW") return "UNKNOWN";
  return favored === winnerSide ? "MATCHED" : "NOT_MATCHED";
}

function directionAgreement(
  domestic: KboMarketFavoredSide,
  overseas: KboMarketFavoredSide,
): KboMarketDirectionAgreement {
  if (domestic === "NONE" || overseas === "NONE") return "UNKNOWN";
  return domestic === overseas ? "AGREED" : "CONFLICTED";
}

function pickMoneyline2Way(game: KboOperatorGameMarketInput | undefined) {
  return game?.markets.find((m) => m.marketType === "MONEYLINE_2WAY") ?? null;
}

function buildRow(args: {
  identityRow: KboScheduleResultIdentityDocument["rows"][number];
  operatorGame: KboOperatorGameMarketInput | undefined;
  operatorDoc: KboOperatorMarketInputV2;
  oddsRow: KboOddsComparisonDocument["rows"][number] | undefined;
}): KboMarketResultFeedbackRow {
  const { identityRow, operatorGame, operatorDoc, oddsRow } = args;
  const warnings: string[] = [];
  const missing: string[] = [];

  const mlMarket = pickMoneyline2Way(operatorGame);
  const domesticHome =
    mlMarket?.selections.find((s) => s.selectionCode === "HOME")?.odds ??
    oddsRow?.domestic?.selections.find((s) => s.selectionCode === "HOME")
      ?.odds ??
    null;
  const domesticAway =
    mlMarket?.selections.find((s) => s.selectionCode === "AWAY")?.odds ??
    oddsRow?.domestic?.selections.find((s) => s.selectionCode === "AWAY")
      ?.odds ??
    null;
  const domesticReviewStatus =
    mlMarket?.reviewStatus ?? operatorGame?.reviewStatus ?? operatorDoc.reviewStatus;
  if (domesticReviewStatus === "DRAFT") {
    warnings.push("DOMESTIC_ODDS_DRAFT");
  }
  if (domesticHome == null || domesticAway == null) {
    missing.push("DOMESTIC_MONEYLINE_2WAY");
  }

  const overseasHome =
    oddsRow?.overseas?.selections.find((s) => s.selectionCode === "HOME")
      ?.odds ?? null;
  const overseasAway =
    oddsRow?.overseas?.selections.find((s) => s.selectionCode === "AWAY")
      ?.odds ?? null;
  const overseasMarketRuleStatus = oddsRow?.comparison.status ?? null;
  if (overseasMarketRuleStatus === "MARKET_RULE_UNVERIFIED") {
    warnings.push("OVERSEAS_MARKET_RULE_UNVERIFIED");
  }
  if (overseasHome == null || overseasAway == null) {
    missing.push("OVERSEAS_H2H");
  }

  const winnerSide = identityRow.result.winner ?? null;
  const domesticFavored = favoredSide(domesticHome, domesticAway);
  const overseasFavored = favoredSide(overseasHome, overseasAway);

  const homeTeam =
    identityRow.homeTeam.canonicalNameKo ??
    identityRow.homeTeam.providerName ??
    oddsRow?.homeTeam ??
    "";
  const awayTeam =
    identityRow.awayTeam.canonicalNameKo ??
    identityRow.awayTeam.providerName ??
    oddsRow?.awayTeam ??
    "";

  let winnerTeam: string | null = null;
  if (winnerSide === "HOME") winnerTeam = homeTeam;
  else if (winnerSide === "AWAY") winnerTeam = awayTeam;
  else if (winnerSide === "DRAW") winnerTeam = "DRAW";

  return {
    internalGameId: identityRow.internalGameId,
    providerGameId: identityRow.providerGameId,
    awayTeam,
    homeTeam,
    startTimeKst: identityRow.time.startTimeKst ?? oddsRow?.startTimeKst ?? "",
    finalStatus: identityRow.gameStatus ?? "UNKNOWN",
    awayScore: identityRow.result.awayScore ?? null,
    homeScore: identityRow.result.homeScore ?? null,
    winnerSide,
    winnerTeam,
    domesticOperatorMarketId: mlMarket?.operatorMarketId ?? null,
    domesticHomeOdds: domesticHome,
    domesticAwayOdds: domesticAway,
    domesticReviewStatus,
    domesticCapturedAt: operatorDoc.capturedAt,
    domesticEnteredAt: operatorDoc.enteredAt,
    domesticFavoredSide: domesticFavored,
    domesticDirectionMatchedResult: directionMatch(domesticFavored, winnerSide),
    overseasHomeOdds: overseasHome,
    overseasAwayOdds: overseasAway,
    overseasProvider: oddsRow?.overseas?.provider ?? null,
    overseasBookmakerPolicy: oddsRow?.overseas?.bookmakerPolicy ?? null,
    overseasCollectedAt: oddsRow?.overseas?.capturedAt ?? null,
    overseasMarketRuleStatus,
    overseasFavoredSide: overseasFavored,
    overseasDirectionMatchedResult: directionMatch(overseasFavored, winnerSide),
    domesticOverseasDirectionAgreement: directionAgreement(
      domesticFavored,
      overseasFavored,
    ),
    identityMappingStatus:
      identityRow.homeTeam.mappingStatus === "MATCHED" &&
      identityRow.awayTeam.mappingStatus === "MATCHED"
        ? "MATCHED"
        : "UNMATCHED",
    warnings,
    missing,
  };
}

export type BuildKboMarketResultFeedbackV1Args = {
  dateKst: string;
  generatedAt?: string;
  cwd?: string;
};

export type BuildKboMarketResultFeedbackV1Result = {
  document: KboMarketResultFeedbackDocument;
  identityImmutableHash: string;
};

export async function buildKboMarketResultFeedbackV1(
  args: BuildKboMarketResultFeedbackV1Args,
): Promise<BuildKboMarketResultFeedbackV1Result> {
  const cwd = args.cwd ?? process.cwd();
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const dateKst = args.dateKst;

  const identityPath = path.join(
    cwd,
    "data/research/kbo",
    `${dateKst}-schedule-result-identity-v1-api-baseball.json`,
  );
  const operatorPath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${dateKst}-operator-markets-v2.json`,
  );
  const oddsPath = path.join(
    cwd,
    "data/research/kbo",
    `${dateKst}-odds-comparison-v1.json`,
  );

  const identity = JSON.parse(
    await readFile(identityPath, "utf8"),
  ) as KboScheduleResultIdentityDocument;
  const operatorDoc = JSON.parse(
    await readFile(operatorPath, "utf8"),
  ) as KboOperatorMarketInputV2;
  const oddsDoc = JSON.parse(
    await readFile(oddsPath, "utf8"),
  ) as KboOddsComparisonDocument;

  const identityImmutableHash = computeKboIdentityImmutableHash(identity);

  const operatorByGameId = new Map(
    operatorDoc.games.map((g) => [g.internalGameId, g]),
  );
  const oddsByGameId = new Map(oddsDoc.rows.map((r) => [r.gameId, r]));

  const rows = identity.rows.map((identityRow) =>
    buildRow({
      identityRow,
      operatorGame: operatorByGameId.get(identityRow.internalGameId),
      operatorDoc,
      oddsRow: oddsByGameId.get(identityRow.internalGameId),
    }),
  );

  const finalGames = rows.filter((r) => r.finalStatus === "FINAL").length;
  const pendingGames = rows.filter(
    (r) => r.finalStatus !== "FINAL" && r.finalStatus !== "DRAW",
  ).length;
  const draws = rows.filter((r) => r.finalStatus === "DRAW").length;
  const domesticOddsAvailable = rows.filter(
    (r) => r.domesticHomeOdds != null && r.domesticAwayOdds != null,
  ).length;
  const overseasOddsAvailable = rows.filter(
    (r) => r.overseasHomeOdds != null && r.overseasAwayOdds != null,
  ).length;
  const bothOddsAvailable = rows.filter(
    (r) =>
      r.domesticHomeOdds != null &&
      r.domesticAwayOdds != null &&
      r.overseasHomeOdds != null &&
      r.overseasAwayOdds != null,
  ).length;

  const summary = {
    totalGames: rows.length,
    finalGames,
    pendingGames,
    draws,
    domesticOddsAvailable,
    overseasOddsAvailable,
    bothOddsAvailable,
    domesticDirectionMatched: rows.filter(
      (r) => r.domesticDirectionMatchedResult === "MATCHED",
    ).length,
    domesticDirectionNotMatched: rows.filter(
      (r) => r.domesticDirectionMatchedResult === "NOT_MATCHED",
    ).length,
    overseasDirectionMatched: rows.filter(
      (r) => r.overseasDirectionMatchedResult === "MATCHED",
    ).length,
    overseasDirectionNotMatched: rows.filter(
      (r) => r.overseasDirectionMatchedResult === "NOT_MATCHED",
    ).length,
    domesticOverseasDirectionAgreed: rows.filter(
      (r) => r.domesticOverseasDirectionAgreement === "AGREED",
    ).length,
    domesticOverseasDirectionConflicted: rows.filter(
      (r) => r.domesticOverseasDirectionAgreement === "CONFLICTED",
    ).length,
    observationStatus:
      rows.length < 10 ? ("INSUFFICIENT_SAMPLE" as const) : ("OBSERVATION_ONLY" as const),
  };

  const inputHashSha256 = sha256(
    stableStringify({
      identity: identity.meta.resultHashSha256,
      operator: sha256(await readFile(operatorPath, "utf8")),
      oddsComparison: oddsDoc.meta.resultHashSha256,
    }),
  );

  const documentWithoutResultHash: Omit<
    KboMarketResultFeedbackDocument,
    "meta"
  > & {
    meta: Omit<KboMarketResultFeedbackDocument["meta"], "resultHashSha256"> & {
      resultHashSha256: string;
    };
  } = {
    meta: {
      datasetId: KBO_MARKET_RESULT_FEEDBACK_DATASET_ID,
      schemaVersion: KBO_MARKET_RESULT_FEEDBACK_SCHEMA_VERSION,
      builderVersion: KBO_MARKET_RESULT_FEEDBACK_BUILDER_VERSION,
      dateKst,
      identityProvider: "API_BASEBALL" as const,
      generatedAt,
      researchOnly: true as const,
      legalStatus: "INTERNAL_RESEARCH_ONLY" as const,
      engineAdmission: "PROHIBITED" as const,
      inputHashSha256,
      resultHashSha256: "",
      notes: [
        "Post-game market observation only — no prediction, ROI, or edge inference.",
        "Domestic odds remain DRAFT — not promoted to VERIFIED.",
        "Overseas MARKET_RULE_UNVERIFIED — no performance or ROI calculation.",
        "Single-slate sample — OBSERVATION_ONLY / INSUFFICIENT_SAMPLE.",
      ],
    },
    identityValidation: {
      identityImmutableHash,
      status: "PASS" as const,
    },
    prediction: {
      predictionStatus: "NOT_IMPLEMENTED" as const,
      predictionGrade: "NOT_APPLICABLE" as const,
      worked: null,
      failed: null,
      confidence: null,
      edgeScore: null,
      learningImpact: "NONE" as const,
    },
    summary,
    pipelineReadiness: {
      scheduleResultIdentity: finalGames === rows.length ? "READY" : "PARTIAL",
      operatorMarket:
        domesticOddsAvailable === rows.length ? "PARTIAL" : "NOT_IMPLEMENTED",
      overseasOdds:
        overseasOddsAvailable === rows.length ? "PARTIAL" : "NOT_IMPLEMENTED",
      starter: "FUTURE_GATED",
      bullpen: "FUTURE_GATED",
      lineup: "FUTURE_GATED",
      injury: "FUTURE_GATED",
      weather: "FUTURE_GATED",
      travel: "FUTURE_GATED",
      prediction: "NOT_IMPLEMENTED",
      grade: "NOT_IMPLEMENTED",
      review: operatorDoc.reviewStatus === "DRAFT" ? "PARTIAL" : "READY",
      learning: "NOT_IMPLEMENTED",
    },
    rows,
  };

  const resultHashSha256 = sha256(
    stableStringify({
      ...documentWithoutResultHash,
      meta: { ...documentWithoutResultHash.meta, resultHashSha256: undefined },
    }),
  );

  const document: KboMarketResultFeedbackDocument = {
    ...documentWithoutResultHash,
    meta: {
      ...documentWithoutResultHash.meta,
      resultHashSha256,
    },
  };

  return { document, identityImmutableHash };
}
