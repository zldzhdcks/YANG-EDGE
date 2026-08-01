/**
 * Schedule-first identity mapping for Proto OCR candidates.
 */
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import type { ProtoOcrCandidate, ProtoOcrMappingStatus, KboProtoOcrDraftRow } from "./types";
import { computeProtoOcrConfidence } from "./confidence";
import { randomUUID } from "node:crypto";

export type ScheduleGameRow = {
  gameId: string;
  home: string;
  away: string;
  scheduledStartTime: string;
  providerGameId?: string | null;
};

function canon(name: string | null | undefined): string | null {
  if (!name) return null;
  const r = resolveKboTeamIdentity(name);
  return r.mappingStatus === "MATCHED" ? r.canonicalNameKo : null;
}

function teamId(name: string | null): string | null {
  if (!name) return null;
  const r = resolveKboTeamIdentity(name);
  return r.canonicalTeamId;
}

/**
 * Map OCR screenshot order onto Schedule home/away (SoT).
 * Prices follow the team they were associated with on screen.
 */
export function mapCandidateToSchedule(
  candidate: ProtoOcrCandidate,
  scheduleGames: ScheduleGameRow[],
  ocrRunId: string,
): KboProtoOcrDraftRow {
  const warnings = [...candidate.parserWarnings];
  const errors: string[] = [];

  const firstCanon = canon(candidate.screenshotFirstTeam);
  const secondCanon = canon(candidate.screenshotSecondTeam);

  let mappingStatus: ProtoOcrMappingStatus = "UNMAPPED";
  let gameId: string | null = null;
  let resolvedAway: string | null = null;
  let resolvedHome: string | null = null;
  let awayPrice: number | null = null;
  let homePrice: number | null = null;

  if (!firstCanon || !secondCanon) {
    mappingStatus = "UNKNOWN_TEAM";
    errors.push("UNKNOWN_TEAM");
  } else {
    const matches = scheduleGames.filter((g) => {
      const h = canon(g.home);
      const a = canon(g.away);
      return (
        (h === firstCanon && a === secondCanon) ||
        (h === secondCanon && a === firstCanon)
      );
    });

    if (matches.length === 0) {
      mappingStatus = "GAME_NOT_IN_SCHEDULE";
      errors.push("GAME_NOT_IN_SCHEDULE");
    } else if (matches.length > 1) {
      mappingStatus = "AMBIGUOUS";
      errors.push("DOUBLEHEADER_AMBIGUOUS");
      warnings.push("AMBIGUOUS_DOUBLEHEADER");
    } else {
      const g = matches[0]!;
      gameId = g.gameId;
      resolvedHome = canon(g.home);
      resolvedAway = canon(g.away);

      const firstIsAway = firstCanon === resolvedAway;
      const firstIsHome = firstCanon === resolvedHome;
      const secondIsAway = secondCanon === resolvedAway;
      const secondIsHome = secondCanon === resolvedHome;

      if (!(firstIsAway || firstIsHome) || !(secondIsAway || secondIsHome)) {
        mappingStatus = "DIRECTION_MISMATCH";
        errors.push("DIRECTION_MISMATCH");
      } else {
        // Assign prices by screenshot team association
        const priceForFirst = candidate.awayPriceCandidate; // parser stored first→awayPriceCandidate slot
        const priceForSecond = candidate.homePriceCandidate;
        // Re-read: parser puts screenshot first into awayTeamText/awayPriceCandidate
        const pFirst = candidate.awayPriceCandidate;
        const pSecond = candidate.homePriceCandidate;

        if (firstIsAway && secondIsHome) {
          awayPrice = pFirst;
          homePrice = pSecond;
          mappingStatus =
            resolveKboTeamIdentity(candidate.screenshotFirstTeam!).mappingStatus ===
              "MATCHED" &&
            candidate.screenshotFirstTeam !== firstCanon
              ? "MATCHED_ALIAS"
              : "MATCHED_EXACT";
        } else if (firstIsHome && secondIsAway) {
          homePrice = pFirst;
          awayPrice = pSecond;
          mappingStatus = "MATCHED_ALIAS";
          warnings.push("SCREENSHOT_ORDER_REVERSED_VS_SCHEDULE");
        } else {
          mappingStatus = "DIRECTION_MISMATCH";
          errors.push("DIRECTION_MISMATCH");
        }
      }
    }
  }

  if (awayPrice == null || homePrice == null) {
    if (!errors.includes("INVALID_PRICE") && candidate.parserStatus !== "PARSED") {
      warnings.push("MISSING_PRICE");
    }
  }

  const confidence = computeProtoOcrConfidence({
    textRecognitionConfidence: candidate.parserStatus === "PARSED" ? 0.9 : 0.5,
    teamResolved: Boolean(firstCanon && secondCanon),
    pricesResolved: awayPrice != null && homePrice != null,
    scheduleMatched:
      mappingStatus === "MATCHED_EXACT" || mappingStatus === "MATCHED_ALIAS",
    ambiguous: mappingStatus === "AMBIGUOUS",
    directionMismatch: mappingStatus === "DIRECTION_MISMATCH",
    invalidPrice:
      (candidate.awayPriceCandidate != null && candidate.awayPriceCandidate <= 1) ||
      (candidate.homePriceCandidate != null && candidate.homePriceCandidate <= 1),
    parserWarnings: candidate.parserWarnings,
    mappingStatus,
  });

  return {
    draftRowId: `row-${randomUUID()}`,
    ocrRunId,
    sourceImageIds: [candidate.sourceImageId],
    rawTeamTexts: [
      candidate.screenshotFirstTeam,
      candidate.screenshotSecondTeam,
    ].filter(Boolean) as string[],
    rawPriceTexts: [candidate.awayPriceText, candidate.homePriceText].filter(
      Boolean,
    ) as string[],
    screenshotFirstTeam: candidate.screenshotFirstTeam,
    screenshotSecondTeam: candidate.screenshotSecondTeam,
    resolvedAwayTeam: resolvedAway,
    resolvedHomeTeam: resolvedHome,
    gameId,
    awayTeamId: teamId(resolvedAway),
    homeTeamId: teamId(resolvedHome),
    awayPrice,
    homePrice,
    mappingStatus,
    parserStatus: candidate.parserStatus,
    confidence,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    adminDecision: "PENDING",
    adminCorrections: [],
    displayOrder: "CANONICAL",
  };
}

export function mapAllCandidates(
  candidates: ProtoOcrCandidate[],
  scheduleGames: ScheduleGameRow[],
  ocrRunId: string,
): KboProtoOcrDraftRow[] {
  return candidates.map((c) => mapCandidateToSchedule(c, scheduleGames, ocrRunId));
}
