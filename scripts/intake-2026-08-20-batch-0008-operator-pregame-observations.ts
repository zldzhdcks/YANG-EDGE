/**
 * One-shot 2026-08-20/batch-0008 operator screenshot seal.
 *
 *   npx tsx scripts/intake-2026-08-20-batch-0008-operator-pregame-observations.ts
 *
 * Raw PNGs must already be byte-copied. Does NOT write Prediction /
 * operator-input / Schedule. Does NOT open 2026-08-19 frozen artifacts.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1";

export const BATCH_ID = "2026-08-20/batch-0008";
export const RECEIVED_DATE_KST = "2026-08-20";
export const SLATE_DATE_KST = "2026-08-20";
export const RECEIVED_AT_KST = "2026-08-20T00:08:36+09:00";
export const OBSERVED_AT_UTC = "2026-08-19T15:08:36.000Z";
export const CAPTURE_TIME_SOURCE =
  "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE";
export const TIMING_CLASS = "PRE_GAME";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-20/batch-0008";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-20/batch-0008-next-pregame-v0.json";
export const AUDIT_REL =
  "data/audits/2026-08-20-batch-0008-next-pregame-v0.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const SCOPE_STATUS = "READY_TO_LOCK_DAILY_SCOPE";
export const MLB_OBSERVED = 15;
export const FOOTBALL_OBSERVED = 23;
export const TOTAL_OBSERVED = 38;

const S1 = "screenshot_2026-08-20_000715.png";
const S2 = "screenshot_2026-08-20_000733.png";
const S3 = "screenshot_2026-08-20_000740.png";
const S4 = "screenshot_2026-08-20_000747.png";
const S5 = "screenshot_2026-08-20_000805.png";
const S6 = "screenshot_2026-08-20_000812.png";
const S7 = "screenshot_2026-08-20_000817.png";
const S8 = "screenshot_2026-08-20_000825.png";
const S9 = "screenshot_2026-08-20_000833.png";
const S10 = "screenshot_2026-08-20_000836.png";

export const SCREENSHOTS = [
  {
    file: S1,
    originalInboxName: "스크린샷 2026-08-20 000715.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "7c49342d36ee819f38f819859157dffaba5e445c0a8c552f813cdee8cf809239",
    bytes: 153531,
    receivedAtKst: "2026-08-20T00:07:15+09:00",
  },
  {
    file: S2,
    originalInboxName: "스크린샷 2026-08-20 000733.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "55d2404037d2653d451fc5d44667ed43f80d9b98cd6d7711808b33eb3bb4c0b4",
    bytes: 178765,
    receivedAtKst: "2026-08-20T00:07:33+09:00",
  },
  {
    file: S3,
    originalInboxName: "스크린샷 2026-08-20 000740.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "8294a008e9ec75c804f9d99599ce80035ca79bfa399299ea44b6792da710a6ea",
    bytes: 162752,
    receivedAtKst: "2026-08-20T00:07:40+09:00",
  },
  {
    file: S4,
    originalInboxName: "스크린샷 2026-08-20 000747.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "45c00d6d72314e7214d2cd3fc1fc539dfd297b8f0fcc3c830535e1136537d62a",
    bytes: 175751,
    receivedAtKst: "2026-08-20T00:07:47+09:00",
  },
  {
    file: S5,
    originalInboxName: "스크린샷 2026-08-20 000805.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "61fc418d7eec97e4388b8947044609667652a214ff31a0db0ab0e6d26fa438c4",
    bytes: 152716,
    receivedAtKst: "2026-08-20T00:08:05+09:00",
  },
  {
    file: S6,
    originalInboxName: "스크린샷 2026-08-20 000812.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "e4e5430a9b5ee63d1a8ccd5597392ba16643118b0504db9751d471f196115093",
    bytes: 169085,
    receivedAtKst: "2026-08-20T00:08:12+09:00",
  },
  {
    file: S7,
    originalInboxName: "스크린샷 2026-08-20 000817.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256: "2d82415e749451f18c6320edf8171bce910756781e77772ec60701394327be08",
    bytes: 67896,
    receivedAtKst: "2026-08-20T00:08:17+09:00",
  },
  {
    file: S8,
    originalInboxName: "스크린샷 2026-08-20 000825.png",
    category: "MLB_MIXED_CONFIRMED_AND_EXPECTED_LINEUP" as const,
    sha256: "15eba5d67aa3fce0e92887a5409c21e03368198a0bb808a1b7568eaafdfde4c7",
    bytes: 197831,
    receivedAtKst: "2026-08-20T00:08:25+09:00",
  },
  {
    file: S9,
    originalInboxName: "스크린샷 2026-08-20 000833.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256: "090f2efda58b109b516b9ab0019eef66c21f0501c0f5dde56210ce606168778e",
    bytes: 188602,
    receivedAtKst: "2026-08-20T00:08:33+09:00",
  },
  {
    file: S10,
    originalInboxName: "스크린샷 2026-08-20 000836.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256: "70e1c17e3d71f7787d16767be178daafb68ee6caedcbff5035d03c9bfe356406",
    bytes: 99253,
    receivedAtKst: "2026-08-20T00:08:36+09:00",
  },
] as const;

type MarketType =
  | "MONEYLINE_2WAY"
  | "DOMESTIC_THREE_WAY_SPECIAL"
  | "RUN_LINE"
  | "TOTALS"
  | "SUM"
  | "FIRST_HALF_OR_EARLY_SPECIAL"
  | "ONE_X_TWO"
  | "FOOTBALL_HANDICAP_3WAY";

function ml(
  rawMarketLabel: string,
  marketType: MarketType,
  line: number | null,
  homePrice: number | null,
  drawPrice: number | null,
  awayPrice: number | null,
  screenshotFile: string,
  rowIds: number[],
) {
  return {
    rawMarketLabel,
    marketType,
    line,
    homePrice,
    drawPrice,
    awayPrice,
    rawValueStatus: "VISIBLE" as const,
    screenshotFile,
    rowIds,
  };
}

const ODDS_GAMES = [
  {
    sport: "MLB" as const,
    displayedStartKst: "01:35",
    rawHome: "피츠파이",
    rawAway: "디트타이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.51, null, 2.11, S1, [4920]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.07, 3.3, 2.75, S1, [4921]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.82, null, 1.28, S1, [4922]),
      ml("U 7.5", "TOTALS", 7.5, 1.89, null, 1.65, S1, [4923]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S1, [4924]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "02:10",
    rawHome: "뉴욕메츠",
    rawAway: "샌디파드",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.96, null, 1.6, S1, [4925]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.9, 3.3, 1.99, S1, [4926]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.33, null, 2.6, S1, [4927]),
      ml("U 8.5", "TOTALS", 8.5, 1.82, null, 1.7, S1, [4928]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S1, [4929]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "02:40",
    rawHome: "미네트윈",
    rawAway: "애틀브레",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.79, null, 1.73, S1, [4930]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.6, 3.3, 2.17, S1, [4931]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.27, null, 2.87, S1, [4932]),
      ml("U 8.5", "TOTALS", 8.5, 1.84, null, 1.69, S1, [4933]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S1, [4934]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "03:20",
    rawHome: "시카컵스",
    rawAway: "시카화이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.46, null, 2.22, S1, [4935]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.99, 3.3, 2.9, S1, [4936]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.68, null, 1.31, S1, [4937]),
      ml("U 8.5", "TOTALS", 8.5, 1.68, null, 1.85, S1, [4938]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S1, [4939]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "05:10",
    rawHome: "보스레드",
    rawAway: "애리다이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.5, null, 2.13, S2, [4946]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.05, 3.35, 2.75, S2, [4947]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.77, null, 1.29, S3, [4948]),
      ml("U 8.5", "TOTALS", 8.5, 1.74, null, 1.78, S3, [4949]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4950]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "07:05",
    rawHome: "필라필리",
    rawAway: "마이말린",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.59, null, 1.97, S3, [4959]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.22, 3.35, 2.5, S3, [4960]),
      ml("H -2.5", "RUN_LINE", -2.5, 3.03, null, 1.24, S3, [4961]),
      ml("U 8.5", "TOTALS", 8.5, 1.76, null, 1.76, S3, [4962]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4963]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "07:35",
    rawHome: "볼티오리",
    rawAway: "뉴욕양키",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.9, null, 1.64, S3, [4964]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.8, 3.35, 2.03, S3, [4965]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.31, null, 2.68, S3, [4966]),
      ml("U 9.5", "TOTALS", 9.5, 1.63, null, 1.91, S3, [4967]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4968]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "07:40",
    rawHome: "템파레이",
    rawAway: "토론블루",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.33, null, 2.6, S3, [4969]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.76, 3.45, 3.45, S3, [4970]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.31, null, 1.42, S3, [4971]),
      ml("U 7.5", "TOTALS", 7.5, 1.77, null, 1.75, S3, [4972]),
      ml("SUM", "SUM", null, 1.6, null, 2.06, S3, [4973]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "07:40",
    rawHome: "클리가디",
    rawAway: "샌프자이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.44, null, 2.26, S3, [4974]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.95, 3.3, 3.0, S3, [4975]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.64, null, 1.32, S3, [4976]),
      ml("U 7.5", "TOTALS", 7.5, 1.73, null, 1.79, S3, [4977]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4978]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "07:40",
    rawHome: "신시레즈",
    rawAway: "세인카디",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.52, null, 2.09, S4, [4979]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.08, 3.35, 2.7, S4, [4980]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.82, null, 1.28, S4, [4981]),
      ml("U 8.5", "TOTALS", 8.5, 1.75, null, 1.77, S4, [4982]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S4, [4983]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "08:40",
    rawHome: "밀워브루",
    rawAway: "시애매리",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.61, null, 1.94, S5, [5012]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.29, 3.2, 2.5, S5, [5013]),
      ml("H -2.5", "RUN_LINE", -2.5, 3.16, null, 1.22, S5, [5014]),
      ml("U 7.5", "TOTALS", 7.5, 1.66, null, 1.87, S5, [5015]),
      ml("SUM", "SUM", null, 1.58, null, 2.09, S5, [5016]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "08:40",
    rawHome: "캔자로알",
    rawAway: "애슬레틱",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.67, null, 1.86, S5, [5017]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.35, 3.35, 2.35, S5, [5018]),
      ml("H -2.5", "RUN_LINE", -2.5, 3.23, null, 1.21, S5, [5019]),
      ml("U 9.5", "TOTALS", 9.5, 1.62, null, 1.93, S5, [5020]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S5, [5021]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "09:05",
    rawHome: "텍사레인",
    rawAway: "워싱내셔",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.61, null, 1.94, S5, [5026]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.26, 3.25, 2.5, S5, [5027]),
      ml("H -2.5", "RUN_LINE", -2.5, 3.16, null, 1.22, S5, [5028]),
      ml("U 7.5", "TOTALS", 7.5, 1.8, null, 1.72, S5, [5029]),
      ml("SUM", "SUM", null, 1.58, null, 2.09, S5, [5030]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "09:10",
    rawHome: "휴스애스",
    rawAway: "LA에인절",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.48, null, 2.17, S5, [5031]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.01, 3.4, 2.8, S5, [5032]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.68, null, 1.31, S5, [5033]),
      ml("U 8.5", "TOTALS", 8.5, 1.84, null, 1.69, S5, [5034]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S5, [5035]),
    ],
  },
  {
    sport: "MLB" as const,
    displayedStartKst: "09:40",
    rawHome: "콜로로키",
    rawAway: "LA다저스",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 2.56, null, 1.34, S6, [5044]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 4.15, 3.7, 1.57, S6, [5045]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.6, null, 1.96, S6, [5046]),
      ml("U 11.5", "TOTALS", 11.5, 1.71, null, 1.81, S6, [5047]),
      ml("SUM", "SUM", null, 1.61, null, 2.04, S6, [5048]),
    ],
  },
];

function fb(
  rawLeagueLabel: string,
  displayedStartKst: string,
  rawHome: string,
  rawAway: string,
  screenshot: string,
  competitionRegistryJoin: "LABEL_NOT_EXACT" | "LABEL_EXACT" | "COMPETITION_NOT_REGISTERED",
  markets: ReturnType<typeof ml>[],
) {
  return {
    sport: "FOOTBALL" as const,
    rawLeagueLabel,
    displayedStartKst,
    rawHome,
    rawAway,
    rawHomeSecondaryVisible: null as string | null,
    screenshot,
    identityStatus: "JOIN_FAILED" as const,
    mappingStatus: "NOT_ON_REGISTERED_SLATE" as const,
    competitionRegistryJoin,
    markets,
  };
}

const FOOTBALL_GAMES = [
  fb("UCL", "04:00", "셀틱", "LASK", S1, "LABEL_NOT_EXACT", [
    ml("1X2", "ONE_X_TWO", null, 1.58, 3.8, 4.4, S1, [4876]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.7, 3.5, 2.08, S1, [4877]),
    ml("U 2.5", "TOTALS", 2.5, 2.02, null, 1.59, S1, [4879]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S1, [4880]),
  ]),
  fb("UCL", "04:00", "슬로반브", "NK첼레", S1, "LABEL_NOT_EXACT", [
    ml("1X2", "ONE_X_TWO", null, 1.6, 3.75, 4.3, S1, [4884]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.1, 3.35, 1.94, S2, [4885]),
  ]),
  fb("UCL", "04:00", "H베르셰", "사바FK", S2, "LABEL_NOT_EXACT", [
    ml("1X2", "ONE_X_TWO", null, 2.25, 3.05, 2.85, S2, [4892]),
  ]),
  fb("UCL", "04:00", "네이메헌", "보되글림", S2, "LABEL_NOT_EXACT", [
    ml("1X2", "ONE_X_TWO", null, 2.5, 3.45, 2.31, S2, [4900]),
  ]),
  fb("라리가", "04:00", "AT마드", "말라가", S2, "LABEL_EXACT", [
    ml("1X2", "ONE_X_TWO", null, 1.25, 4.65, 8.2, S2, [4940]),
  ]),
  fb("코파리베", "07:00", "세로포르", "SE파우메", S3, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 4.8, 3.05, 1.63, S3, [4951]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 2.03, 3.0, 3.1, S3, [4952]),
    ml("U 2.5", "TOTALS", 2.5, 1.45, null, 2.24, S3, [4953]),
    ml("SUM", "SUM", null, 1.82, null, 1.78, S3, [4954]),
  ]),
  fb("코파리베", "07:00", "코킴보U", "플라텐세", S3, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.18, 2.75, 3.05, S3, [4955]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.85, 3.4, 1.54, S3, [4956]),
    ml("U 2.5", "TOTALS", 2.5, 1.4, null, 2.37, S3, [4957]),
    ml("SUM", "SUM", null, 1.82, null, 1.78, S3, [4958]),
  ]),
  fb("코파리베", "09:30", "플라멩구", "크루제이", S6, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.55, 3.35, 4.85, S6, [5040]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.75, 3.15, 2.14, S6, [5041]),
    ml("U 2.5", "TOTALS", 2.5, 1.69, null, 1.84, S6, [5042]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S6, [5043]),
  ]),
  fb("MLS", "08:30", "FC신시내", "뉴욕시티", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.86, 3.6, 3.0, S4, [4984]),
  ]),
  fb("MLS", "08:30", "콜럼크루", "CF몽레알", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.57, 3.6, 4.25, S4, [4988]),
  ]),
  fb("MLS", "08:30", "DC유나이", "뉴잉레벌", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.18, 3.2, 2.65, S4, [4992]),
  ]),
  fb("MLS", "08:30", "뉴욕레드", "내슈빌SC", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.5, 3.5, 2.16, S4, [4996]),
  ]),
  fb("MLS", "08:30", "올랜시티", "시카파이", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.45, 3.65, 2.14, S4, [5000]),
  ]),
  fb("MLS", "08:30", "필라유니", "인터마이", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.24, 3.6, 2.35, S4, [5004]),
  ]),
  fb("MLS", "08:30", "토론토FC", "샬럿FC", S4, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.15, 3.25, 2.65, S4, [5008]),
  ]),
  fb("MLS", "09:00", "스포캔자", "세인시티", S5, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 3.0, 3.6, 1.86, S5, [5022]),
  ]),
  fb("MLS", "09:30", "미네유나", "애틀유나", S5, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.7, 3.4, 3.75, S5, [5036]),
  ]),
  fb("MLS", "10:30", "콜로래피", "LAFC", S6, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.55, 3.25, 2.22, S6, [5052]),
  ]),
  fb("MLS", "10:30", "레알솔트", "FC댈러스", S6, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.76, 3.65, 3.25, S6, [5057]),
  ]),
  fb("MLS", "10:30", "시애사운", "오스틴FC", S6, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.58, 3.7, 4.05, S6, [5061]),
  ]),
  fb("MLS", "11:30", "LA갤럭시", "새너어스", S6, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 2.18, 3.55, 2.45, S6, [5065]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.0, 4.05, 1.53, S6, [5066]),
    ml("U 3.5", "TOTALS", 3.5, 1.59, null, 1.97, S7, [5067]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S7, [5068]),
  ]),
  fb("MLS", "11:30", "포틀팀버", "샌디에FC", S7, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.97, 3.7, 2.7, S7, [5069]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.4, 3.95, 1.66, S7, [5070]),
    ml("U 3.5", "TOTALS", 3.5, 1.74, null, 1.78, S7, [5071]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S7, [5072]),
  ]),
  fb("MLS", "11:30", "밴쿠화이", "휴스다이", S7, "COMPETITION_NOT_REGISTERED", [
    ml("1X2", "ONE_X_TWO", null, 1.45, 3.9, 4.9, S7, [5073]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.3, 3.45, 2.35, S7, [5074]),
    ml("U 3.5", "TOTALS", 3.5, 1.49, null, 2.15, S7, [5075]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S7, [5076]),
  ]),
];

type LineupGame = {
  displayedStartEt: string;
  displayedStartKst: string;
  awayTeam: string;
  homeTeam: string;
  screenshot: string;
  lineupType: "EXPECTED" | "CONFIRMED";
  completeness: "FULL" | "PARTIAL";
  confirmedSides: Array<"AWAY" | "HOME">;
  expectedSides: Array<"AWAY" | "HOME">;
  awayStarterRaw: string;
  homeStarterRaw: string;
  displayedUsLine: string;
  displayedUsTotal: string;
  umpire: string;
  away: string[];
  home: string[];
  note?: string;
};

const CONFIRMED_GAMES: LineupGame[] = [
  {
    displayedStartEt: "12:35 PM ET",
    displayedStartKst: "01:35",
    awayTeam: "Detroit Tigers",
    homeTeam: "Pittsburgh Pirates",
    screenshot: S8,
    lineupType: "CONFIRMED",
    completeness: "FULL",
    confirmedSides: ["AWAY", "HOME"],
    expectedSides: [],
    awayStarterRaw: "Jackson Jobe (R), 1-1, 6.23 ERA",
    homeStarterRaw: "Paul Skenes (R), 9-11, 3.88 ERA",
    displayedUsLine: "PIT -154",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    away: [
      "DH|Colt Keith|L",
      "2B|G. Torres|R",
      "SS|K. McGonigle|L",
      "C|D. Dingler|R",
      "LF|B. Callahan|R",
      "RF|Z. McKinstry|L",
      "1B|S. Torkelson|R",
      "CF|Max Clark|L",
      "3B|Hao-Yu Lee|R",
    ],
    home: [
      "1B|S. Horwitz|L",
      "DH|Brandon Lowe|L",
      "LF|B. Reynolds|S",
      "RF|E. Valdez|R",
      "CF|Oneil Cruz|L",
      "2B|N. Gonzales|R",
      "SS|J. Gonzalez|L",
      "3B|Jared Triolo|R",
      "C|Henry Davis|R",
    ],
  },
  {
    displayedStartEt: "1:10 PM ET",
    displayedStartKst: "02:10",
    awayTeam: "San Diego Padres",
    homeTeam: "New York Mets",
    screenshot: S8,
    lineupType: "CONFIRMED",
    completeness: "FULL",
    confirmedSides: ["AWAY", "HOME"],
    expectedSides: [],
    awayStarterRaw: "Michael King (R), 8-8, 3.41 ERA",
    homeStarterRaw: "Robert Stock (R), 0-2, 6.57 ERA",
    displayedUsLine: "SD -136",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "RF|F. Tatis|R",
      "2B|J. Cronenworth|L",
      "DH|M. Machado|R",
      "1B|Ty France|R",
      "CF|J. Merrill|L",
      "LF|Luis Rengifo|S",
      "C|L. Campusano|R",
      "SS|X. Bogaerts|R",
      "3B|S. Song|L",
    ],
    home: [
      "CF|A.J. Ewing|L",
      "SS|F. Lindor|S",
      "3B|Bo Bichette|R",
      "RF|Carson Benge|L",
      "1B|Jared Young|L",
      "DH|F. Alvarez|R",
      "LF|Brett Baty|L",
      "2B|M. Semien|R",
      "C|Luis Torrens|R",
    ],
  },
  {
    displayedStartEt: "2:20 PM ET",
    displayedStartKst: "03:20",
    awayTeam: "Chicago White Sox",
    homeTeam: "Chicago Cubs",
    screenshot: S8,
    lineupType: "CONFIRMED",
    completeness: "PARTIAL",
    confirmedSides: ["AWAY"],
    expectedSides: ["HOME"],
    awayStarterRaw: "Jose Urquidy (R), 1-1, 8.10 ERA",
    homeStarterRaw: "Clay Holmes (R), 5-5, 2.56 ERA",
    displayedUsLine: "CHC -140",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    note: "Mixed card: CWS Confirmed Lineup, CHC Expected Lineup. Home expected players were not copied into this confirmed record.",
    away: [
      "LF|S. Antonacci|L",
      "1B|M. Murakami|L",
      "3B|M. Vargas|R",
      "DH|A. Benintendi|L",
      "RF|B. Montgomery|S",
      "SS|C. Montgomery|L",
      "2B|C. Meidroth|R",
      "CF|T. Peters|L",
      "C|Jake Rogers|R",
    ],
    home: [],
  },
];

const EXPECTED_GAMES: LineupGame[] = [
  {
    displayedStartEt: "1:40 PM ET",
    displayedStartKst: "02:40",
    awayTeam: "Atlanta Braves",
    homeTeam: "Minnesota Twins",
    screenshot: S8,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "AJ Smith-Shawver (R), 0-0, 4.15 ERA",
    homeStarterRaw: "Taj Bradley (R), 9-5, 3.88 ERA",
    displayedUsLine: "-",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "C|D. Baldwin|L",
      "RF|Ronald Acuna|R",
      "1B|Matt Olson|L",
      "CF|M. Harris|L",
      "LF|M. Dubon|R",
      "2B|Ozzie Albies|S",
      "DH|M. Yastrzemski|L",
      "3B|Austin Riley|R",
      "SS|Jim Jarvis|L",
    ],
    home: [
      "CF|Byron Buxton|R",
      "C|Ryan Jeffers|R",
      "DH|Josh Bell|S",
      "2B|Royce Lewis|R",
      "1B|V. Caratini|S",
      "RF|L. Keaschall|R",
      "3B|Brooks Lee|S",
      "LF|R. Kreidler|R",
      "SS|K. Culpepper|R",
    ],
  },
  {
    displayedStartEt: "2:20 PM ET",
    displayedStartKst: "03:20",
    awayTeam: "Chicago White Sox",
    homeTeam: "Chicago Cubs",
    screenshot: S8,
    lineupType: "EXPECTED",
    completeness: "PARTIAL",
    confirmedSides: ["AWAY"],
    expectedSides: ["HOME"],
    awayStarterRaw: "Jose Urquidy (R), 1-1, 8.10 ERA",
    homeStarterRaw: "Clay Holmes (R), 5-5, 2.56 ERA",
    displayedUsLine: "CHC -140",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    note: "Mixed card: only CHC Expected Lineup recorded here. CWS Confirmed players were not copied into this expected record.",
    away: [],
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
    displayedStartEt: "4:10 PM ET",
    displayedStartKst: "05:10",
    awayTeam: "Arizona Diamondbacks",
    homeTeam: "Boston Red Sox",
    screenshot: S8,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Brandon Pfaadt (R), 7-1, 3.11 ERA",
    homeStarterRaw: "Payton Tolle (L), 8-6, 2.87 ERA",
    displayedUsLine: "BOS -158",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    away: [
      "2B|I. Vargas|S",
      "RF|C. Carroll|L",
      "DH|G. Moreno|R",
      "SS|G. Perdomo|S",
      "3B|N. Arenado|R",
      "CF|J. Lawlar|R",
      "1B|Tim Tawa|R",
      "C|James McCann|R",
      "LF|R. Waldschmidt|R",
    ],
    home: [
      "2B|Nick Sogard|S",
      "CF|C. Rafaela|R",
      "C|A. Rutschman|S",
      "1B|W. Contreras|R",
      "RF|Wilyer Abreu|L",
      "3B|Caleb Durbin|R",
      "LF|Jarren Duran|L",
      "SS|A. Monasterio|R",
      "DH|A. Seigler|L",
    ],
  },
  {
    displayedStartEt: "6:05 PM ET",
    displayedStartKst: "07:05",
    awayTeam: "Miami Marlins",
    homeTeam: "Philadelphia Phillies",
    screenshot: S8,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Sandy Alcantara (R), 13-7, 3.43 ERA",
    homeStarterRaw: "Aaron Nola (R), 4-9, 5.33 ERA",
    displayedUsLine: "PHI -124",
    displayedUsTotal: "9.0",
    umpire: "NOT_ANNOUNCED",
    away: [
      "CF|Jakob Marsee|L",
      "2B|X. Edwards|S",
      "LF|H. Hernandez|R",
      "DH|G. Conine|L",
      "SS|Otto Lopez|R",
      "3B|J. Sanoja|R",
      "RF|Owen Caissie|L",
      "C|Joe Mack|L",
      "1B|G. Pauley|L",
    ],
    home: [
      "DH|K. Schwarber|L",
      "SS|Trea Turner|R",
      "RF|Bryce Harper|L",
      "2B|Luis Arraez|L",
      "1B|Alec Bohm|R",
      "3B|Bryson Stott|L",
      "LF|B. Marsh|L",
      "C|J. Realmuto|R",
      "CF|J. Crawford|L",
    ],
  },
  {
    displayedStartEt: "6:35 PM ET",
    displayedStartKst: "07:35",
    awayTeam: "New York Yankees",
    homeTeam: "Baltimore Orioles",
    screenshot: S9,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Will Warren (R), 8-8, 4.42 ERA",
    homeStarterRaw: "Chris Bassitt (R), 4-4, 5.11 ERA",
    displayedUsLine: "NYY -116",
    displayedUsTotal: "9.0",
    umpire: "NOT_ANNOUNCED",
    away: [
      "CF|T. Grisham|L",
      "DH|Ben Rice|L",
      "RF|S. Jones|L",
      "1B|Luis Garcia|L",
      "2B|J. Chisholm|L",
      "LF|Heliot Ramos|R",
      "3B|Ryan McMahon|L",
      "C|Austin Wells|L",
      "SS|G. Lombard|R",
    ],
    home: [
      "RF|T. O'Neill|R",
      "1B|Pete Alonso|R",
      "2B|J. Holliday|L",
      "DH|Coby Mayo|R",
      "SS|G. Henderson|L",
      "3B|C. Encarnacion-Strand|R",
      "LF|C. Franklin|R",
      "CF|L. Taveras|S",
      "C|C. Narvaez|R",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "San Francisco Giants",
    homeTeam: "Cleveland Guardians",
    screenshot: S9,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Matt Wilkinson (L), 0-0, 0.00 ERA",
    homeStarterRaw: "Parker Messick (L), 9-7, 2.59 ERA",
    displayedUsLine: "CLE -210",
    displayedUsTotal: "7.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "DH|B. Eldridge|L",
      "RF|Jung Hoo Lee|L",
      "SS|Willy Adames|R",
      "1B|R. Devers|L",
      "2B|O. Basabe|R",
      "3B|B. Kennedy|R",
      "LF|V. Bericoto|R",
      "CF|Jonah Cox|R",
      "C|A. Knizner|R",
    ],
    home: [
      "CF|Steven Kwan|L",
      "RF|C. DeLauter|L",
      "DH|Jose Ramirez|S",
      "1B|N. Lowe|L",
      "LF|Jo Adell|R",
      "2B|T. Bazzana|L",
      "3B|Angel Genao|S",
      "C|P. Bailey|S",
      "SS|B. Rocchio|S",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "St. Louis Cardinals",
    homeTeam: "Cincinnati Reds",
    screenshot: S9,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "M. Liberatore (L), 5-10, 5.07 ERA",
    homeStarterRaw: "Chase Burns (R), 14-2, 2.47 ERA",
    displayedUsLine: "CIN -140",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
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
      "C|T. Stephenson|R",
      "DH|E. Suarez|R",
      "CF|Dane Myers|R",
      "LF|JJ Bleday|L",
      "2B|Matt McLain|R",
      "RF|M. Toglia|S",
      "3B|K. Hayes|R",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "Toronto Blue Jays",
    homeTeam: "Tampa Bay Rays",
    screenshot: S9,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Max Scherzer (R), 1-5, 6.59 ERA",
    homeStarterRaw: "Drew Rasmussen (R), 12-5, 2.78 ERA",
    displayedUsLine: "TB -193",
    displayedUsTotal: "7.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "CF|B. Bateman|L",
      "RF|Nathan Lukes|L",
      "DH|G. Springer|R",
      "C|A. Kirk|R",
      "LF|J. Sanchez|L",
      "3B|K. Okamoto|R",
      "SS|A. Gimenez|L",
      "2B|E. Clement|R",
      "1B|C. McAdoo|R",
    ],
    home: [
      "DH|Yandy Diaz|R",
      "1B|J. Aranda|L",
      "3B|J. Caminero|R",
      "C|Liam Hicks|L",
      "LF|C. Simpson|L",
      "RF|Jonny DeLuca|R",
      "CF|C. Mullins|L",
      "2B|R. Palacios|L",
      "SS|Taylor Walls|S",
    ],
  },
  {
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayTeam: "Athletics",
    homeTeam: "Kansas City Royals",
    screenshot: S9,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Jeffrey Springs (L), 3-11, 6.17 ERA",
    homeStarterRaw: "Seth Lugo (R), 5-7, 4.59 ERA",
    displayedUsLine: "KC -158",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
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
      "3B|M. Garcia|R",
      "SS|Bobby Witt Jr|R",
      "RF|J. Caglianone|L",
      "DH|S. Perez|R",
      "1B|V. Pasquantino|L",
      "C|C. Jensen|L",
      "2B|Nick Loftin|R",
      "LF|I. Collins|S",
      "CF|T. Tolbert|R",
    ],
  },
  {
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayTeam: "Seattle Mariners",
    homeTeam: "Milwaukee Brewers",
    screenshot: S9,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Logan Gilbert (R), 9-7, 3.28 ERA",
    homeStarterRaw: "Dustin May (R), 6-7, 4.13 ERA",
    displayedUsLine: "MIL -118",
    displayedUsTotal: "7.0",
    umpire: "NOT_ANNOUNCED",
    away: [
      "RF|Taylor Ward|R",
      "2B|Cole Young|L",
      "LF|R. Arozarena|R",
      "DH|D. Canzone|L",
      "CF|J. Rodriguez|R",
      "1B|Josh Naylor|L",
      "3B|B. Donovan|L",
      "C|Cal Raleigh|S",
      "SS|Brock Rodden|S",
    ],
    home: [
      "2B|Brice Turang|L",
      "LF|J. Chourio|R",
      "RF|Jake Bauers|L",
      "C|W. Contreras|R",
      "CF|G. Mitchell|L",
      "1B|A. Vaughn|R",
      "DH|C. Yelich|L",
      "3B|D. Hamilton|L",
      "SS|Joey Ortiz|R",
    ],
  },
  {
    displayedStartEt: "8:05 PM ET",
    displayedStartKst: "09:05",
    awayTeam: "Washington Nationals",
    homeTeam: "Texas Rangers",
    screenshot: S10,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Cade Cavalli (R), 10-5, 3.36 ERA",
    homeStarterRaw: "Kumar Rocker (R), 4-9, 4.50 ERA",
    displayedUsLine: "TEX -129",
    displayedUsTotal: "7.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "2B|CJ Abrams|L",
      "1B|A. Ortiz|L",
      "RF|Dylan Crews|R",
      "LF|Daylen Lile|L",
      "DH|Brady House|R",
      "C|Keibert Ruiz|S",
      "SS|Nasim Nunez|S",
      "3B|Jorbit Vivas|L",
      "CF|Jacob Young|R",
    ],
    home: [
      "DH|Joc Pederson|L",
      "LF|W. Langford|R",
      "SS|Corey Seager|L",
      "RF|B. Nimmo|L",
      "CF|Evan Carter|L",
      "1B|Jake Burger|R",
      "3B|E. Duran|R",
      "C|Danny Jansen|R",
      "2B|Nicky Lopez|L",
    ],
  },
  {
    displayedStartEt: "8:10 PM ET",
    displayedStartKst: "09:10",
    awayTeam: "Los Angeles Angels",
    homeTeam: "Houston Astros",
    screenshot: S10,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Walbert Urena (R), 8-8, 2.67 ERA",
    homeStarterRaw: "Ethan Pecko (R), 0-0, 0.00 ERA",
    displayedUsLine: "HOU -154",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "LF|Wade Meckler|L",
      "CF|Mike Trout|R",
      "1B|N. Schanuel|L",
      "SS|Zach Neto|R",
      "DH|M. Ballesteros|L",
      "2B|V. Grissom|R",
      "RF|Josh Lowe|L",
      "3B|D. Guzman|R",
      "C|T. Heineman|S",
    ],
    home: [
      "SS|Jeremy Pena|R",
      "DH|Y. Alvarez|L",
      "3B|I. Paredes|R",
      "CF|D. Varsho|L",
      "2B|Jose Altuve|R",
      "1B|C. Walker|R",
      "LF|T. Trammell|L",
      "RF|Cam Smith|R",
      "C|Yainer Diaz|R",
    ],
  },
  {
    displayedStartEt: "8:40 PM ET",
    displayedStartKst: "09:40",
    awayTeam: "Los Angeles Dodgers",
    homeTeam: "Colorado Rockies",
    screenshot: S10,
    lineupType: "EXPECTED",
    completeness: "FULL",
    confirmedSides: [],
    expectedSides: ["AWAY", "HOME"],
    awayStarterRaw: "Roki Sasaki (R), 5-5, 4.46 ERA",
    homeStarterRaw: "Kyle Freeland (L), 4-10, 6.27 ERA",
    displayedUsLine: "LAD -191",
    displayedUsTotal: "11.5",
    umpire: "NOT_ANNOUNCED",
    away: [
      "DH|S. Ohtani|L",
      "CF|Andy Pages|R",
      "1B|F. Freeman|L",
      "2B|Tommy Edman|S",
      "SS|Mookie Betts|R",
      "RF|Kyle Tucker|L",
      "LF|T. Hernandez|R",
      "3B|E. Hernandez|R",
      "C|Ben Rortvedt|L",
    ],
    home: [
      "LF|J. McCarthy|L",
      "CF|Cole Carrigg|S",
      "DH|M. Moniak|L",
      "1B|TJ Rumfield|L",
      "3B|Willi Castro|S",
      "RF|Zac Veen|L",
      "2B|Connor Norby|R",
      "C|B. Sullivan|L",
      "SS|E. Tovar|R",
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

function batters(rows: string[]) {
  return rows.map((row, i) => {
    const [position, rawPlayerName, batsRaw] = row.split("|");
    const bats =
      batsRaw === "L" || batsRaw === "R" || batsRaw === "S" ? batsRaw : null;
    return {
      battingOrder: i + 1,
      rawPlayerName,
      normalizedPlayerCandidate: rawPlayerName,
      position,
      bats,
      playerIdJoin: "NOT_JOINED" as const,
    };
  });
}

function mlbIdentity(rawHome: string, rawAway: string) {
  const canonicalHome = canonicalDomesticTeam(rawHome);
  const canonicalAway = canonicalDomesticTeam(rawAway);
  if (canonicalHome && canonicalAway) {
    return {
      mappingStatus: "TEAM_ALIAS_MATCHED_NO_SCHEDULE" as const,
      identityStatus: "TEAM_ALIAS_MATCHED" as const,
      canonicalHome,
      canonicalAway,
    };
  }
  return {
    mappingStatus: "JOIN_FAILED" as const,
    identityStatus: "JOIN_FAILED" as const,
    canonicalHome,
    canonicalAway,
  };
}

function lineupRow(g: LineupGame) {
  const shot = screenshotMeta(g.screenshot);
  return {
    displayedDateKst: SLATE_DATE_KST,
    displayedStartEt: g.displayedStartEt,
    displayedStartKst: g.displayedStartKst,
    awayTeam: g.awayTeam,
    homeTeam: g.homeTeam,
    screenshotFile: shot.file,
    screenshotSha256: shot.sha256,
    screenshotRel: `${RAW_REL}/${shot.file}`,
    sourceScreenshotSha: shot.sha256,
    receivedAtKst: shot.receivedAtKst,
    operatorObservedAt: shot.receivedAtKst,
    observedAt: shot.receivedAtKst.replace("+09:00", "").replace("T", "T"),
    lineupType: g.lineupType,
    confirmedLineup: g.lineupType === "CONFIRMED",
    officialLineup: false,
    completeness: g.completeness,
    confirmedSides: g.confirmedSides,
    expectedSides: g.expectedSides,
    batsVisibleOnTranscription: true,
    mappingStatus: "TEAM_VISIBLE_NO_SCHEDULE",
    identityStatus: "CARD_TEAM_NAMES_VISIBLE",
    gamePk: null,
    lineupGamePk: null,
    internalGameId: null,
    doubleheaderRisk: "UNKNOWN_NO_SCHEDULE",
    cutoffStatus: "PRE_GAME_OBSERVED",
    timingClass: TIMING_CLASS,
    predictionInput: false,
    umpire: g.umpire,
    awayStarterRaw: g.awayStarterRaw,
    homeStarterRaw: g.homeStarterRaw,
    displayedUsLine: g.displayedUsLine,
    displayedUsTotal: g.displayedUsTotal,
    awayLineup: batters(g.away),
    homeLineup: batters(g.home),
    note: g.note ?? null,
  };
}

export async function runIntake(cwd = process.cwd()) {
  for (const shot of SCREENSHOTS) {
    const abs = path.join(cwd, RAW_REL, shot.file);
    if (!existsSync(abs)) throw new Error(`missing raw ${shot.file}`);
    const sha = sha256File(abs);
    if (sha !== shot.sha256) throw new Error(`raw mutation ${shot.file}`);
    const bytes = readFileSync(abs).byteLength;
    if (bytes !== shot.bytes) throw new Error(`raw size mutation ${shot.file}`);
  }

  const structuredAbs = path.join(cwd, STRUCTURED_REL);
  const manifestAbs = path.join(cwd, MANIFEST_REL);
  const auditAbs = path.join(cwd, AUDIT_REL);
  if (
    existsSync(structuredAbs) &&
    existsSync(manifestAbs) &&
    existsSync(auditAbs)
  ) {
    const document = JSON.parse(readFileSync(structuredAbs, "utf8"));
    const manifest = JSON.parse(readFileSync(manifestAbs, "utf8"));
    const audit = JSON.parse(readFileSync(auditAbs, "utf8"));
    if (document.predictionInput !== false || manifest.predictionInput !== false) {
      throw new Error("SEALED_INTAKE_PREDICTION_INPUT_NOT_FALSE");
    }
    return { document, manifest, audit };
  }

  const scheduleExists =
    existsSync(path.join(cwd, `data/research/mlb/${SLATE_DATE_KST}-schedule-v1.json`)) ||
    existsSync(
      path.join(cwd, `data/research/football/${SLATE_DATE_KST}-schedule-v1.json`),
    );
  const predictionExists = existsSync(
    path.join(cwd, `data/predictions/mlb/${SLATE_DATE_KST}.json`),
  );
  if (scheduleExists) {
    throw new Error("STOP: 2026-08-20 schedule appeared before intake seal");
  }
  if (predictionExists) {
    throw new Error("STOP: 2026-08-20 prediction exists; do not regenerate");
  }

  const oddsRows = ODDS_GAMES.map((g) => {
    const identity = mlbIdentity(g.rawHome, g.rawAway);
    const firstShot = screenshotMeta(g.markets[0]!.screenshotFile);
    return {
      sport: g.sport,
      displayedDateKst: SLATE_DATE_KST,
      displayedStartKst: g.displayedStartKst,
      rawHomeLabel: g.rawHome,
      rawAwayLabel: g.rawAway,
      rawMatchup: `${g.rawHome} : ${g.rawAway}`,
      screenshotFile: firstShot.file,
      screenshotSha256: firstShot.sha256,
      screenshotRel: `${RAW_REL}/${firstShot.file}`,
      sourceScreenshotSha: firstShot.sha256,
      receivedAtKst: firstShot.receivedAtKst,
      operatorObservedAt: firstShot.receivedAtKst,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      ...identity,
      gamePk: null,
      internalGameId: null,
      doubleheaderRisk: "UNKNOWN_NO_SCHEDULE",
      cutoffStatus: "PRE_GAME_OBSERVED",
      markets: g.markets.map((m) => ({
        ...m,
        sourceScreenshotSha: screenshotMeta(m.screenshotFile).sha256,
      })),
    };
  });

  const footballRows = FOOTBALL_GAMES.map((g) => {
    const shot = screenshotMeta(g.screenshot);
    return {
      ...g,
      displayedDateKst: SLATE_DATE_KST,
      screenshotSha256: shot.sha256,
      sourceScreenshotSha: shot.sha256,
      receivedAtKst: shot.receivedAtKst,
      operatorObservedAt: shot.receivedAtKst,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      matchId: null,
      markets: g.markets.map((m) => ({
        ...m,
        sourceScreenshotSha: screenshotMeta(m.screenshotFile).sha256,
      })),
    };
  });

  const confirmedRows = CONFIRMED_GAMES.map(lineupRow);
  const expectedRows = EXPECTED_GAMES.map(lineupRow);

  const aliasFailed = oddsRows.filter((r) => r.mappingStatus === "JOIN_FAILED");
  const confirmedPlayerSlots = confirmedRows.reduce(
    (n, r) => n + r.awayLineup.length + r.homeLineup.length,
    0,
  );
  const expectedPlayerSlots = expectedRows.reduce(
    (n, r) => n + r.awayLineup.length + r.homeLineup.length,
    0,
  );

  const document = {
    schemaVersion: "yang-edge-next-pregame-observation-v0",
    batchId: BATCH_ID,
    receivedDateKst: RECEIVED_DATE_KST,
    slateDateKst: SLATE_DATE_KST,
    intendedOperatingDateKst: SLATE_DATE_KST,
    dateClassification: "DATE_CONFIRMED",
    dateClassificationReason:
      "On-screen betting date is 08.20(목) with status 경기전. Windows screenshot filename HHMMSS agrees with CreationTime 2026-08-20 00:07:15-00:08:36 KST. Inbox folder name 2026-08-19 is drop location only. 2026-08-20 is Thursday. No 2026-08-20 Prediction exists.",
    receivedAtKst: RECEIVED_AT_KST,
    observedAt: OBSERVED_AT_UTC,
    operatorObservedAt: RECEIVED_AT_KST,
    captureTime: RECEIVED_AT_KST,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    autoApply: false,
    predictionInput: false,
    predictionAlreadyFrozen: false,
    officialPredictionHash: null,
    officialPredictionRel: null,
    observationPhase: TIMING_CLASS,
    timingClass: TIMING_CLASS,
    availableAtPredictionFreeze: null,
    availableBeforeKickoff: true,
    scopeLockStatus: SCOPE_STATUS,
    expectedConfirmedSeparation:
      "EXPECTED and CONFIRMED are separate arrays. Mixed screenshot 000825 did not promote Expected players into Confirmed or vice versa.",
    note: "Pregame operator screenshots for slate 2026-08-20 received 2026-08-20 00:07-00:08 KST. Not a Prediction input. Confirmed lineup evidence remains predictionInput=false. Football MLS/Copa/UCL/La Liga rows are preserved. 2026-08-19 frozen artifacts were not opened or rewritten.",
    summary: {
      screenshots: SCREENSHOTS.length,
      oddsScreenshots: 7,
      lineupScreenshots: 3,
      mixedLineupScreenshots: 1,
      mlbOddsMatchups: oddsRows.length,
      mlbOddsAliasMatched: oddsRows.filter(
        (r) => r.identityStatus === "TEAM_ALIAS_MATCHED",
      ).length,
      mlbOddsAliasFailed: aliasFailed.length,
      mlbGamePkJoined: 0,
      footballOddsFixtures: footballRows.length,
      footballJoined: 0,
      expectedLineups: expectedRows.length,
      confirmedLineups: confirmedRows.length,
      lineupOfficial: 0,
      confirmedFullGames: confirmedRows.filter((r) => r.completeness === "FULL")
        .length,
      confirmedPartialGames: confirmedRows.filter(
        (r) => r.completeness === "PARTIAL",
      ).length,
      confirmedUncertain: 0,
      expectedPlayerSlots,
      confirmedPlayerSlots,
      shaDuplicates: 0,
      rawMutation: 0,
      predictionInputTrue: 0,
    },
    screenshots: SCREENSHOTS.map((s) => ({
      file: s.file,
      originalInboxName: s.originalInboxName,
      category: s.category,
      sha256: s.sha256,
      bytes: s.bytes,
      receivedAtKst: s.receivedAtKst,
      operatorObservedAt: s.receivedAtKst,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      source: "MANUAL_SCREENSHOT",
      rel: `${RAW_REL}/${s.file}`,
    })),
    nonMlbOddsFixtures: footballRows,
    domesticOdds: oddsRows,
    expectedLineups: expectedRows,
    confirmedLineups: confirmedRows,
    identity: {
      policy: "EXACT_CATALOG_ALIAS_ONLY",
      mlbAliasMatched: oddsRows.filter(
        (r) => r.identityStatus === "TEAM_ALIAS_MATCHED",
      ).length,
      mlbBlocked: aliasFailed.length,
      mlbJoinFailed: aliasFailed.length,
      footballJoinFailed: footballRows.length,
      gamePkJoined: 0,
      internalGameIdInvented: 0,
      doubleheaderRisk: "UNKNOWN_NO_SCHEDULE",
      aliasFailedRawLabels: aliasFailed.map((r) => r.rawMatchup),
    },
    nextOperatingDay: {
      operatingDate: SLATE_DATE_KST,
      scopeStatus: SCOPE_STATUS,
      sportsVisible: ["MLB", "FOOTBALL"],
      mlbGamesVisibleOnScreenshots: MLB_OBSERVED,
      footballFixturesVisibleOnScreenshots: FOOTBALL_OBSERVED,
      footballByLeague: {
        UCL: 4,
        라리가: 1,
        코파리베: 3,
        MLS: 15,
      },
      mlbSchedulePresent: false,
      footballSchedulePresent: false,
      predictionPresent: false,
      mandatoryPercentComputed: false,
    },
  };

  await mkdir(path.dirname(structuredAbs), { recursive: true });
  await writeFile(structuredAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const manifest = {
    schemaVersion: "yang-edge-inbox-raw-batch-v1",
    batchId: BATCH_ID,
    receivedAtKst: RECEIVED_AT_KST,
    captureTime: RECEIVED_AT_KST,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    predictionInput: false,
    predictionAlreadyFrozen: false,
    predictionHash: null,
    observationPhase: TIMING_CLASS,
    timingClass: TIMING_CLASS,
    officialPredictionRel: null,
    availableAtPredictionFreeze: null,
    availableBeforeKickoff: true,
    slateDateKst: SLATE_DATE_KST,
    receivedDateKst: RECEIVED_DATE_KST,
    inboxPath: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19",
    notes: [
      "Raw screenshots copied byte-identical from INBOX. SHA-256 verified on copy.",
      "Windows screenshot filename HHMMSS agrees with CreationTime; used as observedAt/receivedAtKst.",
      "Inbox folder 2026-08-19 is drop location only. Operating date is on-screen 08.20(목) = 2026-08-20.",
      "No 2026-08-20 Prediction exists. predictionInput remains false.",
      "EXPECTED and CONFIRMED lineups are separate. Mixed screenshot was not merged.",
      "Football MLS / Copa Libertadores / UCL / La Liga rows are preserved.",
      "Do not write these observations into frozen 2026-08-19 Snapshot/Prediction/Odds/Result/Grade/Review/Scorecard.",
    ],
    files: SCREENSHOTS.map((s) => ({
      file: s.file,
      originalInboxName: s.originalInboxName,
      category: s.category,
      sha256: s.sha256,
      bytes: s.bytes,
      receivedAtKst: s.receivedAtKst,
      operatorObservedAt: s.receivedAtKst,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      duplicateSource: false,
    })),
  };
  await writeFile(manifestAbs, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const readme = `YANG EDGE — Next Pregame Observation Raw Batch
batchId: ${BATCH_ID}
Inbox: C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-19\\
Received (latest screenshot CreationTime): ${RECEIVED_AT_KST}
captureTimeSource: ${CAPTURE_TIME_SOURCE}
slateDateKst: ${SLATE_DATE_KST}
observationPhase: ${TIMING_CLASS}
predictionInput: false

Contents
- 7 domestic-odds screenshots (MLB + UCL / La Liga / Copa Libertadores / MLS)
- 1 mixed MLB Confirmed+Expected Lineup screenshot
- 2 MLB Expected Lineup screenshots

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. EXPECTED and CONFIRMED are separate. Do not promote or merge.
3. Odds provenance = MANUAL_OPERATOR_OBSERVATION / MANUAL_SCREENSHOT.
4. researchOnly = true, engineAdmission = PROHIBITED, predictionInput = false.
5. Inbox folder date is drop location. On-screen betting date is 08.20(목).
6. Do not write these observations into 2026-08-19 frozen Snapshot / Prediction / Odds / Result / Grade / Review / Scorecard.
7. Do not call Odds/Starter/Lineup/Result/Grade/Review/Engine/Prediction providers in this batch.
`;
  await writeFile(path.join(cwd, README_REL), readme, "utf8");

  const audit = {
    schemaVersion: "yang-edge-next-pregame-observation-audit-v0",
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    predictionInput: false,
    wrote: [MANIFEST_REL, README_REL, STRUCTURED_REL, AUDIT_REL],
    rawRel: RAW_REL,
    frozenArtifactsOpened: false,
    providerLiveCalls: 0,
    scheduleBuilderCalls: 0,
    oddsBuilderCalls: 0,
    predictionBuilderCalls: 0,
    resultPostgameCalls: 0,
    engineCalls: 0,
    recommendationCalls: 0,
    summary: document.summary,
    timing: {
      observationReceivedAtKst: RECEIVED_AT_KST,
      slateDateKst: SLATE_DATE_KST,
      firstDisplayedMlbStartKst: "2026-08-20T01:35:00+09:00",
      observationPhase: TIMING_CLASS,
    },
    nextOperatingDay: document.nextOperatingDay,
  };
  await mkdir(path.dirname(auditAbs), { recursive: true });
  await writeFile(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  return { document, manifest, audit };
}

async function main() {
  const result = await runIntake();
  console.log(`wrote ${MANIFEST_REL}`);
  console.log(`wrote ${STRUCTURED_REL}`);
  console.log(`wrote ${AUDIT_REL}`);
  console.log(
    `mlbOdds=${result.document.summary.mlbOddsMatchups} expected=${result.document.summary.expectedLineups} confirmed=${result.document.summary.confirmedLineups} football=${result.document.summary.footballOddsFixtures} aliasFailed=${result.document.summary.mlbOddsAliasFailed} predictionInput=false`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
