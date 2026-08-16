/**
 * One-shot 2026-08-16/batch-2207 operator observation intake.
 *
 *   npx tsx --env-file=.env.local scripts/intake-2026-08-16-batch-2207-operator-observations.ts
 *
 * Reuses MLB expected-lineup-v0 + domestic-markets-v1 + korean-market-v0.
 * Football is stored as research-only manual observation (no Engine schema).
 * Does NOT write Prediction / Recommendation / Engine / Scorecard / Postgame.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
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

export const DATE_KST = "2026-08-17";
export const BATCH_ID = "2026-08-16/batch-2207";
export const RECEIVED_AT_KST = "2026-08-16T22:07:00+09:00";
export const OBSERVED_AT_UTC = "2026-08-16T13:07:00.000Z";
export const RAW_REL = "data/operator-observations/raw/2026-08-16/batch-2207";

const SCREENSHOT_SHA: Record<string, string> = {
  "odds_01.png":
    "dc4821f8cc6b5ffb4f5777b1a8b8d9d18f287bb8a71d8ed748913501ebcb2304",
  "odds_02.png":
    "69431457a5d60415763558ca205017b0c3bd95f5c22c59d30c5ed8a9327ed7db",
  "odds_03.png":
    "88c801c508c1469332176254298a2077d6e07870eadbe719d76eed1f5a88317b",
  "odds_04.png":
    "885c8cdca4d6c4f44297efe2f48a627795e4c32fab636e88c369b8e223c63dca",
  "odds_05.png":
    "907091049dc2829bdfeaa4478f0eaf5ec7b5d1c09e044cbc0500c687428044c9",
  "mlb_expected_lineups_01.png":
    "5564c668a48698b597b4514d0b5c1251edee538ebf338825b16c1dfc2d17a758",
  "mlb_expected_lineups_02.png":
    "4fd46b33e4d52c382559d489e333056d792d5cc9eadd6b43db133793b0085b38",
  "mlb_expected_lineups_03.png":
    "69884ef82a9956a7b2b390d7a32a8fec8adbf5c6244c6e2efd646c2aac57bccf",
};

type LineupSlateEntry = {
  awayTeam: string;
  homeTeam: string;
  screenshot: string;
  awayStarter: string;
  homeStarter: string;
  away: string[];
  home: string[];
};

const LINEUP_SLATE: LineupSlateEntry[] = [
  {
    awayTeam: "Baltimore Orioles",
    homeTeam: "Tampa Bay Rays",
    screenshot: "mlb_expected_lineups_01.png",
    awayStarter: "Trevor Rogers L",
    homeStarter: "Freddy Peralta R",
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
      "3B J. Caminero R",
      "RF Ryan Vilade R",
      "LF C. Simpson L",
      "CF Jonny DeLuca R",
      "C Liam Hicks L",
      "SS Taylor Walls S",
      "2B Jorge Mateo R",
    ],
  },
  {
    awayTeam: "Arizona Diamondbacks",
    homeTeam: "Atlanta Braves",
    screenshot: "mlb_expected_lineups_01.png",
    awayStarter: "Michael Soroka R",
    homeStarter: "Bryce Elder R",
    away: [
      "SS G. Perdomo S",
      "RF C. Carroll L",
      "C G. Moreno R",
      "2B Ketel Marte S",
      "DH L. Nootbaar L",
      "3B N. Arenado R",
      "LF Max Kepler L",
      "1B Tim Tawa R",
      "CF R. Waldschmidt R",
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
    awayTeam: "Boston Red Sox",
    homeTeam: "Pittsburgh Pirates",
    screenshot: "mlb_expected_lineups_01.png",
    awayStarter: "Patrick Sandoval L",
    homeStarter: "Lake Bachar R",
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
    awayTeam: "New York Yankees",
    homeTeam: "Toronto Blue Jays",
    screenshot: "mlb_expected_lineups_01.png",
    awayStarter: "Ryan Weathers L",
    homeStarter: "Dylan Cease R",
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
      "CF B. Bateman L",
      "C A. Kirk R",
      "DH G. Springer R",
      "3B K. Okamoto R",
      "2B E. Clement R",
      "SS A. Gimenez L",
      "1B C. McAdoo R",
      "RF Myles Straw R",
      "LF Daz Cameron R",
    ],
  },
  {
    awayTeam: "San Diego Padres",
    homeTeam: "Cleveland Guardians",
    screenshot: "mlb_expected_lineups_01.png",
    awayStarter: "Casey Mize R",
    homeStarter: "Tanner Bibee R",
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
    awayTeam: "Chicago White Sox",
    homeTeam: "Detroit Tigers",
    screenshot: "mlb_expected_lineups_01.png",
    awayStarter: "Sean Burke R",
    homeStarter: "Drew Anderson R",
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
      "3B K. McGonigle L",
      "2B G. Torres R",
      "C D. Dingler R",
      "DH Colt Keith L",
      "1B S. Torkelson R",
      "CF Max Clark L",
      "RF Z. McKinstry L",
      "SS Javier Baez R",
      "LF Trei Cruz S",
    ],
  },
  {
    awayTeam: "Miami Marlins",
    homeTeam: "Cincinnati Reds",
    screenshot: "mlb_expected_lineups_02.png",
    awayStarter: "Eury Perez R",
    homeStarter: "Nick Lodolo L",
    away: [
      "SS Otto Lopez R",
      "LF H. Hernandez R",
      "DH A. Ramirez R",
      "2B X. Edwards S",
      "3B Leo Jimenez R",
      "1B G. Conine L",
      "RF J. Sanoja R",
      "CF Estuary Ruiz R",
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
    awayTeam: "Washington Nationals",
    homeTeam: "New York Mets",
    screenshot: "mlb_expected_lineups_02.png",
    awayStarter: "Jake Irvin R",
    homeStarter: "Christian Scott R",
    away: [
      "2B CJ Abrams L",
      "1B A. Ortiz L",
      "DH Jose Tena L",
      "LF Daylen Lile L",
      "RF Dylan Crews R",
      "3B Jorbit Vivas L",
      "SS Nasim Nunez S",
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
    awayTeam: "Philadelphia Phillies",
    homeTeam: "Minnesota Twins",
    screenshot: "mlb_expected_lineups_02.png",
    awayStarter: "Andrew Painter R",
    homeStarter: "Dean Kremer R",
    away: [
      "DH K. Schwarber L",
      "SS Trea Turner R",
      "RF Bryce Harper L",
      "2B Luis Arraez L",
      "3B Bryson Stott L",
      "LF B. Marsh L",
      "C J. Realmuto R",
      "1B Alec Bohm R",
      "CF J. Crawford L",
    ],
    home: [
      "CF Byron Buxton R",
      "C Ryan Jeffers R",
      "DH Josh Bell S",
      "2B Kody Clemens L",
      "1B Royce Lewis R",
      "3B Brooks Lee S",
      "RF L. Keaschall R",
      "LF T. Larnach L",
      "SS K. Culpepper R",
    ],
  },
  {
    awayTeam: "St. Louis Cardinals",
    homeTeam: "Chicago Cubs",
    screenshot: "mlb_expected_lineups_02.png",
    awayStarter: "Hunter Dobbins R",
    homeStarter: "Edward Cabrera R",
    away: [
      "2B J. Wetherholt L",
      "DH Ivan Herrera R",
      "1B A. Burleson L",
      "RF J. Walker R",
      "CF N. Church L",
      "SS Masyn Winn R",
      "LF Joshua Baez R",
      "C Jimmy Crooks L",
      "3B Jose Fermin R",
    ],
    home: [
      "CF P. Crow-Armstrong L",
      "DH Seiya Suzuki R",
      "1B M. Busch L",
      "3B Alex Bregman R",
      "LF Ian Happ S",
      "2B Nico Hoerner R",
      "C Carson Kelly R",
      "SS D. Swanson R",
      "RF T. Taylor R",
    ],
  },
  {
    awayTeam: "Texas Rangers",
    homeTeam: "Athletics",
    screenshot: "mlb_expected_lineups_02.png",
    awayStarter: "Cody Bradford L",
    homeStarter: "Jacob Lopez L",
    away: [
      "LF W. Langford R",
      "DH Corey Seager L",
      "SS E. Duran R",
      "RF B. Nimmo L",
      "1B Jake Burger R",
      "2B J. Foscue R",
      "C Elias Diaz R",
      "3B Cody Freeman R",
      "CF Evan Carter L",
    ],
    home: [
      "3B Zack Gelof R",
      "SS Jacob Wilson R",
      "DH Jonah Heim S",
      "LF T. Soderstrom L",
      "1B Tommy White R",
      "CF Henry Bolte R",
      "RF L. Butler L",
      "C Brian Serven R",
      "2B A. Williams R",
    ],
  },
  {
    awayTeam: "Colorado Rockies",
    homeTeam: "San Francisco Giants",
    screenshot: "mlb_expected_lineups_02.png",
    awayStarter: "Gabriel Hughes R",
    homeStarter: "Blade Tidwell R",
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
      "RF Jung Hoo Lee L",
      "SS Willy Adames R",
      "DH B. Eldridge L",
      "1B R. Devers L",
      "LF V. Bericoto R",
      "CF Drew Gilbert L",
      "2B O. Basabe R",
      "C D. Cavanaugh L",
      "3B C. Koss R",
    ],
  },
  {
    awayTeam: "Kansas City Royals",
    homeTeam: "Los Angeles Angels",
    screenshot: "mlb_expected_lineups_03.png",
    awayStarter: "Noah Cameron L",
    homeStarter: "Ryan Johnson R",
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
      "SS Zach Neto R",
      "CF Mike Trout R",
      "1B N. Schanuel L",
      "2B V. Grissom R",
      "3B D. Guzman R",
      "DH M. Ballesteros L",
      "C T. d'Arnaud R",
      "LF Jose Siri R",
      "RF Wade Meckler L",
    ],
  },
  {
    awayTeam: "Milwaukee Brewers",
    homeTeam: "Los Angeles Dodgers",
    screenshot: "mlb_expected_lineups_03.png",
    awayStarter: "Logan Henderson R",
    homeStarter: "Tarik Skubal L",
    away: [
      "LF J. Chourio R",
      "2B Brice Turang L",
      "1B A. Vaughn R",
      "C W. Contreras R",
      "DH C. Yelich L",
      "RF Luis Lara S",
      "CF B. Lockridge R",
      "SS Joey Ortiz R",
      "3B D. Hamilton L",
    ],
    home: [
      "DH S. Ohtani L",
      "CF Andy Pages R",
      "1B F. Freeman L",
      "3B Max Muncy L",
      "SS Mookie Betts R",
      "RF Kyle Tucker L",
      "2B Tommy Edman S",
      "LF T. Hernandez R",
      "C H. Feduccia L",
    ],
  },
  {
    awayTeam: "Seattle Mariners",
    homeTeam: "Houston Astros",
    screenshot: "mlb_expected_lineups_03.png",
    awayStarter: "Bryan Woo R",
    homeStarter: "Hunter Brown R",
    away: [
      "RF Taylor Ward R",
      "2B Cole Young L",
      "LF R. Arozarena R",
      "DH D. Canzone L",
      "CF J. Rodriguez R",
      "1B Josh Naylor L",
      "3B B. Donovan L",
      "C Cal Raleigh S",
      "SS Brock Rodden S",
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
];

const ADMIN_ROWS: Array<AdminScreenshotGameRow & { screenshot: string }> = [
  {
    displayOrder: 1,
    screenshot: "odds_02.png",
    screenLeftTeamKo: "탬파레이",
    screenRightTeamKo: "볼티오리",
    screenStartKst: "01:15",
    moneyline: [1.52, 2.09],
    threeWay: [2.1, 3.3, 2.7],
    runLine: { homeHandicap: -2.5, prices: [2.87, 1.27] },
    totals: { line: 7.5, underFirst: true, prices: [1.85, 1.68] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 2,
    screenshot: "odds_02.png",
    screenLeftTeamKo: "피츠파이",
    screenRightTeamKo: "보스레드",
    screenStartKst: "02:35",
    moneyline: [1.77, 1.75],
    threeWay: [2.55, 3.3, 2.2],
    runLine: { homeHandicap: 2.5, prices: [1.26, 2.92] },
    totals: { line: 8.5, underFirst: true, prices: [1.68, 1.85] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 3,
    screenshot: "odds_02.png",
    screenLeftTeamKo: "애틀브레",
    screenRightTeamKo: "애리다이",
    screenStartKst: "02:35",
    moneyline: [1.57, 2.0],
    threeWay: [2.18, 3.35, 2.55],
    runLine: { homeHandicap: -2.5, prices: [2.92, 1.26] },
    totals: { line: 8.5, underFirst: true, prices: [1.89, 1.65] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 4,
    screenshot: "odds_02.png",
    screenLeftTeamKo: "토론블루",
    screenRightTeamKo: "뉴욕양키",
    screenStartKst: "02:37",
    moneyline: [1.65, 1.89],
    threeWay: [2.36, 3.15, 2.45],
    runLine: { homeHandicap: -2.5, prices: [3.3, 1.2] },
    totals: { line: 7.5, underFirst: true, prices: [1.65, 1.89] },
    sum: [1.54, 2.05],
  },
  {
    displayOrder: 5,
    screenshot: "odds_02.png",
    screenLeftTeamKo: "뉴욕메츠",
    screenRightTeamKo: "워싱내셔",
    screenStartKst: "02:40",
    moneyline: [1.43, 2.29],
    threeWay: [1.92, 3.4, 3.0],
    runLine: { homeHandicap: -2.5, prices: [2.56, 1.34] },
    totals: { line: 8.5, underFirst: true, prices: [1.67, 1.86] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 6,
    screenshot: "odds_03.png",
    screenLeftTeamKo: "디트타이",
    screenRightTeamKo: "시카화이",
    screenStartKst: "02:40",
    moneyline: [1.73, 1.79],
    threeWay: [2.5, 3.25, 2.26],
    runLine: { homeHandicap: -2.5, prices: [3.46, 1.18] },
    totals: { line: 8.5, underFirst: true, prices: [1.66, 1.87] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 7,
    screenshot: "odds_03.png",
    screenLeftTeamKo: "클리가디",
    screenRightTeamKo: "샌디파드",
    screenStartKst: "02:40",
    moneyline: [1.77, 1.75],
    threeWay: [2.55, 3.25, 2.22],
    runLine: { homeHandicap: 2.5, prices: [1.25, 2.97] },
    totals: { line: 8.5, underFirst: true, prices: [1.67, 1.86] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 8,
    screenshot: "odds_03.png",
    screenLeftTeamKo: "신시레즈",
    screenRightTeamKo: "마이말린",
    screenStartKst: "02:40",
    moneyline: [1.86, 1.67],
    threeWay: [2.7, 3.35, 2.08],
    runLine: { homeHandicap: 2.5, prices: [1.3, 2.72] },
    totals: { line: 9.5, underFirst: true, prices: [1.6, 1.96] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 9,
    screenshot: "odds_03.png",
    screenLeftTeamKo: "미네트윈",
    screenRightTeamKo: "필라필리",
    screenStartKst: "03:10",
    moneyline: [1.79, 1.73],
    threeWay: [2.6, 3.35, 2.14],
    runLine: { homeHandicap: 2.5, prices: [1.27, 2.87] },
    totals: { line: 9.5, underFirst: true, prices: [1.66, 1.87] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 10,
    screenshot: "odds_03.png",
    screenLeftTeamKo: "시카컵스",
    screenRightTeamKo: "세인카디",
    screenStartKst: "04:15",
    moneyline: [1.48, 2.17],
    threeWay: [2.01, 3.4, 2.8],
    runLine: { homeHandicap: -2.5, prices: [2.68, 1.31] },
    totals: { line: 8.5, underFirst: true, prices: [1.85, 1.68] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 11,
    screenshot: "odds_04.png",
    screenLeftTeamKo: "샌프자이",
    screenRightTeamKo: "콜로로키",
    screenStartKst: "05:05",
    moneyline: [1.6, 1.96],
    threeWay: [2.24, 3.3, 2.5],
    runLine: { homeHandicap: -2.5, prices: [3.09, 1.23] },
    totals: { line: 7.5, underFirst: true, prices: [1.89, 1.65] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 12,
    screenshot: "odds_04.png",
    screenLeftTeamKo: "애슬레틱",
    screenRightTeamKo: "텍사레인",
    screenStartKst: "05:05",
    moneyline: [2.07, 1.53],
    threeWay: [3.1, 3.5, 1.85],
    runLine: { homeHandicap: 2.5, prices: [1.4, 2.37] },
    totals: { line: 10.5, underFirst: true, prices: [1.77, 1.75] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 13,
    screenshot: "odds_04.png",
    screenLeftTeamKo: "LA에인절",
    screenRightTeamKo: "캔자로얄",
    screenStartKst: "05:07",
    moneyline: [1.89, 1.65],
    threeWay: [2.75, 3.35, 2.05],
    runLine: { homeHandicap: 2.5, prices: [1.31, 2.68] },
    totals: { line: 9.5, underFirst: true, prices: [1.67, 1.86] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 14,
    screenshot: "odds_04.png",
    screenLeftTeamKo: "LA다저스",
    screenRightTeamKo: "밀워브루",
    screenStartKst: "05:10",
    moneyline: [1.42, 2.31],
    threeWay: [1.91, 3.35, 3.05],
    runLine: { homeHandicap: -2.5, prices: [2.56, 1.34] },
    totals: { line: 7.5, underFirst: true, prices: [1.81, 1.71] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 15,
    screenshot: "odds_04.png",
    screenLeftTeamKo: "휴스애스",
    screenRightTeamKo: "시애매리",
    screenStartKst: "08:20",
    moneyline: [1.63, 1.91],
    threeWay: [2.33, 3.2, 2.45],
    runLine: { homeHandicap: -2.5, prices: [3.23, 1.21] },
    totals: { line: 7.5, underFirst: true, prices: [1.8, 1.72] },
    sum: [1.55, 2.04],
    firstHalf: {
      threeWay: [1.99, 5.2, 2.2],
      runLine: { homeHandicap: -1.5, prices: [2.97, 1.25] },
      totals: { line: 3.5, prices: [1.99, 1.58] },
    },
  },
];

type FootballMarket = {
  rawMarketLabel: string;
  line: number | null;
  prices: Array<number | null>;
};

type FootballGameRow = {
  screenshot: string;
  displayedDateKst: string;
  displayedStartKst: string;
  rawLeagueLabel: string;
  rawLeftTeam: string;
  rawRightTeam: string;
  markets: FootballMarket[];
};

const FOOTBALL_GAMES: FootballGameRow[] = [
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-16",
    displayedStartKst: "22:00",
    rawLeagueLabel: "축ASEA챔",
    rawLeftTeam: "Malaysia",
    rawRightTeam: "Vietnam",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [4.95, 3.45, 1.52] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [2.3, 3.1, 2.55] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [1.62, null, 1.93] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-16",
    displayedStartKst: "23:00",
    rawLeagueLabel: "잉슈퍼컵",
    rawLeftTeam: "아스널",
    rawRightTeam: "맨체스C",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [2.6, 3.1, 2.26] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [1.49, 3.8, 4.65] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [1.77, null, 1.75] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-16",
    displayedStartKst: "23:45",
    rawLeagueLabel: "에레디비",
    rawLeftTeam: "아약스",
    rawRightTeam: "헤이렌베",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [1.38, 4.25, 5.3] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [2.09, 3.5, 2.6] },
      { rawMarketLabel: "U 3.5", line: 3.5, prices: [1.63, null, 1.91] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "00:00",
    rawLeagueLabel: "EFL챔",
    rawLeftTeam: "번리",
    rawRightTeam: "웨스트햄",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [2.7, 3.25, 2.12] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [1.57, 3.75, 4.05] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [1.96, null, 1.6] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "00:00",
    rawLeagueLabel: "라리가",
    rawLeftTeam: "라싱산탄",
    rawRightTeam: "비야레알",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [2.95, 3.2, 2.01] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [1.62, 3.8, 3.7] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [1.89, null, 1.65] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "00:00",
    rawLeagueLabel: "엘리테세",
    rawLeftTeam: "사릅스보",
    rawRightTeam: "사네피오",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [1.73, 3.6, 3.4] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [2.95, 3.6, 1.88] },
      { rawMarketLabel: "U 3.5", line: 3.5, prices: [1.51, null, 2.11] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "00:00",
    rawLeagueLabel: "엘리테세",
    rawLeftTeam: "SK브란",
    rawRightTeam: "함캄",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [1.48, 4.05, 4.4] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [2.4, 3.5, 2.24] },
      { rawMarketLabel: "U 3.5", line: 3.5, prices: [1.59, null, 1.97] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_01.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "00:00",
    rawLeagueLabel: "엘리테세",
    rawLeftTeam: "몰데FK",
    rawRightTeam: "트롬쇠IL",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [1.99, 3.3, 2.9] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [3.6, 3.75, 1.65] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [2.05, null, 1.54] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_02.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "02:00",
    rawLeagueLabel: "라리가",
    rawLeftTeam: "에스파뇰",
    rawRightTeam: "레반테",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [2.0, 2.85, 3.35] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [3.9, 3.35, 1.68] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [1.6, null, 1.96] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_02.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "02:15",
    rawLeagueLabel: "엘리테세",
    rawLeftTeam: "프레드릭",
    rawRightTeam: "크리스티",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [1.77, 3.35, 3.5] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [3.15, 3.45, 1.84] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [1.93, null, 1.62] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_03.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "03:45",
    rawLeagueLabel: "프슈퍼컵",
    rawLeftTeam: "RC랑스",
    rawRightTeam: "PSG",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [4.1, 3.8, 1.56] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [2.05, 3.35, 2.75] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [2.17, null, 1.48] },
      { rawMarketLabel: "SUM", line: null, prices: [1.77, null, 1.75] },
    ],
  },
  {
    screenshot: "odds_04.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "07:00",
    rawLeagueLabel: "MLS",
    rawLeftTeam: "시카파이",
    rawRightTeam: "포틀팀버",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [1.46, 4.2, 4.4] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [2.22, 3.65, 2.35] },
      { rawMarketLabel: "U 3.5", line: 3.5, prices: [1.8, null, 1.72] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_04.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "07:00",
    rawLeagueLabel: "MLS",
    rawLeftTeam: "뉴욕시티",
    rawRightTeam: "필라유니",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [2.11, 3.35, 2.65] },
      { rawMarketLabel: "H -1.0", line: -1.0, prices: [4.0, 4.0, 1.54] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [2.11, null, 1.51] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_05.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "09:30",
    rawLeagueLabel: "MLS",
    rawLeftTeam: "오스틴FC",
    rawRightTeam: "FC댈러스",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [2.6, 3.35, 2.14] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [1.54, 3.85, 4.15] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [2.11, null, 1.51] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
  {
    screenshot: "odds_05.png",
    displayedDateKst: "2026-08-17",
    displayedStartKst: "11:30",
    rawLeagueLabel: "MLS",
    rawLeftTeam: "시애사운",
    rawRightTeam: "밴쿠화이",
    markets: [
      { rawMarketLabel: "1X2", line: null, prices: [3.25, 3.45, 1.81] },
      { rawMarketLabel: "H +1.0", line: 1.0, prices: [1.79, 3.6, 3.2] },
      { rawMarketLabel: "U 2.5", line: 2.5, prices: [2.17, null, 1.48] },
      { rawMarketLabel: "SUM", line: null, prices: [1.76, null, 1.76] },
    ],
  },
];

function fromPosNameBats(lines: string[]): MlbExpectedLineupDraftBatter[] {
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
  if (batters.length !== 9) throw new Error(`EXPECTED_9_GOT_${batters.length}`);
  return batters;
}

function resolveExactAwayHomePair(
  games: MlbScheduleArtifactGame[],
  awayTeam: string,
  homeTeam: string,
): MlbScheduleArtifactGame {
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
  return hits[0]!;
}

function deriveKoreanDraftsFromDomestic(
  document: MlbDomesticMarketsDocument,
): MlbKoreanMarketOddsDraftGame[] {
  return document.games.map((g) => {
    const ml = g.normalizedMarkets.find((m) => m.marketType === "MONEYLINE_2WAY");
    if (!ml || ml.marketType !== "MONEYLINE_2WAY") {
      throw new Error(`DOMESTIC_MONEYLINE_MISSING: gamePk=${g.gamePk}`);
    }
    return { gamePk: g.gamePk, homeOdds: ml.homePrice, awayOdds: ml.awayPrice };
  });
}

function displayedStartUtc(dateKst: string, startKst: string): string {
  const [h, m] = startKst.split(":").map((x) => Number(x));
  const [y, mo, d] = dateKst.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y!, mo! - 1, d!, h! - 9, m!, 0)).toISOString();
}

function footballCutoff(dateKst: string, startKst: string): {
  cutoffStatus: "PRE_GAME_ELIGIBLE_BY_RECEIVED_AT" | "NOT_PREGAME_ELIGIBLE";
  displayedStartUtc: string;
} {
  const startUtc = displayedStartUtc(dateKst, startKst);
  const receivedMs = Date.parse(OBSERVED_AT_UTC);
  const startMs = Date.parse(startUtc);
  return {
    displayedStartUtc: startUtc,
    cutoffStatus:
      receivedMs < startMs
        ? "PRE_GAME_ELIGIBLE_BY_RECEIVED_AT"
        : "NOT_PREGAME_ELIGIBLE",
  };
}

async function main() {
  const cwd = process.cwd();
  const observedAt = OBSERVED_AT_UTC;

  for (const [file, sha] of Object.entries(SCREENSHOT_SHA)) {
    const abs = path.join(cwd, RAW_REL, file);
    if (!existsSync(abs)) throw new Error(`RAW_MISSING:${file}`);
    const got = createHash("sha256").update(readFileSync(abs)).digest("hex");
    if (got !== sha) throw new Error(`RAW_SHA_MISMATCH:${file}`);
  }

  const schedule = await loadMlbScheduleArtifact(DATE_KST, cwd);
  if (schedule.games.length !== 15) {
    throw new Error(`SCHEDULE_GAME_COUNT_UNEXPECTED:${schedule.games.length}`);
  }

  const lineupDrafts: MlbExpectedLineupDraftGame[] = LINEUP_SLATE.map((entry) => {
    const game = resolveExactAwayHomePair(
      schedule.games,
      entry.awayTeam,
      entry.homeTeam,
    );
    return {
      gamePk: game.gamePk,
      awayLineup: fromPosNameBats(entry.away),
      homeLineup: fromPosNameBats(entry.home),
    };
  });
  const lineupPks = new Set(lineupDrafts.map((d) => d.gamePk));
  if (lineupPks.size !== 15) {
    throw new Error(`LINEUP_PK_NOT_UNIQUE:${lineupPks.size}`);
  }

  const domesticBuilt = await buildMlbDomesticMarketsV1({
    dateKst: DATE_KST,
    cwd,
    observedAt,
    enteredAt: observedAt,
    screenshotCount: 4,
    adminRows: ADMIN_ROWS.map(({ screenshot: _s, ...row }) => row),
  });
  if (domesticBuilt.document.unresolved.length !== 0) {
    throw new Error(
      `DOMESTIC_UNRESOLVED:${JSON.stringify(domesticBuilt.document.unresolved)}`,
    );
  }
  if (domesticBuilt.document.summary.mappedGames !== 15) {
    throw new Error(
      `DOMESTIC_MAPPED_UNEXPECTED:${domesticBuilt.document.summary.mappedGames}`,
    );
  }

  const lineupSaved = await saveMlbExpectedLineupObservation({
    dateKst: DATE_KST,
    cwd,
    observedAt,
    sourceLabel: "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    note:
      "Batch 2026-08-16/batch-2207. Screenshot captureTime=UNKNOWN; observedAt=receivedAtKst 22:07. EXPECTED only — not CONFIRMED. providerPlayerId=null. Probable starters stored in intake audit, not this schema.",
    drafts: lineupDrafts,
    allowLate: false,
  });
  if (!lineupSaved.ok || !lineupSaved.document) {
    throw new Error(`EXPECTED_LINEUP_SAVE_FAILED:${lineupSaved.errors.join(";")}`);
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
    note:
      "Batch 2026-08-16/batch-2207. Screenshot captureTime=UNKNOWN; observedAt=receivedAtKst 22:07. ADMIN / OPERATOR SCREENSHOT OBSERVATION — not Provider odds.",
    drafts: deriveKoreanDraftsFromDomestic(domesticBuilt.document),
    allowLate: false,
  });
  if (!koreanSaved.ok || !koreanSaved.document) {
    throw new Error(`KOREAN_SAVE_FAILED:${koreanSaved.errors.join(";")}`);
  }

  const footballGames = FOOTBALL_GAMES.map((g, i) => {
    const cut = footballCutoff(g.displayedDateKst, g.displayedStartKst);
    return {
      rowId: i + 1,
      sport: "FOOTBALL",
      rawLeagueLabel: g.rawLeagueLabel,
      rawLeftTeam: g.rawLeftTeam,
      rawRightTeam: g.rawRightTeam,
      displayedDateKst: g.displayedDateKst,
      displayedStartKst: g.displayedStartKst,
      displayedStartUtc: cut.displayedStartUtc,
      mappingStatus: "UNRESOLVED_MAPPING",
      mappingDetail:
        "No football schedule artifact for 2026-08-16 or 2026-08-17. Raw teams/league preserved. Not joined to Engine identity.",
      cutoffStatus: cut.cutoffStatus,
      sourceScreenshotFile: g.screenshot,
      sourceScreenshotSha256: SCREENSHOT_SHA[g.screenshot],
      sourceScreenshotRel: `${RAW_REL}/${g.screenshot}`,
      markets: g.markets,
    };
  });

  const footballDoc = {
    schemaVersion: "yang-edge-football-manual-market-observation-v0",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    autoApply: false,
    batchId: BATCH_ID,
    receivedAtKst: RECEIVED_AT_KST,
    captureTime: "UNKNOWN",
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    observedAt: OBSERVED_AT_UTC,
    note: "RESEARCH_ONLY MANUAL MARKET OBSERVATION. Not an Engine input schema. Football schedule mapping unavailable for this batch.",
    summary: {
      games: footballGames.length,
      marketRows: footballGames.reduce((n, g) => n + g.markets.length, 0),
      mapped: 0,
      unresolved: footballGames.length,
      pregameEligible: footballGames.filter(
        (g) => g.cutoffStatus === "PRE_GAME_ELIGIBLE_BY_RECEIVED_AT",
      ).length,
      cutoffBlocked: footballGames.filter(
        (g) => g.cutoffStatus === "NOT_PREGAME_ELIGIBLE",
      ).length,
      leagues: [...new Set(footballGames.map((g) => g.rawLeagueLabel))],
    },
    games: footballGames,
  };
  const footballRel =
    "data/operator-observations/structured/2026-08-16/batch-2207-football-manual-market-observation-v0.json";
  const footballAbs = path.join(cwd, footballRel);
  await mkdir(path.dirname(footballAbs), { recursive: true });
  await writeFile(footballAbs, `${JSON.stringify(footballDoc, null, 2)}\n`, "utf8");

  const auditRel =
    "data/audits/2026-08-16-batch-2207-operator-observations-intake-v0.json";
  const audit = {
    schemaVersion: "mlb-operator-observations-intake-v0",
    batchId: BATCH_ID,
    dateKst: DATE_KST,
    generatedAt: OBSERVED_AT_UTC,
    receivedAtKst: RECEIVED_AT_KST,
    captureTime: "UNKNOWN",
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    inboxSource:
      "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\YANG-EDGE_INBOX_2026-08-16_2207\\2026-08-16\\batch-2207",
    rawPath: RAW_REL,
    screenshotSha256: SCREENSHOT_SHA,
    schedulePath: `data/research/mlb/${DATE_KST}-schedule-v1.json`,
    scheduleHash: domesticBuilt.scheduleHash,
    expectedLineupPath: mlbExpectedLineupObservationRel(DATE_KST),
    expectedLineupHash: lineupSaved.document.expectedLineupHash,
    domesticMarketsPath: mlbDomesticMarketsRel(DATE_KST),
    domesticMarketsRowsHash: domesticBuilt.document.meta.rowsHash,
    koreanMarketPath: mlbKoreanMarketOddsObservationRel(DATE_KST),
    koreanMarketOddsHash: koreanSaved.document.koreanMarketOddsHash,
    footballObservationPath: footballRel,
    lineupScreenshotCount: 3,
    domesticOddsScreenshotCount: 4,
    mixedOddsScreenshotCount: 5,
    lineupGames: lineupSaved.document.summary.expectedGames,
    teamLineups: lineupSaved.document.summary.teamLineups,
    battingSlots: lineupSaved.document.summary.expectedBattingSlots,
    domesticMappedGames: domesticBuilt.document.summary.mappedGames,
    koreanMoneylineGames: koreanSaved.document.summary.observedGames,
    preGameLineupObservations: lineupSaved.document.summary.preGameObservations,
    lateObservations: lineupSaved.document.summary.lateObservations,
    joinErrors: lineupSaved.document.summary.joinErrors,
    unresolvedDomesticRows: domesticBuilt.document.unresolved.length,
    footballGames: footballDoc.summary.games,
    footballPregameEligible: footballDoc.summary.pregameEligible,
    footballCutoffBlocked: footballDoc.summary.cutoffBlocked,
    predictionTouched: false,
    recommendationTouched: false,
    engineTouched: false,
    scorecardTouched: false,
    postgameTouched: false,
    mapping: LINEUP_SLATE.map((entry) => {
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
        lineupScreenshot: entry.screenshot,
        lineupScreenshotSha256: SCREENSHOT_SHA[entry.screenshot],
        awayStarterRaw: entry.awayStarter,
        homeStarterRaw: entry.homeStarter,
        cutoffLabel: "PRE_GAME_OBSERVATION",
      };
    }),
    domesticRowScreenshots: ADMIN_ROWS.map((row) => ({
      displayOrder: row.displayOrder,
      screenLeftTeam: row.screenLeftTeamKo,
      screenRightTeam: row.screenRightTeamKo,
      screenStartKst: row.screenStartKst,
      screenshot: row.screenshot,
      screenshotSha256: SCREENSHOT_SHA[row.screenshot],
      firstHalfScreenshot:
        row.screenStartKst === "08:20" ? "odds_05.png" : null,
    })),
    needsReview: [
      {
        kind: "LINEUP_NAME_CANDIDATE",
        raw: "Estuary Ruiz",
        candidate: "Esteury Ruiz",
        game: "Miami Marlins @ Cincinnati Reds",
        note: "Screenshot raw kept as Estuary Ruiz; canonical candidate Esteury Ruiz. Do not overwrite raw.",
      },
      {
        kind: "ALIAS_TABLE_ADDITION",
        raw: "미네트윈 / 필라필리 / 캔자로얄",
        candidate: "Minnesota Twins / Philadelphia Phillies / Kansas City Royals",
        note: "Added to existing domestic TEAM_ALIASES using the same 4-char sportsbook abbreviation pattern. Raw screen labels retained on domestic rows.",
      },
      {
        kind: "FOOTBALL_SCREEN_LABEL_LANGUAGE",
        raw: "odds_01/02/03 football team names stored in English transcription",
        candidate: "Korean glyphs on screen were not captured character-exactly",
        note: "MLS rows on odds_04/05 keep Korean abbreviations from the screenshot. Confirm Korean labels for odds_01-03 if needed.",
      },
      {
        kind: "FOOTBALL_LEAGUE_LABEL",
        raw: "EFL챔 / Burnley : West Ham",
        candidate: null,
        note: "Raw league/teams preserved. Do not assume Premier League vs Championship.",
      },
      {
        kind: "FOOTBALL_UNMAPPED",
        raw: "all football/MLS rows",
        candidate: null,
        note: "No 2026-08-16 or 2026-08-17 football schedule artifact. mappingStatus=UNRESOLVED_MAPPING.",
      },
    ],
    sourcePolicy: "OPERATOR_MANUAL_SCREENSHOT_OBSERVATION",
    legal: "INTERNAL_ONLY",
    commercialUseStatus: "INTERNAL_ONLY",
  };
  const auditAbs = path.join(cwd, auditRel);
  await mkdir(path.dirname(auditAbs), { recursive: true });
  await writeFile(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`batch=${BATCH_ID}`);
  console.log(`scheduleGames=${schedule.games.length}`);
  console.log(`lineup=${lineupSaved.pathRel} hash=${lineupSaved.document.expectedLineupHash}`);
  console.log(
    `domestic=${domesticBuilt.pathRel} mapped=${domesticBuilt.document.summary.mappedGames} rowsHash=${domesticBuilt.document.meta.rowsHash}`,
  );
  console.log(`korean=${koreanSaved.pathRel} hash=${koreanSaved.document.koreanMarketOddsHash}`);
  console.log(
    `football=${footballRel} games=${footballDoc.summary.games} blocked=${footballDoc.summary.cutoffBlocked}`,
  );
  console.log(`audit=${auditRel}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
