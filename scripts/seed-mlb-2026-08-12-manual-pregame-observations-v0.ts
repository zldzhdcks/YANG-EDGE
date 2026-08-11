/**
 * Seed 2026-08-12 MLB Manual Pregame Observations (Korean Market + Expected Lineup).
 *
 *   npx tsx scripts/seed-mlb-2026-08-12-manual-pregame-observations-v0.ts
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

const DATE_KST = "2026-08-12";

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

/** Operator-provided KOREAN_MARKET moneyline (decimal). */
const TEAM_ODDS: Record<string, number> = {
  MIA: 1.82,
  PIT: 1.70,
  DET: 1.64,
  CLE: 1.9,
  WSH: 2.26,
  CHC: 1.44,
  NYY: 1.62,
  SEA: 1.93,
  TOR: 1.52,
  BOS: 2.09,
  ATL: 1.61,
  NYM: 1.94,
  MIN: 1.7,
  BAL: 1.82,
  CWS: 1.48,
  CIN: 2.17,
  STL: 2.26,
  PHI: 1.44,
  LAA: 2.05,
  TEX: 1.54,
  SD: 2.02,
  MIL: 1.56,
  ATH: 2.19,
  TB: 1.47,
  ARI: 1.42,
  COL: 2.31,
  SF: 2.53,
  HOU: 1.35,
  LAD: 1.28,
  KC: 2.82,
};

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

/** "1 SS G. Henderson L" → parseExpectedLineupPaste input. */
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

const LINEUP_SLATES: LineupSlate[] = [
  {
    awayAbbrev: "BAL",
    homeAbbrev: "MIN",
    away: [
      "1 SS G. Henderson L",
      "2 1B Pete Alonso R",
      "3 2B J. Holliday L",
      "4 DH T. O'Neill R",
      "5 LF D. Beavers L",
      "6 RF L. Taveras S",
      "7 3B Coby Mayo R",
      "8 CF C. Cowser L",
      "9 C C. Narvaez R",
    ],
    home: [
      "1 LF T. Larnach L",
      "2 C Ryan Jeffers R",
      "3 DH Josh Bell S",
      "4 2B Kody Clemens L",
      "5 1B Royce Lewis R",
      "6 3B Brooks Lee S",
      "7 RF Alan Roden L",
      "8 CF L. Keaschall R",
      "9 SS K. Culpepper R",
    ],
  },
  {
    awayAbbrev: "PHI",
    homeAbbrev: "STL",
    away: [
      "1 DH K. Schwarber L",
      "2 SS Trea Turner R",
      "3 RF Bryce Harper L",
      "4 2B Luis Arraez L",
      "5 C J. Realmuto R",
      "6 3B Bryson Stott L",
      "7 LF B. Marsh L",
      "8 1B Alec Bohm R",
      "9 CF J. Crawford L",
    ],
    home: [
      "1 2B J. Wetherholt L",
      "2 DH Ivan Herrera R",
      "3 1B A. Burleson L",
      "4 RF J. Walker R",
      "5 CF N. Church L",
      "6 SS Masyn Winn R",
      "7 3B Jose Fermin R",
      "8 C Jimmy Crooks L",
      "9 LF Bryan Torres L",
    ],
  },
  {
    awayAbbrev: "TB",
    homeAbbrev: "ATH",
    away: [
      "1 DH Yandy Diaz R",
      "2 1B J. Aranda L",
      "3 LF C. Simpson L",
      "4 3B J. Caminero R",
      "5 C Liam Hicks L",
      "6 RF Victor Mesa L",
      "7 CF C. Mullins L",
      "8 2B R. Palacios L",
      "9 SS Taylor Walls S",
    ],
    home: [
      "1 1B Jeff McNeil L",
      "2 LF T. Soderstrom L",
      "3 SS Jacob Wilson R",
      "4 DH C. Cortes L",
      "5 RF L. Butler L",
      "6 C Jonah Heim S",
      "7 CF Henry Bolte R",
      "8 2B D. Walton L",
      "9 3B Zack Gelof R",
    ],
  },
  {
    awayAbbrev: "COL",
    homeAbbrev: "ARI",
    away: [
      "1 LF J. McCarthy L",
      "2 CF Cole Carrigg S",
      "3 1B TJ Rumfield L",
      "4 C H. Goodman R",
      "5 DH M. Moniak L",
      "6 3B Kyle Karros R",
      "7 2B Willi Castro S",
      "8 RF Jordan Beck R",
      "9 SS E. Tovar R",
    ],
    home: [
      "1 SS G. Perdomo S",
      "2 RF C. Carroll L",
      "3 C G. Moreno R",
      "4 2B Ketel Marte S",
      "5 DH L. Nootbaar L",
      "6 3B N. Arenado R",
      "7 LF Max Kepler L",
      "8 1B Tim Tawa R",
      "9 CF R. Waldschmidt R",
    ],
  },
  {
    awayAbbrev: "HOU",
    homeAbbrev: "SF",
    away: [
      "1 SS Jeremy Pena R",
      "2 DH Y. Alvarez L",
      "3 3B I. Paredes R",
      "4 CF D. Varsho L",
      "5 1B C. Walker R",
      "6 2B Jose Altuve R",
      "7 LF T. Trammell L",
      "8 C Yainer Diaz R",
      "9 RF Cam Smith R",
    ],
    home: [
      "1 DH B. Eldridge L",
      "2 RF Jung Hoo Lee L",
      "3 SS Willy Adames R",
      "4 1B R. Devers L",
      "5 2B O. Basabe R",
      "6 CF Drew Gilbert L",
      "7 C D. Cavanaugh L",
      "8 LF Grant McCray L",
      "9 3B C. Koss R",
    ],
  },
  {
    awayAbbrev: "MIL",
    homeAbbrev: "SD",
    away: [
      "1 LF J. Chourio R",
      "2 2B Brice Turang L",
      "3 1B A. Vaughn R",
      "4 C W. Contreras R",
      "5 DH C. Yelich L",
      "6 RF Luis Lara S",
      "7 CF B. Lockridge R",
      "8 SS Joey Ortiz R",
      "9 3B D. Hamilton L",
    ],
    home: [
      "1 RF F. Tatis R",
      "2 2B J. Cronenworth L",
      "3 3B M. Machado R",
      "4 1B Ty France R",
      "5 CF J. Merrill L",
      "6 C L. Campusano R",
      "7 DH Gavin Sheets L",
      "8 SS X. Bogaerts R",
      "9 LF Luis Rengifo S",
    ],
  },
  {
    awayAbbrev: "CLE",
    homeAbbrev: "DET",
    away: [
      "1 CF Steven Kwan L",
      "2 3B Jose Ramirez S",
      "3 DH C. DeLauter L",
      "4 RF Jo Adell R",
      "5 1B Rhys Hoskins R",
      "6 LF A. Martinez S",
      "7 2B T. Bazzana L",
      "8 C A. Hedges R",
      "9 SS B. Rocchio S",
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
      "6 3B N. Gonzales R",
      "7 C E. Rodriguez S",
      "8 SS J. Gonzalez L",
      "9 CF J. Garcia R",
    ],
    home: [
      "1 1B Kyle Stowers L",
      "2 2B X. Edwards S",
      "3 SS Otto Lopez R",
      "4 DH G. Conine L",
      "5 LF H. Hernandez R",
      "6 RF Owen Caissie L",
      "7 CF Jakob Marsee L",
      "8 C Joe Mack L",
      "9 3B J. Sanoja R",
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
      "1 RF Dylan Crews R",
      "2 1B A. Chaparro R",
      "3 3B Brady House R",
      "4 SS CJ Abrams L",
      "5 C Harry Ford R",
      "6 LF A. Pinckney R",
      "7 DH Daylen Lile L",
      "8 CF Jacob Young R",
      "9 2B Nasim Nunez S",
    ],
  },
  {
    awayAbbrev: "SEA",
    homeAbbrev: "NYY",
    away: [
      "1 2B Cole Young L",
      "2 LF R. Arozarena R",
      "3 DH D. Canzone L",
      "4 CF J. Rodriguez R",
      "5 1B Josh Naylor L",
      "6 C Cal Raleigh S",
      "7 3B B. Donovan L",
      "8 RF Taylor Ward R",
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
    awayAbbrev: "NYM",
    homeAbbrev: "ATL",
    away: [
      "1 LF A.J. Ewing L",
      "2 SS F. Lindor S",
      "3 3B Bo Bichette R",
      "4 RF Carson Benge L",
      "5 CF Luis Robert R",
      "6 1B Jared Young L",
      "7 2B M. Semien R",
      "8 DH J. Polanco S",
      "9 C F. Alvarez R",
    ],
    home: [
      "1 RF Ronald Acuna R",
      "2 DH D. Baldwin L",
      "3 1B Matt Olson L",
      "4 2B Ozzie Albies S",
      "5 CF M. Harris L",
      "6 SS M. Dubon R",
      "7 LF Lane Thomas R",
      "8 3B Austin Riley R",
      "9 C Sean Murphy R",
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
      "1 LF S. Antonacci L",
      "2 1B M. Murakami L",
      "3 3B M. Vargas R",
      "4 SS C. Montgomery L",
      "5 DH A. Benintendi L",
      "6 RF B. Montgomery S",
      "7 CF T. Peters L",
      "8 2B C. Meidroth R",
      "9 C Drew Romo S",
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
  {
    awayAbbrev: "KC",
    homeAbbrev: "LAD",
    away: [
      "1 C C. Jensen L",
      "2 SS Bobby Witt R",
      "3 RF J. Caglianone L",
      "4 1B S. Perez R",
      "5 DH S. Marte R",
      "6 3B Nick Loftin R",
      "7 LF I. Collins S",
      "8 2B T. Tolbert R",
      "9 CF Kyle Isbel L",
    ],
    home: [
      "1 DH S. Ohtani L",
      "2 CF Andy Pages R",
      "3 1B F. Freeman L",
      "4 2B Tommy Edman S",
      "5 SS Mookie Betts R",
      "6 RF Kyle Tucker L",
      "7 LF T. Hernandez R",
      "8 3B E. Hernandez R",
      "9 C Ben Rortvedt L",
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

  // Pre-flight: all first pitches must be after observedAt
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

  if (lineupDrafts.length !== 15) {
    throw new Error(`LINEUP_SLATE_NOT_15:got_${lineupDrafts.length}`);
  }

  const koreanNote =
    "PRE_GAME observation · independent from Provider odds · Not Model Probability · does not mutate Prediction / Recommendation / odds-history-dataset-v1";

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
    note:
      "PREGAME EXPECTED LINEUP OBSERVATION transcribed from operator-provided Expected Lineup screenshots before first pitch. Not CONFIRMED. Does not mutate Prediction / Recommendation / lineup-dataset-v1.",
    drafts: lineupDrafts,
    allowLate: false,
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

  const predHash = before.pred
    ? JSON.parse(readFileSync(predRel, "utf8")).meta.predictionHashSha256
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

  console.log("=== MLB 2026-08-12 MANUAL PREGAME OBSERVATION COMPLETE ===\n");
  console.log("Schedule:");
  console.log("15 games\n");
  console.log("Korean Market:");
  console.log(`matched ${k.summary.matchedGames}/15`);
  console.log(`pregame ${k.summary.preGameObservations}/15`);
  console.log(`late ${k.summary.lateGames}`);
  console.log(`hash ${k.koreanMarketOddsHash.slice(0, 8)}…`);
  console.log(`artifact ${koreanRel}\n`);
  console.log("Expected Lineup:");
  console.log(`matched ${l.summary.matchedGames}/15`);
  console.log(`teams ${l.summary.teamLineups}/30`);
  console.log(`slots ${l.summary.expectedBattingSlots}/270`);
  console.log(`confirmed ${l.summary.confirmedGames}`);
  console.log(`late ${l.summary.lateObservations}`);
  console.log(`hash ${l.expectedLineupHash.slice(0, 8)}…`);
  console.log(`artifact ${lineupRel}\n`);
  console.log("Immutable:");
  console.log(`Prediction unchanged ${predUnchanged}`);
  console.log(
    `Recommendation unchanged ${before.rec ? recUnchanged : "N/A"}`,
  );
  console.log(`Provider Odds unchanged ${oddsUnchanged}`);
  console.log(`Provider Lineup unchanged ${providerLineupUnchanged}\n`);
  console.log("Existing Prediction:");
  console.log(`hash ${predHash?.slice(0, 8) ?? "—"}…\n`);
  console.log("Recommendation Artifact:");
  console.log(`EXISTS / ${before.rec ? "SEALED" : "ABSENT"}\n`);
  console.log(`observedAt: ${observedAt}`);

  if (!predUnchanged || !recUnchanged || !oddsUnchanged || !providerLineupUnchanged) {
    console.error("MUTATION_DETECTED");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
