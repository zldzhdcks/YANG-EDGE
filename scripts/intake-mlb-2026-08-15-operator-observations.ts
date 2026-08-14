/**
 * One-shot MLB 2026-08-15 operator observation intake.
 *
 *   npm run intake:mlb-2026-08-15-operator-observations
 *
 * Transcribes Expected Lineup + Korean domestic screenshot evidence.
 * Does NOT write Prediction / Recommendation / Engine / provider odds.
 * Does NOT persist screenshot images.
 * Does NOT hardcode gamePk — resolves exact away+home from Schedule.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMlbScheduleArtifact } from "../src/lib/mlb/build-mlb-schedule-artifact";
import {
  buildMlbDomesticMarketsV1,
  mlbDomesticMarketsRel,
  type AdminScreenshotGameRow,
} from "../src/lib/mlb/domestic-markets-v1/build-from-admin-rows";
import type { MlbDomesticMarketsDocument } from "../src/lib/mlb/domestic-markets-v1/types";
import {
  parseExpectedLineupPaste,
  saveMlbExpectedLineupObservation,
  mlbExpectedLineupObservationRel,
  type MlbExpectedLineupDraftBatter,
  type MlbExpectedLineupDraftGame,
} from "../src/lib/mlb/expected-lineup-observation-v0";
import {
  saveMlbKoreanMarketOddsObservation,
  mlbKoreanMarketOddsObservationRel,
  type MlbKoreanMarketOddsDraftGame,
} from "../src/lib/mlb/korean-market-odds-observation-v0";
import type { MlbScheduleArtifactGame } from "../src/lib/mlb/mlb-schedule-artifact-types";

export const DATE_KST = "2026-08-15";

export const ORIGINAL_OBSERVED_AT = "2026-08-14T13:42:36.510Z";

export const OLD_EXPECTED_LINEUP_HASH =
  "005b088d011dd988665b96500f2862f6c477361ddf73089471bec0c8a69bad63";

export const PROTECTED_SCHEDULE_HASH =
  "e2f807cef14a29db70fe4fb516bfd20fbba64c693e332a51ab656b0c797c58c6";

export const PROTECTED_DOMESTIC_ROWS_HASH =
  "b4c739c28134e50bde0ab806e3385e4b89e20aed451939fc6f99b6708600031c";

export const PROTECTED_KOREAN_MARKET_HASH =
  "7e7b20612ddb04777be29e2b6924bb7f7196531600faea0de8fca5f867e3f156";

export const LINEUP_TRANSCRIPTION_CORRECTION_FIELDS = [
  "Miami Marlins:H. Hernandez:bats L->R",
  "Tampa Bay Rays:Liam Hicks:bats R->L",
  "Arizona Diamondbacks:G. Carroll->C. Carroll",
  "New York Mets:Luis Robert Jr.->Luis Robert",
] as const;

export const LINEUP_NOTE =
  "Screenshot exact capture timestamp unknown; observedAt is operator ingestion time before first pitch. EXPECTED only — not CONFIRMED. providerPlayerId=null.";

export const MARKET_NOTE =
  "Screenshot exact capture timestamp unknown; observedAt is operator ingestion time before first pitch. ADMIN / OPERATOR SCREENSHOT OBSERVATION — not Provider odds.";

const AUDIT_REL =
  "data/audits/2026-08-15-mlb-operator-observations-intake-v0.json";

export type LineupSlateEntry = {
  awayTeam: string;
  homeTeam: string;
  away: string[];
  home: string[];
};

/** Exact schedule team names. gamePk resolved at intake time. */
export const LINEUP_SLATE: LineupSlateEntry[] = [
  {
    awayTeam: "St. Louis Cardinals",
    homeTeam: "Chicago Cubs",
    away: [
      "2B J. Wetherholt L",
      "DH Ivan Herrera R",
      "1B A. Burleson L",
      "RF J. Walker R",
      "CF N. Church L",
      "SS Masyn Winn R",
      "3B Jose Fermin R",
      "C Jimmy Crooks L",
      "LF Bryan Torres L",
    ],
    home: [
      "CF P. Crow-Armstrong L",
      "RF Seiya Suzuki R",
      "3B Alex Bregman R",
      "C Carson Kelly R",
      "1B M. Busch L",
      "2B Nico Hoerner R",
      "LF T. Taylor R",
      "DH P. Ramirez S",
      "SS D. Swanson R",
    ],
  },
  {
    awayTeam: "Miami Marlins",
    homeTeam: "Cincinnati Reds",
    away: [
      "2B X. Edwards S",
      "SS Otto Lopez R",
      "1B G. Conine L",
      "LF H. Hernandez R",
      "CF Jakob Marsee L",
      "3B J. Sanoja R",
      "RF Owen Caissie L",
      "DH A. Ramirez R",
      "C Joe Mack L",
    ],
    home: [
      "SS E. De La Cruz S",
      "1B Sal Stewart R",
      "LF JJ Bleday L",
      "C T. Stephenson R",
      "DH E. Suarez R",
      "RF H. Rodriguez L",
      "CF Dane Myers R",
      "2B Matt McLain R",
      "3B K. Hayes R",
    ],
  },
  {
    awayTeam: "Chicago White Sox",
    homeTeam: "Detroit Tigers",
    away: [
      "LF S. Antonacci L",
      "1B M. Murakami L",
      "3B M. Vargas R",
      "SS C. Montgomery L",
      "DH A. Benintendi L",
      "RF B. Montgomery S",
      "CF T. Peters L",
      "2B C. Meidroth R",
      "C Drew Romo S",
    ],
    home: [
      "DH G. Torres R",
      "C D. Dingler R",
      "3B K. McGonigle L",
      "2B Hao-Yu Lee R",
      "1B S. Torkelson R",
      "LF Ben Malgeri R",
      "CF Max Clark L",
      "SS Javier Baez R",
      "RF Corey Julks R",
    ],
  },
  {
    awayTeam: "Boston Red Sox",
    homeTeam: "Pittsburgh Pirates",
    away: [
      "DH M. Yoshida L",
      "CF C. Rafaela R",
      "C A. Rutschman S",
      "1B W. Contreras R",
      "RF Wilyer Abreu L",
      "3B Caleb Durbin R",
      "LF Jarren Duran L",
      "SS A. Monasterio R",
      "2B Nick Sogard S",
    ],
    home: [
      "CF Jake Mangum S",
      "RF Ronny Simon S",
      "DH B. Reynolds S",
      "3B N. Gonzales R",
      "LF E. Valdez R",
      "2B Brandon Lowe L",
      "1B R. Flores R",
      "C Henry Davis R",
      "SS Jared Triolo R",
    ],
  },
  {
    awayTeam: "San Diego Padres",
    homeTeam: "Cleveland Guardians",
    away: [
      "RF F. Tatis R",
      "2B J. Cronenworth L",
      "3B M. Machado R",
      "1B Ty France R",
      "CF J. Merrill L",
      "C L. Campusano R",
      "DH Gavin Sheets L",
      "SS X. Bogaerts R",
      "LF Luis Rengifo S",
    ],
    home: [
      "CF Steven Kwan L",
      "RF C. DeLauter L",
      "DH Jose Ramirez S",
      "1B N. Lowe L",
      "LF Jo Adell R",
      "2B T. Bazzana L",
      "3B Angel Genao S",
      "C P. Bailey S",
      "SS B. Rocchio S",
    ],
  },
  {
    awayTeam: "Washington Nationals",
    homeTeam: "New York Mets",
    away: [
      "SS CJ Abrams L",
      "1B A. Ortiz L",
      "DH Jose Tena L",
      "LF Daylen Lile L",
      "RF Dylan Crews R",
      "3B Jorbit Vivas L",
      "2B Nasim Nunez S",
      "C Keibert Ruiz S",
      "CF Jacob Young R",
    ],
    home: [
      "LF A.J. Ewing L",
      "SS F. Lindor S",
      "3B Bo Bichette R",
      "RF Carson Benge L",
      "CF Luis Robert R",
      "1B Jared Young L",
      "2B M. Semien R",
      "DH J. Polanco S",
      "C F. Alvarez R",
    ],
  },
  {
    awayTeam: "Baltimore Orioles",
    homeTeam: "Tampa Bay Rays",
    away: [
      "SS G. Henderson L",
      "1B Pete Alonso R",
      "2B J. Holliday L",
      "DH T. O'Neill R",
      "LF D. Beavers L",
      "RF L. Taveras S",
      "3B Coby Mayo R",
      "CF C. Cowser L",
      "C C. Narvaez R",
    ],
    home: [
      "DH Yandy Diaz R",
      "1B J. Aranda L",
      "LF C. Simpson L",
      "3B J. Caminero R",
      "C Liam Hicks L",
      "RF Victor Mesa L",
      "CF C. Mullins L",
      "2B R. Palacios L",
      "SS Taylor Walls S",
    ],
  },
  {
    awayTeam: "New York Yankees",
    homeTeam: "Toronto Blue Jays",
    away: [
      "CF T. Grisham L",
      "DH Ben Rice L",
      "RF S. Jones L",
      "1B Luis Garcia L",
      "LF Heliot Ramos R",
      "2B J. Chisholm L",
      "3B Ryan McMahon L",
      "C Austin Wells L",
      "SS G. Lombard R",
    ],
    home: [
      "RF Nathan Lukes L",
      "CF B. Bateman L",
      "1B V. Guerrero R",
      "DH G. Springer R",
      "C A. Kirk R",
      "LF J. Sanchez L",
      "SS A. Gimenez L",
      "3B K. Okamoto R",
      "2B E. Clement R",
    ],
  },
  {
    awayTeam: "Arizona Diamondbacks",
    homeTeam: "Atlanta Braves",
    away: [
      "RF C. Carroll L",
      "SS G. Perdomo S",
      "DH G. Moreno R",
      "2B Ketel Marte S",
      "3B N. Arenado R",
      "CF Tim Tawa R",
      "1B T. Locklear R",
      "C James McCann R",
      "LF Luke Waddell L",
    ],
    home: [
      "C D. Baldwin L",
      "RF Ronald Acuna R",
      "1B Matt Olson L",
      "CF M. Harris L",
      "2B Ozzie Albies S",
      "LF M. Dubon R",
      "DH M. Yastrzemski L",
      "3B Austin Riley R",
      "SS Jim Jarvis L",
    ],
  },
  {
    awayTeam: "Seattle Mariners",
    homeTeam: "Houston Astros",
    away: [
      "RF Taylor Ward R",
      "2B Cole Young L",
      "LF R. Arozarena R",
      "DH D. Canzone L",
      "CF J. Rodriguez R",
      "1B Josh Naylor L",
      "3B B. Donovan L",
      "C Cal Raleigh S",
      "SS Leo Rivas S",
    ],
    home: [
      "SS Jeremy Pena R",
      "DH Y. Alvarez L",
      "3B I. Paredes R",
      "CF D. Varsho L",
      "1B C. Walker R",
      "2B Jose Altuve R",
      "LF T. Trammell L",
      "C Yainer Diaz R",
      "RF Cam Smith R",
    ],
  },
  {
    awayTeam: "Kansas City Royals",
    homeTeam: "Los Angeles Angels",
    away: [
      "C C. Jensen L",
      "SS Bobby Witt R",
      "1B J. Caglianone L",
      "DH S. Perez R",
      "2B M. Massey L",
      "LF I. Collins S",
      "3B Nick Loftin R",
      "RF John Rave L",
      "CF Kyle Isbel L",
    ],
    home: [
      "LF Wade Meckler L",
      "CF Mike Trout R",
      "1B N. Schanuel L",
      "SS Zach Neto R",
      "2B V. Grissom R",
      "DH M. Ballesteros L",
      "3B D. Guzman R",
      "RF Josh Lowe L",
      "C T. Heineman S",
    ],
  },
  {
    awayTeam: "Texas Rangers",
    homeTeam: "Athletics",
    away: [
      "LF W. Langford R",
      "DH Corey Seager L",
      "SS E. Duran R",
      "RF B. Nimmo L",
      "1B Jake Burger R",
      "2B J. Foscue R",
      "C Elias Diaz R",
      "3B Cam Cauley R",
      "CF Evan Carter L",
    ],
    home: [
      "1B Jeff McNeil L",
      "LF T. Soderstrom L",
      "SS Jacob Wilson R",
      "DH C. Cortes L",
      "RF L. Butler L",
      "C Jonah Heim S",
      "CF Henry Bolte R",
      "2B D. Walton L",
      "3B Zack Gelof R",
    ],
  },
  {
    awayTeam: "Milwaukee Brewers",
    homeTeam: "Los Angeles Dodgers",
    away: [
      "2B Brice Turang L",
      "LF J. Chourio R",
      "RF Jake Bauers L",
      "C W. Contreras R",
      "CF G. Mitchell L",
      "1B A. Vaughn R",
      "DH C. Yelich L",
      "3B D. Hamilton L",
      "SS Joey Ortiz R",
    ],
    home: [
      "DH S. Ohtani L",
      "CF Andy Pages R",
      "SS Mookie Betts R",
      "2B Tommy Edman S",
      "LF T. Hernandez R",
      "RF Kyle Tucker L",
      "1B E. Hernandez R",
      "3B Miguel Rojas R",
      "C Ben Rortvedt L",
    ],
  },
  {
    awayTeam: "Colorado Rockies",
    homeTeam: "San Francisco Giants",
    away: [
      "LF J. McCarthy L",
      "CF Cole Carrigg S",
      "1B TJ Rumfield L",
      "C H. Goodman R",
      "DH M. Moniak L",
      "3B Willi Castro S",
      "RF Zac Veen L",
      "2B Connor Norby R",
      "SS E. Tovar R",
    ],
    home: [
      "DH B. Eldridge L",
      "RF Jung Hoo Lee L",
      "2B O. Basabe R",
      "1B R. Devers L",
      "3B B. Kennedy R",
      "LF V. Berroa R",
      "CF Grant McCray L",
      "SS C. Koss R",
      "C A. Knizner R",
    ],
  },
];

export const ADMIN_ROWS_2026_08_15: AdminScreenshotGameRow[] = [
  {
    displayOrder: 1,
    screenLeftTeamKo: "시카컵스",
    screenRightTeamKo: "세인카디",
    screenStartKst: "03:20",
    moneyline: [1.39, 2.4],
    threeWay: [1.87, 3.35, 3.15],
    runLine: { homeHandicap: -2.5, prices: [2.49, 1.36] },
    totals: { line: 7.5, underFirst: true, prices: [1.79, 1.73] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 2,
    screenLeftTeamKo: "신시레즈",
    screenRightTeamKo: "마이말린",
    screenStartKst: "07:10",
    moneyline: [1.7, 1.82],
    threeWay: [2.45, 3.25, 2.31],
    runLine: { homeHandicap: -2.5, prices: [3.38, 1.19] },
    totals: { line: 7.5, underFirst: true, prices: [1.89, 1.65] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 3,
    screenLeftTeamKo: "피츠파이",
    screenRightTeamKo: "보스레드",
    screenStartKst: "07:40",
    moneyline: [2.13, 1.5],
    threeWay: [3.3, 3.25, 1.86],
    runLine: { homeHandicap: 2.5, prices: [1.38, 2.43] },
    totals: { line: 7.5, underFirst: true, prices: [1.78, 1.74] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 4,
    screenLeftTeamKo: "디트타이",
    screenRightTeamKo: "시카화이",
    screenStartKst: "07:40",
    moneyline: [1.49, 2.15],
    threeWay: [2.01, 3.4, 2.8],
    runLine: { homeHandicap: -2.5, prices: [2.72, 1.3] },
    totals: { line: 8.5, underFirst: true, prices: [1.82, 1.7] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 5,
    screenLeftTeamKo: "탬파레이",
    screenRightTeamKo: "볼티오리",
    screenStartKst: "08:10",
    moneyline: [1.53, 2.07],
    threeWay: [2.1, 3.3, 2.7],
    runLine: { homeHandicap: -2.5, prices: [2.82, 1.28] },
    totals: { line: 8.5, underFirst: true, prices: [1.74, 1.78] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 6,
    screenLeftTeamKo: "뉴욕메츠",
    screenRightTeamKo: "워싱내셔",
    screenStartKst: "08:10",
    moneyline: [1.69, 1.84],
    threeWay: [2.4, 3.3, 2.33],
    runLine: { homeHandicap: -2.5, prices: [3.3, 1.2] },
    totals: { line: 8.5, underFirst: true, prices: [1.84, 1.69] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 7,
    screenLeftTeamKo: "클리가디",
    screenRightTeamKo: "샌디파드",
    screenStartKst: "08:10",
    moneyline: [1.64, 1.9],
    threeWay: [2.36, 3.15, 2.45],
    runLine: { homeHandicap: -2.5, prices: [3.3, 1.2] },
    totals: { line: 7.5, underFirst: true, prices: [1.66, 1.87] },
    sum: [1.54, 2.05],
  },
  {
    displayOrder: 8,
    screenLeftTeamKo: "토론블루",
    screenRightTeamKo: "뉴욕양키",
    screenStartKst: "08:15",
    moneyline: [2.17, 1.48],
    threeWay: [3.4, 3.3, 1.81],
    runLine: { homeHandicap: 2.5, prices: [1.4, 2.37] },
    totals: { line: 7.5, underFirst: true, prices: [1.78, 1.74] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 9,
    screenLeftTeamKo: "애틀브레",
    screenRightTeamKo: "애리다이",
    screenStartKst: "08:15",
    moneyline: [1.41, 2.34],
    threeWay: [1.91, 3.35, 3.05],
    runLine: { homeHandicap: -2.5, prices: [2.53, 1.35] },
    totals: { line: 7.5, underFirst: true, prices: [1.82, 1.7] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 10,
    screenLeftTeamKo: "휴스애스",
    screenRightTeamKo: "시애매리",
    screenStartKst: "09:10",
    moneyline: [1.65, 1.89],
    threeWay: [2.33, 3.3, 2.4],
    runLine: { homeHandicap: -2.5, prices: [3.23, 1.21] },
    totals: { line: 8.5, underFirst: true, prices: [1.67, 1.86] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 11,
    screenLeftTeamKo: "LA에인절",
    screenRightTeamKo: "캔자로열",
    screenStartKst: "10:38",
    moneyline: [1.75, 1.77],
    threeWay: [2.5, 3.35, 2.22],
    runLine: { homeHandicap: -2.5, prices: [3.55, 1.17] },
    totals: { line: 8.5, underFirst: true, prices: [1.82, 1.7] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 12,
    screenLeftTeamKo: "애슬레틱",
    screenRightTeamKo: "텍사레인",
    screenStartKst: "10:40",
    moneyline: [1.89, 1.65],
    threeWay: [2.75, 3.4, 2.03],
    runLine: { homeHandicap: 2.5, prices: [1.32, 2.64] },
    totals: { line: 9.5, underFirst: true, prices: [1.79, 1.73] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 13,
    screenLeftTeamKo: "LA다저스",
    screenRightTeamKo: "밀워브루",
    screenStartKst: "11:10",
    moneyline: [1.37, 2.46],
    threeWay: [1.83, 3.4, 3.25],
    runLine: { homeHandicap: -2.5, prices: [2.43, 1.38] },
    totals: { line: 7.5, underFirst: true, prices: [1.78, 1.74] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 14,
    screenLeftTeamKo: "샌프자이",
    screenRightTeamKo: "콜로로키",
    screenStartKst: "11:15",
    moneyline: [1.66, 1.87],
    threeWay: [2.35, 3.25, 2.4],
    runLine: { homeHandicap: -2.5, prices: [3.3, 1.2] },
    totals: { line: 7.5, underFirst: true, prices: [1.8, 1.72] },
    sum: [1.55, 2.04],
    firstHalf: {
      threeWay: [2.02, 5.6, 2.1],
      runLine: { homeHandicap: -1.5, prices: [2.97, 1.25] },
      totals: { line: 4.5, prices: [1.64, 1.9] },
    },
  },
];

export function fromPosNameBats(lines: string[]): MlbExpectedLineupDraftBatter[] {
  const paste = lines
    .map((line, i) => {
      const m = line
        .trim()
        .match(/^(DH|C|1B|2B|3B|SS|LF|CF|RF|OF)\s+(.+?)\s+([LRSB])\s*$/i);
      if (!m) throw new Error(`BAD_LINE:${line}`);
      return `${i + 1}. ${m[2]} ${m[1]} ${m[3]}`;
    })
    .join("\n");
  const { batters, errors } = parseExpectedLineupPaste(paste);
  if (errors.length) throw new Error(errors.join(";"));
  if (batters.length !== 9) {
    throw new Error(`EXPECTED_9_GOT_${batters.length}`);
  }
  return batters;
}

export function resolveExactAwayHomePair(
  games: Array<Pick<MlbScheduleArtifactGame, "awayTeam" | "homeTeam" | "gamePk">>,
  awayTeam: string,
  homeTeam: string,
): MlbScheduleArtifactGame & { gamePk: number } {
  const hits = games.filter(
    (g) => g.awayTeam === awayTeam && g.homeTeam === homeTeam,
  );
  if (hits.length === 0) {
    throw new Error(`SCHEDULE_PAIR_NOT_FOUND: ${awayTeam} @ ${homeTeam}`);
  }
  if (hits.length > 1) {
    throw new Error(
      `SCHEDULE_PAIR_AMBIGUOUS: ${awayTeam} @ ${homeTeam} count=${hits.length}`,
    );
  }
  return hits[0] as MlbScheduleArtifactGame;
}

function sha256FileSync(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

type LineupBatterView = {
  displayName: string;
  position: string | null;
  bats: string | null;
};

function requireBatter(
  game: { awayTeam: string; homeTeam: string; awayLineup: LineupBatterView[]; homeLineup: LineupBatterView[] },
  side: "away" | "home",
  displayName: string,
): LineupBatterView {
  const row = (side === "away" ? game.awayLineup : game.homeLineup).find(
    (b) => b.displayName === displayName,
  );
  if (!row) {
    throw new Error(
      `BATTER_MISSING: ${displayName} ${side} ${game.awayTeam} @ ${game.homeTeam}`,
    );
  }
  return row;
}

export function assertMlb20260815CorrectedLineupValues(doc: {
  expectedLineupHash: string;
  lineupStatus: string;
  games: Array<{
    awayTeam: string;
    homeTeam: string;
    lineupStatus: string;
    awayLineup: LineupBatterView[];
    homeLineup: LineupBatterView[];
  }>;
}): void {
  if (doc.lineupStatus !== "EXPECTED") {
    throw new Error(`LINEUP_STATUS_${doc.lineupStatus}`);
  }
  if (doc.expectedLineupHash === OLD_EXPECTED_LINEUP_HASH) {
    throw new Error("EXPECTED_LINEUP_HASH_UNCHANGED");
  }

  const marlins = doc.games.find(
    (g) =>
      g.awayTeam === "Miami Marlins" && g.homeTeam === "Cincinnati Reds",
  );
  const rays = doc.games.find(
    (g) =>
      g.awayTeam === "Baltimore Orioles" && g.homeTeam === "Tampa Bay Rays",
  );
  const dbacks = doc.games.find(
    (g) =>
      g.awayTeam === "Arizona Diamondbacks" &&
      g.homeTeam === "Atlanta Braves",
  );
  const mets = doc.games.find(
    (g) =>
      g.awayTeam === "Washington Nationals" &&
      g.homeTeam === "New York Mets",
  );
  if (!marlins || !rays || !dbacks || !mets) {
    throw new Error("CORRECTED_GAME_MISSING");
  }

  const hernandez = requireBatter(marlins, "away", "H. Hernandez");
  if (hernandez.position !== "LF" || hernandez.bats !== "R") {
    throw new Error(
      `HERNANDEZ_NOT_CORRECTED: ${hernandez.position}/${hernandez.bats}`,
    );
  }
  const hicks = requireBatter(rays, "home", "Liam Hicks");
  if (hicks.position !== "C" || hicks.bats !== "L") {
    throw new Error(`HICKS_NOT_CORRECTED: ${hicks.position}/${hicks.bats}`);
  }
  const carroll = requireBatter(dbacks, "away", "C. Carroll");
  if (carroll.position !== "RF" || carroll.bats !== "L") {
    throw new Error(
      `CARROLL_NOT_CORRECTED: ${carroll.position}/${carroll.bats}`,
    );
  }
  const robert = requireBatter(mets, "home", "Luis Robert");
  if (robert.position !== "CF" || robert.bats !== "R") {
    throw new Error(
      `ROBERT_NOT_CORRECTED: ${robert.position}/${robert.bats}`,
    );
  }

  const all = doc.games.flatMap((g) => [...g.awayLineup, ...g.homeLineup]);
  if (all.some((b) => b.displayName === "H. Hernandez" && b.bats === "L")) {
    throw new Error("OLD_VALUE_PRESENT: H. Hernandez bats=L");
  }
  if (all.some((b) => b.displayName === "Liam Hicks" && b.bats === "R")) {
    throw new Error("OLD_VALUE_PRESENT: Liam Hicks bats=R");
  }
  if (all.some((b) => b.displayName === "G. Carroll")) {
    throw new Error("OLD_VALUE_PRESENT: G. Carroll");
  }
  if (all.some((b) => b.displayName === "Luis Robert Jr.")) {
    throw new Error("OLD_VALUE_PRESENT: Luis Robert Jr.");
  }
}

function buildLineupDrafts(scheduleGames: MlbScheduleArtifactGame[]): MlbExpectedLineupDraftGame[] {
  return LINEUP_SLATE.map((entry) => {
    const game = resolveExactAwayHomePair(
      scheduleGames,
      entry.awayTeam,
      entry.homeTeam,
    );
    return {
      gamePk: game.gamePk,
      awayLineup: fromPosNameBats(entry.away),
      homeLineup: fromPosNameBats(entry.home),
    };
  });
}

export function operatorIntakeOutputRels() {
  return {
    expectedLineup: mlbExpectedLineupObservationRel(DATE_KST),
    domestic: mlbDomesticMarketsRel(DATE_KST),
    korean: mlbKoreanMarketOddsObservationRel(DATE_KST),
    audit: AUDIT_REL,
  };
}

export function assertOperatorIntakeOutputsAbsent(cwd: string): void {
  const rels = operatorIntakeOutputRels();
  for (const rel of Object.values(rels)) {
    if (existsSync(path.join(cwd, rel))) {
      throw new Error(`FILE_ALREADY_EXISTS: ${rel}`);
    }
  }
}

export function deriveKoreanDraftsFromDomestic(
  document: MlbDomesticMarketsDocument,
): MlbKoreanMarketOddsDraftGame[] {
  return document.games.map((g) => {
    const ml = g.normalizedMarkets.find((m) => m.marketType === "MONEYLINE_2WAY");
    if (!ml || ml.marketType !== "MONEYLINE_2WAY") {
      throw new Error(`DOMESTIC_MONEYLINE_MISSING: gamePk=${g.gamePk}`);
    }
    return {
      gamePk: g.gamePk,
      homeOdds: ml.homePrice,
      awayOdds: ml.awayPrice,
    };
  });
}

export async function runMlb20260815OperatorIntake(input: {
  cwd?: string;
  observedAt?: string;
}): Promise<{
  observedAt: string;
  scheduleGames: number;
  scheduleHash: string;
  mapping: Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    startTimeKst: string | null;
  }>;
  expectedLineupPath: string;
  expectedLineupHash: string;
  domesticPath: string;
  domesticRowsHash: string;
  koreanPath: string;
  koreanHash: string;
  auditPath: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  assertOperatorIntakeOutputsAbsent(cwd);

  const observedAt = input.observedAt ?? new Date().toISOString();
  const enteredAt = observedAt;
  const schedule = await loadMlbScheduleArtifact(DATE_KST, cwd);
  if (schedule.games.length !== 14) {
    throw new Error(
      `SCHEDULE_GAME_COUNT_UNEXPECTED: got=${schedule.games.length} expected=14`,
    );
  }

  const mapping = LINEUP_SLATE.map((entry) => {
    const game = resolveExactAwayHomePair(
      schedule.games,
      entry.awayTeam,
      entry.homeTeam,
    );
    return {
      gamePk: game.gamePk,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      startTimeKst: game.startTimeKst,
      commenceTimeUtc: game.commenceTimeUtc,
    };
  });

  const lineupDrafts = buildLineupDrafts(schedule.games);

  const domesticBuilt = await buildMlbDomesticMarketsV1({
    dateKst: DATE_KST,
    cwd,
    observedAt,
    enteredAt,
    screenshotCount: 3,
    adminRows: ADMIN_ROWS_2026_08_15,
  });
  if (domesticBuilt.document.summary.mappedGames !== 14) {
    throw new Error(
      `DOMESTIC_MAPPED_UNEXPECTED: ${domesticBuilt.document.summary.mappedGames} unresolved=${JSON.stringify(domesticBuilt.document.unresolved)}`,
    );
  }
  if (domesticBuilt.document.unresolved.length !== 0) {
    throw new Error(
      `DOMESTIC_UNRESOLVED: ${JSON.stringify(domesticBuilt.document.unresolved)}`,
    );
  }
  if (domesticBuilt.document.summary.unmappedScheduleGames !== 0) {
    throw new Error(
      `DOMESTIC_UNMAPPED_SCHEDULE: ${JSON.stringify(domesticBuilt.document.unmappedSchedule)}`,
    );
  }

  const koreanDrafts = deriveKoreanDraftsFromDomestic(domesticBuilt.document);
  if (koreanDrafts.length !== 14) {
    throw new Error(`KOREAN_DRAFT_COUNT_${koreanDrafts.length}`);
  }

  const lineupSaved = await saveMlbExpectedLineupObservation({
    dateKst: DATE_KST,
    cwd,
    observedAt,
    sourceLabel: "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    note: LINEUP_NOTE,
    drafts: lineupDrafts,
    allowLate: false,
  });
  if (!lineupSaved.ok || !lineupSaved.document) {
    throw new Error(`EXPECTED_LINEUP_SAVE_FAILED: ${lineupSaved.errors.join(";")}`);
  }

  const domesticAbs = path.join(cwd, domesticBuilt.pathRel);
  await mkdir(path.dirname(domesticAbs), { recursive: true });
  await writeFile(
    domesticAbs,
    `${JSON.stringify(domesticBuilt.document, null, 2)}\n`,
    "utf8",
  );

  const koreanSaved = await saveMlbKoreanMarketOddsObservation({
    dateKst: DATE_KST,
    cwd,
    observedAt,
    sourceLabel:
      "수동 관찰 · KOREAN_MARKET · MONEYLINE · MANUAL_OBSERVATION",
    note: MARKET_NOTE,
    drafts: koreanDrafts,
    allowLate: false,
  });
  if (!koreanSaved.ok || !koreanSaved.document) {
    throw new Error(`KOREAN_SAVE_FAILED: ${koreanSaved.errors.join(";")}`);
  }

  for (const g of koreanSaved.document.games) {
    const domestic = domesticBuilt.document.games.find(
      (d) => d.gamePk === g.gamePk,
    );
    if (!domestic) {
      throw new Error(`CROSS_ARTIFACT_GAMEPK_MISSING: ${g.gamePk}`);
    }
    const ml = domestic.normalizedMarkets.find(
      (m) => m.marketType === "MONEYLINE_2WAY",
    );
    if (!ml || ml.marketType !== "MONEYLINE_2WAY") {
      throw new Error(`CROSS_ARTIFACT_ML_MISSING: ${g.gamePk}`);
    }
    if (ml.homePrice !== g.homeOdds || ml.awayPrice !== g.awayOdds) {
      throw new Error(
        `CROSS_ARTIFACT_ML_DRIFT: gamePk=${g.gamePk} domestic=${ml.homePrice}/${ml.awayPrice} korean=${g.homeOdds}/${g.awayOdds}`,
      );
    }
    if (
      domestic.homeTeam !== g.homeTeam ||
      domestic.awayTeam !== g.awayTeam ||
      domestic.internalGameId !== g.internalGameId
    ) {
      throw new Error(`CROSS_ARTIFACT_IDENTITY_DRIFT: gamePk=${g.gamePk}`);
    }
  }

  const scheduleRel = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
  const scheduleRaw = await readFile(path.join(cwd, scheduleRel), "utf8");
  const scheduleHash = createHash("sha256")
    .update(scheduleRaw)
    .digest("hex");

  const audit = {
    schemaVersion: "mlb-operator-observations-intake-v0",
    dateKst: DATE_KST,
    generatedAt: observedAt,
    schedulePath: scheduleRel,
    scheduleHash,
    expectedLineupPath: lineupSaved.pathRel,
    expectedLineupHash: lineupSaved.document.expectedLineupHash,
    domesticMarketsPath: domesticBuilt.pathRel,
    domesticMarketsRowsHash: domesticBuilt.document.meta.rowsHash,
    koreanMarketPath: koreanSaved.pathRel,
    koreanMarketOddsHash: koreanSaved.document.koreanMarketOddsHash,
    lineupScreenshotCount: 3,
    domesticOddsScreenshotCount: 3,
    lineupGames: lineupSaved.document.summary.expectedGames,
    teamLineups: lineupSaved.document.summary.teamLineups,
    battingSlots: lineupSaved.document.summary.expectedBattingSlots,
    domesticMappedGames: domesticBuilt.document.summary.mappedGames,
    koreanMoneylineGames: koreanSaved.document.summary.observedGames,
    preGameLineupObservations: lineupSaved.document.summary.preGameObservations,
    preGameMarketObservations: koreanSaved.document.summary.preGameObservations,
    lateObservations:
      lineupSaved.document.summary.lateObservations +
      koreanSaved.document.summary.lateGames,
    joinErrors: lineupSaved.document.summary.joinErrors,
    unresolvedDomesticRows: domesticBuilt.document.unresolved.length,
    predictionTouched: false,
    recommendationTouched: false,
    engineTouched: false,
    providerOddsReplaced: false,
    sourcePolicy: "OPERATOR_MANUAL_SCREENSHOT_OBSERVATION",
    legal: "INTERNAL_ONLY",
    commercialUseStatus: "INTERNAL_ONLY",
    mapping,
  };

  const auditAbs = path.join(cwd, AUDIT_REL);
  await mkdir(path.dirname(auditAbs), { recursive: true });
  await writeFile(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  return {
    observedAt,
    scheduleGames: schedule.games.length,
    scheduleHash,
    mapping,
    expectedLineupPath: lineupSaved.pathRel,
    expectedLineupHash: lineupSaved.document.expectedLineupHash,
    domesticPath: domesticBuilt.pathRel,
    domesticRowsHash: domesticBuilt.document.meta.rowsHash,
    koreanPath: koreanSaved.pathRel,
    koreanHash: koreanSaved.document.koreanMarketOddsHash,
    auditPath: AUDIT_REL,
  };
}

/**
 * Date-specific Expected Lineup source transcription correction.
 * Regenerates lineup + audit only. Does not weaken FILE_ALREADY_EXISTS
 * on the original intake wrapper. Does not rewrite Domestic/Korean/Schedule.
 */
export async function correctMlb20260815ExpectedLineupTranscription(input: {
  cwd?: string;
  correctedAt?: string;
}): Promise<{
  observedAt: string;
  correctedAt: string;
  expectedLineupHash: string;
  oldExpectedLineupHash: string;
  scheduleHash: string;
  domesticRowsHash: string;
  koreanHash: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  const correctedAt = input.correctedAt ?? new Date().toISOString();
  const rels = operatorIntakeOutputRels();
  const scheduleRel = `data/research/mlb/${DATE_KST}-schedule-v1.json`;

  const required = [
    scheduleRel,
    rels.expectedLineup,
    rels.domestic,
    rels.korean,
    rels.audit,
  ];
  for (const rel of required) {
    if (!existsSync(path.join(cwd, rel))) {
      throw new Error(`CORRECTION_REQUIRES_EXISTING: ${rel}`);
    }
  }

  const scheduleAbs = path.join(cwd, scheduleRel);
  const domesticAbs = path.join(cwd, rels.domestic);
  const koreanAbs = path.join(cwd, rels.korean);
  const before = {
    schedule: sha256FileSync(scheduleAbs),
    domestic: sha256FileSync(domesticAbs),
    korean: sha256FileSync(koreanAbs),
  };

  const domesticDoc = JSON.parse(await readFile(domesticAbs, "utf8")) as {
    meta: { rowsHash: string };
  };
  const koreanDoc = JSON.parse(await readFile(koreanAbs, "utf8")) as {
    koreanMarketOddsHash: string;
  };
  const existingLineup = JSON.parse(
    await readFile(path.join(cwd, rels.expectedLineup), "utf8"),
  ) as { expectedLineupHash: string };
  const oldExpectedLineupHash = existingLineup.expectedLineupHash;

  const schedule = await loadMlbScheduleArtifact(DATE_KST, cwd);
  const lineupSaved = await saveMlbExpectedLineupObservation({
    dateKst: DATE_KST,
    cwd,
    observedAt: ORIGINAL_OBSERVED_AT,
    sourceLabel: "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    note: LINEUP_NOTE,
    drafts: buildLineupDrafts(schedule.games),
    allowLate: false,
  });
  if (!lineupSaved.ok || !lineupSaved.document) {
    throw new Error(
      `EXPECTED_LINEUP_CORRECTION_SAVE_FAILED: ${lineupSaved.errors.join(";")}`,
    );
  }
  assertMlb20260815CorrectedLineupValues(lineupSaved.document);
  if (lineupSaved.document.observedAt !== ORIGINAL_OBSERVED_AT) {
    throw new Error("OBSERVED_AT_OVERWRITTEN");
  }
  if (lineupSaved.document.summary.expectedGames !== 14) {
    throw new Error("CORRECTION_SUMMARY_UNEXPECTED");
  }
  if (lineupSaved.document.summary.confirmedGames !== 0) {
    throw new Error("CORRECTION_CONFIRMED_NONZERO");
  }
  if (lineupSaved.document.summary.expectedBattingSlots !== 252) {
    throw new Error("CORRECTION_SLOT_COUNT");
  }
  if (lineupSaved.document.summary.preGameObservations !== 14) {
    throw new Error("CORRECTION_NOT_PREGAME");
  }
  if (lineupSaved.document.summary.lateObservations !== 0) {
    throw new Error("CORRECTION_LATE");
  }

  const after = {
    schedule: sha256FileSync(scheduleAbs),
    domestic: sha256FileSync(domesticAbs),
    korean: sha256FileSync(koreanAbs),
  };
  if (after.schedule !== before.schedule) {
    throw new Error("PROTECTED_SCHEDULE_MUTATED");
  }
  if (after.domestic !== before.domestic) {
    throw new Error("PROTECTED_DOMESTIC_MUTATED");
  }
  if (after.korean !== before.korean) {
    throw new Error("PROTECTED_KOREAN_MUTATED");
  }
  if (domesticDoc.meta.rowsHash !== JSON.parse(readFileSync(domesticAbs, "utf8")).meta.rowsHash) {
    throw new Error("PROTECTED_DOMESTIC_ROWS_HASH_MUTATED");
  }
  if (koreanDoc.koreanMarketOddsHash !== JSON.parse(readFileSync(koreanAbs, "utf8")).koreanMarketOddsHash) {
    throw new Error("PROTECTED_KOREAN_HASH_MUTATED");
  }

  const auditAbs = path.join(cwd, rels.audit);
  const audit = JSON.parse(await readFile(auditAbs, "utf8")) as Record<
    string,
    unknown
  >;
  audit.expectedLineupHash = lineupSaved.document.expectedLineupHash;
  audit.correction = {
    applied: true,
    correctedAt,
    reason: "SOURCE_TRANSCRIPTION_CORRECTION_BEFORE_PREDICTION",
    count: 4,
    fields: [...LINEUP_TRANSCRIPTION_CORRECTION_FIELDS],
  };
  await writeFile(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  return {
    observedAt: ORIGINAL_OBSERVED_AT,
    correctedAt,
    expectedLineupHash: lineupSaved.document.expectedLineupHash,
    oldExpectedLineupHash,
    scheduleHash: after.schedule,
    domesticRowsHash: domesticDoc.meta.rowsHash,
    koreanHash: koreanDoc.koreanMarketOddsHash,
  };
}

async function main() {
  if (process.argv.includes("--correct-lineup-transcription")) {
    const result = await correctMlb20260815ExpectedLineupTranscription({});
    console.log("=== MLB 2026-08-15 EXPECTED LINEUP SOURCE CORRECTION ===");
    console.log(`observedAt=${result.observedAt}`);
    console.log(`correctedAt=${result.correctedAt}`);
    console.log(`oldExpectedLineupHash=${result.oldExpectedLineupHash}`);
    console.log(`expectedLineupHash=${result.expectedLineupHash}`);
    console.log(`scheduleHash=${result.scheduleHash}`);
    console.log(`domesticRowsHash=${result.domesticRowsHash}`);
    console.log(`koreanHash=${result.koreanHash}`);
    console.log("MLB_2026_08_15_EXPECTED_LINEUP_CORRECTION_OK");
    return;
  }

  const result = await runMlb20260815OperatorIntake({});
  console.log("=== MLB 2026-08-15 OPERATOR OBSERVATION INTAKE ===");
  console.log(`observedAt=${result.observedAt}`);
  console.log(`scheduleGames=${result.scheduleGames}`);
  console.log(`scheduleHash=${result.scheduleHash}`);
  console.log(`expectedLineup=${result.expectedLineupPath}`);
  console.log(`expectedLineupHash=${result.expectedLineupHash}`);
  console.log(`domestic=${result.domesticPath}`);
  console.log(`domesticRowsHash=${result.domesticRowsHash}`);
  console.log(`korean=${result.koreanPath}`);
  console.log(`koreanHash=${result.koreanHash}`);
  console.log(`audit=${result.auditPath}`);
  for (const row of result.mapping) {
    console.log(
      `${row.gamePk} ${row.awayTeam} @ ${row.homeTeam} ${row.startTimeKst ?? ""}`,
    );
  }
  console.log("MLB_2026_08_15_OPERATOR_INTAKE_OK");
}

const invoked = process.argv[1]?.replace(/\\/g, "/");
if (invoked && invoked.endsWith("intake-mlb-2026-08-15-operator-observations.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
