/**
 * Seed 2026-08-13 MLB Manual Pregame Observations (Korean Market + Expected Lineup).
 *
 *   npx tsx scripts/seed-mlb-2026-08-13-manual-pregame-observations-v0.ts
 *
 * Does NOT mutate Prediction / Recommendation / Provider datasets.
 * Refuses overwrite if observation artifacts already exist.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { loadMlbScheduleArtifact } from "../src/lib/mlb/build-mlb-schedule-artifact";
import {
  parseExpectedLineupPaste,
  saveMlbExpectedLineupObservation,
  loadMlbExpectedLineupObservation,
  mlbExpectedLineupObservationRel,
  type MlbExpectedLineupDraftBatter,
  type MlbExpectedLineupDraftGame,
} from "../src/lib/mlb/expected-lineup-observation-v0";
import {
  saveMlbKoreanMarketOddsObservation,
  loadMlbKoreanMarketOddsObservation,
  mlbKoreanMarketOddsObservationRel,
  mlbOddsHistoryDatasetRel,
} from "../src/lib/mlb/korean-market-odds-observation-v0";
import { mlbLineupDatasetRel } from "../src/lib/mlb/expected-lineup-observation-v0/paths";

const DATE_KST = "2026-08-13";

const ABBREV_TO_TEAM: Record<string, string> = {
  MIA: "Miami Marlins",
  PIT: "Pittsburgh Pirates",
  DET: "Detroit Tigers",
  CLE: "Cleveland Guardians",
  WSH: "Washington Nationals",
  CHC: "Chicago Cubs",
  NYY: "New York Yankees",
  SEA: "Seattle Mariners",
  TOR: "Toronto Blue Jays",
  BOS: "Boston Red Sox",
  ATL: "Atlanta Braves",
  NYM: "New York Mets",
  MIN: "Minnesota Twins",
  BAL: "Baltimore Orioles",
  CWS: "Chicago White Sox",
  CIN: "Cincinnati Reds",
  STL: "St. Louis Cardinals",
  PHI: "Philadelphia Phillies",
  LAA: "Los Angeles Angels",
  TEX: "Texas Rangers",
  SD: "San Diego Padres",
  MIL: "Milwaukee Brewers",
  ATH: "Athletics",
  TB: "Tampa Bay Rays",
  ARI: "Arizona Diamondbacks",
  COL: "Colorado Rockies",
  SF: "San Francisco Giants",
  HOU: "Houston Astros",
  LAD: "Los Angeles Dodgers",
  KC: "Kansas City Royals",
};

/** Operator-provided KOREAN_MARKET moneyline (decimal) by team abbrev. */
const TEAM_ODDS: Record<string, number> = {
  BAL: 1.8,
  MIN: 1.72,
  PHI: 1.46,
  STL: 2.22,
  TB: 1.37,
  ATH: 2.46,
  COL: 2.34,
  ARI: 1.41,
  HOU: 1.53,
  SF: 2.07,
  MIL: 1.7,
  SD: 1.82,
  PIT: 1.82,
  MIA: 1.7,
  CLE: 1.94,
  DET: 1.61,
  CHC: 1.5,
  WSH: 2.13,
  SEA: 1.91,
  NYY: 1.63,
  BOS: 1.61,
  TOR: 1.94,
  NYM: 2.17,
  ATL: 1.48,
  CIN: 2.09,
  CWS: 1.52,
  KC: 2.6,
  LAD: 1.33,
  TEX: 1.59,
  LAA: 1.97,
};

/** Source image slates rejected — not on 2026-08-13 schedule. */
const REJECTED_SOURCE_MISMATCH = ["PHI @ MIN", "MIL @ LAD"] as const;

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function fileAudit(p: string): { hash: string; mtimeMs: number } | null {
  if (!existsSync(p)) return null;
  return { hash: sha256File(p), mtimeMs: statSync(p).mtimeMs };
}

function abbrevForTeam(fullName: string): string {
  const hit = Object.entries(ABBREV_TO_TEAM).find(([, name]) => name === fullName);
  if (!hit) throw new Error(`UNKNOWN_TEAM:${fullName}`);
  return hit[0]!;
}

function oddsForTeam(fullName: string): number {
  const abbrev = abbrevForTeam(fullName);
  const odds = TEAM_ODDS[abbrev];
  if (odds == null) throw new Error(`MISSING_TEAM_ODDS:${fullName}:${abbrev}`);
  return odds;
}

function fromOrderPosNameBats(lines: string[]): MlbExpectedLineupDraftBatter[] {
  const paste = lines
    .map((line) => {
      const m = line
        .trim()
        .match(
          /^(\d+)\s+(DH|C|1B|2B|3B|SS|LF|CF|RF)\s+(.+?)\s+([LRSB])\s*$/i,
        );
      if (!m) throw new Error(`BAD_LINEUP_LINE:${line}`);
      return `${m[1]}. ${m[3]} ${m[2]} ${m[4]}`;
    })
    .join("\n");
  const { batters, errors } = parseExpectedLineupPaste(paste);
  if (errors.length) throw new Error(errors.join(";"));
  return batters;
}

type LineupSlate = {
  awayAbbrev: string;
  homeAbbrev: string;
  away: string[];
  home: string[];
};

/** Only schedule-exact matchups — 7 of 15 schedule games. */
const LINEUP_SLATES: LineupSlate[] = [
  {
    awayAbbrev: "CLE",
    homeAbbrev: "DET",
    away: [
      "1 LF Steven Kwan L",
      "2 RF C. DeLauter L",
      "3 DH Jose Ramirez S",
      "4 1B N. Lowe L",
      "5 2B T. Bazzana L",
      "6 SS B. Rocchio S",
      "7 CF Petey Halpin L",
      "8 C R. Bailey S",
      "9 3B Angel Genao S",
    ],
    home: [
      "1 2B G. Torres R",
      "2 DH D. Dingler R",
      "3 SS K. McGonigle L",
      "4 LF Riley Greene L",
      "5 C E. Valencia R",
      "6 1B S. Torkelson R",
      "7 3B Hao-Yu Lee R",
      "8 CF Javier Baez R",
      "9 RF Ben Malgeri R",
    ],
  },
  {
    awayAbbrev: "PIT",
    homeAbbrev: "MIA",
    away: [
      "1 LF Jake Mangum S",
      "2 2B Brandon Lowe L",
      "3 DH B. Reynolds S",
      "4 RF E. Valdez R",
      "5 1B S. Horwitz L",
      "6 3B N. Gonzalez R",
      "7 C E. Rodriguez S",
      "8 SS J. Gonzalez L",
      "9 CF J. Garcia R",
    ],
    home: [
      "1 CF Jakob Marsee L",
      "2 2B X. Edwards S",
      "3 SS Otto Lopez R",
      "4 DH G. Conine L",
      "5 LF H. Hernandez R",
      "6 RF Owen Caissie L",
      "7 1B A. Ramirez R",
      "8 C Joe Mack L",
      "9 3B J. Sanoja R",
    ],
  },
  {
    awayAbbrev: "SEA",
    homeAbbrev: "NYY",
    away: [
      "1 RF Taylor Ward R",
      "2 2B Cole Young L",
      "3 LF R. Arozarena R",
      "4 DH D. Canzone L",
      "5 CF J. Rodriguez R",
      "6 1B Josh Naylor L",
      "7 C Cal Raleigh S",
      "8 3B W. Wilson R",
      "9 SS Colt Emerson L",
    ],
    home: [
      "1 CF T. Grisham L",
      "2 DH Ben Rice L",
      "3 LF Heliot Ramos R",
      "4 1B Luis Garcia L",
      "5 2B J. Chisholm L",
      "6 RF S. Jones L",
      "7 SS G. Lombard R",
      "8 3B Ryan McMahon L",
      "9 C Austin Wells L",
    ],
  },
  {
    awayAbbrev: "CIN",
    homeAbbrev: "CWS",
    away: [
      "1 SS E. De La Cruz S",
      "2 1B Sal Stewart R",
      "3 LF JJ Bleday L",
      "4 C T. Stephenson R",
      "5 3B E. Suarez R",
      "6 DH H. Rodriguez L",
      "7 CF Dane Myers R",
      "8 RF Noelvi Marte R",
      "9 2B Matt McLain R",
    ],
    home: [
      "1 2B C. Meidroth R",
      "2 1B M. Murakami L",
      "3 3B M. Vargas R",
      "4 DH R. Grichuk R",
      "5 RF B. Montgomery S",
      "6 CF B. Doyle R",
      "7 SS C. Montgomery L",
      "8 C Edgar Quero L",
      "9 LF L. Acuna R",
    ],
  },
  {
    awayAbbrev: "BOS",
    homeAbbrev: "TOR",
    away: [
      "1 2B Nick Sogard S",
      "2 CF C. Rafaela R",
      "3 RF Wilyer Abreu L",
      "4 1B W. Contreras R",
      "5 C A. Rutschman S",
      "6 DH M. Yoshida L",
      "7 3B Caleb Durbin R",
      "8 LF Jarren Duran L",
      "9 SS A. Monasterio R",
    ],
    home: [
      "1 CF B. Bateman L",
      "2 1B V. Guerrero R",
      "3 C A. Kirk R",
      "4 DH G. Springer R",
      "5 3B K. Okamoto R",
      "6 2B E. Clement R",
      "7 SS A. Gimenez L",
      "8 RF Myles Straw R",
      "9 LF C. McAdoo R",
    ],
  },
  {
    awayAbbrev: "CHC",
    homeAbbrev: "WSH",
    away: [
      "1 CF P. Crow-Armstrong L",
      "2 DH Seiya Suzuki R",
      "3 1B M. Busch L",
      "4 3B Alex Bregman R",
      "5 LF Ian Happ S",
      "6 2B Nico Hoerner R",
      "7 C Carson Kelly R",
      "8 SS D. Swanson R",
      "9 RF T. Taylor R",
    ],
    home: [
      "1 SS CJ Abrams L",
      "2 1B A. Ortiz L",
      "3 DH Jose Tena L",
      "4 LF Daylen Lile L",
      "5 RF Dylan Crews R",
      "6 3B Jorbit Vivas L",
      "7 2B Nasim Nunez S",
      "8 C Keibert Ruiz S",
      "9 CF Jacob Young R",
    ],
  },
  {
    awayAbbrev: "TEX",
    homeAbbrev: "LAA",
    away: [
      "1 DH Joc Pederson L",
      "2 LF W. Langford R",
      "3 SS Corey Seager L",
      "4 RF B. Nimmo L",
      "5 CF Evan Carter L",
      "6 1B Jake Burger R",
      "7 3B E. Duran R",
      "8 C Elias Diaz R",
      "9 2B Nicky Lopez L",
    ],
    home: [
      "1 LF Wade Meckler L",
      "2 CF Mike Trout R",
      "3 1B N. Schanuel L",
      "4 SS Zach Neto R",
      "5 2B V. Grissom R",
      "6 DH M. Ballesteros L",
      "7 3B D. Guzman R",
      "8 RF Josh Lowe L",
      "9 C T. Heineman R",
    ],
  },
];

function resolveGameByAbbrevs(
  schedule: Awaited<ReturnType<typeof loadMlbScheduleArtifact>>,
  awayAbbrev: string,
  homeAbbrev: string,
) {
  const awayTeam = ABBREV_TO_TEAM[awayAbbrev];
  const homeTeam = ABBREV_TO_TEAM[homeAbbrev];
  if (!awayTeam || !homeTeam) {
    throw new Error(`BAD_ABBREV:${awayAbbrev}@${homeAbbrev}`);
  }
  const game = schedule.games.find(
    (g) => g.awayTeam === awayTeam && g.homeTeam === homeTeam,
  );
  if (!game) {
    throw new Error(`SCHEDULE_JOIN_FAILED:${awayAbbrev}@${homeAbbrev}`);
  }
  return game;
}

async function main() {
  const observedAt = new Date().toISOString();
  const koreanRel = mlbKoreanMarketOddsObservationRel(DATE_KST);
  const lineupRel = mlbExpectedLineupObservationRel(DATE_KST);
  const predRel = `data/predictions/mlb/${DATE_KST}.json`;
  const recRel = `data/recommendations/mlb/${DATE_KST}-engine-recommendations-v1.json`;
  const oddsRel = mlbOddsHistoryDatasetRel(DATE_KST);
  const providerLineupRel = mlbLineupDatasetRel(DATE_KST);

  const before = {
    pred: fileAudit(predRel),
    rec: fileAudit(recRel),
    odds: fileAudit(oddsRel),
    providerLineup: fileAudit(providerLineupRel),
  };

  if (existsSync(koreanRel) || existsSync(lineupRel)) {
    const existingK = await loadMlbKoreanMarketOddsObservation({ dateKst: DATE_KST });
    const existingL = await loadMlbExpectedLineupObservation({ dateKst: DATE_KST });
    console.error("ALREADY_EXISTS — refusing overwrite");
    if (existingK) {
      console.error(`Korean hash: ${existingK.koreanMarketOddsHash}`);
    }
    if (existingL) {
      console.error(`Expected lineup hash: ${existingL.expectedLineupHash}`);
    }
    process.exit(1);
  }

  const schedule = await loadMlbScheduleArtifact(DATE_KST);
  if (schedule.games.length !== 15) {
    throw new Error(`SCHEDULE_NOT_15:got_${schedule.games.length}`);
  }

  for (const g of schedule.games) {
    const pitch = g.commenceTimeUtc ?? g.scheduledStartTime ?? null;
    if (!pitch || Date.parse(observedAt) >= Date.parse(pitch)) {
      throw new Error(`LATE_OBSERVATION_PREFLIGHT:${g.gamePk}:${pitch}`);
    }
  }

  const koreanDrafts = schedule.games.map((g) => ({
    gamePk: g.gamePk,
    awayOdds: oddsForTeam(g.awayTeam),
    homeOdds: oddsForTeam(g.homeTeam),
  }));

  const lineupDrafts: MlbExpectedLineupDraftGame[] = LINEUP_SLATES.map((slate) => {
    const game = resolveGameByAbbrevs(
      schedule,
      slate.awayAbbrev,
      slate.homeAbbrev,
    );
    return {
      gamePk: game.gamePk,
      awayLineup: fromOrderPosNameBats(slate.away),
      homeLineup: fromOrderPosNameBats(slate.home),
    };
  });

  if (lineupDrafts.length !== 7) {
    throw new Error(`LINEUP_SLATE_NOT_7:got_${lineupDrafts.length}`);
  }

  const koreanNote =
    "PRE_GAME observation · independent from Provider odds · Not Model Probability · does not mutate Prediction / Recommendation / odds-history-dataset-v1";

  const lineupNote = [
    "PREGAME EXPECTED LINEUP OBSERVATION transcribed from operator-provided Expected Lineup screenshots before first pitch.",
    "Not CONFIRMED.",
    "Partial slate: 7/15 schedule games observed; 8 schedule games NOT_OBSERVED.",
    `UNMATCHED_SOURCE_SLATE (rejected, not joined to any gamePk): ${REJECTED_SOURCE_MISMATCH.join(", ")}.`,
    "Does not mutate Prediction / Recommendation / lineup-dataset-v1.",
  ].join(" ");

  const korean = await saveMlbKoreanMarketOddsObservation({
    dateKst: DATE_KST,
    observedAt,
    sourceLabel:
      "운영자 제공 사전 스크린샷 · KOREAN_MARKET · MONEYLINE · MANUAL_OBSERVATION",
    note: koreanNote,
    drafts: koreanDrafts,
    allowLate: false,
  });

  if (!korean.ok || !korean.document) {
    console.error("KOREAN_SAVE_FAILED", korean.errors);
    process.exit(1);
  }

  if (korean.document.summary.lateGames > 0) {
    console.error("KOREAN_LATE_DETECTED — aborting before lineup write");
    process.exit(1);
  }

  const lineup = await saveMlbExpectedLineupObservation({
    dateKst: DATE_KST,
    observedAt,
    sourceLabel:
      "운영자 제공 사전 스크린샷 · EXPECTED_LINEUP · MANUAL_OBSERVATION",
    note: lineupNote,
    drafts: lineupDrafts,
    allowLate: false,
    allowMissingDrafts: true,
  });

  if (!lineup.ok || !lineup.document) {
    console.error("LINEUP_SAVE_FAILED", lineup.errors);
    process.exit(1);
  }

  if (lineup.document.summary.lateObservations > 0) {
    console.error("LINEUP_LATE_DETECTED");
    process.exit(1);
  }

  const after = {
    pred: fileAudit(predRel),
    rec: fileAudit(recRel),
    odds: fileAudit(oddsRel),
    providerLineup: fileAudit(providerLineupRel),
  };

  const predHashMeta = before.pred
    ? (JSON.parse(readFileSync(predRel, "utf8")).meta.predictionHashSha256 as string)
    : null;

  const predUnchanged =
    before.pred != null &&
    after.pred != null &&
    before.pred.hash === after.pred.hash &&
    before.pred.mtimeMs === after.pred.mtimeMs;
  const recUnchanged =
    before.rec == null ||
    (after.rec != null &&
      before.rec.hash === after.rec.hash &&
      before.rec.mtimeMs === after.rec.mtimeMs);
  const oddsUnchanged =
    before.odds == null ||
    (after.odds != null &&
      before.odds.hash === after.odds.hash &&
      before.odds.mtimeMs === after.odds.mtimeMs);
  const providerLineupUnchanged =
    before.providerLineup == null ||
    (after.providerLineup != null &&
      before.providerLineup.hash === after.providerLineup.hash &&
      before.providerLineup.mtimeMs === after.providerLineup.mtimeMs);

  const k = korean.document;
  const l = lineup.document;

  console.log("=== MLB 2026-08-13 MANUAL PREGAME OBSERVATION COMPLETE ===\n");

  console.log("Korean Market");
  console.log(`- schedule games: ${k.summary.scheduleGames}`);
  console.log(`- matched: ${k.summary.matchedGames}`);
  console.log(`- observations: ${k.summary.observedGames}`);
  console.log(`- missing: ${k.summary.missingGames}`);
  console.log(`- pregame count: ${k.summary.preGameObservations}`);
  console.log(`- late count: ${k.summary.lateGames}`);
  console.log(`- hash: ${k.koreanMarketOddsHash}`);
  console.log(`- artifact: ${koreanRel}\n`);

  console.log("Expected Lineup");
  console.log(`- schedule games: ${l.summary.scheduleGames}`);
  console.log(`- matched expected games: ${l.summary.expectedGames}`);
  console.log(`- missing schedule games: ${l.summary.missingGames}`);
  console.log(`- team lineups: ${l.summary.teamLineups}`);
  console.log(`- batting slots: ${l.summary.expectedBattingSlots}`);
  console.log(`- confirmed: ${l.summary.confirmedGames}`);
  console.log(`- pregame: ${l.summary.preGameObservations}`);
  console.log(`- late: ${l.summary.lateObservations}`);
  console.log(`- join errors: ${l.summary.joinErrors}`);
  console.log(
    `- rejected/source mismatch list: ${REJECTED_SOURCE_MISMATCH.join(", ")}`,
  );
  console.log(`- hash: ${l.expectedLineupHash}`);
  console.log(`- artifact: ${lineupRel}\n`);

  console.log("Immutability");
  console.log(`- Prediction hash before: ${before.pred?.hash ?? "N/A"}`);
  console.log(`- Prediction hash after: ${after.pred?.hash ?? "N/A"}`);
  console.log(`- Prediction meta hash: ${predHashMeta ?? "N/A"}`);
  console.log(`- Recommendation hash before: ${before.rec?.hash ?? "N/A"}`);
  console.log(`- Recommendation hash after: ${after.rec?.hash ?? "N/A"}`);
  console.log(`- Provider Odds hash before: ${before.odds?.hash ?? "N/A"}`);
  console.log(`- Provider Odds hash after: ${after.odds?.hash ?? "N/A"}`);
  console.log(
    `- Provider Lineup hash before: ${before.providerLineup?.hash ?? "N/A"}`,
  );
  console.log(
    `- Provider Lineup hash after: ${after.providerLineup?.hash ?? "N/A"}`,
  );
  console.log(`- Prediction mutation: ${predUnchanged ? "NONE" : "DETECTED"}`);
  console.log(
    `- Recommendation mutation: ${recUnchanged ? "NONE" : "DETECTED"}`,
  );
  console.log(`- Provider Odds mutation: ${oddsUnchanged ? "NONE" : "DETECTED"}`);
  console.log(
    `- Provider Lineup mutation: ${providerLineupUnchanged ? "NONE" : "DETECTED"}`,
  );
  console.log(`- observedAt: ${observedAt}\n`);

  console.log("Recommendation QA Debt");
  console.log("- RECOMMENDATION_PICK_SIDE_PROBABILITY_SEMANTICS");
  console.log("- OBSERVED_ONLY / NOT_FIXED");
  console.log(
    "  TB @ ATH pick=AWAY probability=45.3 vs HOME picks ARI=53.7 CWS=53.2 — schema contract audit pending",
  );

  if (
    !predUnchanged ||
    !recUnchanged ||
    !oddsUnchanged ||
    !providerLineupUnchanged
  ) {
    console.error("MUTATION_DETECTED");
    process.exit(1);
  }

  if (
    k.summary.matchedGames !== 15 ||
    k.summary.observedGames !== 15 ||
    k.summary.lateGames !== 0 ||
    l.summary.expectedGames !== 7 ||
    l.summary.missingGames !== 8 ||
    l.summary.teamLineups !== 14 ||
    l.summary.expectedBattingSlots !== 126 ||
    l.summary.joinErrors !== 0
  ) {
    console.error("SUMMARY_VALIDATION_FAILED", {
      korean: k.summary,
      lineup: l.summary,
    });
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
