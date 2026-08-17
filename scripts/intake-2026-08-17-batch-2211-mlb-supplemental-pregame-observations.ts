/**
 * One-shot MLB 2026-08-17/batch-2211 supplemental pregame observation seal.
 *
 *   npx tsx scripts/intake-2026-08-17-batch-2211-mlb-supplemental-pregame-observations.ts
 *
 * Writes only operator-observation raw/structured artifacts.
 * Does NOT write Prediction / Recommendation / Starter / Odds History /
 * Lineup Dataset / Daily Summary / operator-input.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BATCH_ID = "2026-08-17/batch-2211";
export const SLATE_DATE_KST = "2026-08-18";
export const RECEIVED_AT_KST = "2026-08-17T22:10:49+09:00";
export const OBSERVED_AT_UTC = "2026-08-17T13:10:49.000Z";
export const CAPTURE_TIME = "UNKNOWN";
export const FROZEN_PREDICTION_HASH =
  "97237eb6e6f52efec95889da07428b0ae0ae333ec903702c54505622b81132f3";
export const FROZEN_PREDICTION_FILE_SHA =
  "01b08e396ef4db7bf7fe38c4bcb0dfe1aa17b5c167e3aba824ad538d4ec6dab7";
export const RAW_REL = "data/operator-observations/raw/2026-08-17/batch-2211";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-17/batch-2211-mlb-supplemental-pregame-v0.json";
export const AUDIT_REL =
  "data/audits/2026-08-17-batch-2211-mlb-supplemental-pregame-v0.json";

const SCREENSHOTS = [
  {
    file: "screenshot_2026-08-17_220826.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "181b6d4dec327e4c80567307213bfa7fc29eddb667be8530396e4221223da6ba",
    bytes: 153201,
    receivedAtKst: "2026-08-17T22:08:26+09:00",
  },
  {
    file: "screenshot_2026-08-17_221012.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "30843ed7215c5a30c1f8049a1c209b9ee272fdf925dae8d499aa04a841b9125e",
    bytes: 158584,
    receivedAtKst: "2026-08-17T22:10:12+09:00",
  },
  {
    file: "screenshot_2026-08-17_221021.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "d5e71ed7ab31cda9915e29a01ea862c2740971519dcf0e9881005cea7accaf43",
    bytes: 17341,
    receivedAtKst: "2026-08-17T22:10:21+09:00",
  },
  {
    file: "screenshot_2026-08-17_221041.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256: "6c9c1e2df6915ec1b3ec98eae2c204564e8c9b39a1a1d40f51b35fda79962262",
    bytes: 195151,
    receivedAtKst: "2026-08-17T22:10:41+09:00",
  },
  {
    file: "screenshot_2026-08-17_221049.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256: "f1783521d827d1b61b8d3a2f805b458aae7831aeae2682400f8a58f656fa256e",
    bytes: 199166,
    receivedAtKst: "2026-08-17T22:10:49+09:00",
  },
] as const;

type OddsMarket = {
  rawMarketLabel: string;
  marketType:
    | "MONEYLINE_2WAY"
    | "DOMESTIC_THREE_WAY_SPECIAL"
    | "RUN_LINE"
    | "TOTALS"
    | "SUM"
    | "FIRST_HALF_OR_EARLY_SPECIAL"
    | "UNKNOWN";
  line: number | null;
  homePrice: number | string | null;
  drawPrice: number | string | null;
  awayPrice: number | string | null;
  rawValueStatus: "VISIBLE" | "RAW_VALUE_UNCERTAIN";
};

type OddsGameDraft = {
  displayedStartKst: string;
  rawHome: string;
  rawAway: string;
  screenshot: string;
  rowIds: number[];
  markets: OddsMarket[];
};

const ODDS_GAMES: OddsGameDraft[] = [
  {
    displayedStartKst: "02:40",
    rawHome: "신시레즈",
    rawAway: "세인카디",
    screenshot: "screenshot_2026-08-17_220826.png",
    rowIds: [4512, 4513, 4514, 4515, 4516],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.75,
        drawPrice: null,
        awayPrice: 1.77,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.6,
        drawPrice: 3.35,
        awayPrice: 2.14,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 3.46,
        drawPrice: null,
        awayPrice: 1.18,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 9.5",
        marketType: "TOTALS",
        line: 9.5,
        homePrice: 1.66,
        drawPrice: null,
        awayPrice: 1.87,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "07:05",
    rawHome: "탬파레이",
    rawAway: "볼티오리",
    screenshot: "screenshot_2026-08-17_220826.png",
    rowIds: [4526, 4527, 4528, 4529, 4530],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.48,
        drawPrice: null,
        awayPrice: 2.17,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.02,
        drawPrice: 3.3,
        awayPrice: 2.85,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 2.72,
        drawPrice: null,
        awayPrice: 1.3,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 7.5",
        marketType: "TOTALS",
        line: 7.5,
        homePrice: 1.78,
        drawPrice: null,
        awayPrice: 1.74,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "07:40",
    rawHome: "필라필리",
    rawAway: "마이말린",
    screenshot: "screenshot_2026-08-17_220826.png",
    rowIds: [4531, 4532, 4533, 4534, 4535],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.28,
        drawPrice: null,
        awayPrice: 2.82,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 1.65,
        drawPrice: 3.6,
        awayPrice: 3.75,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 2.13,
        drawPrice: null,
        awayPrice: 1.5,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 8.5",
        marketType: "TOTALS",
        line: 8.5,
        homePrice: 1.66,
        drawPrice: null,
        awayPrice: 1.87,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.6,
        drawPrice: null,
        awayPrice: 2.06,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "08:05",
    rawHome: "피츠파이",
    rawAway: "디트타이",
    screenshot: "screenshot_2026-08-17_220826.png",
    rowIds: [4536, 4537, 4538, 4539, 4540],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.87,
        drawPrice: null,
        awayPrice: 1.66,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.75,
        drawPrice: 3.25,
        awayPrice: 2.09,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H +2.5",
        marketType: "RUN_LINE",
        line: 2.5,
        homePrice: 1.29,
        drawPrice: null,
        awayPrice: 2.77,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 7.5",
        marketType: "TOTALS",
        line: 7.5,
        homePrice: 1.89,
        drawPrice: null,
        awayPrice: 1.65,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.58,
        drawPrice: null,
        awayPrice: 2.09,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "08:10",
    rawHome: "뉴욕메츠",
    rawAway: "샌디파드",
    screenshot: "screenshot_2026-08-17_221012.png",
    rowIds: [4541, 4542, 4543, 4544, 4545],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.63,
        drawPrice: null,
        awayPrice: 1.91,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.31,
        drawPrice: 3.25,
        awayPrice: 2.45,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 3.16,
        drawPrice: null,
        awayPrice: 1.22,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 8.5",
        marketType: "TOTALS",
        line: 8.5,
        homePrice: 1.66,
        drawPrice: null,
        awayPrice: 1.87,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "08:10",
    rawHome: "보스레드",
    rawAway: "애리다이",
    screenshot: "screenshot_2026-08-17_221012.png",
    rowIds: [4546, 4547, 4548, 4549, 4550],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.6,
        drawPrice: null,
        awayPrice: 1.96,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.22,
        drawPrice: 3.35,
        awayPrice: 2.5,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 3.03,
        drawPrice: null,
        awayPrice: 1.24,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 8.5",
        marketType: "TOTALS",
        line: 8.5,
        homePrice: 1.86,
        drawPrice: null,
        awayPrice: 1.67,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "08:40",
    rawHome: "미네트윈",
    rawAway: "애틀브레",
    screenshot: "screenshot_2026-08-17_221012.png",
    rowIds: [4551, 4552, 4553, 4554, 4555],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.89,
        drawPrice: null,
        awayPrice: 1.65,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.75,
        drawPrice: 3.3,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H +2.5",
        marketType: "RUN_LINE",
        line: 2.5,
        homePrice: 1.3,
        drawPrice: null,
        awayPrice: 2.72,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 8.5",
        marketType: "TOTALS",
        line: 8.5,
        homePrice: 1.87,
        drawPrice: null,
        awayPrice: 1.66,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "08:40",
    rawHome: "캔자로얄",
    rawAway: "애슬레틱",
    screenshot: "screenshot_2026-08-17_221012.png",
    rowIds: [4556, 4557, 4558, 4559, 4560],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.47,
        drawPrice: null,
        awayPrice: 2.19,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 1.97,
        drawPrice: 3.45,
        awayPrice: 2.85,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 2.43,
        drawPrice: null,
        awayPrice: 1.38,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 9.5",
        marketType: "TOTALS",
        line: 9.5,
        homePrice: 1.65,
        drawPrice: null,
        awayPrice: 1.89,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "09:05",
    rawHome: "시카컵스",
    rawAway: "시카화이",
    screenshot: "screenshot_2026-08-17_221012.png",
    rowIds: [4561, 4562, 4563, 4564, 4565],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 1.48,
        drawPrice: null,
        awayPrice: 2.17,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 2.03,
        drawPrice: 3.35,
        awayPrice: 2.8,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H -2.5",
        marketType: "RUN_LINE",
        line: -2.5,
        homePrice: 2.72,
        drawPrice: null,
        awayPrice: 1.3,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 8.5",
        marketType: "TOTALS",
        line: 8.5,
        homePrice: 1.66,
        drawPrice: null,
        awayPrice: 1.87,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.59,
        drawPrice: null,
        awayPrice: 2.07,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
  {
    displayedStartKst: "09:40",
    rawHome: "콜로로키",
    rawAway: "LA다저스",
    screenshot: "screenshot_2026-08-17_221012.png",
    rowIds: [4566, 4567, 4568, 4569, 4570, 4571, 4572, 4573],
    markets: [
      {
        rawMarketLabel: "승패",
        marketType: "MONEYLINE_2WAY",
        line: null,
        homePrice: 2.92,
        drawPrice: null,
        awayPrice: 1.26,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "승①패",
        marketType: "DOMESTIC_THREE_WAY_SPECIAL",
        line: null,
        homePrice: 4.6,
        drawPrice: 3.85,
        awayPrice: 1.49,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "H +2.5",
        marketType: "RUN_LINE",
        line: 2.5,
        homePrice: 1.75,
        drawPrice: null,
        awayPrice: 1.77,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "U 11.5",
        marketType: "TOTALS",
        line: 11.5,
        homePrice: 1.61,
        drawPrice: null,
        awayPrice: 1.94,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "SUM",
        marketType: "SUM",
        line: null,
        homePrice: 1.62,
        drawPrice: null,
        awayPrice: 2.03,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "h(전반)",
        marketType: "FIRST_HALF_OR_EARLY_SPECIAL",
        line: null,
        homePrice: 3.05,
        drawPrice: 7.3,
        awayPrice: 1.46,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "h H +1.5",
        marketType: "RUN_LINE",
        line: 1.5,
        homePrice: 1.64,
        drawPrice: null,
        awayPrice: 1.9,
        rawValueStatus: "VISIBLE",
      },
      {
        rawMarketLabel: "h U 6.5",
        marketType: "TOTALS",
        line: 6.5,
        homePrice: 1.61,
        drawPrice: null,
        awayPrice: 1.94,
        rawValueStatus: "VISIBLE",
      },
    ],
  },
];

const NON_MLB_ODDS = [
  {
    rawLeagueLabel: "EFL Championship",
    displayedStartKst: "04:00",
    rawHome: "카디프C",
    rawAway: "렉섬",
    screenshot: "screenshot_2026-08-17_220826.png",
    mappingStatus: "NOT_MLB_SLATE",
  },
  {
    rawLeagueLabel: "La Liga",
    displayedStartKst: "04:00",
    rawHome: "데포아코",
    rawAway: "엘체",
    screenshot: "screenshot_2026-08-17_220826.png",
    mappingStatus: "NOT_MLB_SLATE",
  },
];

type Batter = {
  battingOrder: number;
  rawPlayerName: string;
  normalizedPlayerCandidate: string;
  position: string;
  bats: string | null;
};

function batters(rows: string[]): Batter[] {
  return rows.map((row, i) => {
    const [position, rawPlayerName, bats] = row.split("|");
    return {
      battingOrder: i + 1,
      rawPlayerName: rawPlayerName ?? "",
      normalizedPlayerCandidate: rawPlayerName ?? "",
      position: position ?? "",
      bats: bats && bats !== "" ? bats : null,
    };
  });
}

type LineupDraft = {
  displayedStartEt: string;
  displayedStartKst: string;
  awayAbbr: string;
  homeAbbr: string;
  awayTeam: string;
  homeTeam: string;
  screenshot: string;
  awayStarterRaw: string;
  homeStarterRaw: string;
  displayedUsLine: string | null;
  displayedUsTotal: string | null;
  away: string[];
  home: string[];
};

const LINEUP_GAMES: LineupDraft[] = [
  {
    displayedStartEt: "1:40 PM ET",
    displayedStartKst: "02:40",
    awayAbbr: "STL",
    homeAbbr: "CIN",
    awayTeam: "St. Louis Cardinals",
    homeTeam: "Cincinnati Reds",
    screenshot: "screenshot_2026-08-17_221041.png",
    awayStarterRaw: "Quinn Mathews (L), 0-1, 3.60 ERA",
    homeStarterRaw: "Chase Petty (R), 1-2, 4.83 ERA",
    displayedUsLine: "STL -112",
    displayedUsTotal: "9.5",
    away: [
      "2B|J. Wetherholt|L",
      "DH|Ivan Herrera|R",
      "1B|A. Burleson|L",
      "RF|J. Walker|R",
      "LF|Joshua Baez|R",
      "CF|N. Church|L",
      "SS|Masyn Winn|R",
      "C|Jimmy Crooks|L",
      "3B|Jose Fermin|R",
    ],
    home: [
      "SS|E. De La Cruz|S",
      "1B|Sal Stewart|R",
      "LF|JJ Bleday|L",
      "C|T. Stephenson|R",
      "DH|E. Suarez|R",
      "CF|Dane Myers|R",
      "RF|Noelvi Marte|R",
      "3B|K. Hayes|R",
      "2B|Matt McLain|R",
    ],
  },
  {
    displayedStartEt: "6:05 PM ET",
    displayedStartKst: "07:05",
    awayAbbr: "BAL",
    homeAbbr: "TB",
    awayTeam: "Baltimore Orioles",
    homeTeam: "Tampa Bay Rays",
    screenshot: "screenshot_2026-08-17_221041.png",
    awayStarterRaw: "Brandon Young (R), 9-3, 3.33 ERA",
    homeStarterRaw: "Shane McClanahan (L), 9-6, 3.09 ERA",
    displayedUsLine: "TB -158",
    displayedUsTotal: "7.5",
    away: [
      "SS|G. Henderson|L",
      "1B|Pete Alonso|R",
      "2B|J. Holliday|L",
      "DH|T. O'Neill|R",
      "LF|D. Beavers|L",
      "3B|C. Encarnacion-Strand|R",
      "RF|L. Taveras|S",
      "CF|C. Cowser|L",
      "C|Narvaez|R",
    ],
    home: [
      "DH|Yandy Diaz|R",
      "1B|J. Aranda|L",
      "LF|C. Simpson|L",
      "3B|J. Caminero|R",
      "C|Liam Hicks|L",
      "RF|Victor Mesa|L",
      "CF|C. Mullins|L",
      "2B|R. Palacios|L",
      "SS|Taylor Walls|S",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayAbbr: "MIA",
    homeAbbr: "PHI",
    awayTeam: "Miami Marlins",
    homeTeam: "Philadelphia Phillies",
    screenshot: "screenshot_2026-08-17_221041.png",
    awayStarterRaw: "Janson Junk (R), 6-7, 4.41 ERA",
    homeStarterRaw: "C. Sanchez (L), 15-4, 2.54 ERA",
    displayedUsLine: "PHI -246",
    displayedUsTotal: "8.0",
    away: [
      "SS|Otto Lopez|R",
      "LF|H. Hernandez|R",
      "DH|A. Ramirez|R",
      "2B|X. Edwards|S",
      "3B|Leo Jimenez|R",
      "1B|G. Conine|L",
      "RF|J. Sanoja|R",
      "CF|Esteury Ruiz|R",
      "C|Joe Mack|L",
    ],
    home: [
      "DH|K. Schwarber|L",
      "SS|Trea Turner|R",
      "RF|Bryce Harper|L",
      "2B|Luis Arraez|L",
      "3B|Bryson Stott|L",
      "LF|B. Marsh|L",
      "C|J. Realmuto|R",
      "1B|Alec Bohm|R",
      "CF|J. Crawford|L",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayAbbr: "STL",
    homeAbbr: "CIN",
    awayTeam: "St. Louis Cardinals",
    homeTeam: "Cincinnati Reds",
    screenshot: "screenshot_2026-08-17_221041.png",
    awayStarterRaw: "Andre Pallante (R), 12-6, 3.46 ERA",
    homeStarterRaw: "Rhett Lowder (R), 4-8, 5.15 ERA",
    displayedUsLine: "STL -119",
    displayedUsTotal: "9.0",
    away: [
      "2B|J. Wetherholt|L",
      "DH|Ivan Herrera|R",
      "1B|A. Burleson|L",
      "RF|J. Walker|R",
      "LF|Joshua Baez|R",
      "CF|N. Church|L",
      "SS|Masyn Winn|R",
      "C|Jimmy Crooks|L",
      "3B|Jose Fermin|R",
    ],
    home: [
      "SS|E. De La Cruz|S",
      "1B|Sal Stewart|R",
      "CF|Dane Myers|R",
      "DH|E. Suarez|R",
      "C|T. Stephenson|R",
      "RF|Noelvi Marte|R",
      "LF|JJ Bleday|L",
      "3B|K. Hayes|R",
      "2B|Matt McLain|R",
    ],
  },
  {
    displayedStartEt: "7:05 PM ET",
    displayedStartKst: "08:05",
    awayAbbr: "DET",
    homeAbbr: "PIT",
    awayTeam: "Detroit Tigers",
    homeTeam: "Pittsburgh Pirates",
    screenshot: "screenshot_2026-08-17_221041.png",
    awayStarterRaw: "Framber Valdez (L), 7-8, 4.26 ERA",
    homeStarterRaw: "C. Miodzinski (R), 6-5, 3.79 ERA",
    displayedUsLine: "DET -110",
    displayedUsTotal: "8.0",
    away: [
      "2B|G. Torres|R",
      "3B|K. McGonigle|L",
      "C|D. Dingler|R",
      "DH|Colt Keith|L",
      "RF|Z. McKinstry|L",
      "1B|S. Torkelson|R",
      "LF|Ben Malgeri|R",
      "CF|Max Clark|L",
      "SS|Javier Baez|R",
    ],
    home: [
      "3B|N. Gonzales|R",
      "RF|Ronny Simon|S",
      "DH|B. Reynolds|S",
      "LF|E. Valdez|R",
      "2B|Brandon Lowe|L",
      "1B|R. Flores|R",
      "CF|Jake Mangum|S",
      "SS|Jared Triolo|R",
      "C|Henry Davis|R",
    ],
  },
  {
    displayedStartEt: "7:10 PM ET",
    displayedStartKst: "08:10",
    awayAbbr: "ARI",
    homeAbbr: "BOS",
    awayTeam: "Arizona Diamondbacks",
    homeTeam: "Boston Red Sox",
    screenshot: "screenshot_2026-08-17_221041.png",
    awayStarterRaw: "Mitch Bratt (L), 1-1, 3.74 ERA",
    homeStarterRaw: "Brayan Bello (R), 4-6, 4.84 ERA",
    displayedUsLine: "BOS -140",
    displayedUsTotal: "9.0",
    away: [
      "RF|C. Carroll|L",
      "SS|G. Perdomo|S",
      "DH|G. Moreno|R",
      "2B|Ketel Marte|S",
      "3B|N. Arenado|R",
      "CF|Tim Tawa|R",
      "1B|T. Locklear|R",
      "C|James McCann|R",
      "LF|R. Waldschmidt|R",
    ],
    home: [
      "DH|Jahmai Jones|R",
      "CF|C. Rafaela|R",
      "1B|W. Contreras|R",
      "RF|Wilyer Abreu|L",
      "C|A. Rutschman|S",
      "3B|Caleb Durbin|R",
      "SS|A. Monasterio|R",
      "LF|Eli White|R",
      "2B|Nick Sogard|S",
    ],
  },
  {
    displayedStartEt: "7:10 PM ET",
    displayedStartKst: "08:10",
    awayAbbr: "SD",
    homeAbbr: "NYM",
    awayTeam: "San Diego Padres",
    homeTeam: "New York Mets",
    screenshot: "screenshot_2026-08-17_221049.png",
    awayStarterRaw: "Walker Buehler (R), 7-5, 4.88 ERA",
    homeStarterRaw: "Nolan McLean (R), 8-8, 3.42 ERA",
    displayedUsLine: "NYM -114",
    displayedUsTotal: "8.0",
    away: [
      "RF|F. Tatis|R",
      "2B|J. Cronenworth|L",
      "3B|M. Machado|R",
      "1B|Ty France|R",
      "CF|J. Merrill|L",
      "C|L. Campusano|R",
      "DH|Gavin Sheets|L",
      "SS|X. Bogaerts|R",
      "LF|Luis Rengifo|S",
    ],
    home: [
      "LF|A.J. Ewing|L",
      "SS|F. Lindor|S",
      "3B|Bo Bichette|R",
      "RF|Carson Benge|L",
      "CF|Luis Robert|R",
      "1B|Jared Young|L",
      "2B|M. Semien|R",
      "DH|J. Polanco|S",
      "C|F. Alvarez|R",
    ],
  },
  {
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayAbbr: "ATH",
    homeAbbr: "KC",
    awayTeam: "Athletics",
    homeTeam: "Kansas City Royals",
    screenshot: "screenshot_2026-08-17_221049.png",
    awayStarterRaw: "Mason Barnett (R), 1-3, 6.16 ERA",
    homeStarterRaw: "Michael Wacha (R), 5-8, 3.46 ERA",
    displayedUsLine: "KC -187",
    displayedUsTotal: "9.0",
    away: [
      "1B|Jeff McNeil|L",
      "SS|Jacob Wilson|R",
      "LF|Zack Gelof|R",
      "RF|L. Butler|L",
      "DH|C. Cortes|L",
      "2B|D. Walton|L",
      "C|Jonah Heim|S",
      "3B|Tommy White|R",
      "CF|Henry Bolte|R",
    ],
    home: [
      "C|C. Jensen|L",
      "SS|Bobby Witt|R",
      "RF|J. Caglianone|L",
      "3B|M. Garcia|R",
      "DH|S. Perez|R",
      "1B|V. Pasquantino|L",
      "2B|M. Massey|L",
      "LF|I. Collins|S",
      "CF|Kyle Isbel|L",
    ],
  },
  {
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayAbbr: "ATL",
    homeAbbr: "MIN",
    awayTeam: "Atlanta Braves",
    homeTeam: "Minnesota Twins",
    screenshot: "screenshot_2026-08-17_221049.png",
    awayStarterRaw: "Martin Perez (L), 8-6, 2.96 ERA",
    homeStarterRaw: "Bailey Ober (R), 7-4, 4.64 ERA",
    displayedUsLine: "ATL -124",
    displayedUsTotal: "9.0",
    away: [
      "C|D. Baldwin|L",
      "RF|Ronald Acuna|R",
      "1B|Matt Olson|L",
      "CF|M. Harris|L",
      "2B|Ozzie Albies|S",
      "LF|M. Dubon|R",
      "DH|M. Yastrzemski|L",
      "3B|Austin Riley|R",
      "SS|Jim Jarvis|L",
    ],
    home: [
      "CF|Byron Buxton|R",
      "C|Ryan Jeffers|R",
      "DH|Josh Bell|S",
      "2B|Royce Lewis|R",
      "LF|A. Martin|R",
      "1B|V. Caratini|S",
      "RF|L. Keaschall|R",
      "3B|Brooks Lee|S",
      "SS|K. Culpepper|R",
    ],
  },
  {
    displayedStartEt: "8:05 PM ET",
    displayedStartKst: "09:05",
    awayAbbr: "CWS",
    homeAbbr: "CHC",
    awayTeam: "Chicago White Sox",
    homeTeam: "Chicago Cubs",
    screenshot: "screenshot_2026-08-17_221049.png",
    awayStarterRaw: "Luis Castillo (R), 4-9, 4.96 ERA",
    homeStarterRaw: "Shota Imanaga (L), 8-9, 3.74 ERA",
    displayedUsLine: "CHC -161",
    displayedUsTotal: "8.0",
    away: [
      "2B|C. Meidroth|R",
      "1B|M. Murakami|L",
      "3B|M. Vargas|R",
      "DH|R. Grichuk|R",
      "RF|B. Montgomery|S",
      "CF|B. Doyle|R",
      "SS|C. Montgomery|L",
      "C|Jake Rogers|R",
      "LF|L. Acuna|R",
    ],
    home: [
      "CF|P. Crow-Armstrong|L",
      "RF|Seiya Suzuki|R",
      "1B|M. Busch|L",
      "3B|Alex Bregman|R",
      "LF|Ian Happ|S",
      "SS|Nico Hoerner|R",
      "2B|P. Ramirez|S",
      "DH|M. Conforto|L",
      "C|Miguel Amaya|R",
    ],
  },
  {
    displayedStartEt: "8:40 PM ET",
    displayedStartKst: "09:40",
    awayAbbr: "LAD",
    homeAbbr: "COL",
    awayTeam: "Los Angeles Dodgers",
    homeTeam: "Colorado Rockies",
    screenshot: "screenshot_2026-08-17_221049.png",
    awayStarterRaw: "Blake Snell (L), 0-1, 5.00 ERA",
    homeStarterRaw: "Tomoyuki Sugano (R), 12-5, 4.43 ERA",
    displayedUsLine: "LAD -259",
    displayedUsTotal: "10.5",
    away: [
      "DH|S. Ohtani|L",
      "1B|F. Freeman|L",
      "CF|Andy Pages|R",
      "3B|Max Muncy|L",
      "SS|Mookie Betts|R",
      "RF|Kyle Tucker|L",
      "2B|Tommy Edman|S",
      "LF|T. Hernandez|R",
      "C|H. Feduccia|L",
    ],
    home: [
      "LF|J. McCarthy|L",
      "CF|Cole Carrigg|S",
      "DH|TJ Rumfield|L",
      "C|H. Goodman|R",
      "3B|Willi Castro|S",
      "RF|Jordan Beck|R",
      "1B|Connor Norby|R",
      "SS|E. Tovar|R",
      "2B|Adael Amador|S",
    ],
  },
];

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function screenshotMeta(file: string) {
  const row = SCREENSHOTS.find((s) => s.file === file);
  if (!row) throw new Error(`unknown screenshot ${file}`);
  return row;
}

type ScheduleGame = {
  gamePk: number;
  internalGameId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string;
  commenceTimeUtc: string;
};

function mapByHomeAwayTime(
  schedule: ScheduleGame[],
  homeTeam: string,
  awayTeam: string,
  startTimeKst: string,
): { status: "MAPPED" | "AMBIGUOUS_DOUBLEHEADER" | "UNRESOLVED"; games: ScheduleGame[] } {
  const hits = schedule.filter(
    (g) =>
      g.homeTeam === homeTeam &&
      g.awayTeam === awayTeam &&
      g.startTimeKst === startTimeKst,
  );
  if (hits.length === 1) return { status: "MAPPED", games: hits };
  const pair = schedule.filter(
    (g) => g.homeTeam === homeTeam && g.awayTeam === awayTeam,
  );
  if (pair.length > 1 && hits.length !== 1) {
    return { status: "AMBIGUOUS_DOUBLEHEADER", games: pair };
  }
  if (hits.length === 0 && pair.length === 1) {
    return { status: "UNRESOLVED", games: pair };
  }
  return { status: "UNRESOLVED", games: hits };
}

function cutoffStatus(receivedAtIso: string, commenceTimeUtc: string) {
  const received = Date.parse(receivedAtIso);
  const kickoff = Date.parse(commenceTimeUtc);
  if (!Number.isFinite(received) || !Number.isFinite(kickoff)) {
    return "UNKNOWN" as const;
  }
  return received < kickoff ? "PRE_GAME_OBSERVED" : "NOT_PREGAME_ELIGIBLE";
}

async function main() {
  const cwd = process.cwd();
  const predRel = `data/predictions/mlb/${SLATE_DATE_KST}.json`;
  const predAbs = path.join(cwd, predRel);
  const predRaw = await readFile(predAbs);
  const predFileSha = createHash("sha256").update(predRaw).digest("hex");
  const predDoc = JSON.parse(predRaw.toString("utf8")) as {
    meta: { generatedAt: string; predictionHashSha256: string };
    predictions: Array<{
      gameId: string;
      startTimeKst: string;
      homeTeam: string;
      awayTeam: string;
      baselinePick: string | null;
      modelProbability: number | null;
      confidence: number | null;
      officialStatus: string;
      inputStatus: string;
    }>;
  };
  if (predDoc.meta.predictionHashSha256 !== FROZEN_PREDICTION_HASH) {
    throw new Error("STOP: frozen predictionHash mismatch");
  }
  if (predFileSha !== FROZEN_PREDICTION_FILE_SHA) {
    throw new Error("STOP: frozen prediction file SHA mismatch");
  }

  const forbidden = [
    predRel,
    `data/research/mlb/${SLATE_DATE_KST}-schedule-v1.json`,
    `data/research/mlb/${SLATE_DATE_KST}-starter-dataset-v1.json`,
    `data/research/mlb/${SLATE_DATE_KST}-odds-history-dataset-v1.json`,
    `data/research/mlb/${SLATE_DATE_KST}-lineup-dataset-v1.json`,
    `data/research/mlb/${SLATE_DATE_KST}-daily-research-summary-v1.json`,
  ];
  const frozenHashes: Record<string, string> = {};
  for (const rel of forbidden) {
    frozenHashes[rel] = sha256File(path.join(cwd, rel));
  }

  for (const shot of SCREENSHOTS) {
    const abs = path.join(cwd, RAW_REL, shot.file);
    if (!existsSync(abs)) throw new Error(`missing raw ${shot.file}`);
    const sha = sha256File(abs);
    if (sha !== shot.sha256) throw new Error(`raw mutation ${shot.file}`);
    const bytes = readFileSync(abs).byteLength;
    if (bytes !== shot.bytes) throw new Error(`raw size mutation ${shot.file}`);
  }

  const scheduleDoc = JSON.parse(
    await readFile(
      path.join(cwd, `data/research/mlb/${SLATE_DATE_KST}-schedule-v1.json`),
      "utf8",
    ),
  ) as { games: ScheduleGame[] };
  const schedule = scheduleDoc.games;

  const oddsRows = ODDS_GAMES.map((g) => {
    const shot = screenshotMeta(g.screenshot);
    const mapped = mapByHomeAwayTime(
      schedule,
      // Korean screenshot lists home:away using schedule home/away English names via known transliteration
      englishHome(g.rawHome),
      englishAway(g.rawAway),
      g.displayedStartKst,
    );
    const game = mapped.games[0] ?? null;
    const receivedAtUtc = kstToUtc(shot.receivedAtKst);
    return {
      displayedDateKst: SLATE_DATE_KST,
      displayedStartKst: g.displayedStartKst,
      rawHomeLabel: g.rawHome,
      rawAwayLabel: g.rawAway,
      rawMatchup: `${g.rawHome} : ${g.rawAway}`,
      screenshotFile: g.screenshot,
      screenshotSha256: shot.sha256,
      screenshotRel: `${RAW_REL}/${g.screenshot}`,
      receivedAtKst: shot.receivedAtKst,
      rowIds: g.rowIds,
      mappingStatus: mapped.status,
      gamePk: mapped.status === "MAPPED" ? game!.gamePk : null,
      internalGameId: mapped.status === "MAPPED" ? game!.internalGameId : null,
      cutoffStatus:
        mapped.status === "MAPPED"
          ? cutoffStatus(receivedAtUtc, game!.commenceTimeUtc)
          : "UNKNOWN",
      markets: g.markets,
    };
  });

  const lineupRows = LINEUP_GAMES.map((g) => {
    const shot = screenshotMeta(g.screenshot);
    const mapped = mapByHomeAwayTime(
      schedule,
      g.homeTeam,
      g.awayTeam,
      g.displayedStartKst,
    );
    const game = mapped.games[0] ?? null;
    const receivedAtUtc = kstToUtc(shot.receivedAtKst);
    const pred =
      mapped.status === "MAPPED"
        ? predDoc.predictions.find(
            (p) =>
              p.gameId === game!.internalGameId &&
              p.startTimeKst === g.displayedStartKst,
          )
        : undefined;
    return {
      displayedStartEt: g.displayedStartEt,
      displayedStartKst: g.displayedStartKst,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      screenshotFile: g.screenshot,
      screenshotSha256: shot.sha256,
      screenshotRel: `${RAW_REL}/${g.screenshot}`,
      receivedAtKst: shot.receivedAtKst,
      lineupType: "EXPECTED" as const,
      mappingStatus: mapped.status,
      gamePk: mapped.status === "MAPPED" ? game!.gamePk : null,
      internalGameId: mapped.status === "MAPPED" ? game!.internalGameId : null,
      cutoffStatus:
        mapped.status === "MAPPED"
          ? cutoffStatus(receivedAtUtc, game!.commenceTimeUtc)
          : "UNKNOWN",
      awayStarterRaw: g.awayStarterRaw,
      homeStarterRaw: g.homeStarterRaw,
      displayedUsLine: g.displayedUsLine,
      displayedUsTotal: g.displayedUsTotal,
      awayLineup: batters(g.away),
      homeLineup: batters(g.home),
      frozenPredictionLink:
        pred && mapped.status === "MAPPED"
          ? {
              officialPredictionHash: FROZEN_PREDICTION_HASH,
              gamePk: game!.gamePk,
              frozenBaselinePick: pred.baselinePick,
              frozenModelProbability: pred.modelProbability,
              frozenConfidence: pred.confidence,
              frozenOfficialStatus: pred.officialStatus,
              frozenInputStatus: pred.inputStatus,
              predictionInput: false,
              availableAtPredictionFreeze: false,
              availableBeforeKickoff: true,
            }
          : null,
    };
  });

  const oddsMapped = oddsRows.filter((r) => r.mappingStatus === "MAPPED");
  const lineupMapped = lineupRows.filter((r) => r.mappingStatus === "MAPPED");
  const mappedGamePks = [...new Set(lineupMapped.map((r) => r.gamePk))];
  const schedulePks = schedule.map((g) => g.gamePk);
  const oddsMissing = schedulePks.filter(
    (pk) => !oddsMapped.some((r) => r.gamePk === pk),
  );

  const document = {
    schemaVersion: "mlb-supplemental-pregame-observation-v0",
    batchId: BATCH_ID,
    slateDateKst: SLATE_DATE_KST,
    receivedAtKst: RECEIVED_AT_KST,
    observedAt: OBSERVED_AT_UTC,
    captureTime: CAPTURE_TIME,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    autoApply: false,
    predictionInput: false,
    predictionAlreadyFrozen: true,
    officialPredictionHash: FROZEN_PREDICTION_HASH,
    officialPredictionRel: predRel,
    observationPhase: "POST_PREDICTION_PRE_GAME",
    availableAtPredictionFreeze: false,
    availableBeforeKickoff: true,
    note: "Supplemental pregame observation received after official 2026-08-18 Prediction freeze and before first pitch. Not a Prediction input. Lineups are EXPECTED only. Domestic odds are screenshot-visible values only.",
    summary: {
      screenshots: SCREENSHOTS.length,
      oddsScreenshots: 3,
      lineupScreenshots: 2,
      observedGames: mappedGamePks.length,
      mappedGamePk: mappedGamePks.length,
      unresolved: lineupRows.filter((r) => r.mappingStatus !== "MAPPED").length,
      pregameEligible: lineupMapped.filter(
        (r) => r.cutoffStatus === "PRE_GAME_OBSERVED",
      ).length,
      cutoffBlocked: lineupMapped.filter(
        (r) => r.cutoffStatus === "NOT_PREGAME_ELIGIBLE",
      ).length,
      doubleheaderAmbiguous:
        oddsRows.filter((r) => r.mappingStatus === "AMBIGUOUS_DOUBLEHEADER")
          .length +
        lineupRows.filter((r) => r.mappingStatus === "AMBIGUOUS_DOUBLEHEADER")
          .length,
      oddsGamesMapped: oddsMapped.length,
      oddsGamesMissingFromScreenshots: oddsMissing,
      lineupExpected: lineupMapped.length,
      lineupOfficial: 0,
      lineupUnknown: 0,
      teamLineups: lineupMapped.length * 2,
      players: lineupMapped.reduce(
        (n, r) => n + r.awayLineup.length + r.homeLineup.length,
        0,
      ),
      nonMlbOddsFixtures: NON_MLB_ODDS.length,
      shaDuplicates: 0,
      rawMutation: 0,
    },
    screenshots: SCREENSHOTS.map((s) => ({
      ...s,
      rel: `${RAW_REL}/${s.file}`,
    })),
    nonMlbOddsFixtures: NON_MLB_ODDS,
    domesticOdds: oddsRows,
    expectedLineups: lineupRows,
    doubleheader: {
      pair: "CIN vs STL",
      gamePk824514: {
        startTimeKst: "02:40",
        odds: "MAPPED",
        lineup: "MAPPED",
        separatedByDisplayedTime: true,
      },
      gamePk824478: {
        startTimeKst: "07:40",
        odds: "NOT_ON_SCREENSHOT",
        lineup: "MAPPED",
        separatedByDisplayedTime: true,
      },
      ambiguous: false,
    },
    frozenPrediction: {
      generatedAt: predDoc.meta.generatedAt,
      predictionHash: predDoc.meta.predictionHashSha256,
      fileSha256: predFileSha,
    },
  };

  const structuredAbs = path.join(cwd, STRUCTURED_REL);
  await mkdir(path.dirname(structuredAbs), { recursive: true });
  await writeFile(structuredAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const afterFrozen: Record<string, string> = {};
  for (const rel of forbidden) {
    afterFrozen[rel] = sha256File(path.join(cwd, rel));
    if (afterFrozen[rel] !== frozenHashes[rel]) {
      throw new Error(`STOP: frozen artifact mutated ${rel}`);
    }
  }

  const audit = {
    schemaVersion: "mlb-supplemental-pregame-observation-audit-v0",
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    predictionInput: false,
    wrote: [STRUCTURED_REL],
    rawRel: RAW_REL,
    frozenUnchanged: true,
    frozenHashes,
    summary: document.summary,
    timing: {
      predictionGeneratedAt: predDoc.meta.generatedAt,
      observationReceivedAtKst: RECEIVED_AT_KST,
      firstPitchKst: "2026-08-18T02:40:00+09:00",
      afterPredictionBeforeGame: true,
    },
  };
  const auditAbs = path.join(cwd, AUDIT_REL);
  await mkdir(path.dirname(auditAbs), { recursive: true });
  await writeFile(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`wrote ${STRUCTURED_REL}`);
  console.log(`wrote ${AUDIT_REL}`);
  console.log(
    `oddsMapped=${document.summary.oddsGamesMapped} lineupMapped=${document.summary.lineupExpected} DH_ambiguous=${document.summary.doubleheaderAmbiguous}`,
  );
}

function kstToUtc(kst: string): string {
  const m = kst.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})$/,
  );
  if (!m) throw new Error(`bad kst ${kst}`);
  const utcMs = Date.parse(`${m[1]}T${m[2]}${m[3]}`);
  return new Date(utcMs).toISOString();
}

function englishHome(raw: string): string {
  const map: Record<string, string> = {
    신시레즈: "Cincinnati Reds",
    탬파레이: "Tampa Bay Rays",
    필라필리: "Philadelphia Phillies",
    피츠파이: "Pittsburgh Pirates",
    뉴욕메츠: "New York Mets",
    보스레드: "Boston Red Sox",
    미네트윈: "Minnesota Twins",
    캔자로얄: "Kansas City Royals",
    시카컵스: "Chicago Cubs",
    콜로로키: "Colorado Rockies",
  };
  const v = map[raw];
  if (!v) throw new Error(`unmapped home label ${raw}`);
  return v;
}

function englishAway(raw: string): string {
  const map: Record<string, string> = {
    세인카디: "St. Louis Cardinals",
    볼티오리: "Baltimore Orioles",
    마이말린: "Miami Marlins",
    디트타이: "Detroit Tigers",
    샌디파드: "San Diego Padres",
    애리다이: "Arizona Diamondbacks",
    애틀브레: "Atlanta Braves",
    애슬레틱: "Athletics",
    시카화이: "Chicago White Sox",
    LA다저스: "Los Angeles Dodgers",
  };
  const v = map[raw];
  if (!v) throw new Error(`unmapped away label ${raw}`);
  return v;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
