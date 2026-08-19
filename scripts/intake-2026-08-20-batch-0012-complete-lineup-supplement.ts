/**
 * One-shot 2026-08-20/batch-0012 complete lineup coverage supplement.
 * Raw PNG must already be byte-copied. Does NOT write Prediction /
 * freeze close / daily summary / batch-0008..0011.
 *
 *   npx tsx scripts/intake-2026-08-20-batch-0012-complete-lineup-supplement.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BATCH_ID = "2026-08-20/batch-0012";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-20/batch-0012";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-20/batch-0012-complete-lineup-supplement-v0.json";
export const SUPPLEMENT_REL =
  "data/operator-input/mlb/2026-08-20-confirmed-lineup-supplement-batch-0012-v0.json";
export const AUDIT_REL =
  "data/audits/2026-08-20-complete-lineup-coverage-supplement-v1.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const PREDICTION_REL = "data/predictions/mlb/2026-08-20.json";
export const STAGE_C_REL = "data/audits/2026-08-20-pregame-freeze-close-v1.json";
export const SUMMARY_REL =
  "data/research/mlb/2026-08-20-daily-research-summary-v1.json";
export const SCHEDULE_REL = "data/research/mlb/2026-08-20-schedule-v1.json";

const S1 = "screenshot_2026-08-20_071002.png";
const SHA1 =
  "2332e94ccdc1a8e09bd3c8c94a0359fbf72e12de15fcfbafd76b754433a5fd4c";
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
type CoverageStatus = "FULL_CONFIRMED_BOTH" | "PARTIAL_CONFIRMED" | "EXPECTED_BOTH";
type Shot = {
  file: string;
  sha256: string;
  bytes: number;
  receivedAtKst: string;
  operatorObservedAt: string;
  observedAt: string;
  rel: string;
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}
function slot(battingOrder: number, rawPlayerName: string, position: string, bats: string): Slot {
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
function countFull(map: Map<number, CoverageStatus>): number {
  return [...map.values()].filter((s) => s === "FULL_CONFIRMED_BOTH").length;
}
function snapshot(map: Map<number, CoverageStatus>, scheduleLen: number) {
  const full = countFull(map);
  const partial = [...map.values()].filter((s) => s === "PARTIAL_CONFIRMED").length;
  const expected = [...map.values()].filter((s) => s === "EXPECTED_BOTH").length;
  return {
    knownGames: map.size,
    slateGames: scheduleLen,
    fullConfirmedBoth: full,
    partialConfirmed: partial,
    expectedRemaining: expected,
  };
}

const WSH = [
  slot(1, "CJ Abrams", "SS", "L"),
  slot(2, "A. Ortiz", "1B", "L"),
  slot(3, "Jose Tena", "LF", "L"),
  slot(4, "Daylen Lile", "RF", "L"),
  slot(5, "A. Chaparro", "DH", "R"),
  slot(6, "Keibert Ruiz", "C", "S"),
  slot(7, "Jacob Young", "CF", "R"),
  slot(8, "Jorbit Vivas", "3B", "L"),
  slot(9, "Nasim Nunez", "2B", "S"),
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
const LAD = [
  slot(1, "S. Ohtani", "DH", "L"),
  slot(2, "Andy Pages", "CF", "R"),
  slot(3, "T. Hernandez", "LF", "R"),
  slot(4, "F. Freeman", "1B", "L"),
  slot(5, "Mookie Betts", "SS", "R"),
  slot(6, "Miguel Rojas", "2B", "R"),
  slot(7, "Kyle Tucker", "RF", "L"),
  slot(8, "E. Hernandez", "3B", "R"),
  slot(9, "Ben Rortvedt", "C", "L"),
];
const COL = [
  slot(1, "J. McCarthy", "RF", "L"),
  slot(2, "M. Moniak", "DH", "L"),
  slot(3, "Cole Carrigg", "CF", "S"),
  slot(4, "TJ Rumfield", "1B", "L"),
  slot(5, "Zac Veen", "LF", "L"),
  slot(6, "Connor Norby", "3B", "R"),
  slot(7, "Adael Amador", "2B", "S"),
  slot(8, "B. Sullivan", "C", "L"),
  slot(9, "E. Tovar", "SS", "R"),
];

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
  const timing = classifyTiming(input.shot.observedAt, FREEZE_PREDICTED_AT, input.commenceTimeUtc);
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
  players: Slot[];
  note?: string;
}) {
  const timing = classifyTiming(input.shot.observedAt, FREEZE_PREDICTED_AT, input.commenceTimeUtc);
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
    completeness: "FULL",
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
  if (predSha !== FROZEN_PRED_ARTIFACT) throw new Error(`Prediction hash changed: ${predSha}`);
  if (sha256File(stageCAbs) !== FROZEN_STAGE_C) throw new Error("Freeze close hash changed");
  if (sha256File(summaryAbs) !== FROZEN_SUMMARY) throw new Error("Daily summary hash changed");

  const png1 = path.join(cwd, RAW_REL, S1);
  if (!existsSync(png1)) throw new Error("batch-0012 raw PNG missing");
  if (sha256File(png1) !== SHA1) throw new Error("S1 sha mismatch");

  const shot1: Shot = {
    file: S1,
    sha256: SHA1,
    bytes: 101096,
    receivedAtKst: "2026-08-20T07:10:02+09:00",
    operatorObservedAt: "2026-08-20T07:10:02+09:00",
    observedAt: "2026-08-19T22:10:02.000Z",
    rel: `${RAW_REL}/${S1}`,
  };

  const confirmedLineups = [
    card({
      displayedStartEt: "8:05 PM ET",
      displayedStartKst: "09:05",
      awayTeam: "Washington Nationals",
      homeTeam: "Texas Rangers",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 822860,
      internalGameId: "mlb-texas-rangers-washington-nationals",
      commenceTimeUtc: "2026-08-20T00:05:00Z",
      awayStarterRaw: "Cade Cavalli (R), 10-5, 3.36 ERA",
      homeStarterRaw: "Kumar Rocker (R), 4-9, 4.50 ERA",
      awayLineup: WSH,
      homeLineup: TEX,
      note: "Already FULL in batch-0011. Append-only recapture on the same screenshot as LAD@COL.",
    }),
    card({
      displayedStartEt: "8:10 PM ET",
      displayedStartKst: "09:10",
      awayTeam: "Los Angeles Angels",
      homeTeam: "Houston Astros",
      shot: shot1,
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
      note: "Already FULL in batch-0011. Append-only recapture on the same screenshot as LAD@COL.",
    }),
    card({
      displayedStartEt: "8:40 PM ET",
      displayedStartKst: "09:40",
      awayTeam: "Los Angeles Dodgers",
      homeTeam: "Colorado Rockies",
      shot: shot1,
      lineupType: "CONFIRMED",
      completeness: "FULL",
      confirmedSides: ["AWAY", "HOME"],
      expectedSides: [],
      gamePk: 824318,
      internalGameId: "mlb-colorado-rockies-los-angeles-dodgers",
      commenceTimeUtc: "2026-08-20T00:40:00Z",
      awayStarterRaw: "Roki Sasaki (R), 5-5, 4.46 ERA",
      homeStarterRaw: "Kyle Freeland (L), 4-10, 6.27 ERA",
      awayLineup: LAD,
      homeLineup: COL,
      note: "Newly FULL vs batch-0011 EXPECTED both sides. Visible Confirmed Lineup on both LAD and COL, 9/9 each. Expected slots were not copied; slots are from this Confirmed screenshot only.",
    }),
  ];

  const rows = [
    supplementRow({
      gamePk: 822860,
      internalGameId: "mlb-texas-rangers-washington-nationals",
      matchup: "Washington Nationals @ Texas Rangers",
      team: "Washington Nationals",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-20T00:05:00Z",
      players: WSH,
    }),
    supplementRow({
      gamePk: 822860,
      internalGameId: "mlb-texas-rangers-washington-nationals",
      matchup: "Washington Nationals @ Texas Rangers",
      team: "Texas Rangers",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-20T00:05:00Z",
      players: TEX,
    }),
    supplementRow({
      gamePk: 824155,
      internalGameId: "mlb-houston-astros-los-angeles-angels",
      matchup: "Los Angeles Angels @ Houston Astros",
      team: "Los Angeles Angels",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-20T00:10:00Z",
      players: LAA,
    }),
    supplementRow({
      gamePk: 824155,
      internalGameId: "mlb-houston-astros-los-angeles-angels",
      matchup: "Los Angeles Angels @ Houston Astros",
      team: "Houston Astros",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-20T00:10:00Z",
      players: HOU,
    }),
    supplementRow({
      gamePk: 824318,
      internalGameId: "mlb-colorado-rockies-los-angeles-dodgers",
      matchup: "Los Angeles Dodgers @ Colorado Rockies",
      team: "Los Angeles Dodgers",
      side: "AWAY",
      shot: shot1,
      commenceTimeUtc: "2026-08-20T00:40:00Z",
      players: LAD,
      note: "Newly confirmed vs batch-0011 EXPECTED. Slots from this screenshot only.",
    }),
    supplementRow({
      gamePk: 824318,
      internalGameId: "mlb-colorado-rockies-los-angeles-dodgers",
      matchup: "Los Angeles Dodgers @ Colorado Rockies",
      team: "Colorado Rockies",
      side: "HOME",
      shot: shot1,
      commenceTimeUtc: "2026-08-20T00:40:00Z",
      players: COL,
      note: "Newly confirmed vs batch-0011 EXPECTED. Slots from this screenshot only.",
    }),
  ];

  const schedule = JSON.parse(readFileSync(path.join(cwd, SCHEDULE_REL), "utf8")) as {
    games: Array<{ gamePk: number; awayTeam: string; homeTeam: string; commenceTimeUtc: string }>;
  };
  const freezeConfirmed = JSON.parse(
    readFileSync(path.join(cwd, "data/operator-input/mlb/2026-08-20-confirmed-lineup-observation-v0.json"), "utf8"),
  ) as { games: Array<{ gamePk: number; completeness: string }> };
  const batch0009 = JSON.parse(
    readFileSync(path.join(cwd, "data/operator-observations/structured/2026-08-20/batch-0009-post-freeze-lineup-supplement-v0.json"), "utf8"),
  ) as { confirmedLineups: Array<{ gamePk: number; completeness: string; confirmedSides: string[] }> };
  const batch0010 = JSON.parse(
    readFileSync(path.join(cwd, "data/operator-observations/structured/2026-08-20/batch-0010-post-freeze-lineup-supplement-v0.json"), "utf8"),
  ) as {
    confirmedLineups: Array<{ gamePk: number; completeness: string; confirmedSides: string[] }>;
    expectedLineups: Array<{ gamePk: number; confirmedSides: string[]; expectedSides: string[] }>;
  };
  const batch0011 = JSON.parse(
    readFileSync(path.join(cwd, "data/operator-observations/structured/2026-08-20/batch-0011-post-freeze-lineup-supplement-v0.json"), "utf8"),
  ) as {
    confirmedLineups: Array<{ gamePk: number; completeness: string; confirmedSides: string[] }>;
    expectedLineups: Array<{ gamePk: number; confirmedSides: string[]; expectedSides: string[] }>;
  };

  function applyConfirmed(
    map: Map<number, CoverageStatus>,
    games: Array<{ gamePk: number; completeness: string; confirmedSides?: string[] }>,
  ) {
    for (const g of games) {
      const both =
        g.completeness === "FULL" &&
        (g.confirmedSides == null || g.confirmedSides.length === 2);
      map.set(g.gamePk, both ? "FULL_CONFIRMED_BOTH" : "PARTIAL_CONFIRMED");
    }
  }
  function applyExpected(
    map: Map<number, CoverageStatus>,
    games: Array<{ gamePk: number; confirmedSides: string[]; expectedSides: string[] }>,
  ) {
    for (const g of games) {
      if (g.confirmedSides.length === 0 && g.expectedSides.length === 2) {
        map.set(g.gamePk, "EXPECTED_BOTH");
      }
    }
  }

  const latest = new Map<number, CoverageStatus>();
  applyConfirmed(latest, freezeConfirmed.games);
  const atFreeze = snapshot(latest, schedule.games.length);
  applyConfirmed(latest, batch0009.confirmedLineups);
  const after0009 = snapshot(latest, schedule.games.length);
  applyConfirmed(latest, batch0010.confirmedLineups);
  applyExpected(latest, batch0010.expectedLineups);
  const after0010 = snapshot(latest, schedule.games.length);
  applyConfirmed(latest, batch0011.confirmedLineups);
  applyExpected(latest, batch0011.expectedLineups);
  const after0011 = snapshot(latest, schedule.games.length);
  applyConfirmed(latest, confirmedLineups);
  const after0012 = snapshot(latest, schedule.games.length);

  const coverageGames = schedule.games.map((g) => ({
    gamePk: g.gamePk,
    matchup: `${g.awayTeam} @ ${g.homeTeam}`,
    latestStatus: latest.get(g.gamePk) ?? "UNKNOWN",
    commenceTimeUtc: g.commenceTimeUtc,
  }));
  const notFully = coverageGames.filter((g) => g.latestStatus !== "FULL_CONFIRMED_BOTH");
  if (coverageGames.some((g) => g.latestStatus === "UNKNOWN")) {
    throw new Error("coverage unknown remains");
  }

  const generatedAt = new Date().toISOString();
  const predAfter = sha256File(predAbs);
  if (predAfter !== predSha) throw new Error("Prediction mutated during intake");

  const structured = {
    schemaVersion: "yang-edge-post-freeze-lineup-supplement-v0",
    batchId: BATCH_ID,
    receivedDateKst: "2026-08-20",
    slateDateKst: "2026-08-20",
    intendedOperatingDateKst: "2026-08-20",
    receivedAtKst: "2026-08-20T07:10:02+09:00",
    observedAt: "2026-08-19T22:10:02.000Z",
    operatorObservedAt: "2026-08-20T07:10:02+09:00",
    captureTime: "2026-08-20T07:10:02+09:00",
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
    note: "Complete-coverage supplemental screenshot. LAD@COL visible Confirmed Lineup both sides 9/9. Expected slots were not copied into Confirmed. Not written into frozen Prediction.",
    screenshots: [
      {
        file: S1,
        originalInboxName: "스크린샷 2026-08-20 071002.png",
        category: "MLB_CONFIRMED_LINEUP",
        sha256: SHA1,
        bytes: 101096,
        receivedAtKst: shot1.receivedAtKst,
        operatorObservedAt: shot1.operatorObservedAt,
        observedAt: shot1.observedAt,
        timingClass: "POST_FREEZE_PRE_GAME",
        predictionInput: false,
        rel: shot1.rel,
      },
    ],
    confirmedLineups,
    expectedLineups: [],
    summary: {
      screenshots: 1,
      confirmedCards: 3,
      expectedCards: 0,
      mixedCards: 0,
      uncertainCards: 0,
      confirmedFullGames: 3,
      confirmedPartialGames: 0,
      confirmedPlayerSlots: 54,
      matchedUnique: 3,
      ambiguous: 0,
      notFound: 0,
      preFreeze: 0,
      postFreezePregame: 3,
      postStart: 0,
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
    sourceLabel: "수동 관찰 · COMPLETE POST_FREEZE CONFIRMED LINEUP SUPPLEMENT",
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
    note: "New evidence only from batch-0012. Does not mutate prior batches. LAD@COL newly FULL confirmed from visible Confirmed Lineup labels. Expected slots were not copied.",
    rows,
    summary: {
      newScreenshots: 1,
      games: 3,
      teams: 6,
      full: 6,
      partial: 0,
      playerSlots: 54,
      expectedCopiedIntoConfirmed: 0,
      predictionInputTrue: 0,
      preFreeze: 0,
      postFreezePregame: 3,
      postStart: 0,
      unknownTiming: 0,
      matchedUnique: 3,
      ambiguous: 0,
      notFound: 0,
    },
  };

  const audit = {
    schemaVersion: "yang-edge-complete-lineup-coverage-supplement-v1",
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
        "data/operator-observations/structured/2026-08-20/batch-0011-post-freeze-lineup-supplement-v0.json",
    },
    intake: {
      inboxRoot: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX",
      operatingDropFolder: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19",
      discoveredPngFullInbox: 37,
      newScreenshots: 1,
      duplicates: 36,
      duplicatesInOperatingDropFolder: 16,
      duplicatesOlderInbox: 20,
      confirmedCards: 3,
      expectedCards: 0,
      mixedCards: 0,
      uncertainCards: 0,
      otherCards: 0,
      rawBatch: BATCH_ID,
      newFiles: [
        {
          filename: "스크린샷 2026-08-20 071002.png",
          fullPath:
            "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19\\스크린샷 2026-08-20 071002.png",
          sealedName: S1,
          bytes: 101096,
          creationTime: "2026-08-20T07:10:02+09:00",
          lastWriteTime: "2026-08-20T07:10:02+09:00",
          sha256: SHA1,
          classification: "CONFIRMED_LINEUP",
          observedAt: shot1.observedAt,
          observedAtSource: "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE",
        },
      ],
    },
    ladCol: {
      gamePk: 824318,
      matchup: "Los Angeles Dodgers @ Colorado Rockies",
      dodgersStatus: "CONFIRMED",
      dodgersConfirmedSlots: 9,
      rockiesStatus: "CONFIRMED",
      rockiesConfirmedSlots: 9,
      fullConfirmedBoth: true,
      previousStatus: "EXPECTED_BOTH",
      previousBatch: "2026-08-20/batch-0011",
    },
    timing: {
      preFreeze: 0,
      postFreezePregame: 3,
      postStart: 0,
      unknown: 0,
      games: confirmedLineups.map((g) => ({
        gamePk: g.gamePk,
        matchup: `${g.awayTeam} @ ${g.homeTeam}`,
        observedAt: g.observedAt,
        freezePredictedAt: FREEZE_PREDICTED_AT,
        startTime: g.commenceTimeUtc,
        relativeToFreeze: g.timingVsPredictionFreeze,
        relativeToStart: g.timingVsGame,
      })),
    },
    identity: {
      matched: 3,
      ambiguous: 0,
      notFound: 0,
      gamePks: confirmedLineups.map((g) => g.gamePk),
      scheduleRel: SCHEDULE_REL,
      scheduleProviderRecalled: false,
    },
    confirmedLineups: {
      games: 3,
      teams: 6,
      full: 6,
      partialGames: 0,
      playerSlots: 54,
      expectedCopiedIntoConfirmed: 0,
    },
    lineupAvailabilityProgression: {
      method: "APPEND_ONLY_LATEST_WINS",
      engineConnected: false,
      atPredictionFreeze: atFreeze,
      afterBatch0009: after0009,
      afterBatch0010: after0010,
      afterBatch0011: after0011,
      afterFinalBatch0012: after0012,
    },
    latestCoverage: {
      method: "APPEND_ONLY_LATEST_WINS",
      priorBatchesNotMutated: [
        "2026-08-20/batch-0008",
        "2026-08-20/batch-0009",
        "2026-08-20/batch-0010",
        "2026-08-20/batch-0011",
      ],
      mlbTotalGames: 15,
      fullConfirmedBoth: after0012.fullConfirmedBoth,
      partialConfirmed: after0012.partialConfirmed,
      expectedRemaining: after0012.expectedRemaining,
      games: coverageGames,
      notFullyConfirmed: notFully,
    },
    researchValue: {
      preFreezeConfirmedGames: [],
      postFreezePregameConfirmedGames: confirmedLineups.map((g) => g.gamePk),
      postStartConfirmedGames: [],
      unknownTimingGames: [],
      stillExpectedBothSides: [],
      notes: [
        "A PRE_FREEZE: 0. Screenshot observedAt 2026-08-19T22:10:02.000Z is after predictedAt.",
        "B POST_FREEZE_PRE_GAME: WSH@TEX, LAA@HOU, LAD@COL all observed before scheduled start.",
        "C POST_START: 0 in this batch.",
        "824318 LAD@COL is newly FULL confirmed. Expected slots from batch-0011 were not copied.",
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
    postgame: { resultCalls: 0, postgameCalls: 0, gradeCalls: 0, reviewCalls: 0 },
    engine: { predictionCalls: 0, engineCalls: 0, recommendationCalls: 0 },
    wrote: [
      MANIFEST_REL,
      README_REL,
      `${RAW_REL}/${S1}`,
      STRUCTURED_REL,
      SUPPLEMENT_REL,
      AUDIT_REL,
    ],
  };

  const manifest = {
    schemaVersion: "yang-edge-inbox-raw-batch-v1",
    batchId: BATCH_ID,
    receivedAtKst: "2026-08-20T07:10:02+09:00",
    captureTime: "2026-08-20T07:10:02+09:00",
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
    observationPhase: "POST_FREEZE_PRE_GAME",
    timingClass: "POST_FREEZE_PRE_GAME",
    availableAtPredictionFreeze: false,
    availableBeforeKickoff: true,
    slateDateKst: "2026-08-20",
    receivedDateKst: "2026-08-20",
    inboxPath: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19",
    notes: [
      "Complete-coverage supplemental screenshot. Copied byte-identical from INBOX. SHA-256 verified on copy.",
      "Windows screenshot filename HHMMSS agrees with CreationTime; used as observedAt.",
      "Prediction 2026-08-20 is already frozen. predictionInput remains false.",
      "Does not mutate batch-0008/0009/0010/0011, freeze close, or daily summary.",
      "LAD@COL newly FULL confirmed. WSH@TEX and LAA@HOU are already-full recaptures.",
    ],
    files: [
      {
        file: S1,
        originalInboxName: "스크린샷 2026-08-20 071002.png",
        category: "MLB_CONFIRMED_LINEUP",
        sha256: SHA1,
        bytes: 101096,
        receivedAtKst: shot1.receivedAtKst,
        operatorObservedAt: shot1.operatorObservedAt,
        timingClass: "POST_FREEZE_PRE_GAME",
        predictionInput: false,
        duplicateSource: false,
      },
    ],
  };

  const readme = `YANG EDGE — Complete Lineup Coverage Supplemental Raw Batch
batchId: 2026-08-20/batch-0012
Inbox: C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19\\
Received (screenshot CreationTime): 2026-08-20T07:10:02+09:00
captureTimeSource: WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE
slateDateKst: 2026-08-20
observationPhase: POST_FREEZE_PRE_GAME
predictionInput: false
predictionAlreadyFrozen: true

Contents
- screenshot_2026-08-20_071002.png — WSH@TEX FULL recapture; LAA@HOU FULL recapture; LAD@COL newly Confirmed Lineup FULL both sides

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. Supplemental only. Does not mutate frozen Prediction / Stage B / Stage C artifacts.
3. predictionInput = false. Do not rerun Prediction or Engine.
4. researchOnly = true, engineAdmission = PROHIBITED.
5. Do not merge Expected slots into Confirmed. Do not call providers.
6. Do not mutate batch-0008, batch-0009, batch-0010, or batch-0011.
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
  console.log("SEALED 2026-08-20/batch-0012");
  console.log(JSON.stringify({
    predictionHashUnchanged: true,
    ladColFullConfirmedBoth: true,
    postFreezePregame: 3,
    postStart: 0,
    latestFullConfirmedBoth: after0012.fullConfirmedBoth,
    latestPartial: after0012.partialConfirmed,
    latestExpected: after0012.expectedRemaining,
    notFullyConfirmed: notFully,
    progression: {
      atFreeze: atFreeze.fullConfirmedBoth,
      after0009: after0009.fullConfirmedBoth,
      after0010: after0010.fullConfirmedBoth,
      after0011: after0011.fullConfirmedBoth,
      after0012: after0012.fullConfirmedBoth,
    },
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
