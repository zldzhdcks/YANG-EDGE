/**
 * Read-only joins for research-scorecard-v1.
 * Schedule is the spine. Never mutates source artifacts.
 */
import { resolveSelectedPickProbability } from "@/lib/mlb/daily-picks-v1/resolve-selected-pick-probability";
import { asNumber, asRecord, asString, normTeam } from "@/lib/mlb/mlb-review-utils";
import { readOptionalJsonObject } from "./read-json";
import {
  mlbExpectedLineupRel,
  mlbFailureReviewRel,
  mlbGradedRel,
  mlbKoreanRel,
  mlbOddsRel,
  mlbOfficialResultsRel,
  mlbPredictionRel,
  mlbProviderLineupRel,
  mlbRecommendationRel,
  mlbScheduleRel,
  mlbStarterRel,
  mlbSuccessReviewRel,
} from "./paths";
import { classifyObservationTiming, isPostPredictionPregame } from "./timing";
import type {
  FavoriteSide,
  MlbResearchScorecardRowV1,
  ModelVsKoreanMarket,
  ResultStatus,
  StarterAvailability,
} from "./types";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function teamsMatch(
  aHome: string | null,
  aAway: string | null,
  bHome: string,
  bAway: string,
): boolean {
  if (!aHome || !aAway) return false;
  return normTeam(aHome) === normTeam(bHome) && normTeam(aAway) === normTeam(bAway);
}

function favoriteFromDecimalOdds(
  homeOdds: number | null,
  awayOdds: number | null,
): FavoriteSide {
  if (homeOdds == null || awayOdds == null) return "NO_FAVORITE";
  if (homeOdds === awayOdds) return "TIE";
  return homeOdds < awayOdds ? "HOME" : "AWAY";
}

function teamForSide(
  side: FavoriteSide | "HOME" | "AWAY" | null,
  homeTeam: string,
  awayTeam: string,
): string | null {
  if (side === "HOME") return homeTeam;
  if (side === "AWAY") return awayTeam;
  return null;
}

function providerFavoriteFromOddsRow(
  row: Record<string, unknown> | null,
): FavoriteSide {
  if (!row) return "NO_FAVORITE";
  const markets = asArr(row.markets);
  let homeDec: number | null = null;
  let awayDec: number | null = null;
  for (const m of markets) {
    const rec = asRecord(m);
    if (!rec) continue;
    if (asString(rec.marketType) !== "moneyline") continue;
    if (asString(rec.status) !== "COLLECTED") continue;
    const sel = asString(rec.selection);
    const dec = asNumber(rec.priceDecimal);
    if (sel === "home") homeDec = dec;
    if (sel === "away") awayDec = dec;
  }
  const fromPrices = favoriteFromDecimalOdds(homeDec, awayDec);
  if (fromPrices !== "NO_FAVORITE") return fromPrices;
  const mktPct = asNumber(row.marketProbability);
  if (mktPct == null) return "NO_FAVORITE";
  if (mktPct > 50) return "HOME";
  if (mktPct < 50) return "AWAY";
  return "TIE";
}

function starterBucket(
  homeStatus: string | null,
  awayStatus: string | null,
): StarterAvailability {
  const homeOk = homeStatus === "PROBABLE_ONLY";
  const awayOk = awayStatus === "PROBABLE_ONLY";
  if (homeOk && awayOk) return "BOTH_AVAILABLE";
  if (homeOk || awayOk) return "PARTIAL";
  return "MISSING";
}

export async function joinMlbResearchScorecardRows(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  rows: MlbResearchScorecardRowV1[];
  predictionGeneratedAt: string | null;
}> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;

  const schedule = await readOptionalJsonObject(cwd, mlbScheduleRel(dateKst));
  if (!schedule) {
    throw new Error(`SCHEDULE_MISSING: ${mlbScheduleRel(dateKst)}`);
  }
  if (!Array.isArray(schedule.games)) {
    throw new Error(`SCHEDULE_ARTIFACT_INVALID: ${mlbScheduleRel(dateKst)}`);
  }

  const prediction = await readOptionalJsonObject(cwd, mlbPredictionRel(dateKst));
  const rec = await readOptionalJsonObject(cwd, mlbRecommendationRel(dateKst));
  const starter = await readOptionalJsonObject(cwd, mlbStarterRel(dateKst));
  const odds = await readOptionalJsonObject(cwd, mlbOddsRel(dateKst));
  const lineup = await readOptionalJsonObject(cwd, mlbProviderLineupRel(dateKst));
  const korean = await readOptionalJsonObject(cwd, mlbKoreanRel(dateKst));
  const expected = await readOptionalJsonObject(
    cwd,
    mlbExpectedLineupRel(dateKst),
  );
  const results = await readOptionalJsonObject(
    cwd,
    mlbOfficialResultsRel(dateKst),
  );
  const graded = await readOptionalJsonObject(cwd, mlbGradedRel(dateKst));
  const success = await readOptionalJsonObject(
    cwd,
    mlbSuccessReviewRel(dateKst),
  );
  const failure = await readOptionalJsonObject(
    cwd,
    mlbFailureReviewRel(dateKst),
  );

  const predictionGeneratedAt =
    asString(asRecord(prediction?.meta)?.generatedAt) ??
    asString(prediction?.generatedAt);

  const predById = new Map<string, Record<string, unknown>>();
  for (const raw of asArr(prediction?.predictions)) {
    const p = asRecord(raw);
    const id = asString(p?.gameId);
    if (p && id) predById.set(id, p);
  }

  const recByPk = new Map<number, Record<string, unknown>>();
  const recSealed = rec != null && asString(rec.sourceType) === "ENGINE_SNAPSHOT";
  for (const raw of asArr(rec?.picks)) {
    const p = asRecord(raw);
    const pk = asNumber(p?.gamePk);
    if (p && pk != null) recByPk.set(pk, p);
  }

  const starterByPk = new Map<
    number,
    { home: Record<string, unknown> | null; away: Record<string, unknown> | null }
  >();
  for (const raw of asArr(starter?.rows)) {
    const r = asRecord(raw);
    const pk = asNumber(r?.gamePk);
    if (!r || pk == null) continue;
    const slot = starterByPk.get(pk) ?? { home: null, away: null };
    const side = asString(r.side);
    if (side === "home") slot.home = r;
    if (side === "away") slot.away = r;
    starterByPk.set(pk, slot);
  }

  const oddsById = new Map<string, Record<string, unknown>>();
  for (const raw of asArr(odds?.rows)) {
    const r = asRecord(raw);
    const id = asString(r?.gameId) ?? asString(r?.internalGameId);
    if (r && id) oddsById.set(id, r);
  }

  const lineupStatusByPk = new Map<number, string>();
  for (const raw of asArr(lineup?.rows)) {
    const r = asRecord(raw);
    const pk = asNumber(r?.gamePk);
    if (!r || pk == null) continue;
    const status = asString(r.collectionStatus) ?? "NOT_COLLECTED";
    const prev = lineupStatusByPk.get(pk);
    if (!prev) {
      lineupStatusByPk.set(pk, status);
      continue;
    }
    if (prev !== status) lineupStatusByPk.set(pk, "PARTIAL");
  }

  const koreanByPk = new Map<number, Record<string, unknown>>();
  for (const raw of asArr(korean?.games)) {
    const g = asRecord(raw);
    const pk = asNumber(g?.gamePk);
    if (g && pk != null) koreanByPk.set(pk, g);
  }

  const expectedByPk = new Map<number, Record<string, unknown>>();
  for (const raw of asArr(expected?.games)) {
    const g = asRecord(raw);
    const pk = asNumber(g?.gamePk);
    if (g && pk != null) expectedByPk.set(pk, g);
  }

  const resultByPk = new Map<number, Record<string, unknown>>();
  for (const raw of asArr(results?.games)) {
    const g = asRecord(raw);
    const pk = asNumber(g?.gamePk);
    if (g && pk != null) resultByPk.set(pk, g);
  }

  const gradedById = new Map<string, Record<string, unknown>>();
  const gradedByPk = new Map<number, Record<string, unknown>>();
  for (const raw of asArr(graded?.games)) {
    const g = asRecord(raw);
    if (!g) continue;
    const id = asString(g.gameId);
    const pk = asNumber(g.gamePk);
    if (id) gradedById.set(id, g);
    if (pk != null) gradedByPk.set(pk, g);
  }

  const successPks = new Set<number>();
  const failurePks = new Set<number>();
  for (const raw of asArr(success?.games)) {
    const pk = asNumber(asRecord(raw)?.gamePk);
    if (pk != null) successPks.add(pk);
  }
  for (const raw of asArr(failure?.games)) {
    const pk = asNumber(asRecord(raw)?.gamePk);
    if (pk != null) failurePks.add(pk);
  }
  for (const pk of successPks) {
    if (failurePks.has(pk)) {
      throw new Error(
        `REVIEW_SUCCESS_FAILURE_OVERLAP: gamePk=${pk} dateKst=${dateKst}`,
      );
    }
  }

  const tagsByPk = new Map<number, string[]>();
  for (const raw of [...asArr(failure?.games), ...asArr(success?.games)]) {
    const g = asRecord(raw);
    const pk = asNumber(g?.gamePk);
    if (!g || pk == null) continue;
    const cats = [
      ...asArr(g.failureCategories),
      ...asArr(g.successCategories),
    ]
      .map((c) => asString(c))
      .filter((c): c is string => Boolean(c));
    if (cats.length) tagsByPk.set(pk, [...new Set(cats)]);
  }

  const koreanDocObservedAt = asString(korean?.observedAt);
  const expectedDocObservedAt = asString(expected?.observedAt);

  const rows: MlbResearchScorecardRowV1[] = [];

  for (const rawGame of asArr(schedule.games)) {
    const g = asRecord(rawGame);
    if (!g) continue;
    const gamePk = asNumber(g.gamePk);
    const internalGameId = asString(g.internalGameId);
    const awayTeam = asString(g.awayTeam);
    const homeTeam = asString(g.homeTeam);
    if (gamePk == null || !internalGameId || !awayTeam || !homeTeam) {
      throw new Error("SCHEDULE_ROW_IDENTITY_INVALID");
    }

    const pred = predById.get(internalGameId) ?? null;
    const resolved = pred ? resolveSelectedPickProbability(pred) : null;
    const selectedPickSide = resolved?.pickSide ?? null;
    const selectedPick =
      selectedPickSide === "HOME"
        ? homeTeam
        : selectedPickSide === "AWAY"
          ? awayTeam
          : asString(pred?.baselinePick);
    const inputStatus = asString(pred?.inputStatus);
    const officialStatus = asString(pred?.officialStatus);
    const baselineStatus = asString(pred?.baselineStatus);
    let predictionStatus: string | null = null;
    if (!pred) predictionStatus = "MISSING";
    else if (inputStatus === "BLOCKED" || officialStatus === "BLOCKED") {
      predictionStatus = "BLOCKED";
    } else {
      predictionStatus = baselineStatus ?? inputStatus;
    }

    const recPick = recByPk.get(gamePk) ?? null;
    if (recPick) {
      const recGameId = asString(recPick.gameId);
      if (recGameId && recGameId !== internalGameId) {
        throw new Error(
          `RECOMMENDATION_GAMEID_MISMATCH pk=${gamePk} rec=${recGameId} schedule=${internalGameId}`,
        );
      }
    }
    const recTier = asString(recPick?.tier);
    const isGoodPick = recTier === "GOOD";

    const oddsRow = oddsById.get(internalGameId) ?? null;
    const providerFav = providerFavoriteFromOddsRow(oddsRow);
    const providerMarketAvailable =
      oddsRow != null &&
      providerFav !== "NO_FAVORITE" &&
      asString(oddsRow.collectionStatus) !== "NOT_COLLECTED";

    const kRaw = koreanByPk.get(gamePk) ?? null;
    const kIdOk =
      kRaw != null &&
      asString(kRaw.internalGameId) === internalGameId &&
      teamsMatch(
        asString(kRaw.homeTeam),
        asString(kRaw.awayTeam),
        homeTeam,
        awayTeam,
      ) &&
      asString(kRaw.joinStatus) === "MATCHED";
    const koreanObs = kIdOk ? kRaw : null;
    const koreanFav = koreanObs
      ? favoriteFromDecimalOdds(
          asNumber(koreanObs.homeOdds),
          asNumber(koreanObs.awayOdds),
        )
      : null;
    const firstPitchAt =
      asString(koreanObs?.firstPitchAt) ??
      asString(g.commenceTimeUtc) ??
      asString(g.scheduledStartTime);
    const koreanTiming = koreanObs
      ? classifyObservationTiming({
          predictionGeneratedAt,
          observedAt:
            asString(koreanObs.observedAt) ?? koreanDocObservedAt,
          firstPitchAt,
        })
      : null;

    let modelVsKorean: ModelVsKoreanMarket = "NO_KOREAN_OBSERVATION";
    if (!koreanObs || koreanFav == null) {
      modelVsKorean = "NO_KOREAN_OBSERVATION";
    } else if (
      !selectedPickSide ||
      koreanFav === "TIE" ||
      koreanFav === "NO_FAVORITE"
    ) {
      modelVsKorean = "AMBIGUOUS";
    } else if (koreanFav === selectedPickSide) {
      modelVsKorean = "ALIGNED";
    } else {
      modelVsKorean = "CONFLICT";
    }

    const st = starterByPk.get(gamePk);
    const starterHomeStatus = asString(st?.home?.probableStatus);
    const starterAwayStatus = asString(st?.away?.probableStatus);

    const eRaw = expectedByPk.get(gamePk) ?? null;
    const eIdOk =
      eRaw != null &&
      asString(eRaw.internalGameId) === internalGameId &&
      teamsMatch(
        asString(eRaw.homeTeam),
        asString(eRaw.awayTeam),
        homeTeam,
        awayTeam,
      );
    const expectedGame = eIdOk ? eRaw : null;
    let expectedObsStatus: "OBSERVED" | "NOT_OBSERVED" = "NOT_OBSERVED";
    if (expectedGame) {
      const declared = asString(expectedGame.observationStatus);
      if (declared === "OBSERVED" || declared === "NOT_OBSERVED") {
        expectedObsStatus = declared;
      } else if (
        asArr(expectedGame.awayLineup).length === 9 &&
        asArr(expectedGame.homeLineup).length === 9
      ) {
        expectedObsStatus = "OBSERVED";
      }
    }
    const expectedTiming =
      expectedObsStatus === "OBSERVED"
        ? classifyObservationTiming({
            predictionGeneratedAt,
            observedAt:
              asString(expectedGame?.observedAt) ?? expectedDocObservedAt,
            firstPitchAt:
              asString(expectedGame?.firstPitchAt) ?? firstPitchAt,
          })
        : null;

    const result = resultByPk.get(gamePk) ?? null;
    let resultStatus: ResultStatus = "AWAITING";
    let actualWinnerSide: "HOME" | "AWAY" | "DRAW" | null = null;
    if (result) {
      const stRes = asString(result.status);
      const winnerRaw = asString(result.winner);
      if (stRes === "FINAL") {
        if (
          winnerRaw !== "HOME" &&
          winnerRaw !== "AWAY" &&
          winnerRaw !== "DRAW"
        ) {
          throw new Error(
            `FINAL_RESULT_WINNER_MISSING: gamePk=${gamePk} dateKst=${dateKst}`,
          );
        }
        resultStatus = "FINAL";
        actualWinnerSide = winnerRaw;
      } else {
        if (winnerRaw != null) {
          throw new Error(
            `NONFINAL_RESULT_HAS_WINNER: gamePk=${gamePk} status=${stRes ?? "null"} dateKst=${dateKst}`,
          );
        }
        if (
          stRes === "POSTPONED" ||
          stRes === "CANCELLED" ||
          stRes === "SUSPENDED" ||
          stRes === "UNKNOWN"
        ) {
          resultStatus = "OTHER";
        } else {
          resultStatus = "AWAITING";
        }
        actualWinnerSide = null;
      }
    }

    const gr = gradedByPk.get(gamePk) ?? gradedById.get(internalGameId) ?? null;
    const rawGrade = asString(gr?.grade);
    const outcomeGrade =
      rawGrade === "CORRECT" || rawGrade === "INCORRECT" ? rawGrade : null;
    if (resultStatus !== "FINAL" && outcomeGrade != null) {
      throw new Error(
        `GRADE_WITHOUT_FINAL_RESULT: gamePk=${gamePk} grade=${outcomeGrade} resultStatus=${resultStatus} dateKst=${dateKst}`,
      );
    }
    const predictionGrade = resultStatus === "FINAL" ? rawGrade : null;
    let predictionCorrect: boolean | null = null;
    if (resultStatus === "FINAL") {
      if (predictionGrade === "CORRECT") predictionCorrect = true;
      else if (predictionGrade === "INCORRECT") predictionCorrect = false;
    }

    rows.push({
      dateKst,
      gamePk,
      internalGameId,
      awayTeam,
      homeTeam,
      predictionAvailable: pred != null,
      predictionStatus,
      selectedPick,
      selectedPickSide,
      selectedPickProbability: resolved?.selectedPickProbabilityPercent ?? null,
      selectedPickProbabilitySource: resolved?.source ?? null,
      inputStatus,
      inputConfidence: asNumber(pred?.confidence),
      researchOnly:
        typeof pred?.researchOnly === "boolean" ? pred.researchOnly : null,
      officialPick: asString(pred?.officialPick),
      recommendationAvailable: recPick != null,
      recommendationTier: recTier,
      recommendationResearchOnly:
        typeof recPick?.researchOnly === "boolean"
          ? recPick.researchOnly
          : recPick != null
            ? true
            : null,
      recommendationSealed: recSealed,
      isGoodPick,
      providerMarketAvailable,
      providerMarketFavoriteSide: providerMarketAvailable ? providerFav : null,
      providerMarketFavoriteTeam: providerMarketAvailable
        ? teamForSide(providerFav, homeTeam, awayTeam)
        : null,
      koreanMarketObservationStatus: koreanObs
        ? "OBSERVED"
        : "NO_KOREAN_OBSERVATION",
      koreanMarketFavoriteSide: koreanFav,
      koreanMarketFavoriteTeam: teamForSide(koreanFav, homeTeam, awayTeam),
      koreanMarketTimingRelativeToPrediction: koreanTiming,
      modelVsKoreanMarket: modelVsKorean,
      starterAvailability: starterBucket(starterHomeStatus, starterAwayStatus),
      starterHomeStatus,
      starterAwayStatus,
      providerLineupStatus: lineupStatusByPk.get(gamePk) ?? null,
      expectedLineupObservationStatus: expectedObsStatus,
      expectedLineupStatus:
        expectedObsStatus === "OBSERVED" ? "EXPECTED" : null,
      expectedLineupTimingRelativeToPrediction: expectedTiming,
      expectedLineupPostPredictionPregameObservation:
        isPostPredictionPregame(expectedTiming),
      expectedLineupUsedByPrediction: false,
      resultStatus,
      actualWinnerSide,
      predictionGrade,
      predictionCorrect,
      reviewTags: tagsByPk.get(gamePk) ?? [],
      reviewTagDataClass: "POSTGAME_REVIEW_TAG",
    });
  }

  rows.sort((a, b) => a.gamePk - b.gamePk);
  return { rows, predictionGeneratedAt };
}
