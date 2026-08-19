/**
 * One-shot 2026-08-20/batch-0010 post-freeze confirmed lineup supplement.
 * Raw PNGs must already be byte-copied. Does NOT write Prediction /
 * freeze close / daily summary / batch-0008 / batch-0009.
 *
 *   npx tsx scripts/intake-2026-08-20-batch-0010-post-freeze-lineup-supplement.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BATCH_ID = "2026-08-20/batch-0010";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-20/batch-0010";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-20/batch-0010-post-freeze-lineup-supplement-v0.json";
export const SUPPLEMENT_REL =
  "data/operator-input/mlb/2026-08-20-confirmed-lineup-supplement-batch-0010-v0.json";
export const AUDIT_REL =
  "data/audits/2026-08-20-additional-post-freeze-lineup-supplement-v1.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const PREDICTION_REL = "data/predictions/mlb/2026-08-20.json";
export const STAGE_C_REL = "data/audits/2026-08-20-pregame-freeze-close-v1.json";
export const SUMMARY_REL =
  "data/research/mlb/2026-08-20-daily-research-summary-v1.json";
export const SCHEDULE_REL = "data/research/mlb/2026-08-20-schedule-v1.json";

const S1 = "screenshot_2026-08-20_053815.png";
const S2 = "screenshot_2026-08-20_053821.png";
const SHA1 =
  "f58ad5bc47db7a9a465bdee90d4fac5e12bf619914e19ff155c922b36a09398d";
const SHA2 =
  "49b5e2651cdc3b27ee626a1d9a5881a725ddd6ed0d2c71f9c988d7a12c3f8f53";
const FROZEN_PRED_ARTIFACT =
  "67f22360cdc5d797d81d6582516bc183eb034ff54c1231dddb8c27f567f2a3e6";
const FROZEN_PRED_HASH =
  "334a67a4038626c681f6437f4373053de0b900f3b9ff4afe649dfd27481ab473";
const FROZEN_STAGE_C =
  "7d5bbfceb284711d44eb191fba478be5b110e26b0a709250e0838bb8d3eaca8d";
const FROZEN_SUMMARY =
  "a7d970a1843e6feaf42be80e8ae25a34727801d30e051cc4f481163f7846da47";
const FREEZE_PREDICTED_AT = "2026-08-19T16:27:02.247Z";
const FREEZE_GENERATED_AT = "2026-08-19T16:27:22.953Z";

type Slot = {
  battingOrder: number;
  rawPlayerName: string;
  position: string;
  bats: string;
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function slot(
  battingOrder: number,
  rawPlayerName: string,
  position: string,
  bats: string,
): Slot {
  return { battingOrder, rawPlayerName, position, bats };
}

function classifyTiming(
  observedAt: string,
  freezePredictedAt: string,
  commenceTimeUtc: string,
): "PRE_FREEZE" | "POST_FREEZE_PRE_GAME" | "POST_START" | "UNKNOWN_TIMING" {
  const observed = Date.parse(observedAt);
  const freeze = Date.parse(freezePredictedAt);
  const start = Date.parse(commenceTimeUtc);
  if (!Number.isFinite(observed) || !Number.isFinite(freeze) || !Number.isFinite(start)) {
    return "UNKNOWN_TIMING";
  }
  if (observed <= freeze) return "PRE_FREEZE";
  if (observed < start) return "POST_FREEZE_PRE_GAME";
  return "POST_START";
}

function playerRows(team: string, lineup: Slot[]) {
  return lineup.map((p) => ({
    battingOrder: p.battingOrder,
    playerName: p.rawPlayerName,
    team,
    position: p.position,
    handedness: p.bats,
  }));
}

const CWS = [
  slot(1, "S. Antonacci", "LF", "L"),
  slot(2, "M. Murakami", "1B", "L"),
  slot(3, "M. Vargas", "3B", "R"),
  slot(4, "A. Benintendi", "DH", "L"),
  slot(5, "B. Montgomery", "RF", "S"),
  slot(6, "C. Montgomery", "SS", "L"),
  slot(7, "C. Meidroth", "2B", "R"),
  slot(8, "T. Peters", "CF", "L"),
  slot(9, "Jake Rogers", "C", "R"),
];
const CHC = [
  slot(1, "P. Crow-Armstrong", "DH", "L"),
  slot(2, "Seiya Suzuki", "RF", "R"),
  slot(3, "Alex Bregman", "3B", "R"),
  slot(4, "M. Busch", "1B", "L"),
  slot(5, "Nico Hoerner", "SS", "R"),
  slot(6, "P. Ramirez", "2B", "S"),
  slot(7, "Carson Kelly", "C", "R"),
  slot(8, "Ian Happ", "LF", "S"),
  slot(9, "T. Taylor", "CF", "R"),
];
const ARI = [
  slot(1, "I. Vargas", "2B", "S"),
  slot(2, "C. Carroll", "RF", "L"),
  slot(3, "G. Moreno", "C", "R"),
  slot(4, "G. Perdomo", "SS", "S"),
  slot(5, "N. Arenado", "DH", "R"),
  slot(6, "Tim Tawa", "1B", "R"),
  slot(7, "J. Lawlar", "CF", "R"),
  slot(8, "J. Fernandez", "3B", "R"),
  slot(9, "R. Waldschmidt", "LF", "R"),
];
const BOS = [
  slot(1, "Nick Sogard", "2B", "S"),
  slot(2, "C. Rafaela", "CF", "R"),
  slot(3, "Wilyer Abreu", "RF", "L"),
  slot(4, "W. Contreras", "1B", "R"),
  slot(5, "Caleb Durbin", "3B", "R"),
  slot(6, "M. Gasper", "DH", "S"),
  slot(7, "A. Monasterio", "SS", "R"),
  slot(8, "Jarren Duran", "LF", "L"),
  slot(9, "Connor Wong", "C", "R"),
];
const MIA = [
  slot(1, "Jakob Marsee", "CF", "L"),
  slot(2, "Otto Lopez", "SS", "R"),
  slot(3, "X. Edwards", "2B", "S"),
  slot(4, "G. Conine", "1B", "L"),
  slot(5, "H. Hernandez", "LF", "R"),
  slot(6, "Owen Caissie", "DH", "L"),
  slot(7, "Esteury Ruiz", "RF", "R"),
  slot(8, "Joe Mack", "C", "L"),
  slot(9, "J. Sanoja", "3B", "R"),
];
const PHI = [
  slot(1, "K. Schwarber", "DH", "L"),
  slot(2, "Trea Turner", "SS", "R"),
  slot(3, "Bryce Harper", "RF", "L"),
  slot(4, "Luis Arraez", "2B", "L"),
  slot(5, "Alec Bohm", "1B", "R"),
  slot(6, "Bryson Stott", "3B", "L"),
  slot(7, "B. Marsh", "LF", "L"),
  slot(8, "J. Crawford", "CF", "L"),
  slot(9, "G. Stubbs", "C", "L"),
];
const NYY = [
  slot(1, "T. Grisham", "CF", "L"),
  slot(2, "Ben Rice", "DH", "L"),
  slot(3, "Luis Garcia", "1B", "L"),
  slot(4, "Heliot Ramos", "LF", "R"),
  slot(5, "J. Chisholm", "2B", "L"),
  slot(6, "S. Jones", "RF", "L"),
  slot(7, "Ryan McMahon", "3B", "L"),
  slot(8, "G. Lombard", "SS", "R"),
  slot(9, "Austin Wells", "C", "L"),
];
const BAL_EXPECTED = [
  slot(1, "G. Henderson", "SS", "L"),
  slot(2, "Pete Alonso", "1B", "R"),
  slot(3, "J. Holliday", "2B", "L"),
  slot(4, "S. Basallo", "C", "L"),
  slot(5, "T. O'Neill", "DH", "R"),
  slot(6, "D. Beavers", "LF", "L"),
  slot(7, "C. Encarnacion-Strand", "3B", "R"),
  slot(8, "L. Taveras", "RF", "S"),
  slot(9, "C. Cowser", "CF", "L"),
];
const SF = [
  slot(1, "Jonah Cox", "CF", "R"),
  slot(2, "R. Devers", "DH", "L"),
  slot(3, "Willy Adames", "SS", "R"),
  slot(4, "B. Eldridge", "1B", "L"),
  slot(5, "V. Bericoto", "LF", "R"),
  slot(6, "Jung Hoo Lee", "RF", "L"),
  slot(7, "O. Basabe", "2B", "R"),
  slot(8, "D. Cavanaugh", "C", "L"),
  slot(9, "C. Koss", "3B", "R"),
];
const CLE = [
  slot(1, "Steven Kwan", "LF", "L"),
  slot(2, "Jose Ramirez", "DH", "S"),
  slot(3, "N. Lowe", "1B", "L"),
  slot(4, "A. Martinez", "RF", "S"),
  slot(5, "T. Bazzana", "2B", "L"),
  slot(6, "Angel Genao", "3B", "S"),
  slot(7, "Petey Halpin", "CF", "L"),
  slot(8, "A. Hedges", "C", "R"),
  slot(9, "B. Rocchio", "SS", "S"),
];
const STL = [
  slot(1, "J. Wetherholt", "2B", "L"),
  slot(2, "Ivan Herrera", "DH", "R"),
  slot(3, "A. Burleson", "1B", "L"),
  slot(4, "J. Walker", "RF", "R"),
  slot(5, "N. Church", "CF", "L"),
  slot(6, "Masyn Winn", "SS", "R"),
  slot(7, "Bryan Torres", "LF", "L"),
  slot(8, "Blaze Jordan", "3B", "R"),
  slot(9, "Jimmy Crooks", "C", "L"),
];
const CIN = [
  slot(1, "E. De La Cruz", "SS", "S"),
  slot(2, "Sal Stewart", "1B", "R"),
  slot(3, "Dane Myers", "CF", "R"),
  slot(4, "E. Suarez", "3B", "R"),
  slot(5, "T. Stephenson", "DH", "R"),
  slot(6, "M. Toglia", "RF", "S"),
  slot(7, "JJ Bleday", "LF", "L"),
  slot(8, "Jose Trevino", "C", "R"),
  slot(9, "Matt McLain", "2B", "R"),
];
const TOR = [
  slot(1, "B. Bateman", "CF", "L"),
  slot(2, "Nathan Lukes", "RF", "L"),
  slot(3, "A. Kirk", "DH", "R"),
  slot(4, "K. Okamoto", "1B", "R"),
  slot(5, "A. Gimenez", "SS", "L"),
  slot(6, "J. Sanchez", "LF", "L"),
  slot(7, "Josh Smith", "2B", "L"),
  slot(8, "B. Valenzuela", "C", "S"),
  slot(9, "C. McAdoo", "3B", "R"),
];
const TB = [
  slot(1, "C. Simpson", "LF", "L"),
  slot(2, "J. Caminero", "3B", "R"),
  slot(3, "J. Aranda", "1B", "L"),
  slot(4, "Yandy Diaz", "DH", "R"),
  slot(5, "Liam Hicks", "C", "L"),
  slot(6, "C. Mullins", "CF", "L"),
  slot(7, "Ryan Vilade", "RF", "R"),
  slot(8, "R. Palacios", "2B", "L"),
  slot(9, "Taylor Walls", "SS", "S"),
];
const ATH_EXPECTED = [
  slot(1, "Jeff McNeil", "1B", "L"),
  slot(2, "Jacob Wilson", "SS", "R"),
  slot(3, "Zack Gelof", "LF", "R"),
  slot(4, "L. Butler", "RF", "L"),
  slot(5, "C. Cortes", "DH", "L"),
  slot(6, "D. Walton", "2B", "L"),
  slot(7, "Jonah Heim", "C", "S"),
  slot(8, "Tommy White", "3B", "R"),
  slot(9, "Henry Bolte", "CF", "R"),
];
const KC = [
  slot(1, "Nick Loftin", "2B", "R"),
  slot(2, "Bobby Witt Jr", "SS", "R"),
  slot(3, "J. Caglianone", "RF", "L"),
  slot(4, "M. Garcia", "3B", "R"),
  slot(5, "V. Pasquantino", "1B", "L"),
  slot(6, "S. Perez", "DH", "R"),
  slot(7, "C. Jensen", "C", "L"),
  slot(8, "T. Tolbert", "LF", "R"),
  slot(9, "Kyle Isbel", "CF", "L"),
];
const SEA = [
  slot(1, "B. Donovan", "3B", "L"),
  slot(2, "R. Arozarena", "LF", "R"),
  slot(3, "D. Canzone", "RF", "L"),
  slot(4, "J. Rodriguez", "CF", "R"),
  slot(5, "Josh Naylor", "1B", "L"),
  slot(6, "Cole Young", "2B", "L"),
  slot(7, "Cal Raleigh", "C", "S"),
  slot(8, "Taylor Ward", "DH", "R"),
  slot(9, "Brock Rodden", "SS", "S"),
];
const MIL_EXPECTED = [
  slot(1, "Brice Turang", "2B", "L"),
  slot(2, "J. Chourio", "LF", "R"),
  slot(3, "Jake Bauers", "RF", "L"),
  slot(4, "W. Contreras", "C", "R"),
  slot(5, "G. Mitchell", "CF", "L"),
  slot(6, "A. Vaughn", "1B", "R"),
  slot(7, "C. Yelich", "DH", "L"),
  slot(8, "D. Hamilton", "3B", "L"),
  slot(9, "Cooper Pratt", "SS", "R"),
];
const WSH_EXPECTED = [
  slot(1, "CJ Abrams", "2B", "L"),
  slot(2, "A. Ortiz", "1B", "L"),
  slot(3, "Dylan Crews", "RF", "R"),
  slot(4, "Daylen Lile", "LF", "L"),
  slot(5, "Brady House", "DH", "R"),
  slot(6, "Keibert Ruiz", "C", "S"),
  slot(7, "Nasim Nunez", "SS", "S"),
  slot(8, "Jorbit Vivas", "3B", "L"),
  slot(9, "Jacob Young", "CF", "R"),
];
const TEX = [
  slot(1, "Joc Pederson", "1B", "L"),
  slot(2, "Corey Seager", "SS", "L"),
  slot(3, "W. Langford", "DH", "R"),
  slot(4, "B. Nimmo", "RF", "L"),
  slot(5, "E. Duran", "3B", "R"),
  slot(6, "Evan Carter", "CF", "L"),
  slot(7, "J. Kelenic", "LF", "L"),
  slot(8, "Elias Diaz", "C", "R"),
  slot(9, "Nicky Lopez", "2B", "L"),
];
const LAA = [
  slot(1, "Wade Meckler", "LF", "L"),
  slot(2, "Mike Trout", "CF", "R"),
  slot(3, "N. Schanuel", "1B", "L"),
  slot(4, "Zach Neto", "SS", "R"),
  slot(5, "M. Ballesteros", "C", "L"),
  slot(6, "V. Grissom", "DH", "R"),
  slot(7, "Josh Lowe", "RF", "L"),
  slot(8, "D. Guzman", "3B", "R"),
  slot(9, "O. Peraza", "2B", "R"),
];
const HOU = [
  slot(1, "Jeremy Pena", "SS", "R"),
  slot(2, "Y. Alvarez", "DH", "L"),
  slot(3, "I. Paredes", "3B", "R"),
  slot(4, "Jose Altuve", "2B", "R"),
  slot(5, "LaMonte Wade", "LF", "L"),
  slot(6, "Cam Smith", "RF", "R"),
  slot(7, "C. Walker", "1B", "R"),
  slot(8, "T. Trammell", "CF", "L"),
  slot(9, "C. Vazquez", "C", "R"),
];
const LAD_EXPECTED = [
  slot(1, "S. Ohtani", "DH", "L"),
  slot(2, "Andy Pages", "CF", "R"),
  slot(3, "F. Freeman", "1B", "L"),
  slot(4, "Tommy Edman", "2B", "S"),
  slot(5, "Mookie Betts", "SS", "R"),
  slot(6, "Kyle Tucker", "RF", "L"),
  slot(7, "T. Hernandez", "LF", "R"),
  slot(8, "E. Hernandez", "3B", "R"),
  slot(9, "Ben Rortvedt", "C", "L"),
];
const COL_EXPECTED = [
  slot(1, "J. McCarthy", "LF", "L"),
  slot(2, "Cole Carrigg", "CF", "S"),
  slot(3, "M. Moniak", "DH", "L"),
  slot(4, "TJ Rumfield", "1B", "L"),
  slot(5, "Willi Castro", "3B", "S"),
  slot(6, "Zac Veen", "RF", "L"),
  slot(7, "Connor Norby", "2B", "R"),
  slot(8, "B. Sullivan", "C", "L"),
  slot(9, "E. Tovar", "SS", "R"),
];

type Shot = {
  file: string;
  sha256: string;
  bytes: number;
  receivedAtKst: string;
  operatorObservedAt: string;
  observedAt: string;
  rel: string;
};

function card(input: {
  displayedStartEt: string;
  displayedStartKst: string;
  awayTeam: string;
  homeTeam: string;
  shot: Shot;
  lineupType: "CONFIRMED" | "EXPECTED";
  completeness: "FULL" | "PARTIAL";
  confirmedSides: Array<"AWAY" | "HOME">;
  expectedSides: Array<"AWAY" | "HOME">;
  gamePk: number;
  internalGameId: string;
  commenceTimeUtc: string;
  awayStarterRaw: string;
  homeStarterRaw: string;
  awayLineup: Slot[];
  homeLineup: Slot[];
  note?: string;
}) {
  const timing = classifyTiming(
    input.shot.observedAt,
    FREEZE_PREDICTED_AT,
    input.commenceTimeUtc,
  );
  return {
    displayedStartEt: input.displayedStartEt,
    displayedStartKst: input.displayedStartKst,
    awayTeam: input.awayTeam,
    homeTeam: input.homeTeam,
    screenshotFile: input.shot.file,
    screenshotSha256: input.shot.sha256,
    screenshotRel: input.shot.rel,
    receivedAtKst: input.shot.receivedAtKst,
    operatorObservedAt: input.shot.operatorObservedAt,
    observedAt: input.shot.observedAt,
    lineupType: input.lineupType,
    confirmedLineup: input.lineupType === "CONFIRMED",
    officialLineup: false,
    completeness: input.completeness,
    confirmedSides: input.confirmedSides,
    expectedSides: input.expectedSides,
    status: "MATCHED_UNIQUE" as const,
    gamePk: input.gamePk,
    internalGameId: input.internalGameId,
    commenceTimeUtc: input.commenceTimeUtc,
    scheduleStartKst: input.displayedStartKst,
    timingVsPredictionFreeze: timing,
    timingVsGame: timing === "POST_START" ? "POST_START" : "PRE_GAME",
    predictionInput: false,
    awayStarterRaw: input.awayStarterRaw,
    homeStarterRaw: input.homeStarterRaw,
    note: input.note ?? null,
    awayLineup: input.awayLineup,
    homeLineup: input.homeLineup,
  };
}

function supplementRow(input: {
  gamePk: number;
  internalGameId: string;
  matchup: string;
  team: string;
  side: "AWAY" | "HOME";
  shot: Shot;
  commenceTimeUtc: string;
  completeness: "FULL" | "PARTIAL";
  players: Slot[];
  note?: string;
}) {
  const timing = classifyTiming(
    input.shot.observedAt,
    FREEZE_PREDICTED_AT,
    input.commenceTimeUtc,
  );
  return {
    gamePk: input.gamePk,
    internalGameId: input.internalGameId,
    matchup: input.matchup,
    team: input.team,
    side: input.side,
    joinStatus: "MATCHED_UNIQUE",
    observedAt: input.shot.observedAt,
    operatorObservedAt: input.shot.operatorObservedAt,
    freezePredictedAt: FREEZE_PREDICTED_AT,
    commenceTimeUtc: input.commenceTimeUtc,
    relativeToFreeze: timing,
    relativeToStart: timing === "POST_START" ? "POST_START" : "PRE_GAME",
    timingVsPredictionFreeze: timing,
    timingVsGame: timing === "POST_START" ? "POST_START" : "PRE_GAME",
    lineupStatus: "CONFIRMED_FULL",
    completeness: input.completeness,
    officialLineup: false,
    predictionInput: false,
    predictionFrozen: true,
    supplementalEvidenceOnly: true,
    sourceScreenshot: input.shot.rel,
    sourceHash: input.shot.sha256,
    ...(input.note ? { note: input.note } : {}),
    players: playerRows(input.team, input.players),
  };
}

async function main() {
  const cwd = process.cwd();
  const predAbs = path.join(cwd, PREDICTION_REL);
  const stageCAbs = path.join(cwd, STAGE_C_REL);
  const summaryAbs = path.join(cwd, SUMMARY_REL);
  const predSha = sha256File(predAbs);
  const stageCSha = sha256File(stageCAbs);
  const summarySha = sha256File(summaryAbs);
  if (predSha !== FROZEN_PRED_ARTIFACT) {
    throw new Error(`Prediction hash changed before intake: ${predSha}`);
  }
  if (stageCSha !== FROZEN_STAGE_C) {
    throw new Error(`Freeze close hash changed before intake: ${stageCSha}`);
  }
  if (summarySha !== FROZEN_SUMMARY) {
    throw new Error(`Daily summary hash changed before intake: ${summarySha}`);
  }

  const png1 = path.join(cwd, RAW_REL, S1);
  const png2 = path.join(cwd, RAW_REL, S2);
  if (!existsSync(png1) || !existsSync(png2)) {
    throw new Error("batch-0010 raw PNGs missing");
  }
  if (sha256File(png1) !== SHA1) throw new Error("S1 sha mismatch");
  if (sha256File(png2) !== SHA2) throw new Error("S2 sha mismatch");

  const shot1: Shot = {
    file: S1,
    sha256: SHA1,
    bytes: 200395,
    receivedAtKst: "2026-08-20T05:38:15+09:00",
    operatorObservedAt: "2026-08-20T05:38:15+09:00",
    observedAt: "2026-08-19T20:38:15.000Z",
    rel: `${RAW_REL}/${S1}`,
  };
  const shot2: Shot = {
    file: S2,
    sha256: SHA2,
    bytes: 191682,
    receivedAtKst: "2026-08-20T05:38:21+09:00",
    operatorObservedAt: "2026-08-20T05:38:21+09:00",
    observedAt: "2026-08-19T20:38:21.000Z",
    rel: `${RAW_REL}/${S2}`,
  };

  const confirmedLineups = [
    card({
      displayedStartEt: "2:20 PM ET",
      displayedStartKst: "03:20",
      awayTeam: "Chicago White Sox",
      homeTeam: "Chicago Cubs",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 824640,
      internalGameId: "mlb-chicago-cubs-chicago-white-sox",
      commenceTimeUtc: "2026-08-19T18:20:00Z",
      awayStarterRaw: "Jose Urquidy (R), 1-1, 8.10 ERA",
      homeStarterRaw: "Clay Holmes (R), 5-5, 2.56 ERA",
      awayLineup: CWS,
      homeLineup: CHC,
      note: "POST_START recapture. Same matchup was sealed in batch-0009 as POST_FREEZE_PRE_GAME. Expected slots were not copied.",
    }),
    card({
      displayedStartEt: "4:10 PM ET",
      displayedStartKst: "05:10",
      awayTeam: "Arizona Diamondbacks",
      homeTeam: "Boston Red Sox",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 824722,
      internalGameId: "mlb-boston-red-sox-arizona-diamondbacks",
      commenceTimeUtc: "2026-08-19T20:10:00Z",
      awayStarterRaw: "Brandon Pfaadt (R)",
      homeStarterRaw: "Payton Tolle (L)",
      awayLineup: ARI,
      homeLineup: BOS,
    }),
    card({
      displayedStartEt: "6:05 PM ET",
      displayedStartKst: "07:05",
      awayTeam: "Miami Marlins",
      homeTeam: "Philadelphia Phillies",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 823424,
      internalGameId: "mlb-philadelphia-phillies-miami-marlins",
      commenceTimeUtc: "2026-08-19T22:05:00Z",
      awayStarterRaw: "Sandy Alcantara (R)",
      homeStarterRaw: "Aaron Nola (R)",
      awayLineup: MIA,
      homeLineup: PHI,
    }),
    card({
      displayedStartEt: "6:35 PM ET",
      displayedStartKst: "07:35",
      awayTeam: "New York Yankees",
      homeTeam: "Baltimore Orioles",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "PARTIAL",
      confirmedSides: ["AWAY"],
      expectedSides: ["HOME"],
      gamePk: 824801,
      internalGameId: "mlb-baltimore-orioles-new-york-yankees",
      commenceTimeUtc: "2026-08-19T22:35:00Z",
      awayStarterRaw: "Will Warren (R)",
      homeStarterRaw: "Chris Bassitt (R)",
      awayLineup: NYY,
      homeLineup: [],
      note: "Mixed card: NYY Confirmed Lineup, BAL Expected Lineup. Home expected players were not copied into this confirmed record.",
    }),
    card({
      displayedStartEt: "6:40 PM ET",
      displayedStartKst: "07:40",
      awayTeam: "San Francisco Giants",
      homeTeam: "Cleveland Guardians",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 824394,
      internalGameId: "mlb-cleveland-guardians-san-francisco-giants",
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      awayStarterRaw: "Matt Wilkinson (L)",
      homeStarterRaw: "Parker Messick (L)",
      awayLineup: SF,
      homeLineup: CLE,
    }),
    card({
      displayedStartEt: "6:40 PM ET",
      displayedStartKst: "07:40",
      awayTeam: "St. Louis Cardinals",
      homeTeam: "Cincinnati Reds",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 824476,
      internalGameId: "mlb-cincinnati-reds-st-louis-cardinals",
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      awayStarterRaw: "M. Liberatore (L)",
      homeStarterRaw: "Chase Burns (R)",
      awayLineup: STL,
      homeLineup: CIN,
    }),
    card({
      displayedStartEt: "6:40 PM ET",
      displayedStartKst: "07:40",
      awayTeam: "Toronto Blue Jays",
      homeTeam: "Tampa Bay Rays",
      shot: shot2,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 822937,
      internalGameId: "mlb-tampa-bay-rays-toronto-blue-jays",
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      awayStarterRaw: "Max Scherzer (R), 1-5, 6.59 ERA",
      homeStarterRaw: "Drew Rasmussen (R), 12-5, 2.78 ERA",
      awayLineup: TOR,
      homeLineup: TB,
    }),
    card({
      displayedStartEt: "7:40 PM ET",
      displayedStartKst: "08:40",
      awayTeam: "Athletics",
      homeTeam: "Kansas City Royals",
      shot: shot2,
      lineupType: "CONFIRMED",
      completeness: "PARTIAL",
      confirmedSides: ["HOME"],
      expectedSides: ["AWAY"],
      gamePk: 824076,
      internalGameId: "mlb-kansas-city-royals-athletics",
      commenceTimeUtc: "2026-08-19T23:40:00Z",
      awayStarterRaw: "Jeffrey Springs (L), 3-11, 6.17 ERA",
      homeStarterRaw: "Seth Lugo (R), 5-7, 4.59 ERA",
      awayLineup: [],
      homeLineup: KC,
      note: "Mixed card: ATH Expected Lineup, KC Confirmed Lineup. Away expected players were not copied into this confirmed record.",
    }),
    card({
      displayedStartEt: "7:40 PM ET",
      displayedStartKst: "08:40",
      awayTeam: "Seattle Mariners",
      homeTeam: "Milwaukee Brewers",
      shot: shot2,
      lineupType: "CONFIRMED",
      completeness: "PARTIAL",
      confirmedSides: ["AWAY"],
      expectedSides: ["HOME"],
      gamePk: 823748,
      internalGameId: "mlb-milwaukee-brewers-seattle-mariners",
      commenceTimeUtc: "2026-08-19T23:40:00Z",
      awayStarterRaw: "Logan Gilbert (R), 9-7, 3.28 ERA",
      homeStarterRaw: "Dustin May (R), 6-7, 4.13 ERA",
      awayLineup: SEA,
      homeLineup: [],
      note: "Mixed card: SEA Confirmed Lineup, MIL Expected Lineup. Home expected players were not copied into this confirmed record.",
    }),
    card({
      displayedStartEt: "8:05 PM ET",
      displayedStartKst: "09:05",
      awayTeam: "Washington Nationals",
      homeTeam: "Texas Rangers",
      shot: shot2,
      lineupType: "CONFIRMED",
      completeness: "PARTIAL",
      confirmedSides: ["HOME"],
      expectedSides: ["AWAY"],
      gamePk: 822860,
      internalGameId: "mlb-texas-rangers-washington-nationals",
      commenceTimeUtc: "2026-08-20T00:05:00Z",
      awayStarterRaw: "Cade Cavalli (R), 10-5, 3.36 ERA",
      homeStarterRaw: "Kumar Rocker (R), 4-9, 4.50 ERA",
      awayLineup: [],
      homeLineup: TEX,
      note: "Mixed card: WSH Expected Lineup, TEX Confirmed Lineup. Away expected players were not copied into this confirmed record.",
    }),
    card({
      displayedStartEt: "8:10 PM ET",
      displayedStartKst: "09:10",
      awayTeam: "Los Angeles Angels",
      homeTeam: "Houston Astros",
      shot: shot2,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 824155,
      internalGameId: "mlb-houston-astros-los-angeles-angels",
      commenceTimeUtc: "2026-08-20T00:10:00Z",
      awayStarterRaw: "Walbert Urena (R), 8-8, 2.67 ERA",
      homeStarterRaw: "Ethan Pecko (R), 0-0, 0.00 ERA",
      awayLineup: LAA,
      homeLineup: HOU,
    }),
  ];

  const expectedLineups = [
    card({
      displayedStartEt: "6:35 PM ET",
      displayedStartKst: "07:35",
      awayTeam: "New York Yankees",
      homeTeam: "Baltimore Orioles",
      shot: shot1,
      lineupType: "EXPECTED",
      completeness: "PARTIAL",
      confirmedSides: ["AWAY"],
      expectedSides: ["HOME"],
      gamePk: 824801,
      internalGameId: "mlb-baltimore-orioles-new-york-yankees",
      commenceTimeUtc: "2026-08-19T22:35:00Z",
      awayStarterRaw: "Will Warren (R)",
      homeStarterRaw: "Chris Bassitt (R)",
      awayLineup: [],
      homeLineup: BAL_EXPECTED,
      note: "Mixed card: only BAL Expected Lineup recorded here. NYY Confirmed players were not copied into this expected record.",
    }),
    card({
      displayedStartEt: "7:40 PM ET",
      displayedStartKst: "08:40",
      awayTeam: "Athletics",
      homeTeam: "Kansas City Royals",
      shot: shot2,
      lineupType: "EXPECTED",
      completeness: "PARTIAL",
      confirmedSides: ["HOME"],
      expectedSides: ["AWAY"],
      gamePk: 824076,
      internalGameId: "mlb-kansas-city-royals-athletics",
      commenceTimeUtc: "2026-08-19T23:40:00Z",
      awayStarterRaw: "Jeffrey Springs (L), 3-11, 6.17 ERA",
      homeStarterRaw: "Seth Lugo (R), 5-7, 4.59 ERA",
      awayLineup: ATH_EXPECTED,
      homeLineup: [],
      note: "Mixed card: only ATH Expected Lineup recorded here. KC Confirmed players were not copied into this expected record.",
    }),
    card({
      displayedStartEt: "7:40 PM ET",
      displayedStartKst: "08:40",
      awayTeam: "Seattle Mariners",
      homeTeam: "Milwaukee Brewers",
      shot: shot2,
      lineupType: "EXPECTED",
      completeness: "PARTIAL",
      confirmedSides: ["AWAY"],
      expectedSides: ["HOME"],
      gamePk: 823748,
      internalGameId: "mlb-milwaukee-brewers-seattle-mariners",
      commenceTimeUtc: "2026-08-19T23:40:00Z",
      awayStarterRaw: "Logan Gilbert (R), 9-7, 3.28 ERA",
      homeStarterRaw: "Dustin May (R), 6-7, 4.13 ERA",
      awayLineup: [],
      homeLineup: MIL_EXPECTED,
      note: "Mixed card: only MIL Expected Lineup recorded here. SEA Confirmed players were not copied into this expected record.",
    }),
    card({
      displayedStartEt: "8:05 PM ET",
      displayedStartKst: "09:05",
      awayTeam: "Washington Nationals",
      homeTeam: "Texas Rangers",
      shot: shot2,
      lineupType: "EXPECTED",
      completeness: "PARTIAL",
      confirmedSides: ["HOME"],
      expectedSides: ["AWAY"],
      gamePk: 822860,
      internalGameId: "mlb-texas-rangers-washington-nationals",
      commenceTimeUtc: "2026-08-20T00:05:00Z",
      awayStarterRaw: "Cade Cavalli (R), 10-5, 3.36 ERA",
      homeStarterRaw: "Kumar Rocker (R), 4-9, 4.50 ERA",
      awayLineup: WSH_EXPECTED,
      homeLineup: [],
      note: "Mixed card: only WSH Expected Lineup recorded here. TEX Confirmed players were not copied into this expected record.",
    }),
    card({
      displayedStartEt: "8:40 PM ET",
      displayedStartKst: "09:40",
      awayTeam: "Los Angeles Dodgers",
      homeTeam: "Colorado Rockies",
      shot: shot2,
      lineupType: "EXPECTED",
      completeness: "FULL",
      confirmedSides: [],
      expectedSides: ["AWAY", "HOME"],
      gamePk: 824318,
      internalGameId: "mlb-colorado-rockies-los-angeles-dodgers",
      commenceTimeUtc: "2026-08-20T00:40:00Z",
      awayStarterRaw: "Roki Sasaki (R), 5-5, 4.46 ERA",
      homeStarterRaw: "Kyle Freeland (L), 4-10, 6.27 ERA",
      awayLineup: LAD_EXPECTED,
      homeLineup: COL_EXPECTED,
      note: "Both sides still Expected Lineup. Not copied into Confirmed.",
    }),
  ];

  const rows = [
    supplementRow({
      gamePk: 824640,
      internalGameId: "mlb-chicago-cubs-chicago-white-sox",
      matchup: "Chicago White Sox @ Chicago Cubs",
      team: "Chicago White Sox",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T18:20:00Z",
      completeness: "FULL",
      players: CWS,
      note: "POST_START recapture of a matchup already sealed in batch-0009.",
    }),
    supplementRow({
      gamePk: 824640,
      internalGameId: "mlb-chicago-cubs-chicago-white-sox",
      matchup: "Chicago White Sox @ Chicago Cubs",
      team: "Chicago Cubs",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T18:20:00Z",
      completeness: "FULL",
      players: CHC,
      note: "POST_START recapture of a matchup already sealed in batch-0009.",
    }),
    supplementRow({
      gamePk: 824722,
      internalGameId: "mlb-boston-red-sox-arizona-diamondbacks",
      matchup: "Arizona Diamondbacks @ Boston Red Sox",
      team: "Arizona Diamondbacks",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T20:10:00Z",
      completeness: "FULL",
      players: ARI,
    }),
    supplementRow({
      gamePk: 824722,
      internalGameId: "mlb-boston-red-sox-arizona-diamondbacks",
      matchup: "Arizona Diamondbacks @ Boston Red Sox",
      team: "Boston Red Sox",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T20:10:00Z",
      completeness: "FULL",
      players: BOS,
    }),
    supplementRow({
      gamePk: 823424,
      internalGameId: "mlb-philadelphia-phillies-miami-marlins",
      matchup: "Miami Marlins @ Philadelphia Phillies",
      team: "Miami Marlins",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:05:00Z",
      completeness: "FULL",
      players: MIA,
    }),
    supplementRow({
      gamePk: 823424,
      internalGameId: "mlb-philadelphia-phillies-miami-marlins",
      matchup: "Miami Marlins @ Philadelphia Phillies",
      team: "Philadelphia Phillies",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:05:00Z",
      completeness: "FULL",
      players: PHI,
    }),
    supplementRow({
      gamePk: 824801,
      internalGameId: "mlb-baltimore-orioles-new-york-yankees",
      matchup: "New York Yankees @ Baltimore Orioles",
      team: "New York Yankees",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:35:00Z",
      completeness: "FULL",
      players: NYY,
      note: "BAL remained Expected on this screenshot and was not copied into Confirmed.",
    }),
    supplementRow({
      gamePk: 824394,
      internalGameId: "mlb-cleveland-guardians-san-francisco-giants",
      matchup: "San Francisco Giants @ Cleveland Guardians",
      team: "San Francisco Giants",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      completeness: "FULL",
      players: SF,
    }),
    supplementRow({
      gamePk: 824394,
      internalGameId: "mlb-cleveland-guardians-san-francisco-giants",
      matchup: "San Francisco Giants @ Cleveland Guardians",
      team: "Cleveland Guardians",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      completeness: "FULL",
      players: CLE,
    }),
    supplementRow({
      gamePk: 824476,
      internalGameId: "mlb-cincinnati-reds-st-louis-cardinals",
      matchup: "St. Louis Cardinals @ Cincinnati Reds",
      team: "St. Louis Cardinals",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      completeness: "FULL",
      players: STL,
    }),
    supplementRow({
      gamePk: 824476,
      internalGameId: "mlb-cincinnati-reds-st-louis-cardinals",
      matchup: "St. Louis Cardinals @ Cincinnati Reds",
      team: "Cincinnati Reds",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      completeness: "FULL",
      players: CIN,
    }),
    supplementRow({
      gamePk: 822937,
      internalGameId: "mlb-tampa-bay-rays-toronto-blue-jays",
      matchup: "Toronto Blue Jays @ Tampa Bay Rays",
      team: "Toronto Blue Jays",
      side: "AWAY",
      shot: shot2,
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      completeness: "FULL",
      players: TOR,
    }),
    supplementRow({
      gamePk: 822937,
      internalGameId: "mlb-tampa-bay-rays-toronto-blue-jays",
      matchup: "Toronto Blue Jays @ Tampa Bay Rays",
      team: "Tampa Bay Rays",
      side: "HOME",
      shot: shot2,
      commenceTimeUtc: "2026-08-19T22:40:00Z",
      completeness: "FULL",
      players: TB,
    }),
    supplementRow({
      gamePk: 824076,
      internalGameId: "mlb-kansas-city-royals-athletics",
      matchup: "Athletics @ Kansas City Royals",
      team: "Kansas City Royals",
      side: "HOME",
      shot: shot2,
      commenceTimeUtc: "2026-08-19T23:40:00Z",
      completeness: "FULL",
      players: KC,
      note: "ATH remained Expected on this screenshot and was not copied into Confirmed.",
    }),
    supplementRow({
      gamePk: 823748,
      internalGameId: "mlb-milwaukee-brewers-seattle-mariners",
      matchup: "Seattle Mariners @ Milwaukee Brewers",
      team: "Seattle Mariners",
      side: "AWAY",
      shot: shot2,
      commenceTimeUtc: "2026-08-19T23:40:00Z",
      completeness: "FULL",
      players: SEA,
      note: "MIL remained Expected on this screenshot and was not copied into Confirmed.",
    }),
    supplementRow({
      gamePk: 822860,
      internalGameId: "mlb-texas-rangers-washington-nationals",
      matchup: "Washington Nationals @ Texas Rangers",
      team: "Texas Rangers",
      side: "HOME",
      shot: shot2,
      commenceTimeUtc: "2026-08-20T00:05:00Z",
      completeness: "FULL",
      players: TEX,
      note: "WSH remained Expected on this screenshot and was not copied into Confirmed.",
    }),
    supplementRow({
      gamePk: 824155,
      internalGameId: "mlb-houston-astros-los-angeles-angels",
      matchup: "Los Angeles Angels @ Houston Astros",
      team: "Los Angeles Angels",
      side: "AWAY",
      shot: shot2,
      commenceTimeUtc: "2026-08-20T00:10:00Z",
      completeness: "FULL",
      players: LAA,
    }),
    supplementRow({
      gamePk: 824155,
      internalGameId: "mlb-houston-astros-los-angeles-angels",
      matchup: "Los Angeles Angels @ Houston Astros",
      team: "Houston Astros",
      side: "HOME",
      shot: shot2,
      commenceTimeUtc: "2026-08-20T00:10:00Z",
      completeness: "FULL",
      players: HOU,
    }),
  ];

  const timingGames = [
    ...confirmedLineups.map((g) => ({
      gamePk: g.gamePk,
      matchup: `${g.awayTeam} @ ${g.homeTeam}`,
      observedAt: g.observedAt,
      freezePredictedAt: FREEZE_PREDICTED_AT,
      startTime: g.commenceTimeUtc,
      relativeToFreeze: g.timingVsPredictionFreeze,
      relativeToStart: g.timingVsGame,
    })),
    {
      gamePk: 824318,
      matchup: "Los Angeles Dodgers @ Colorado Rockies",
      observedAt: shot2.observedAt,
      freezePredictedAt: FREEZE_PREDICTED_AT,
      startTime: "2026-08-20T00:40:00Z",
      relativeToFreeze: classifyTiming(
        shot2.observedAt,
        FREEZE_PREDICTED_AT,
        "2026-08-20T00:40:00Z",
      ),
      relativeToStart: "PRE_GAME" as const,
    },
  ];

  const generatedAt = new Date().toISOString();
  const predAfter = sha256File(predAbs);
  const freezeAfter = sha256File(stageCAbs);
  const summaryAfter = sha256File(summaryAbs);
  if (predAfter !== predSha) throw new Error("Prediction mutated during intake");
  if (freezeAfter !== stageCSha) throw new Error("Freeze close mutated during intake");
  if (summaryAfter !== summarySha) throw new Error("Daily summary mutated during intake");

  const structured = {
    schemaVersion: "yang-edge-post-freeze-lineup-supplement-v0",
    batchId: BATCH_ID,
    receivedDateKst: "2026-08-20",
    slateDateKst: "2026-08-20",
    intendedOperatingDateKst: "2026-08-20",
    receivedAtKst: "2026-08-20T05:38:21+09:00",
    observedAt: "2026-08-19T20:38:21.000Z",
    operatorObservedAt: "2026-08-20T05:38:21+09:00",
    captureTime: "2026-08-20T05:38:21+09:00",
    captureTimeSource: "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE",
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    classification: "POST_FREEZE_CONFIRMED_LINEUP_SUPPLEMENT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    predictionInput: false,
    predictionFrozen: true,
    predictionRerunAllowed: false,
    supplementalEvidenceOnly: true,
    officialPredictionRel: PREDICTION_REL,
    freezePredictedAt: FREEZE_PREDICTED_AT,
    freezeGeneratedAt: FREEZE_GENERATED_AT,
    predictionHashSha256: FROZEN_PRED_HASH,
    note: "Additional post-freeze operator lineup screenshots after batch-0009. Visible Confirmed Lineup labels only copied into Confirmed. Expected slots were not copied into Confirmed. CWS@CHC and ARI@BOS are POST_START. Not written into frozen Prediction.",
    screenshots: [
      {
        file: S1,
        originalInboxName: "스크린샷 2026-08-20 053815.png",
        category: "MLB_CONFIRMED_LINEUP",
        sha256: SHA1,
        bytes: 200395,
        receivedAtKst: shot1.receivedAtKst,
        operatorObservedAt: shot1.operatorObservedAt,
        observedAt: shot1.observedAt,
        timingClass: "MIXED_POST_START_AND_POST_FREEZE_PRE_GAME",
        predictionInput: false,
        rel: shot1.rel,
      },
      {
        file: S2,
        originalInboxName: "스크린샷 2026-08-20 053821.png",
        category: "MLB_MIXED_CONFIRMED_EXPECTED_LINEUP",
        sha256: SHA2,
        bytes: 191682,
        receivedAtKst: shot2.receivedAtKst,
        operatorObservedAt: shot2.operatorObservedAt,
        observedAt: shot2.observedAt,
        timingClass: "POST_FREEZE_PRE_GAME",
        predictionInput: false,
        rel: shot2.rel,
      },
    ],
    confirmedLineups,
    expectedLineups,
    summary: {
      screenshots: 2,
      confirmedCards: 7,
      expectedCards: 1,
      mixedCards: 4,
      uncertainCards: 0,
      confirmedFullGames: 7,
      confirmedPartialGames: 4,
      confirmedPlayerSlots: 162,
      matchedUnique: 12,
      ambiguous: 0,
      notFound: 0,
      preFreeze: 0,
      postFreezePregame: 10,
      postStart: 2,
      unknownTiming: 0,
      predictionInputTrue: 0,
    },
  };

  const supplement = {
    schemaVersion: "mlb-confirmed-lineup-supplement-v0",
    dateKst: "2026-08-20",
    league: "MLB",
    observationType: "CONFIRMED_LINEUP_SUPPLEMENT",
    sourceType: "MANUAL_OBSERVATION",
    sourceLabel: "수동 관찰 · ADDITIONAL POST_FREEZE CONFIRMED LINEUP SUPPLEMENT",
    officialLineup: false,
    predictionInput: false,
    predictionFrozen: true,
    predictionRerunAllowed: false,
    supplementalEvidenceOnly: true,
    predictionArtifact: PREDICTION_REL,
    freezePredictedAt: FREEZE_PREDICTED_AT,
    freezeGeneratedAt: FREEZE_GENERATED_AT,
    predictionHashSha256: FROZEN_PRED_HASH,
    predictionArtifactSha256: FROZEN_PRED_ARTIFACT,
    batchId: BATCH_ID,
    enteredBy: "OPERATOR",
    note: "New evidence only from batch-0010. Does not mutate 2026-08-20-confirmed-lineup-observation-v0.json or batch-0009 supplement. Expected slots were not copied into Confirmed. CWS@CHC is a POST_START recapture of a batch-0009 matchup.",
    rows,
    summary: {
      newScreenshots: 2,
      games: 11,
      teams: 18,
      full: 18,
      partial: 0,
      playerSlots: 162,
      expectedCopiedIntoConfirmed: 0,
      predictionInputTrue: 0,
      preFreeze: 0,
      postFreezePregame: 9,
      postStart: 2,
      unknownTiming: 0,
      matchedUnique: 11,
      ambiguous: 0,
      notFound: 0,
    },
  };

  const audit = {
    schemaVersion: "yang-edge-additional-post-freeze-lineup-supplement-v1",
    dateKst: "2026-08-20",
    generatedAt,
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    stageStatus: "SUPPLEMENTAL_RESEARCH_ONLY",
    mandatoryCompletion: {
      A: "10/10",
      B: "20/20",
      C: "20/20",
      D: "10/10",
      total: "60%",
      supplementalMissionEffect: "0%",
      stageBReevaluated: false,
      stageCReevaluated: false,
      stageDReevaluated: false,
    },
    freeze: {
      predictionArtifact: PREDICTION_REL,
      predictionHash: FROZEN_PRED_HASH,
      predictionArtifactSha256: FROZEN_PRED_ARTIFACT,
      predictedAt: FREEZE_PREDICTED_AT,
      generatedAt: FREEZE_GENERATED_AT,
      stageCCloseRel: STAGE_C_REL,
      stageCCloseSha256: FROZEN_STAGE_C,
      dailySummaryRel: SUMMARY_REL,
      dailySummarySha256: FROZEN_SUMMARY,
      priorSupplementRel:
        "data/operator-observations/structured/2026-08-20/batch-0009-post-freeze-lineup-supplement-v0.json",
    },
    intake: {
      inboxRoot: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX",
      operatingDropFolder:
        "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19",
      discoveredPngFullInbox: 34,
      newScreenshots: 2,
      duplicates: 32,
      duplicatesInOperatingDropFolder: 12,
      duplicatesOlderInbox: 20,
      confirmedCards: 7,
      expectedCards: 1,
      mixedCards: 4,
      uncertainCards: 0,
      otherCards: 0,
      rawBatch: BATCH_ID,
      newFiles: [
        {
          filename: "스크린샷 2026-08-20 053815.png",
          fullPath:
            "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19\\스크린샷 2026-08-20 053815.png",
          sealedName: S1,
          bytes: 200395,
          creationTime: "2026-08-20T05:38:15+09:00",
          lastWriteTime: "2026-08-20T05:38:15+09:00",
          sha256: SHA1,
          classification: "MIXED_CONFIRMED_LINEUP_GRID",
          observedAt: shot1.observedAt,
          observedAtSource: "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE",
        },
        {
          filename: "스크린샷 2026-08-20 053821.png",
          fullPath:
            "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19\\스크린샷 2026-08-20 053821.png",
          sealedName: S2,
          bytes: 191682,
          creationTime: "2026-08-20T05:38:21+09:00",
          lastWriteTime: "2026-08-20T05:38:21+09:00",
          sha256: SHA2,
          classification: "MIXED_CONFIRMED_EXPECTED_LINEUP_GRID",
          observedAt: shot2.observedAt,
          observedAtSource: "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE",
        },
      ],
    },
    timing: {
      preFreeze: 0,
      postFreezePregame: 10,
      postStart: 2,
      unknown: 0,
      games: timingGames,
    },
    identity: {
      matched: 12,
      ambiguous: 0,
      notFound: 0,
      gamePks: timingGames.map((g) => g.gamePk),
      scheduleRel: SCHEDULE_REL,
      scheduleProviderRecalled: false,
    },
    confirmedLineups: {
      games: 11,
      teams: 18,
      full: 18,
      partialGames: 4,
      playerSlots: 162,
      expectedCopiedIntoConfirmed: 0,
    },
    researchValue: {
      preFreezeConfirmedGames: [],
      postFreezePregameConfirmedGames: [
        823424, 824801, 824394, 824476, 822937, 824076, 823748, 822860, 824155,
      ],
      postStartConfirmedGames: [824640, 824722],
      unknownTimingGames: [],
      stillExpectedBothSides: [824318],
      notes: [
        "A PRE_FREEZE: 0. Both new screenshots have observedAt after predictedAt 2026-08-19T16:27:02.247Z.",
        "B POST_FREEZE_PRE_GAME: MIA@PHI 823424, NYY@BAL 824801 (NYY only), SF@CLE 824394, STL@CIN 824476, TOR@TB 822937, ATH@KC 824076 (KC only), SEA@MIL 823748 (SEA only), WSH@TEX 822860 (TEX only), LAA@HOU 824155. LAD@COL 824318 remains Expected both sides.",
        "C POST_START: CWS@CHC 824640 and ARI@BOS 824722. Screenshot filename/CreationTime 05:38 KST is after scheduled first pitch. Not used as Prediction or Grade input.",
        "824640 was already sealed in batch-0009 as POST_FREEZE_PRE_GAME FULL confirmed. This batch is a later POST_START recapture, not a Prediction rewind.",
        "Expected sides on mixed cards were transcribed separately and were not copied into Confirmed.",
      ],
      futureQuestion:
        "POST_FREEZE_PRE_GAME confirmed lineup이 frozen Prediction의 inputQuality / PASS / edge에 어떤 영향을 줄 수 있었는가?",
      counterfactualPredictionExecuted: false,
      answerComputed: false,
    },
    prediction: {
      artifact: PREDICTION_REL,
      frozen: true,
      rerun: false,
      modified: false,
      predictionInputTrue: 0,
      predictionRerunAllowed: false,
      supplementalEvidenceOnly: true,
      hashBefore: predSha,
      hashAfter: predAfter,
      predictionHashSha256Before: FROZEN_PRED_HASH,
      predictionHashSha256After: FROZEN_PRED_HASH,
    },
    network: {
      providerCalls: 0,
      mlbStatsApi: 0,
      theOddsApi: 0,
      apiFootball: 0,
      lineupProvider: 0,
      starterProvider: 0,
    },
    postgame: {
      resultCalls: 0,
      postgameCalls: 0,
      gradeCalls: 0,
      reviewCalls: 0,
    },
    engine: {
      predictionCalls: 0,
      engineCalls: 0,
      recommendationCalls: 0,
    },
    wrote: [
      MANIFEST_REL,
      README_REL,
      `${RAW_REL}/${S1}`,
      `${RAW_REL}/${S2}`,
      STRUCTURED_REL,
      SUPPLEMENT_REL,
      AUDIT_REL,
    ],
  };

  const manifest = {
    schemaVersion: "yang-edge-inbox-raw-batch-v1",
    batchId: BATCH_ID,
    receivedAtKst: "2026-08-20T05:38:21+09:00",
    captureTime: "2026-08-20T05:38:21+09:00",
    captureTimeSource: "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE",
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    predictionInput: false,
    predictionAlreadyFrozen: true,
    predictionHash: FROZEN_PRED_HASH,
    officialPredictionRel: PREDICTION_REL,
    observationPhase: "POST_FREEZE_MIXED_PRE_GAME_AND_POST_START",
    timingClass: "POST_FREEZE_MIXED_PRE_GAME_AND_POST_START",
    availableAtPredictionFreeze: false,
    availableBeforeKickoff: false,
    slateDateKst: "2026-08-20",
    receivedDateKst: "2026-08-20",
    inboxPath: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19",
    notes: [
      "Additional supplemental post-freeze lineup screenshots. Copied byte-identical from INBOX. SHA-256 verified on copy.",
      "Windows screenshot filename HHMMSS agrees with CreationTime; used as observedAt.",
      "Prediction 2026-08-20 is already frozen. predictionInput remains false. Do not rerun Prediction.",
      "Does not mutate batch-0008, batch-0009, confirmed-lineup-observation-v0, expected-lineup-observation-v0, freeze close, or daily summary.",
      "CWS@CHC and ARI@BOS are POST_START. Remaining visible games are POST_FREEZE_PRE_GAME. Expected slots were not copied into Confirmed.",
    ],
    files: [
      {
        file: S1,
        originalInboxName: "스크린샷 2026-08-20 053815.png",
        category: "MLB_CONFIRMED_LINEUP",
        sha256: SHA1,
        bytes: 200395,
        receivedAtKst: shot1.receivedAtKst,
        operatorObservedAt: shot1.operatorObservedAt,
        timingClass: "MIXED_POST_START_AND_POST_FREEZE_PRE_GAME",
        predictionInput: false,
        duplicateSource: false,
      },
      {
        file: S2,
        originalInboxName: "스크린샷 2026-08-20 053821.png",
        category: "MLB_MIXED_CONFIRMED_EXPECTED_LINEUP",
        sha256: SHA2,
        bytes: 191682,
        receivedAtKst: shot2.receivedAtKst,
        operatorObservedAt: shot2.operatorObservedAt,
        timingClass: "POST_FREEZE_PRE_GAME",
        predictionInput: false,
        duplicateSource: false,
      },
    ],
  };

  const readme = `YANG EDGE — Additional Post-Freeze Lineup Supplemental Raw Batch
batchId: 2026-08-20/batch-0010
Inbox: C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19\\
Received (latest screenshot CreationTime): 2026-08-20T05:38:21+09:00
captureTimeSource: WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE
slateDateKst: 2026-08-20
observationPhase: POST_FREEZE_MIXED_PRE_GAME_AND_POST_START
predictionInput: false
predictionAlreadyFrozen: true

Contents
- screenshot_2026-08-20_053815.png — CWS@CHC POST_START FULL; ARI@BOS POST_START FULL; MIA@PHI / SF@CLE / STL@CIN POST_FREEZE_PRE_GAME FULL; NYY@BAL PARTIAL (NYY confirmed / BAL expected)
- screenshot_2026-08-20_053821.png — TOR@TB / LAA@HOU POST_FREEZE_PRE_GAME FULL; ATH@KC / SEA@MIL / WSH@TEX PARTIAL; LAD@COL Expected both sides

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. Supplemental only. Does not mutate frozen Prediction / Stage B / Stage C artifacts.
3. predictionInput = false. Do not rerun Prediction or Engine.
4. researchOnly = true, engineAdmission = PROHIBITED.
5. Inbox folder 2026-08-19 is drop location. Operating date is 2026-08-20.
6. Do not merge Expected slots into Confirmed. Do not call providers.
7. Do not mutate batch-0008 or batch-0009.
`;

  await mkdir(path.join(cwd, RAW_REL), { recursive: true });
  await mkdir(path.dirname(path.join(cwd, STRUCTURED_REL)), { recursive: true });
  await mkdir(path.dirname(path.join(cwd, SUPPLEMENT_REL)), { recursive: true });
  await mkdir(path.dirname(path.join(cwd, AUDIT_REL)), { recursive: true });
  await writeFile(path.join(cwd, MANIFEST_REL), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await writeFile(path.join(cwd, README_REL), readme, "utf8");
  await writeFile(path.join(cwd, STRUCTURED_REL), JSON.stringify(structured, null, 2) + "\n", "utf8");
  await writeFile(path.join(cwd, SUPPLEMENT_REL), JSON.stringify(supplement, null, 2) + "\n", "utf8");
  await writeFile(path.join(cwd, AUDIT_REL), JSON.stringify(audit, null, 2) + "\n", "utf8");

  if (sha256File(predAbs) !== FROZEN_PRED_ARTIFACT) {
    throw new Error("Prediction hash changed after write");
  }
  console.log("SEALED 2026-08-20/batch-0010");
  console.log(JSON.stringify({
    predictionHashUnchanged: true,
    freezeHashUnchanged: sha256File(stageCAbs) === FROZEN_STAGE_C,
    summaryHashUnchanged: sha256File(summaryAbs) === FROZEN_SUMMARY,
    confirmedCards: 7,
    mixedCards: 4,
    expectedCards: 1,
    postStart: 2,
    postFreezePregame: 10,
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
