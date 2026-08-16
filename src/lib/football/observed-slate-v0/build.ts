/**
 * Build Football Observed Slate v0 from sealed observation + fixture mapping.
 * Does not read Prediction. Does not mutate football-schedule-v1.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isCompetitionProfiled } from "../competition/profiles";
import type {
  FootballCompetitionAdmissionStatus,
  FootballCompetitionGapRowV0,
  FootballObservedMarketKind,
  FootballObservedMarketV0,
  FootballObservedSlateGameV0,
  FootballObservedSlateV0,
  FootballPregameEvidenceStatus,
  FootballResearchUsageEligibility,
  FootballSlatePredictionStatus,
  FootballSlateResearchStatus,
} from "./types";
import {
  FOOTBALL_OBSERVED_SLATE_V0_BUILDER,
  FOOTBALL_OBSERVED_SLATE_V0_SCHEMA,
} from "./types";

const OBS_REL =
  "data/operator-observations/structured/2026-08-16/batch-2207-football-manual-market-observation-v0.json";
const MAP_REL =
  "data/research/football/2026-08-16-manual-observation-fixture-mapping-v1.json";

type RawMarket = {
  rawMarketLabel?: unknown;
  line?: unknown;
  prices?: unknown;
};

type ObservationGame = {
  rowId?: unknown;
  rawLeagueLabel?: unknown;
  rawLeftTeam?: unknown;
  rawRightTeam?: unknown;
  displayedDateKst?: unknown;
  displayedStartKst?: unknown;
  cutoffStatus?: unknown;
  sourceScreenshotFile?: unknown;
  sourceScreenshotSha256?: unknown;
  markets?: unknown;
};

type MappingRow = {
  rowId?: unknown;
  fixtureId?: unknown;
  mappingStatus?: unknown;
  rawLeagueLabel?: unknown;
  rawLeftTeam?: unknown;
  rawRightTeam?: unknown;
  candidateLeftTeam?: unknown;
  candidateRightTeam?: unknown;
  providerLeagueId?: unknown;
  providerLeagueName?: unknown;
  providerHomeTeamId?: unknown;
  providerHomeTeamName?: unknown;
  providerAwayTeamId?: unknown;
  providerAwayTeamName?: unknown;
  displayedDateKst?: unknown;
  displayedStartKst?: unknown;
  providerKickoffUtc?: unknown;
  providerKickoffKst?: unknown;
  sourceScreenshotFile?: unknown;
  sourceScreenshotSha256?: unknown;
  cutoffStatus?: unknown;
  inScheduleArtifact?: unknown;
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function classifyMarket(label: string): FootballObservedMarketKind {
  const t = label.trim().toUpperCase();
  if (t === "1X2") return "ONE_X_TWO";
  if (t === "SUM") return "SUM_RAW_ONLY";
  if (t.startsWith("H")) return "HANDICAP";
  if (t.startsWith("U")) return "TOTALS";
  return "RAW_ONLY";
}

function copyPrices(raw: unknown): Array<number | null> {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => (typeof p === "number" && Number.isFinite(p) ? p : null));
}

function classifyGap(input: {
  providerCompetitionId: number;
  providerCompetitionName: string;
}): Pick<
  FootballCompetitionGapRowV0,
  | "matchFormat"
  | "potential1x2Compatibility"
  | "currentReasonUnregistered"
  | "registrationCandidateStatus"
> {
  const id = input.providerCompetitionId;
  if (id === 88) {
    return {
      matchFormat: "LEAGUE_MATCH",
      potential1x2Compatibility: "LIKELY",
      currentReasonUnregistered:
        "Not in football-competition-profile-v1. Eredivisie league 1X2 is structurally compatible but not registered.",
      registrationCandidateStatus: "CANDIDATE_FOR_RESEARCH_REGISTRATION",
    };
  }
  if (id === 103) {
    return {
      matchFormat: "LEAGUE_MATCH",
      potential1x2Compatibility: "LIKELY",
      currentReasonUnregistered:
        "Not in football-competition-profile-v1. Eliteserien league 1X2 is structurally compatible but not registered.",
      registrationCandidateStatus: "CANDIDATE_FOR_RESEARCH_REGISTRATION",
    };
  }
  if (id === 40) {
    return {
      matchFormat: "LEAGUE_MATCH",
      potential1x2Compatibility: "REVIEW",
      currentReasonUnregistered:
        "Not in football-competition-profile-v1. Raw label EFL챔 mapped to Championship; West Ham identity vs typical Premier League membership needs format/competition review.",
      registrationCandidateStatus: "FORMAT_REVIEW_REQUIRED",
    };
  }
  if (id === 24) {
    return {
      matchFormat: "CUP",
      potential1x2Compatibility: "REVIEW",
      currentReasonUnregistered:
        "Not in football-competition-profile-v1. International cup (ASEAN Championship).",
      registrationCandidateStatus: "FORMAT_REVIEW_REQUIRED",
    };
  }
  if (id === 528 || id === 526) {
    return {
      matchFormat: "CUP",
      potential1x2Compatibility: "REVIEW",
      currentReasonUnregistered:
        "Not in football-competition-profile-v1. One-off super cup / shield format.",
      registrationCandidateStatus: "FORMAT_REVIEW_REQUIRED",
    };
  }
  return {
    matchFormat: "UNKNOWN",
    potential1x2Compatibility: "REVIEW",
    currentReasonUnregistered: "Not in football-competition-profile-v1.",
    registrationCandidateStatus: "DO_NOT_REGISTER_YET",
  };
}

export function deriveSlateStatuses(input: {
  registered: boolean;
  cutoffBlocked: boolean;
}): {
  competitionAdmissionStatus: FootballCompetitionAdmissionStatus;
  pregameEvidenceStatus: FootballPregameEvidenceStatus;
  slatePredictionStatus: FootballSlatePredictionStatus;
  researchUsageEligibility: FootballResearchUsageEligibility;
  slateResearchStatus: FootballSlateResearchStatus;
} {
  const competitionAdmissionStatus: FootballCompetitionAdmissionStatus =
    input.registered ? "REGISTERED" : "UNREGISTERED";
  const pregameEvidenceStatus: FootballPregameEvidenceStatus = input.cutoffBlocked
    ? "CUTOFF_BLOCKED"
    : "ELIGIBLE";

  if (input.cutoffBlocked) {
    return {
      competitionAdmissionStatus,
      pregameEvidenceStatus,
      slatePredictionStatus: "NOT_PREGAME_ELIGIBLE",
      researchUsageEligibility: "NOT_PREGAME_ELIGIBLE",
      slateResearchStatus: "CUTOFF_BLOCKED",
    };
  }
  if (!input.registered) {
    return {
      competitionAdmissionStatus,
      pregameEvidenceStatus,
      slatePredictionStatus: "NOT_SUPPORTED_COMPETITION",
      researchUsageEligibility: "OBSERVED_UNSUPPORTED",
      slateResearchStatus: "PASS_UNSUPPORTED_COMPETITION",
    };
  }
  return {
    competitionAdmissionStatus,
    pregameEvidenceStatus,
    slatePredictionStatus: "NOT_EVALUATED",
    researchUsageEligibility: "FUTURE_RESEARCH_ELIGIBLE",
    slateResearchStatus: "OBSERVED_REGISTERED",
  };
}

export function assertObservedSlateIntegrity(doc: FootballObservedSlateV0): string[] {
  const errors: string[] = [];
  const s = doc.summary;
  if (s.observedGames !== 15) errors.push(`observedGames=${s.observedGames}`);
  if (s.fixtureMapped !== 15) errors.push(`fixtureMapped=${s.fixtureMapped}`);
  if (s.marketRows !== 60) errors.push(`marketRows=${s.marketRows}`);
  if (s.registeredCompetition !== 6) {
    errors.push(`registeredCompetition=${s.registeredCompetition}`);
  }
  if (s.unregisteredCompetition !== 9) {
    errors.push(`unregisteredCompetition=${s.unregisteredCompetition}`);
  }
  if (s.pregameEligible !== 14) errors.push(`pregameEligible=${s.pregameEligible}`);
  if (s.cutoffBlocked !== 1) errors.push(`cutoffBlocked=${s.cutoffBlocked}`);
  if (s.droppedFromObservedSlate !== 0) {
    errors.push(`droppedFromObservedSlate=${s.droppedFromObservedSlate}`);
  }
  if (s.observedGames !== s.registeredCompetition + s.unregisteredCompetition) {
    errors.push("observedGames !== registered + unregistered");
  }
  const ids = doc.games.map((g) => g.fixtureId);
  if (ids.some((id) => !Number.isFinite(id))) errors.push("missing fixtureId");
  if (new Set(ids).size !== ids.length) errors.push("duplicate fixtureId");
  if (new Set(doc.games.map((g) => g.rowId)).size !== doc.games.length) {
    errors.push("duplicate rowId");
  }
  return errors;
}

export async function buildFootballObservedSlateV0(input: {
  cwd?: string;
  generatedAt?: string;
}): Promise<FootballObservedSlateV0> {
  const cwd = input.cwd ?? process.cwd();
  const obsAbs = path.join(cwd, OBS_REL);
  const mapAbs = path.join(cwd, MAP_REL);
  const obsText = await readFile(obsAbs, "utf8");
  const mapText = await readFile(mapAbs, "utf8");
  const obs = asRecord(JSON.parse(obsText));
  const map = asRecord(JSON.parse(mapText));
  if (!obs || !map) throw new Error("OBSERVED_SLATE_SOURCE_INVALID");

  const obsGames = Array.isArray(obs.games) ? (obs.games as ObservationGame[]) : [];
  const mapRows = Array.isArray(map.rows) ? (map.rows as MappingRow[]) : [];
  const byRow = new Map<number, MappingRow>();
  for (const row of mapRows) {
    const id = asNumber(row.rowId);
    if (id == null) throw new Error("MAPPING_ROW_ID_MISSING");
    if (byRow.has(id)) throw new Error(`DUPLICATE_MAPPING_ROW:${id}`);
    byRow.set(id, row);
  }

  const games: FootballObservedSlateGameV0[] = [];
  for (const game of obsGames) {
    const rowId = asNumber(game.rowId);
    if (rowId == null) throw new Error("OBS_ROW_ID_MISSING");
    const mapped = byRow.get(rowId);
    if (!mapped) throw new Error(`MAPPING_MISSING_ROW:${rowId}`);
    const fixtureId = asNumber(mapped.fixtureId);
    if (fixtureId == null) throw new Error(`FIXTURE_ID_MISSING:${rowId}`);

    const leagueId = asNumber(mapped.providerLeagueId);
    if (leagueId == null) throw new Error(`PROVIDER_LEAGUE_MISSING:${rowId}`);
    const registered =
      mapped.inScheduleArtifact === true &&
      isCompetitionProfiled("api-football", String(leagueId));
    const cutoffBlocked = asString(game.cutoffStatus) === "NOT_PREGAME_ELIGIBLE";
    const statuses = deriveSlateStatuses({ registered, cutoffBlocked });

    const rawMarkets = Array.isArray(game.markets)
      ? (game.markets as RawMarket[])
      : [];
    const markets: FootballObservedMarketV0[] = rawMarkets.map((m) => {
      const label = asString(m.rawMarketLabel) ?? "";
      const kind = classifyMarket(label);
      return {
        rawMarketLabel: label,
        marketKind: kind,
        line: asNumber(m.line),
        prices: copyPrices(m.prices),
        oneX2Joined: kind === "ONE_X_TWO",
      };
    });

    games.push({
      rowId,
      fixtureId,
      observationStatus: "OBSERVED",
      fixtureIdentityStatus: "MATCHED",
      ...statuses,
      cutoffStatus: asString(game.cutoffStatus) ?? "",
      rawLeagueLabel: asString(game.rawLeagueLabel) ?? "",
      providerCompetitionId: leagueId,
      providerCompetitionName: asString(mapped.providerLeagueName) ?? "",
      rawLeftTeam: asString(game.rawLeftTeam) ?? "",
      rawRightTeam: asString(game.rawRightTeam) ?? "",
      candidateLeftTeam: asString(mapped.candidateLeftTeam) ?? "",
      candidateRightTeam: asString(mapped.candidateRightTeam) ?? "",
      providerHomeTeamId: asNumber(mapped.providerHomeTeamId),
      providerHomeTeamName: asString(mapped.providerHomeTeamName),
      providerAwayTeamId: asNumber(mapped.providerAwayTeamId),
      providerAwayTeamName: asString(mapped.providerAwayTeamName),
      displayedDateKst: asString(game.displayedDateKst) ?? "",
      displayedStartKst: asString(game.displayedStartKst) ?? "",
      providerKickoffUtc: asString(mapped.providerKickoffUtc),
      providerKickoffKst: asString(mapped.providerKickoffKst),
      sourceScreenshotFile: asString(game.sourceScreenshotFile) ?? "",
      sourceScreenshotSha256: asString(game.sourceScreenshotSha256) ?? "",
      inScheduleArtifact: mapped.inScheduleArtifact === true,
      markets,
    });
  }

  const unregisteredGames = games.filter(
    (g) => g.competitionAdmissionStatus === "UNREGISTERED",
  );
  const gapMap = new Map<number, FootballCompetitionGapRowV0>();
  for (const g of unregisteredGames) {
    const existing = gapMap.get(g.providerCompetitionId);
    if (existing) {
      existing.observedFixtureCount += 1;
      if (!existing.rawLeagueLabels.includes(g.rawLeagueLabel)) {
        existing.rawLeagueLabels.push(g.rawLeagueLabel);
      }
      continue;
    }
    gapMap.set(g.providerCompetitionId, {
      providerCompetitionId: g.providerCompetitionId,
      providerCompetitionName: g.providerCompetitionName,
      rawLeagueLabels: [g.rawLeagueLabel],
      observedFixtureCount: 1,
      marketObservationPresent: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      ...classifyGap({
        providerCompetitionId: g.providerCompetitionId,
        providerCompetitionName: g.providerCompetitionName,
      }),
    });
  }

  const oneX2 = games.flatMap((g) =>
    g.markets
      .filter((m) => m.oneX2Joined)
      .map((m) => ({ game: g, market: m })),
  );

  const document: FootballObservedSlateV0 = {
    schemaVersion: FOOTBALL_OBSERVED_SLATE_V0_SCHEMA,
    builderVersion: FOOTBALL_OBSERVED_SLATE_V0_BUILDER,
    batchId: asString(obs.batchId) ?? asString(map.batchId) ?? "2026-08-16/batch-2207",
    dateKst: "2026-08-16",
    sourceObservationPath: OBS_REL,
    sourceObservationHash: sha256Text(obsText),
    sourceMappingPath: MAP_REL,
    sourceMappingHash: sha256Text(mapText),
    receivedAtKst:
      asString(obs.receivedAtKst) ?? "2026-08-16T22:07:00+09:00",
    captureTime: obs.captureTime ?? "UNKNOWN",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    autoApply: false,
    resultDataUsed: false,
    doesNotReplaceScheduleV1: true,
    scheduleFilterUnchanged: true,
    note:
      "Research overlay. football-schedule-v1 still drops unregistered competitions. Observed/Scheduled is separated from Prediction Eligible. No Engine admission.",
    passSchemaAudit: {
      existingSnapshotHasPassUnsupportedCompetition: false,
      overlayUsesPassUnsupportedCompetition: true,
      enginePickSchemaChanged: false,
    },
    summary: {
      observedGames: games.length,
      fixtureMapped: games.filter((g) => Number.isFinite(g.fixtureId)).length,
      registeredCompetition: games.filter(
        (g) => g.competitionAdmissionStatus === "REGISTERED",
      ).length,
      unregisteredCompetition: unregisteredGames.length,
      pregameEligible: games.filter(
        (g) => g.pregameEvidenceStatus === "ELIGIBLE",
      ).length,
      cutoffBlocked: games.filter(
        (g) => g.pregameEvidenceStatus === "CUTOFF_BLOCKED",
      ).length,
      droppedFromObservedSlate: 0,
      marketRows: games.reduce((n, g) => n + g.markets.length, 0),
      oneX2Observations: oneX2.length,
      oneX2Joined: oneX2.length,
      oneX2RegisteredEligible: oneX2.filter(
        (x) => x.game.researchUsageEligibility === "FUTURE_RESEARCH_ELIGIBLE",
      ).length,
      oneX2UnsupportedObserved: oneX2.filter(
        (x) => x.game.researchUsageEligibility === "OBSERVED_UNSUPPORTED",
      ).length,
      oneX2CutoffBlocked: oneX2.filter(
        (x) => x.game.researchUsageEligibility === "NOT_PREGAME_ELIGIBLE",
      ).length,
    },
    competitionGap: [...gapMap.values()].sort(
      (a, b) => a.providerCompetitionId - b.providerCompetitionId,
    ),
    games,
  };

  const errors = assertObservedSlateIntegrity(document);
  if (errors.length) {
    throw new Error(`OBSERVED_SLATE_INTEGRITY:\n- ${errors.join("\n- ")}`);
  }
  return document;
}
