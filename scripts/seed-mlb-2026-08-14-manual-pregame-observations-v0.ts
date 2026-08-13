/**
 * Seed 2026-08-14 MLB Manual Pregame Observations (Korean Market + Expected Lineup).
 *
 *   npx tsx scripts/seed-mlb-2026-08-14-manual-pregame-observations-v0.ts
 *
 * Does NOT mutate Prediction / Recommendation / Provider datasets / Engine.
 * Refuses overwrite if observation artifacts already exist.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { loadMlbScheduleArtifact } from "../src/lib/mlb/build-mlb-schedule-artifact";
import { resolveSelectedPickProbability } from "../src/lib/mlb/daily-picks-v1";
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

const DATE_KST = "2026-08-14";
const MINNESOTA_GAME_PK = 823669;

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
  MIN: "Minnesota Twins",
  CWS: "Chicago White Sox",
  CIN: "Cincinnati Reds",
  PHI: "Philadelphia Phillies",
  LAA: "Los Angeles Angels",
  TEX: "Texas Rangers",
  MIL: "Milwaukee Brewers",
  LAD: "Los Angeles Dodgers",
};

/**
 * Ordinary 2-way moneyline only, joined by exact gamePk + Schedule team identity.
 * Screenshot is HOME:AWAY; values here are already mapped to AWAY @ HOME.
 */
const KOREAN_MONEYLINE: Record<
  number,
  { awayTeam: string; awayOdds: number; homeTeam: string; homeOdds: number }
> = {
  823829: {
    awayTeam: "Pittsburgh Pirates",
    awayOdds: 1.64,
    homeTeam: "Miami Marlins",
    homeOdds: 1.9,
  },
  824238: {
    awayTeam: "Cleveland Guardians",
    awayOdds: 1.7,
    homeTeam: "Detroit Tigers",
    homeOdds: 1.82,
  },
  823508: {
    awayTeam: "Seattle Mariners",
    awayOdds: 2.07,
    homeTeam: "New York Yankees",
    homeOdds: 1.53,
  },
  824561: {
    awayTeam: "Cincinnati Reds",
    awayOdds: 2.04,
    homeTeam: "Chicago White Sox",
    homeOdds: 1.55,
  },
  822776: {
    awayTeam: "Boston Red Sox",
    awayOdds: 1.44,
    homeTeam: "Toronto Blue Jays",
    homeOdds: 2.26,
  },
  822696: {
    awayTeam: "Chicago Cubs",
    awayOdds: 1.51,
    homeTeam: "Washington Nationals",
    homeOdds: 2.11,
  },
  823669: {
    awayTeam: "Philadelphia Phillies",
    awayOdds: 1.84,
    homeTeam: "Minnesota Twins",
    homeOdds: 1.69,
  },
  823995: {
    awayTeam: "Texas Rangers",
    awayOdds: 1.45,
    homeTeam: "Los Angeles Angels",
    homeOdds: 2.24,
  },
  823915: {
    awayTeam: "Milwaukee Brewers",
    awayOdds: 1.97,
    homeTeam: "Los Angeles Dodgers",
    homeOdds: 1.59,
  },
};

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function fileAudit(p: string): { hash: string; mtimeMs: number } | null {
  if (!existsSync(p)) return null;
  return { hash: sha256File(p), mtimeMs: statSync(p).mtimeMs };
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
  gamePk: number;
  awayAbbrev: string;
  homeAbbrev: string;
  away: string[];
  home: string[];
};

const LINEUP_SLATES: LineupSlate[] = [
  {
    gamePk: 824238,
    awayAbbrev: "CLE",
    homeAbbrev: "DET",
    away: [
      "1 CF Steven Kwan L",
      "2 RF C. DeLauter L",
      "3 DH Jose Ramirez S",
      "4 1B N. Lowe L",
      "5 LF Jo Adell R",
      "6 2B T. Bazzana L",
      "7 SS B. Rocchio S",
      "8 C P. Bailey S",
      "9 3B Angel Genao S",
    ],
    home: [
      "1 DH G. Torres R",
      "2 C D. Dingler R",
      "3 3B K. McGonigle L",
      "4 2B Hao-Yu Lee R",
      "5 1B S. Torkelson R",
      "6 LF Ben Malgeri R",
      "7 CF Max Clark L",
      "8 SS Javier Baez R",
      "9 RF Corey Julks R",
    ],
  },
  {
    gamePk: 823829,
    awayAbbrev: "PIT",
    homeAbbrev: "MIA",
    away: [
      "1 CF Jake Mangum S",
      "2 2B Brandon Lowe L",
      "3 LF B. Reynolds S",
      "4 1B S. Horwitz L",
      "5 3B N. Gonzales R",
      "6 DH Ronny Simon S",
      "7 RF E. Valdez R",
      "8 C E. Rodriguez S",
      "9 SS J. Gonzalez L",
    ],
    home: [
      "1 2B X. Edwards S",
      "2 SS Otto Lopez R",
      "3 1B G. Conine L",
      "4 LF H. Hernandez R",
      "5 CF Jakob Marsee L",
      "6 3B J. Sanoja R",
      "7 RF Owen Caissie L",
      "8 DH A. Ramirez R",
      "9 C Joe Mack L",
    ],
  },
  {
    gamePk: 823508,
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
      "3 RF S. Jones L",
      "4 1B Luis Garcia L",
      "5 LF Heliot Ramos R",
      "6 2B J. Chisholm L",
      "7 3B Ryan McMahon L",
      "8 C Austin Wells L",
      "9 SS G. Lombard R",
    ],
  },
  {
    gamePk: 824561,
    awayAbbrev: "CIN",
    homeAbbrev: "CWS",
    away: [
      "1 SS E. De La Cruz S",
      "2 1B Sal Stewart R",
      "3 LF JJ Bleday L",
      "4 C T. Stephenson R",
      "5 DH E. Suarez R",
      "6 RF H. Rodriguez L",
      "7 CF Dane Myers R",
      "8 2B Matt McLain R",
      "9 3B R. Hayes R",
    ],
    home: [
      "1 2B C. Meidroth R",
      "2 1B M. Murakami L",
      "3 3B M. Vargas R",
      "4 DH R. Grichuk R",
      "5 RF B. Montgomery S",
      "6 CF B. Doyle R",
      "7 SS C. Montgomery L",
      "8 C Edgar Quero S",
      "9 LF L. Acuna R",
    ],
  },
  {
    gamePk: 822776,
    awayAbbrev: "BOS",
    homeAbbrev: "TOR",
    away: [
      "1 DH M. Yoshida L",
      "2 CF C. Rafaela R",
      "3 C A. Rutschman S",
      "4 1B W. Contreras R",
      "5 RF Wilyer Abreu L",
      "6 3B Caleb Durbin R",
      "7 LF Jarren Duran L",
      "8 SS A. Monasterio R",
      "9 2B Nick Sogard S",
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
    gamePk: 822696,
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
    gamePk: 823669,
    awayAbbrev: "PHI",
    homeAbbrev: "MIN",
    away: [
      "1 DH K. Schwarber L",
      "2 SS Trea Turner R",
      "3 RF Bryce Harper L",
      "4 2B Luis Arraez L",
      "5 3B Bryson Stott L",
      "6 LF B. Marsh L",
      "7 C J. Realmuto R",
      "8 1B Alec Bohm R",
      "9 CF J. Crawford L",
    ],
    home: [
      "1 CF Byron Buxton R",
      "2 C Ryan Jeffers R",
      "3 DH Josh Bell S",
      "4 2B Kody Clemens L",
      "5 1B Royce Lewis R",
      "6 3B Brooks Lee S",
      "7 RF L. Keaschall R",
      "8 LF T. Larnach L",
      "9 SS K. Culpepper R",
    ],
  },
  {
    gamePk: 823995,
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
      "9 C T. Heineman S",
    ],
  },
  {
    gamePk: 823915,
    awayAbbrev: "MIL",
    homeAbbrev: "LAD",
    away: [
      "1 2B Brice Turang L",
      "2 LF J. Chourio R",
      "3 RF Jake Bauers L",
      "4 C W. Contreras R",
      "5 CF G. Mitchell L",
      "6 1B A. Vaughn R",
      "7 DH C. Yelich L",
      "8 3B D. Hamilton L",
      "9 SS Joey Ortiz R",
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

function unchanged(
  before: { hash: string; mtimeMs: number } | null,
  after: { hash: string; mtimeMs: number } | null,
): boolean {
  if (before == null) return after == null;
  return (
    after != null &&
    before.hash === after.hash &&
    before.mtimeMs === after.mtimeMs
  );
}

async function main() {
  const observedAt = new Date().toISOString();
  const koreanRel = mlbKoreanMarketOddsObservationRel(DATE_KST);
  const lineupRel = mlbExpectedLineupObservationRel(DATE_KST);
  const predRel = `data/predictions/mlb/${DATE_KST}.json`;
  const recRel = `data/recommendations/mlb/${DATE_KST}-engine-recommendations-v1.json`;
  const scheduleRel = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
  const starterRel = `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`;
  const oddsRel = mlbOddsHistoryDatasetRel(DATE_KST);
  const providerLineupRel = mlbLineupDatasetRel(DATE_KST);

  const before = {
    pred: fileAudit(predRel),
    rec: fileAudit(recRel),
    schedule: fileAudit(scheduleRel),
    starter: fileAudit(starterRel),
    odds: fileAudit(oddsRel),
    providerLineup: fileAudit(providerLineupRel),
  };

  if (existsSync(koreanRel) || existsSync(lineupRel)) {
    const existingK = await loadMlbKoreanMarketOddsObservation({
      dateKst: DATE_KST,
    });
    const existingL = await loadMlbExpectedLineupObservation({
      dateKst: DATE_KST,
    });
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
  if (schedule.games.length !== 9) {
    throw new Error(`SCHEDULE_NOT_9:got_${schedule.games.length}`);
  }

  const lateGames = schedule.games.filter((g) => {
    const pitch = g.commenceTimeUtc ?? g.scheduledStartTime ?? null;
    return !pitch || Date.parse(observedAt) >= Date.parse(pitch);
  });
  const allowLate = lateGames.length > 0;

  const koreanDrafts = schedule.games.map((g) => {
    const obs = KOREAN_MONEYLINE[g.gamePk];
    if (!obs) {
      throw new Error(`MISSING_KOREAN_OBSERVATION:${g.gamePk}`);
    }
    if (obs.awayTeam !== g.awayTeam || obs.homeTeam !== g.homeTeam) {
      throw new Error(
        `TEAM_IDENTITY_MISMATCH:${g.gamePk}:schedule=${g.awayTeam}@${g.homeTeam}:obs=${obs.awayTeam}@${obs.homeTeam}`,
      );
    }
    return {
      gamePk: g.gamePk,
      awayOdds: obs.awayOdds,
      homeOdds: obs.homeOdds,
    };
  });

  const extraKorean = Object.keys(KOREAN_MONEYLINE)
    .map(Number)
    .filter((pk) => !schedule.games.some((g) => g.gamePk === pk));
  if (extraKorean.length) {
    throw new Error(`KOREAN_OUTSIDE_SCHEDULE:${extraKorean.join(",")}`);
  }

  const lineupDrafts: MlbExpectedLineupDraftGame[] = LINEUP_SLATES.map(
    (slate) => {
      const game = resolveGameByAbbrevs(
        schedule,
        slate.awayAbbrev,
        slate.homeAbbrev,
      );
      if (game.gamePk !== slate.gamePk) {
        throw new Error(
          `LINEUP_GAMEPK_MISMATCH:${slate.awayAbbrev}@${slate.homeAbbrev}:expected_${slate.gamePk}:got_${game.gamePk}`,
        );
      }
      return {
        gamePk: game.gamePk,
        awayLineup: fromOrderPosNameBats(slate.away),
        homeLineup: fromOrderPosNameBats(slate.home),
      };
    },
  );

  if (lineupDrafts.length !== 9) {
    throw new Error(`LINEUP_SLATE_NOT_9:got_${lineupDrafts.length}`);
  }

  const koreanNote =
    "PRE_GAME observation · operator supplied · not provider confirmed · research/internal use · independent from Provider odds · Not Model Probability · does not mutate Prediction / Recommendation / odds-history-dataset-v1";

  const lineupNote = [
    "PREGAME EXPECTED LINEUP OBSERVATION transcribed from operator-provided Expected Lineup screenshots before first pitch.",
    "Operator supplied · not provider confirmed · research/internal use.",
    "Not CONFIRMED.",
    "Full slate: 9/9 schedule games OBSERVED as EXPECTED.",
    "Does not mutate Prediction / Recommendation / lineup-dataset-v1.",
  ].join(" ");

  const korean = await saveMlbKoreanMarketOddsObservation({
    dateKst: DATE_KST,
    observedAt,
    sourceLabel:
      "운영자 제공 사전 스크린샷 · KOREAN_MARKET · MONEYLINE · MANUAL_OBSERVATION",
    note: koreanNote,
    drafts: koreanDrafts,
    allowLate,
  });

  if (!korean.ok || !korean.document) {
    console.error("KOREAN_SAVE_FAILED", korean.errors);
    process.exit(1);
  }

  const lineup = await saveMlbExpectedLineupObservation({
    dateKst: DATE_KST,
    observedAt,
    sourceLabel:
      "운영자 제공 사전 스크린샷 · EXPECTED_LINEUP · MANUAL_OBSERVATION",
    note: lineupNote,
    drafts: lineupDrafts,
    allowLate,
  });

  if (!lineup.ok || !lineup.document) {
    console.error("LINEUP_SAVE_FAILED", lineup.errors);
    process.exit(1);
  }

  const after = {
    pred: fileAudit(predRel),
    rec: fileAudit(recRel),
    schedule: fileAudit(scheduleRel),
    starter: fileAudit(starterRel),
    odds: fileAudit(oddsRel),
    providerLineup: fileAudit(providerLineupRel),
  };

  const predHashMeta = before.pred
    ? (JSON.parse(readFileSync(predRel, "utf8")).meta
        .predictionHashSha256 as string)
    : null;

  const predUnchanged = unchanged(before.pred, after.pred);
  const recUnchanged = unchanged(before.rec, after.rec);
  const scheduleUnchanged = unchanged(before.schedule, after.schedule);
  const starterUnchanged = unchanged(before.starter, after.starter);
  const oddsUnchanged = unchanged(before.odds, after.odds);
  const providerLineupUnchanged = unchanged(
    before.providerLineup,
    after.providerLineup,
  );

  const k = korean.document;
  const l = lineup.document;
  const observedCount = l.games.filter(
    (g) => g.observationStatus === "OBSERVED",
  ).length;
  const notObservedCount = l.games.filter(
    (g) => g.observationStatus === "NOT_OBSERVED",
  ).length;

  const mappingRows = k.games.map((g) => {
    const obs = KOREAN_MONEYLINE[g.gamePk]!;
    return {
      gamePk: g.gamePk,
      awayTeam: g.awayTeam,
      awayOdds: g.awayOdds,
      homeTeam: g.homeTeam,
      homeOdds: g.homeOdds,
      identityOk:
        g.awayTeam === obs.awayTeam &&
        g.homeTeam === obs.homeTeam &&
        g.awayOdds === obs.awayOdds &&
        g.homeOdds === obs.homeOdds,
    };
  });

  const recDoc = JSON.parse(readFileSync(recRel, "utf8")) as {
    picks: Array<{
      gamePk: number | null;
      pick: string;
      tier: string;
      pickSide: string | null;
      probability: number | null;
      confidence: number | null;
    }>;
  };
  const minRec = recDoc.picks.find((p) => p.gamePk === MINNESOTA_GAME_PK);
  const predDoc = JSON.parse(readFileSync(predRel, "utf8")) as {
    predictions: Array<Record<string, unknown>>;
  };
  const minPred = predDoc.predictions.find((p) => {
    const gameId = String(p.gameId ?? "");
    return (
      gameId.includes("minnesota-twins") &&
      String(p.homeTeam ?? "") === "Minnesota Twins"
    );
  });
  const selected = minPred
    ? resolveSelectedPickProbability(minPred)
    : null;
  const semanticsCorrect =
    minRec != null &&
    selected != null &&
    minRec.pickSide === "HOME" &&
    selected.pickSide === "HOME" &&
    minRec.probability === 53.3 &&
    selected.selectedPickProbabilityPercent === 53.3 &&
    (selected.source === "market_research_baseline" ||
      selected.source === "home_away_by_side" ||
      selected.source === "legacy_top_level_home_as_pick");

  console.log("=== MLB 2026-08-14 MANUAL PREGAME OBSERVATION COMPLETE ===\n");

  console.log("Schedule");
  console.log(`- schedule games: ${schedule.games.length}`);
  console.log(`- observedAt: ${observedAt}`);
  console.log(
    `- late preflight games: ${lateGames.length ? lateGames.map((g) => g.gamePk).join(", ") : "none"}`,
  );
  console.log(`- allowLate: ${allowLate}\n`);

  console.log("Korean Market");
  console.log(`- schedule games: ${k.summary.scheduleGames}`);
  console.log(`- matched: ${k.summary.matchedGames}`);
  console.log(`- observations: ${k.summary.observedGames}`);
  console.log(`- missing: ${k.summary.missingGames}`);
  console.log(`- pregame count: ${k.summary.preGameObservations}`);
  console.log(`- late count: ${k.summary.lateGames}`);
  console.log(`- document hash: ${k.koreanMarketOddsHash}`);
  console.log(`- file SHA256: ${sha256File(koreanRel)}`);
  console.log(`- artifact: ${koreanRel}`);
  for (const row of mappingRows) {
    console.log(
      `  ${row.gamePk} ${row.awayTeam} @ ${row.homeTeam} away=${row.awayOdds} home=${row.homeOdds} identity=${row.identityOk ? "OK" : "FAIL"}`,
    );
  }
  console.log("");

  console.log("Expected Lineup");
  console.log(`- schedule games: ${l.summary.scheduleGames}`);
  console.log(`- OBSERVED: ${observedCount}`);
  console.log(`- NOT_OBSERVED: ${notObservedCount}`);
  console.log(`- expectedGames: ${l.summary.expectedGames}`);
  console.log(`- missingGames: ${l.summary.missingGames}`);
  console.log(`- team lineups: ${l.summary.teamLineups}`);
  console.log(`- batting slots: ${l.summary.expectedBattingSlots}`);
  console.log(`- confirmed: ${l.summary.confirmedGames}`);
  console.log(`- pregame: ${l.summary.preGameObservations}`);
  console.log(`- late: ${l.summary.lateObservations}`);
  console.log(`- join errors: ${l.summary.joinErrors}`);
  console.log(`- document hash: ${l.expectedLineupHash}`);
  console.log(`- file SHA256: ${sha256File(lineupRel)}`);
  console.log(`- artifact: ${lineupRel}\n`);

  console.log("Immutability");
  console.log(`- Prediction file SHA256 before: ${before.pred?.hash ?? "N/A"}`);
  console.log(`- Prediction file SHA256 after: ${after.pred?.hash ?? "N/A"}`);
  console.log(`- Prediction meta hash: ${predHashMeta ?? "N/A"}`);
  console.log(
    `- Recommendation file SHA256 before: ${before.rec?.hash ?? "N/A"}`,
  );
  console.log(
    `- Recommendation file SHA256 after: ${after.rec?.hash ?? "N/A"}`,
  );
  console.log(
    `- Schedule file SHA256 before: ${before.schedule?.hash ?? "N/A"}`,
  );
  console.log(
    `- Schedule file SHA256 after: ${after.schedule?.hash ?? "N/A"}`,
  );
  console.log(
    `- Starter file SHA256 before: ${before.starter?.hash ?? "N/A"}`,
  );
  console.log(`- Starter file SHA256 after: ${after.starter?.hash ?? "N/A"}`);
  console.log(
    `- Provider Odds file SHA256 before: ${before.odds?.hash ?? "N/A"}`,
  );
  console.log(
    `- Provider Odds file SHA256 after: ${after.odds?.hash ?? "N/A"}`,
  );
  console.log(
    `- Provider Lineup file SHA256 before: ${before.providerLineup?.hash ?? "N/A"}`,
  );
  console.log(
    `- Provider Lineup file SHA256 after: ${after.providerLineup?.hash ?? "N/A"}`,
  );
  console.log(`- Prediction mutation: ${predUnchanged ? "NONE" : "DETECTED"}`);
  console.log(
    `- Recommendation mutation: ${recUnchanged ? "NONE" : "DETECTED"}`,
  );
  console.log(
    `- Schedule mutation: ${scheduleUnchanged ? "NONE" : "DETECTED"}`,
  );
  console.log(`- Starter mutation: ${starterUnchanged ? "NONE" : "DETECTED"}`);
  console.log(
    `- Provider Odds mutation: ${oddsUnchanged ? "NONE" : "DETECTED"}`,
  );
  console.log(
    `- Provider Lineup mutation: ${providerLineupUnchanged ? "NONE" : "DETECTED"}`,
  );
  console.log("");

  console.log("Minnesota Recommendation (read-only)");
  console.log(`- pick: ${minRec?.pick ?? "MISSING"}`);
  console.log(`- tier: ${minRec?.tier ?? "MISSING"}`);
  console.log(`- pickSide: ${minRec?.pickSide ?? "MISSING"}`);
  console.log(`- sealed probability: ${minRec?.probability ?? "MISSING"}`);
  console.log(`- confidence: ${minRec?.confidence ?? "MISSING"}`);
  console.log(
    `- selected-pick % from Prediction: ${selected?.selectedPickProbabilityPercent ?? "MISSING"}`,
  );
  console.log(`- selected-pick source: ${selected?.source ?? "MISSING"}`);
  console.log(
    `- selected-pick semantics correct: ${semanticsCorrect ? "YES" : "NO"}`,
  );
  console.log("");

  if (
    !predUnchanged ||
    !recUnchanged ||
    !scheduleUnchanged ||
    !starterUnchanged ||
    !oddsUnchanged ||
    !providerLineupUnchanged
  ) {
    console.error("MUTATION_DETECTED");
    process.exit(1);
  }

  if (
    k.summary.scheduleGames !== 9 ||
    k.summary.matchedGames !== 9 ||
    k.summary.observedGames !== 9 ||
    k.summary.missingGames !== 0 ||
    mappingRows.some((row) => !row.identityOk) ||
    observedCount !== 9 ||
    notObservedCount !== 0 ||
    l.summary.expectedGames !== 9 ||
    l.summary.missingGames !== 0 ||
    l.summary.teamLineups !== 18 ||
    l.summary.expectedBattingSlots !== 162 ||
    l.summary.confirmedGames !== 0 ||
    l.summary.joinErrors !== 0 ||
    l.games.some((g) => g.lineupStatus !== "EXPECTED")
  ) {
    console.error("SUMMARY_VALIDATION_FAILED", {
      korean: k.summary,
      lineup: l.summary,
      observedCount,
      notObservedCount,
    });
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
