/**
 * One-shot 2026-08-26/batch-1047 operator screenshot seal.
 *
 *   npx tsx scripts/intake-2026-08-26-batch-1047-operator-pregame-observations.ts
 *
 * Raw PNGs must already be byte-copied. Does NOT write Prediction /
 * operator-input / Schedule. Does NOT call providers. Does NOT join
 * team aliases or competition registries.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BATCH_ID = "2026-08-26/batch-1047";
export const RECEIVED_DATE_KST = "2026-08-26";
export const SLATE_DATE_KST = "2026-08-26";
export const RECEIVED_AT_KST = "2026-08-26T10:47:13+09:00";
export const OBSERVED_AT_UTC = "2026-08-26T01:47:13.000Z";
export const CAPTURE_TIME_SOURCE =
  "WINDOWS_SCREENSHOT_FILENAME_AND_CREATIONTIME_AGREE";
export const TIMING_CLASS = "PRE_GAME";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-26/batch-1047";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-26/batch-1047-next-pregame-v0.json";
export const AUDIT_REL =
  "data/audits/2026-08-26-batch-1047-next-pregame-v0.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const SCOPE_STATUS = "READY_TO_LOCK_DAILY_SCOPE";
export const INBOX_PATH =
  "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-26";

export const VOLLEYBALL_OBSERVED = 1;
export const NPB_OBSERVED = 6;
export const KBO_OBSERVED = 5;
export const BASEBALL_OBSERVED = NPB_OBSERVED + KBO_OBSERVED;
export const FOOTBALL_OBSERVED = 14;
export const TOTAL_OBSERVED =
  VOLLEYBALL_OBSERVED + BASEBALL_OBSERVED + FOOTBALL_OBSERVED;
export const NEXT_DATE_FOOTBALL_VISIBLE = 9;
export const OVERLAP_GAMES_REMOVED = 5;

const S1 = "screenshot_2026-08-26_104615.png";
const S2 = "screenshot_2026-08-26_104623.png";
const S3 = "screenshot_2026-08-26_104633.png";
const S4 = "screenshot_2026-08-26_104639.png";
const S5 = "screenshot_2026-08-26_104648.png";
const S6 = "screenshot_2026-08-26_104654.png";
const S7 = "screenshot_2026-08-26_104713.png";

export const SCREENSHOTS = [
  {
    file: S1,
    originalInboxName: "스크린샷 2026-08-26 104615.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "e156f5f5bfdcc5c275ea88ba2896bcd4c8132244542ffe5179264f2c1117de9c",
    bytes: 168143,
    receivedAtKst: "2026-08-26T10:46:15+09:00",
    sequence: 1,
  },
  {
    file: S2,
    originalInboxName: "스크린샷 2026-08-26 104623.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "c57351670238c16cbb2308fa2d082fbc9a2b415763a2a40b243afdcdd70e4e13",
    bytes: 168123,
    receivedAtKst: "2026-08-26T10:46:23+09:00",
    sequence: 2,
  },
  {
    file: S3,
    originalInboxName: "스크린샷 2026-08-26 104633.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "d21fae5c1ac729091f3b6726e544e659092ae5db24fc4bdb73349cf0200bb591",
    bytes: 170805,
    receivedAtKst: "2026-08-26T10:46:34+09:00",
    sequence: 3,
  },
  {
    file: S4,
    originalInboxName: "스크린샷 2026-08-26 104639.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "356d6016a59b57cf132621656b82e5b47bfd5b5704adee144c95da1ceee2d23c",
    bytes: 184433,
    receivedAtKst: "2026-08-26T10:46:39+09:00",
    sequence: 4,
  },
  {
    file: S5,
    originalInboxName: "스크린샷 2026-08-26 104648.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "34fbbf35cee988fbd3b419100a8340898ec73ba2e5aac57b1f2bca0c0d6b98e3",
    bytes: 118451,
    receivedAtKst: "2026-08-26T10:46:48+09:00",
    sequence: 5,
  },
  {
    file: S6,
    originalInboxName: "스크린샷 2026-08-26 104654.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "70766ee3eab35e56662cd2e623be68fc841c01f9bfbedba7b85a7af96b3d172a",
    bytes: 178903,
    receivedAtKst: "2026-08-26T10:46:54+09:00",
    sequence: 6,
  },
  {
    file: S7,
    originalInboxName: "스크린샷 2026-08-26 104713.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "d732581135be4c00b118fd27ba68e9a884a20b2eca8c3bb1a7c5ac741a1f472e",
    bytes: 180395,
    receivedAtKst: "2026-08-26T10:47:13+09:00",
    sequence: 7,
  },
] as const;

export const FORBIDDEN_WRITE_PREFIXES = [
  "data/predictions/",
  "data/research/",
  "data/operator-input/",
  "리포트/",
] as const;

type MarketType =
  | "MONEYLINE_2WAY"
  | "DOMESTIC_THREE_WAY_SPECIAL"
  | "RUN_LINE"
  | "TOTALS"
  | "SUM"
  | "FIRST_HALF_OR_EARLY_SPECIAL"
  | "ONE_X_TWO"
  | "FOOTBALL_HANDICAP_3WAY"
  | "UNKNOWN";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function screenshotMeta(file: string) {
  const shot = SCREENSHOTS.find((s) => s.file === file);
  if (!shot) throw new Error(`UNKNOWN_SCREENSHOT: ${file}`);
  return shot;
}

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

function baseballGame(
  sport: "NPB" | "KBO" | "VOLLEYBALL",
  rawLeagueLabel: string,
  displayedStartKst: string,
  rawHome: string,
  rawAway: string,
  screenshot: string,
  markets: ReturnType<typeof ml>[],
  extra?: { overlapScreenshots?: string[]; truncatedAwayVariant?: string },
) {
  return {
    sport,
    rawLeagueLabel,
    displayedDateKst: SLATE_DATE_KST,
    displayedStartKst,
    rawHomeLabel: rawHome,
    rawAwayLabel: rawAway,
    rawMatchup: `${rawHome} : ${rawAway}`,
    screenshot,
    markets,
    overlapScreenshots: extra?.overlapScreenshots ?? [],
    truncatedAwayVariant: extra?.truncatedAwayVariant ?? null,
  };
}

function fb(
  rawLeagueLabel: string,
  displayedDateKst: string,
  displayedStartKst: string,
  rawHome: string,
  rawAway: string,
  screenshot: string,
  markets: ReturnType<typeof ml>[],
  extra?: { overlapScreenshots?: string[] },
) {
  return {
    sport: "FOOTBALL" as const,
    rawLeagueLabel,
    displayedDateKst,
    displayedStartKst,
    rawHome,
    rawAway,
    rawHomeSecondaryVisible: null as string | null,
    screenshot,
    identityStatus: "NOT_JOINED" as const,
    mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH" as const,
    competitionRegistryJoin: "NOT_ATTEMPTED" as const,
    markets,
    overlapScreenshots: extra?.overlapScreenshots ?? [],
  };
}

const VOLLEYBALL_GAMES = [
  baseballGame("VOLLEYBALL", "여배아선", "11:00", "한국W", "홍콩W", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 1.0, null, 1.0, S1, [6509]),
    ml("H -2.5", "UNKNOWN", -2.5, 1.14, null, 3.86, S1, [6510]),
    ml("U 121.5", "TOTALS", 121.5, 1.76, null, 1.76, S1, [6511]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [6512]),
  ]),
];

const NPB_GAMES = [
  baseballGame("NPB", "NPB", "18:00", "야쿠르트", "요미우리", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 2.22, null, 1.46, S1, [6517]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.65, 2.8, 1.93, S1, [6518]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.33, null, 2.6, S1, [6519]),
    ml("U 6.5", "TOTALS", 6.5, 1.93, null, 1.62, S1, [6520]),
    ml("SUM", "SUM", null, 1.65, null, 1.98, S1, [6521]),
  ]),
  baseballGame("NPB", "NPB", "18:00", "주니치", "한신", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 1.96, null, 1.6, S1, [6522]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.25, 2.65, 2.15, S1, [6523]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.25, null, 2.97, S1, [6524]),
    ml("U 6.5", "TOTALS", 6.5, 1.9, null, 1.64, S1, [6525]),
    ml("SUM", "SUM", null, 1.65, null, 1.98, S1, [6526]),
  ]),
  baseballGame("NPB", "NPB", "18:00", "히로카프", "요코베이", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 2.53, null, 1.35, S1, [6527]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 4.65, 2.75, 1.75, S1, [6528]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.4, null, 2.37, S1, [6529]),
    ml("U 6.5", "TOTALS", 6.5, 1.67, null, 1.86, S1, [6530]),
    ml("SUM", "SUM", null, 1.66, null, 1.97, S1, [6531]),
  ]),
  baseballGame("NPB", "NPB", "18:00", "세이부", "닛폰햄", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 1.89, null, 1.65, S1, [6532]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.15, 2.6, 2.24, S1, [6533]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.26, null, 2.92, S1, [6534]),
    ml("U 6.5", "TOTALS", 6.5, 1.73, null, 1.79, S1, [6535]),
    ml("SUM", "SUM", null, 1.65, null, 1.98, S1, [6536]),
  ]),
  baseballGame(
    "NPB",
    "NPB",
    "18:00",
    "지바롯데",
    "소프트뱅",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 2.37, null, 1.4, S1, [6537]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 4.2, 2.85, 1.78, S1, [6538]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.39, null, 2.4, S1, [6539]),
      ml("U 7.5", "TOTALS", 7.5, 1.78, null, 1.74, S2, [6540]),
      ml("SUM", "SUM", null, 1.65, null, 1.98, S2, [6541]),
    ],
    { overlapScreenshots: [S2], truncatedAwayVariant: "소프트뱅크" },
  ),
  baseballGame("NPB", "NPB", "18:00", "오릭스", "라쿠텐", S2, [
    ml("승패", "MONEYLINE_2WAY", null, 1.77, null, 1.75, S2, [6542]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.8, 2.75, 2.33, S2, [6543]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.2, null, 3.3, S2, [6544]),
    ml("U 7.5", "TOTALS", 7.5, 1.72, null, 1.8, S2, [6545]),
    ml("SUM", "SUM", null, 1.64, null, 1.99, S2, [6546]),
  ]),
];

const KBO_GAMES = [
  baseballGame("KBO", "KBO", "18:30", "LG", "NC", S2, [
    ml("승패", "MONEYLINE_2WAY", null, 1.66, null, 1.87, S2, [6551]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.33, 3.2, 2.45, S2, [6552]),
    ml("H -2.5", "RUN_LINE", -2.5, 3.16, null, 1.22, S2, [6553]),
    ml("U 8.5", "TOTALS", 8.5, 1.82, null, 1.7, S2, [6554]),
    ml("SUM", "SUM", null, 1.62, null, 2.03, S2, [6555]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 1.99, 5.9, 2.1, S2, [6556]),
    ml("h H -1.5", "FIRST_HALF_OR_EARLY_SPECIAL", -1.5, 2.72, null, 1.3, S2, [6557]),
    ml("h U 4.5", "TOTALS", 4.5, 1.77, null, 1.75, S2, [6558]),
  ]),
  baseballGame("KBO", "KBO", "18:30", "SSG", "한화", S2, [
    ml("승패", "MONEYLINE_2WAY", null, 2.26, null, 1.44, S2, [6559]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.4, 3.55, 1.74, S2, [6560]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.47, null, 2.19, S2, [6561]),
    ml("U 10.5", "TOTALS", 10.5, 1.71, null, 1.81, S2, [6562]),
    ml("SUM", "SUM", null, 1.62, null, 2.03, S2, [6563]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.55, 7.0, 1.63, S2, [6564]),
    ml("h H +1.5", "FIRST_HALF_OR_EARLY_SPECIAL", 1.5, 1.5, null, 2.13, S2, [6565]),
    ml("h U 5.5", "TOTALS", 5.5, 1.8, null, 1.72, S2, [6566]),
  ]),
  baseballGame(
    "KBO",
    "KBO",
    "18:30",
    "KIA",
    "롯데",
    S2,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.8, null, 1.72, S2, [6567]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.55, 3.35, 2.18, S2, [6568]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.28, null, 2.82, S2, [6569]),
      ml("U 9.5", "TOTALS", 9.5, 1.7, null, 1.82, S2, [6570]),
      ml("SUM", "SUM", null, 1.61, null, 2.04, S3, [6571]),
      ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.1, 6.3, 1.94, S3, [6572]),
      ml("h H +1.5", "FIRST_HALF_OR_EARLY_SPECIAL", 1.5, 1.31, null, 2.68, S3, [6573]),
      ml("h U 5.5", "TOTALS", 5.5, 1.63, null, 1.91, S3, [6574]),
    ],
    { overlapScreenshots: [S3] },
  ),
  baseballGame("KBO", "KBO", "18:30", "KT", "두산", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.7, null, 1.82, S3, [6575]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.4, 3.3, 2.33, S3, [6576]),
    ml("H -2.5", "RUN_LINE", -2.5, 3.23, null, 1.21, S3, [6577]),
    ml("U 9.5", "TOTALS", 9.5, 1.72, null, 1.8, S3, [6578]),
    ml("SUM", "SUM", null, 1.61, null, 2.04, S3, [6579]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 1.98, 6.4, 2.05, S3, [6580]),
    ml("h H -1.5", "FIRST_HALF_OR_EARLY_SPECIAL", -1.5, 2.72, null, 1.3, S3, [6581]),
    ml("h U 5.5", "TOTALS", 5.5, 1.66, null, 1.87, S3, [6582]),
  ]),
  baseballGame("KBO", "KBO", "18:30", "키움", "삼성", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 2.6, null, 1.33, S3, [6583]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 4.1, 3.5, 1.61, S3, [6584]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.57, null, 2.0, S3, [6585]),
    ml("U 8.5", "TOTALS", 8.5, 1.87, null, 1.66, S3, [6586]),
    ml("SUM", "SUM", null, 1.63, null, 2.01, S3, [6587]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.95, 6.6, 1.52, S3, [6588]),
    ml("h H +1.5", "FIRST_HALF_OR_EARLY_SPECIAL", 1.5, 1.58, null, 1.99, S3, [6589]),
    ml("h U 4.5", "TOTALS", 4.5, 1.91, null, 1.63, S3, [6590]),
  ]),
];

const FOOTBALL_GAMES_0826 = [
  fb("리그스컵", SLATE_DATE_KST, "11:30", "레온", "레알솔트", S1, [
    ml("1X2", "ONE_X_TWO", null, 2.75, 3.3, 2.07, S1, [6513]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.59, 3.75, 3.95, S1, [6514]),
    ml("U 2.5", "TOTALS", 2.5, 2.04, null, 1.55, S1, [6515]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [6516]),
  ]),
  fb("호주FA컵", SLATE_DATE_KST, "18:30", "프레라이", "사우스멜", S2, [
    ml("1X2", "ONE_X_TWO", null, 1.99, 3.25, 2.95, S2, [6547]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.75, 3.6, 1.65, S2, [6548]),
    ml("U 2.5", "TOTALS", 2.5, 1.93, null, 1.62, S2, [6549]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S2, [6550]),
  ]),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "C삿포로", "V고후", S3, [
    ml("1X2", "ONE_X_TWO", null, 1.92, 3.0, 3.4, S3, [6591]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.85, 3.3, 1.7, S3, [6592]),
    ml("U 2.5", "TOTALS", 2.5, 1.54, null, 2.05, S3, [6593]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S3, [6594]),
  ]),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "J이와타", "미야자키", S3, [
    ml("1X2", "ONE_X_TWO", null, 2.38, 2.9, 2.6, S3, [6595]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 5.3, 3.7, 1.45, S3, [6596]),
    ml("U 2.5", "TOTALS", 2.5, 1.53, null, 2.07, S3, [6597]),
    ml("SUM", "SUM", null, 1.82, null, 1.78, S3, [6598]),
  ]),
  fb(
    "일본FA컵",
    SLATE_DATE_KST,
    "19:00",
    "이와키",
    "오이타T",
    S3,
    [
      ml("1X2", "ONE_X_TWO", null, 1.89, 3.1, 3.35, S3, [6599]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.65, 3.4, 1.72, S3, [6600]),
      ml("U 2.5", "TOTALS", 2.5, 1.67, null, 1.86, S4, [6601]),
      ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6602]),
    ],
    { overlapScreenshots: [S4] },
  ),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "사간도스", "K도야마", S4, [
    ml("1X2", "ONE_X_TWO", null, 2.3, 2.9, 2.7, S4, [6603]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 5.1, 3.65, 1.47, S4, [6604]),
    ml("U 2.5", "TOTALS", 2.5, 1.52, null, 2.09, S4, [6605]),
    ml("SUM", "SUM", null, 1.82, null, 1.78, S4, [6606]),
  ]),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "이마바리", "B아키타", S4, [
    ml("1X2", "ONE_X_TWO", null, 2.55, 2.9, 2.42, S4, [6607]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.44, 3.7, 5.4, S4, [6608]),
    ml("U 2.5", "TOTALS", 2.5, 1.52, null, 2.09, S4, [6609]),
    ml("SUM", "SUM", null, 1.82, null, 1.78, S4, [6610]),
  ]),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "RB오미야", "하치노헤", S4, [
    ml("1X2", "ONE_X_TWO", null, 1.7, 3.2, 4.0, S4, [6611]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.1, 3.25, 1.93, S4, [6612]),
    ml("U 2.5", "TOTALS", 2.5, 1.68, null, 1.85, S4, [6613]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6614]),
  ]),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "야마가타", "후지에다", S4, [
    ml("1X2", "ONE_X_TWO", null, 2.1, 2.95, 3.0, S4, [6615]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.35, 3.45, 1.59, S4, [6616]),
    ml("U 2.5", "TOTALS", 2.5, 1.57, null, 2.0, S4, [6617]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6618]),
  ]),
  fb("일본FA컵", SLATE_DATE_KST, "19:00", "V센다이", "도치기SC", S4, [
    ml("1X2", "ONE_X_TWO", null, 1.9, 3.0, 3.45, S4, [6619]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.8, 3.3, 1.71, S4, [6620]),
    ml("U 2.5", "TOTALS", 2.5, 1.54, null, 2.05, S4, [6621]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6622]),
  ]),
  fb("K리그1", SLATE_DATE_KST, "19:30", "FC안양", "인천유나", S4, [
    ml("1X2", "ONE_X_TWO", null, 3.2, 3.0, 2.09, S4, [6623]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.63, 3.45, 4.3, S4, [6624]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.14, 6.1, 10.5, S4, [6625]),
    ml("U 2.5", "TOTALS", 2.5, 1.56, null, 2.07, S4, [6626]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6627]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 3.95, 1.86, 2.8, S4, [6628]),
    ml("h H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.31, 3.7, 8.6, S4, [6629]),
    ml("h U 1.5", "TOTALS", 1.5, 1.26, null, 2.92, S4, [6630]),
  ]),
  fb(
    "K리그1",
    SLATE_DATE_KST,
    "19:30",
    "대전하나",
    "울산HDFC",
    S4,
    [
      ml("1X2", "ONE_X_TWO", null, 2.21, 3.4, 2.65, S4, [6631]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.25, 3.85, 1.56, S5, [6632]),
      ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 9.7, 6.4, 1.14, S5, [6633]),
      ml("U 2.5", "TOTALS", 2.5, 2.05, null, 1.57, S5, [6634]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S5, [6635]),
      ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.75, 2.11, 3.2, S5, [6636]),
      ml("h H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 7.7, 3.9, 1.31, S5, [6637]),
      ml("h U 1.5", "TOTALS", 1.5, 1.46, null, 2.22, S5, [6638]),
    ],
    { overlapScreenshots: [S5] },
  ),
  fb("K리그1", SLATE_DATE_KST, "19:30", "강원FC", "광주FC", S5, [
    ml("1X2", "ONE_X_TWO", null, 1.47, 3.55, 6.2, S5, [6639]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.5, 3.05, 2.45, S5, [6640]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 5.0, 4.15, 1.44, S5, [6641]),
    ml("U 2.5", "TOTALS", 2.5, 1.62, null, 1.98, S5, [6642]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S5, [6643]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.0, 1.99, 6.8, S5, [6644]),
    ml("h H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 5.1, 3.05, 1.6, S5, [6645]),
    ml("h U 1.5", "TOTALS", 1.5, 1.29, null, 2.77, S5, [6646]),
  ]),
  fb("축ASEA챔", SLATE_DATE_KST, "22:00", "베트남", "태국", S5, [
    ml("1X2", "ONE_X_TWO", null, 1.64, 3.4, 4.05, S5, [6366]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.05, 3.35, 1.91, S5, [6367]),
    ml("U 2.5", "TOTALS", 2.5, 1.63, null, 1.91, S5, [6368]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S5, [6369]),
  ]),
];

const FOOTBALL_GAMES_0827 = [
  fb("인터컨컵", "2026-08-27", "03:00", "알아흘리", "오클FC", S6, [
    ml("1X2", "ONE_X_TWO", null, 1.13, 5.6, 11.5, S6, [6656]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.44, 4.25, 4.55, S6, [6657]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 2.09, 3.8, 2.45, S6, [6658]),
    ml("H -3.5", "FOOTBALL_HANDICAP_3WAY", -3.5, 3.65, null, 1.16, S6, [6659]),
    ml("U 3.5", "TOTALS", 3.5, 1.66, null, 1.87, S6, [6660]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S6, [6661]),
  ]),
  fb("잉리그컵", "2026-08-27", "03:45", "뉴캐슬U", "웨스브로", S6, [
    ml("1X2", "ONE_X_TWO", null, 1.29, 4.4, 6.8, S6, [6662]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.92, 3.45, 2.95, S6, [6663]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 3.2, 3.85, 1.73, S6, [6664]),
    ml("H -3.5", "FOOTBALL_HANDICAP_3WAY", -3.5, 6.04, null, 1.03, S6, [6665]),
    ml("U 3.5", "TOTALS", 3.5, 1.5, null, 2.13, S6, [6666]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S6, [6667]),
  ]),
  fb("잉리그컵", "2026-08-27", "03:45", "토트넘", "찰턴A", S6, [
    ml("1X2", "ONE_X_TWO", null, 1.17, 5.1, 10.0, S6, [6668]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.63, 3.6, 3.85, S6, [6669]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 2.5, 3.65, 2.1, S6, [6670]),
    ml("H -3.5", "FOOTBALL_HANDICAP_3WAY", -3.5, 4.4, null, 1.1, S6, [6671]),
    ml("U 3.5", "TOTALS", 3.5, 1.56, null, 2.02, S6, [6672]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S6, [6673]),
  ]),
  fb("UCL", "2026-08-27", "04:00", "AEK아테", "L소피아", S6, [
    ml("1X2", "ONE_X_TWO", null, 1.47, 3.55, 6.2, S6, [6674]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.5, 3.05, 2.45, S6, [6675]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 5.0, 4.15, 1.44, S6, [6676]),
    ml("U 2.5", "TOTALS", 2.5, 1.64, null, 1.95, S6, [6677]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S6, [6678]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.0, 2.0, 6.7, S6, [6679]),
    ml("h H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 5.1, 3.05, 1.6, S6, [6680]),
    ml("h U 1.5", "TOTALS", 1.5, 1.3, null, 2.72, S6, [6681]),
  ]),
  fb(
    "UCL",
    "2026-08-27",
    "04:00",
    "비킹FK",
    "D자그레",
    S6,
    [
      ml("1X2", "ONE_X_TWO", null, 2.23, 3.45, 2.6, S6, [6682]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.2, 3.95, 1.55, S6, [6683]),
      ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 9.5, 6.5, 1.14, S6, [6684]),
      ml("U 2.5", "TOTALS", 2.5, 2.19, null, 1.5, S6, [6685]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S7, [6686]),
      ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.75, 2.16, 3.1, S7, [6687]),
      ml("h H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 7.4, 3.9, 1.32, S7, [6688]),
      ml("h U 1.5", "TOTALS", 1.5, 1.51, null, 2.11, S7, [6689]),
    ],
    { overlapScreenshots: [S7] },
  ),
  fb("UCL", "2026-08-27", "04:00", "NK셀레", "슬로반브", S7, [
    ml("1X2", "ONE_X_TWO", null, 2.29, 3.1, 2.75, S7, [6690]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.8, 3.7, 1.52, S7, [6691]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 12.5, 6.8, 1.1, S7, [6692]),
    ml("U 2.5", "TOTALS", 2.5, 1.66, null, 1.92, S7, [6693]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S7, [6694]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.95, 1.92, 3.45, S7, [6695]),
    ml("h H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 9.2, 3.95, 1.27, S7, [6696]),
    ml("h U 1.5", "TOTALS", 1.5, 1.31, null, 2.68, S7, [6697]),
  ]),
  fb("UCL", "2026-08-27", "04:00", "리옹", "페네르SK", S7, [
    ml("1X2", "ONE_X_TWO", null, 1.85, 3.35, 3.5, S7, [6698]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.4, 3.45, 1.81, S7, [6699]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 7.4, 5.3, 1.23, S7, [6700]),
    ml("U 2.5", "TOTALS", 2.5, 1.84, null, 1.72, S7, [6701]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S7, [6702]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.4, 2.05, 4.1, S7, [6703]),
    ml("h H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 6.5, 3.5, 1.41, S7, [6704]),
    ml("h U 1.5", "TOTALS", 1.5, 1.39, null, 2.4, S7, [6705]),
  ]),
  fb("라리가", "2026-08-27", "04:00", "레알마드", "소시에다", S7, [
    ml("1X2", "ONE_X_TWO", null, 1.27, 4.75, 7.2, S7, [6706]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.82, 3.55, 3.15, S7, [6707]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 2.9, 3.85, 1.84, S7, [6708]),
    ml("H -3.5", "FOOTBALL_HANDICAP_3WAY", -3.5, 5.18, null, 1.06, S7, [6709]),
    ml("U 3.5", "TOTALS", 3.5, 1.63, null, 1.96, S7, [6710]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S7, [6711]),
  ]),
  fb("잉리그컵", "2026-08-27", "04:00", "프레스턴", "에버턴", S7, [
    ml("1X2", "ONE_X_TWO", null, 5.3, 3.75, 1.44, S7, [6712]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 2.4, 3.3, 2.33, S7, [6713]),
    ml("U 2.5", "TOTALS", 2.5, 1.96, null, 1.6, S7, [6714]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S7, [6715]),
  ]),
];

function decorateMarkets(markets: ReturnType<typeof ml>[]) {
  return markets.map((m) => ({
    ...m,
    sourceScreenshotSha: screenshotMeta(m.screenshotFile).sha256,
  }));
}

function decorateBaseball(
  g: (typeof NPB_GAMES)[number] | (typeof VOLLEYBALL_GAMES)[number],
) {
  const shot = screenshotMeta(g.screenshot);
  return {
    sport: g.sport,
    rawLeagueLabel: g.rawLeagueLabel,
    displayedDateKst: g.displayedDateKst,
    displayedStartKst: g.displayedStartKst,
    rawHomeLabel: g.rawHomeLabel,
    rawAwayLabel: g.rawAwayLabel,
    rawMatchup: g.rawMatchup,
    screenshotFile: shot.file,
    screenshotSha256: shot.sha256,
    screenshotRel: `${RAW_REL}/${shot.file}`,
    sourceScreenshotSha: shot.sha256,
    receivedAtKst: shot.receivedAtKst,
    operatorObservedAt: shot.receivedAtKst,
    timingClass: TIMING_CLASS,
    predictionInput: false,
    mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH" as const,
    identityStatus: "NOT_JOINED" as const,
    canonicalHome: null,
    canonicalAway: null,
    gamePk: null,
    internalGameId: null,
    doubleheaderRisk: "UNKNOWN_NO_SCHEDULE" as const,
    cutoffStatus: "PRE_GAME_OBSERVED" as const,
    overlapScreenshots: g.overlapScreenshots,
    truncatedAwayVariant: g.truncatedAwayVariant,
    markets: decorateMarkets(g.markets),
  };
}

function decorateFootball(g: (typeof FOOTBALL_GAMES_0826)[number]) {
  const shot = screenshotMeta(g.screenshot);
  return {
    ...g,
    screenshotSha256: shot.sha256,
    sourceScreenshotSha: shot.sha256,
    receivedAtKst: shot.receivedAtKst,
    operatorObservedAt: shot.receivedAtKst,
    timingClass:
      g.displayedDateKst === SLATE_DATE_KST
        ? TIMING_CLASS
        : ("NEXT_CALENDAR_DATE_VISIBLE" as const),
    predictionInput: false,
    matchId: null,
    markets: decorateMarkets(g.markets),
  };
}

function footballByLeague(rows: { rawLeagueLabel: string }[]) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.rawLeagueLabel] = (out[row.rawLeagueLabel] ?? 0) + 1;
  }
  return out;
}

export function sha256Abs(abs: string): string {
  return sha256File(abs);
}

export async function runIntake(cwd = process.cwd()) {
  for (const shot of SCREENSHOTS) {
    const copiedAbs = path.join(cwd, RAW_REL, shot.file);
    if (!existsSync(copiedAbs)) {
      throw new Error(`COPIED_SCREENSHOT_MISSING: ${shot.file}`);
    }
    const copiedSha = sha256File(copiedAbs);
    if (copiedSha !== shot.sha256) {
      throw new Error(`COPIED_SHA_MISMATCH: ${shot.file}`);
    }
    const inboxAbs = path.join(INBOX_PATH, shot.originalInboxName);
    if (!existsSync(inboxAbs)) {
      throw new Error(`INBOX_SCREENSHOT_MISSING: ${shot.originalInboxName}`);
    }
    const inboxSha = sha256File(inboxAbs);
    if (inboxSha !== shot.sha256) {
      throw new Error(`INBOX_SHA_MISMATCH: ${shot.originalInboxName}`);
    }
    if (inboxSha !== copiedSha) {
      throw new Error(`COPY_NOT_BYTE_IDENTICAL: ${shot.file}`);
    }
  }

  if (VOLLEYBALL_GAMES.length !== VOLLEYBALL_OBSERVED) {
    throw new Error("VOLLEYBALL_COUNT_MISMATCH");
  }
  if (NPB_GAMES.length !== NPB_OBSERVED) {
    throw new Error("NPB_COUNT_MISMATCH");
  }
  if (KBO_GAMES.length !== KBO_OBSERVED) {
    throw new Error("KBO_COUNT_MISMATCH");
  }
  if (FOOTBALL_GAMES_0826.length !== FOOTBALL_OBSERVED) {
    throw new Error("FOOTBALL_0826_COUNT_MISMATCH");
  }
  if (FOOTBALL_GAMES_0827.length !== NEXT_DATE_FOOTBALL_VISIBLE) {
    throw new Error("FOOTBALL_0827_COUNT_MISMATCH");
  }

  const volleyballRows = VOLLEYBALL_GAMES.map(decorateBaseball);
  const npbRows = NPB_GAMES.map(decorateBaseball);
  const kboRows = KBO_GAMES.map(decorateBaseball);
  const football0826 = FOOTBALL_GAMES_0826.map(decorateFootball);
  const football0827 = FOOTBALL_GAMES_0827.map(decorateFootball);

  const overlapRemoved = [
    ...VOLLEYBALL_GAMES,
    ...NPB_GAMES,
    ...KBO_GAMES,
    ...FOOTBALL_GAMES_0826,
    ...FOOTBALL_GAMES_0827,
  ].filter((g) => g.overlapScreenshots.length > 0).length;
  if (overlapRemoved !== OVERLAP_GAMES_REMOVED) {
    throw new Error(`OVERLAP_COUNT_MISMATCH: ${overlapRemoved}`);
  }

  const footballByLeague0826 = footballByLeague(FOOTBALL_GAMES_0826);
  const summary = {
    screenshots: SCREENSHOTS.length,
    oddsScreenshots: 7,
    lineupScreenshots: 0,
    mixedLineupScreenshots: 0,
    mlbOddsMatchups: 0,
    mlbOddsAliasMatched: 0,
    mlbOddsAliasFailed: 0,
    mlbGamePkJoined: 0,
    volleyballOddsFixtures: volleyballRows.length,
    npbOddsGames: npbRows.length,
    kboOddsGames: kboRows.length,
    baseballOddsGames: npbRows.length + kboRows.length,
    footballOddsFixtures: football0826.length,
    footballJoined: 0,
    nextCalendarDateFootballFixtures: football0827.length,
    expectedLineups: 0,
    confirmedLineups: 0,
    lineupOfficial: 0,
    confirmedFullGames: 0,
    confirmedPartialGames: 0,
    confirmedUncertain: 0,
    expectedPlayerSlots: 0,
    confirmedPlayerSlots: 0,
    overlapGamesDeduped: OVERLAP_GAMES_REMOVED,
    shaDuplicates: 0,
    rawMutation: 0,
    predictionInputTrue: 0,
    reviewRequiredSections: 1,
    unreadableGameRows: 0,
  };

  const document = {
    schemaVersion: "yang-edge-next-pregame-observation-v0",
    batchId: BATCH_ID,
    receivedDateKst: RECEIVED_DATE_KST,
    slateDateKst: SLATE_DATE_KST,
    intendedOperatingDateKst: SLATE_DATE_KST,
    dateClassification: "DATE_CONFIRMED",
    dateClassificationReason:
      "On-screen betting date for operating slate is 08.26(수) with status 경기전. Screenshots 104654 and 104713 continue the same board onto 08.27(목); those rows are recorded as next-calendar-date visible fixtures and are excluded from the 2026-08-26 denominator. Windows screenshot filename HHMMSS agrees with CreationTime 2026-08-26 10:46:15-10:47:13 KST. Inbox folder 2026-08-26 is both drop location and operating date.",
    receivedAtKst: RECEIVED_AT_KST,
    observedAt: OBSERVED_AT_UTC,
    operatorObservedAt: RECEIVED_AT_KST,
    captureTime: RECEIVED_AT_KST,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    captureWindowFirstKst: SCREENSHOTS[0].receivedAtKst,
    captureWindowLastKst: RECEIVED_AT_KST,
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
      "No lineup screenshots in this batch. EXPECTED and CONFIRMED arrays remain empty.",
    note: "Same-day operator screenshot intake for slate 2026-08-26 captured 10:46-10:47 KST. Domestic odds are manual observation evidence only. No alias join, no schedule join, no provider calls. 08.27(목) rows remain visible evidence but are not the 2026-08-26 denominator. Market IDs 6647-6655 were not visible between screenshot 104648 and 104654; no games were invented from that gap.",
    summary,
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
      sequence: s.sequence,
      rel: `${RAW_REL}/${s.file}`,
    })),
    overlapDedup: {
      method: "EVENT_IDENTITY_DISPLAYED_DATE_START_LEAGUE_HOME_AWAY",
      duplicateGameIdentitiesRemoved: OVERLAP_GAMES_REMOVED,
      overlappingGames: [
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "지바롯데 : 소프트뱅",
          screenshots: [S1, S2],
        },
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "KIA : 롯데",
          screenshots: [S2, S3],
        },
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "이와키 : 오이타T",
          screenshots: [S3, S4],
        },
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "대전하나 : 울산HDFC",
          screenshots: [S4, S5],
        },
        {
          displayedDateKst: "2026-08-27",
          matchup: "비킹FK : D자그레",
          screenshots: [S6, S7],
        },
      ],
    },
    reviewRequired: [
      {
        status: "REVIEW_REQUIRED",
        section: "CAPTURE_GAP_BETWEEN_SCREENSHOTS_5_AND_6",
        afterLastFullyVisible0826MarketId: 6646,
        aseanMarketIdsVisibleAfter6646: [6366, 6367, 6368, 6369],
        beforeFirst0827MarketId: 6656,
        uncapturedMarketIdRange: "6647-6655",
        gamesInventedFromGap: 0,
        note: "Nine 66xx market IDs are not visible. ASEAN 22:00 rows use a separate 6366-6369 series. Do not invent a 27th 08.26 game from the gap.",
      },
    ],
    volleyballOddsFixtures: volleyballRows,
    npbOddsGames: npbRows,
    kboOddsGames: kboRows,
    domesticOdds: [],
    nonMlbOddsFixtures: football0826,
    nextCalendarDateVisibleFixtures: football0827,
    expectedLineups: [],
    confirmedLineups: [],
    identity: {
      policy: "RAW_LABELS_ONLY_NO_ALIAS_JOIN",
      mlbAliasMatched: 0,
      mlbBlocked: 0,
      mlbJoinFailed: 0,
      npbJoinFailed: npbRows.length,
      kboJoinFailed: kboRows.length,
      volleyballJoinFailed: volleyballRows.length,
      footballJoinFailed: football0826.length,
      gamePkJoined: 0,
      internalGameIdInvented: 0,
      doubleheaderRisk: "UNKNOWN_NO_SCHEDULE",
      aliasFailedRawLabels: [],
    },
    nextOperatingDay: {
      operatingDate: SLATE_DATE_KST,
      scopeStatus: SCOPE_STATUS,
      sportsVisible: ["VOLLEYBALL", "BASEBALL", "FOOTBALL"],
      mlbGamesVisibleOnScreenshots: 0,
      volleyballGamesVisibleOnScreenshots: VOLLEYBALL_OBSERVED,
      npbGamesVisibleOnScreenshots: NPB_OBSERVED,
      kboGamesVisibleOnScreenshots: KBO_OBSERVED,
      baseballGamesVisibleOnScreenshots: BASEBALL_OBSERVED,
      footballFixturesVisibleOnScreenshots: FOOTBALL_OBSERVED,
      footballByLeague: footballByLeague0826,
      baseballByLeague: { NPB: NPB_OBSERVED, KBO: KBO_OBSERVED },
      nextCalendarDateFootballVisibleExcludedFromDenominator:
        NEXT_DATE_FOOTBALL_VISIBLE,
      mlbSchedulePresent: false,
      footballSchedulePresent: false,
      predictionPresent: false,
      mandatoryPercentComputed: false,
    },
  };

  const manifest = {
    schemaVersion: "yang-edge-inbox-raw-batch-v1",
    batchId: BATCH_ID,
    receivedAtKst: RECEIVED_AT_KST,
    captureTime: RECEIVED_AT_KST,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    captureWindowFirstKst: SCREENSHOTS[0].receivedAtKst,
    captureWindowLastKst: RECEIVED_AT_KST,
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
    inboxPath: INBOX_PATH,
    screenshotCount: SCREENSHOTS.length,
    notes: [
      "Raw screenshots copied byte-identical from INBOX. SHA-256 verified on copy.",
      "Windows screenshot filename HHMMSS agrees with CreationTime; used as observedAt/receivedAtKst.",
      "Inbox folder 2026-08-26 is drop location and operating date. On-screen 08.26(수) is the locked slate.",
      "On-screen 08.27(목) rows are next-calendar-date visible fixtures, not the 2026-08-26 denominator.",
      "No 2026-08-26 Prediction exists. predictionInput remains false.",
      "No lineup screenshots in this batch.",
      "Do not call Odds/Starter/Lineup/Result/Grade/Review/Engine/Prediction providers in this batch.",
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
      copiedAs: `${RAW_REL}/${s.file}`,
      copiedBytes: s.bytes,
      copiedSha256: s.sha256,
      copyIntegrity: "PASS",
    })),
  };

  const readme = `YANG EDGE — Next Pregame Observation Raw Batch
batchId: ${BATCH_ID}
Inbox: ${INBOX_PATH}\\
Received (latest screenshot CreationTime): ${RECEIVED_AT_KST}
captureTimeSource: ${CAPTURE_TIME_SOURCE}
slateDateKst: ${SLATE_DATE_KST}
observationPhase: ${TIMING_CLASS}
predictionInput: false

Contents
- 7 domestic-odds screenshots (volleyball / NPB / KBO / football)
- 0 lineup screenshots

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. Odds provenance = MANUAL_OPERATOR_OBSERVATION / MANUAL_SCREENSHOT.
3. researchOnly = true, engineAdmission = PROHIBITED, predictionInput = false.
4. Operating date is on-screen 08.26(수) = 2026-08-26.
5. 08.27(목) rows are next-calendar-date visible evidence, not today's denominator.
6. Do not invent games from the uncaptured 6647-6655 market-id gap.
7. Do not call Odds/Starter/Lineup/Result/Grade/Review/Engine/Prediction providers in this batch.
`;

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
    summary,
    timing: {
      observationReceivedAtKst: RECEIVED_AT_KST,
      slateDateKst: SLATE_DATE_KST,
      captureWindowFirstKst: SCREENSHOTS[0].receivedAtKst,
      captureWindowLastKst: RECEIVED_AT_KST,
      firstDisplayedStartKst: "2026-08-26T11:00:00+09:00",
      observationPhase: TIMING_CLASS,
    },
    nextOperatingDay: document.nextOperatingDay,
  };

  await mkdir(path.dirname(path.join(cwd, STRUCTURED_REL)), { recursive: true });
  await mkdir(path.dirname(path.join(cwd, AUDIT_REL)), { recursive: true });
  await writeFile(
    path.join(cwd, MANIFEST_REL),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(cwd, README_REL), readme, "utf8");
  await writeFile(
    path.join(cwd, STRUCTURED_REL),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(cwd, AUDIT_REL),
    `${JSON.stringify(audit, null, 2)}\n`,
    "utf8",
  );

  return { document, manifest, audit };
}

async function main() {
  const result = await runIntake();
  console.log(`wrote ${MANIFEST_REL}`);
  console.log(`wrote ${STRUCTURED_REL}`);
  console.log(`wrote ${AUDIT_REL}`);
  console.log(
    `volleyball=${result.document.summary.volleyballOddsFixtures} npb=${result.document.summary.npbOddsGames} kbo=${result.document.summary.kboOddsGames} football0826=${result.document.summary.footballOddsFixtures} football0827=${result.document.summary.nextCalendarDateFootballFixtures} overlapRemoved=${result.document.summary.overlapGamesDeduped} predictionInput=false`,
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
