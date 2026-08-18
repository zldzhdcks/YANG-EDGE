/**
 * One-shot 2026-08-18/batch-2253 operator screenshot seal.
 *
 *   npx tsx scripts/intake-2026-08-18-batch-2253-operator-pregame-observations.ts
 *
 * Writes only operator-observation raw metadata + structured/audit JSON.
 * Does NOT write Prediction / operator-input / Schedule / Odds / Result.
 * Does NOT open 2026-08-18 frozen research/prediction artifacts.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1";

export const BATCH_ID = "2026-08-18/batch-2253";
export const RECEIVED_DATE_KST = "2026-08-18";
export const SLATE_DATE_KST = "2026-08-19";
export const RECEIVED_AT_KST = "2026-08-18T22:53:44+09:00";
export const OBSERVED_AT_UTC = "2026-08-18T13:53:44.000Z";
export const CAPTURE_TIME = "UNKNOWN";
export const TIMING_CLASS = "PRE_PREDICTION";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-18/batch-2253";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-18/batch-2253-next-pregame-v0.json";
export const AUDIT_REL =
  "data/audits/2026-08-18-batch-2253-next-pregame-v0.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const SCOPE_STATUS = "NOT_READY_TO_LOCK_DAILY_SCOPE";

export const SCREENSHOTS = [
  {
    file: "screenshot_2026-08-18_224945.png",
    originalInboxName: "스크린샷 2026-08-18 224945.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "5805cee39fe94b84e4756bca29c716852e7938db093463929f4bf906616b5246",
    bytes: 189435,
    receivedAtKst: "2026-08-18T22:49:45+09:00",
  },
  {
    file: "screenshot_2026-08-18_225045.png",
    originalInboxName: "스크린샷 2026-08-18 225045.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "7ceb253172d3cfd9cc1b1f9ba98e36976cf7cff788aab9b5ee9ca9882de0a7d1",
    bytes: 152166,
    receivedAtKst: "2026-08-18T22:50:45+09:00",
  },
  {
    file: "screenshot_2026-08-18_225055.png",
    originalInboxName: "스크린샷 2026-08-18 225055.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "f5c92095dc13b31366762c92e1cd74449917fdc2463362896e49f888822a5c0d",
    bytes: 154841,
    receivedAtKst: "2026-08-18T22:50:55+09:00",
  },
  {
    file: "screenshot_2026-08-18_225132.png",
    originalInboxName: "스크린샷 2026-08-18 225132.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "b9a081fd250431d5936aad3d7e7ec5748f004dcfd01ea7828b19f9f8d56d97e0",
    bytes: 132984,
    receivedAtKst: "2026-08-18T22:51:33+09:00",
  },
  {
    file: "screenshot_2026-08-18_225325.png",
    originalInboxName: "스크린샷 2026-08-18 225325.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256:
      "881ad2f014df29614c14ba8359800b4772650843609e32389b11ef12c18c3dd5",
    bytes: 195879,
    receivedAtKst: "2026-08-18T22:53:25+09:00",
  },
  {
    file: "screenshot_2026-08-18_225331.png",
    originalInboxName: "스크린샷 2026-08-18 225331.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256:
      "dcea7dac74579cb722c4d7570bfa8fb7737e7ce31f3c34ec7504db84b1809b34",
    bytes: 196100,
    receivedAtKst: "2026-08-18T22:53:32+09:00",
  },
  {
    file: "screenshot_2026-08-18_225344.png",
    originalInboxName: "스크린샷 2026-08-18 225344.png",
    category: "MLB_EXPECTED_LINEUP" as const,
    sha256:
      "33b0b4dcbcd3e21e8dab5943ea90e9503dff2e32bbec476de0bbf7e43fe7f895",
    bytes: 100655,
    receivedAtKst: "2026-08-18T22:53:44+09:00",
  },
] as const;

export const FORBIDDEN_WRITE_PREFIXES = [
  "data/predictions/",
  "data/research/",
  "data/operator-input/",
  "리포트/",
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
    | "ONE_X_TWO"
    | "FOOTBALL_HANDICAP_3WAY"
    | "UNKNOWN";
  line: number | null;
  homePrice: number | null;
  drawPrice: number | null;
  awayPrice: number | null;
  rawValueStatus: "VISIBLE" | "NOT_FULLY_VISIBLE";
  screenshotFile: string;
  rowIds: number[];
};

type OddsGameDraft = {
  sport: "MLB";
  displayedStartKst: string;
  rawHome: string;
  rawAway: string;
  markets: OddsMarket[];
};

type FootballDraft = {
  sport: "FOOTBALL";
  rawLeagueLabel: string;
  displayedStartKst: string;
  rawHome: string;
  rawAway: string;
  rawHomeSecondaryVisible?: string;
  screenshot: string;
  identityStatus: "JOIN_FAILED";
  mappingStatus: "NOT_ON_REGISTERED_SLATE";
  competitionRegistryJoin:
    | "LABEL_NOT_EXACT"
    | "COMPETITION_NOT_REGISTERED";
  markets: OddsMarket[];
};

function ml(
  label: string,
  type: OddsMarket["marketType"],
  line: number | null,
  home: number | null,
  draw: number | null,
  away: number | null,
  file: string,
  rowIds: number[],
  status: OddsMarket["rawValueStatus"] = "VISIBLE",
): OddsMarket {
  return {
    rawMarketLabel: label,
    marketType: type,
    line,
    homePrice: home,
    drawPrice: draw,
    awayPrice: away,
    rawValueStatus: status,
    screenshotFile: file,
    rowIds,
  };
}

const S1 = "screenshot_2026-08-18_224945.png";
const S2 = "screenshot_2026-08-18_225045.png";
const S3 = "screenshot_2026-08-18_225055.png";
const S4 = "screenshot_2026-08-18_225132.png";
const L1 = "screenshot_2026-08-18_225325.png";
const L2 = "screenshot_2026-08-18_225331.png";
const L3 = "screenshot_2026-08-18_225344.png";

const ODDS_GAMES: OddsGameDraft[] = [
  {
    sport: "MLB",
    displayedStartKst: "07:35",
    rawHome: "볼티오리",
    rawAway: "뉴욕양키",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.8, null, 1.72, S1, [4696]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.65, 3.25, 2.15, S1, [4697]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.27, null, 2.87, S1, [4698]),
      ml("U 8.5", "TOTALS", 8.5, 1.79, null, 1.73, S2, [4699]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S2, [4700]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "07:40",
    rawHome: "탬파레이",
    rawAway: "토론블루",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.52, null, 2.09, S2, [4701]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.09, 3.25, 2.75, S2, [4702]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.87, null, 1.27, S2, [4703]),
      ml("U 7.5", "TOTALS", 7.5, 1.77, null, 1.75, S2, [4704]),
      ml("SUM", "SUM", null, 1.58, null, 2.09, S2, [4705]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "07:40",
    rawHome: "피츠파이",
    rawAway: "디트타이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.59, null, 1.97, S2, [4706]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.22, 3.25, 2.55, S2, [4707]),
      ml("H -2.5", "RUN_LINE", -2.5, 3.03, null, 1.24, S2, [4708]),
      ml("U 7.5", "TOTALS", 7.5, 1.87, null, 1.66, S2, [4709]),
      ml("SUM", "SUM", null, 1.58, null, 2.09, S2, [4710]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "07:40",
    rawHome: "필라필리",
    rawAway: "마이말린",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.29, null, 2.77, S2, [4711]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.66, 3.6, 3.7, S2, [4712]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.15, null, 1.49, S2, [4713]),
      ml("U 8.5", "TOTALS", 8.5, 1.65, null, 1.89, S2, [4714]),
      ml("SUM", "SUM", null, 1.6, null, 2.06, S2, [4715]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "07:40",
    rawHome: "클리가디",
    rawAway: "샌프자이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.39, null, 2.4, S2, [4716]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.86, 3.4, 3.15, S2, [4717]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.46, null, 1.37, S2, [4718]),
      ml("U 8.5", "TOTALS", 8.5, 1.65, null, 1.89, S2, [4719]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S2, [4720]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "07:40",
    rawHome: "신시레즈",
    rawAway: "세인카디",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.84, null, 1.69, S2, [4721]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.7, 3.3, 2.1, S2, [4722]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.29, null, 2.77, S2, [4723]),
      ml("U 8.5", "TOTALS", 8.5, 1.8, null, 1.72, S2, [4724]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S2, [4725]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "08:10",
    rawHome: "뉴욕메츠",
    rawAway: "샌디파드",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.79, null, 1.73, S2, [4726]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.6, 3.3, 2.17, S2, [4727]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.27, null, 2.87, S2, [4728]),
      ml("U 8.5", "TOTALS", 8.5, 1.8, null, 1.72, S2, [4729]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4730]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "08:10",
    rawHome: "보스레드",
    rawAway: "애리다이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.43, null, 2.29, S3, [4731]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.92, 3.4, 3.0, S3, [4732]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.56, null, 1.34, S3, [4733]),
      ml("U 8.5", "TOTALS", 8.5, 1.76, null, 1.76, S3, [4734]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4735]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "08:40",
    rawHome: "미네트윈",
    rawAway: "애틀브레",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.93, null, 1.62, S3, [4736]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.85, 3.35, 2.0, S3, [4737]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.32, null, 2.64, S3, [4738]),
      ml("U 8.5", "TOTALS", 8.5, 1.8, null, 1.72, S3, [4739]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4740]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "08:40",
    rawHome: "밀워브루",
    rawAway: "시애매리",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.49, null, 2.15, S3, [4741]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.04, 3.3, 2.8, S3, [4742]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.77, null, 1.29, S3, [4743]),
      ml("U 7.5", "TOTALS", 7.5, 1.85, null, 1.68, S3, [4744]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4745]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "08:40",
    rawHome: "캔자로얄",
    rawAway: "애슬레틱",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.6, null, 1.96, S3, [4746]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.22, 3.45, 2.45, S3, [4747]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.97, null, 1.25, S3, [4748]),
      ml("U 9.5", "TOTALS", 9.5, 1.81, null, 1.71, S3, [4749]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4750]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "09:05",
    rawHome: "텍사레인",
    rawAway: "워싱내셔",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.49, null, 2.15, S3, [4751]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.03, 3.35, 2.8, S3, [4752]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.72, null, 1.3, S3, [4753]),
      ml("U 8.5", "TOTALS", 8.5, 1.67, null, 1.86, S3, [4754]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [4755]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "09:05",
    rawHome: "시카컵스",
    rawAway: "시카화이",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.45, null, 2.24, S3, [4756]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.96, 3.4, 2.9, S3, [4757]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.6, null, 1.33, S3, [4758]),
      ml(
        "U 8.5",
        "TOTALS",
        8.5,
        1.76,
        null,
        null,
        S3,
        [4759],
        "NOT_FULLY_VISIBLE",
      ),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S4, [4760]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "09:10",
    rawHome: "휴스애스",
    rawAway: "LA에인절",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 1.48, null, 2.17, S4, [4761]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.01, 3.4, 2.8, S4, [4762]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.64, null, 1.32, S4, [4763]),
      ml("U 9.5", "TOTALS", 9.5, 1.62, null, 1.93, S4, [4764]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S4, [4765]),
    ],
  },
  {
    sport: "MLB",
    displayedStartKst: "09:40",
    rawHome: "콜로로키",
    rawAway: "LA다저스",
    markets: [
      ml("승패", "MONEYLINE_2WAY", null, 2.4, null, 1.39, S4, [4774]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.75, 3.6, 1.65, S4, [4775]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.53, null, 2.07, S4, [4776]),
      ml("U 11.5", "TOTALS", 11.5, 1.72, null, 1.8, S4, [4777]),
      ml("SUM", "SUM", null, 1.6, null, 2.06, S4, [4778]),
      ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.35, 6.9, 1.73, S4, [4779]),
      ml("h H +1.5", "FIRST_HALF_OR_EARLY_SPECIAL", 1.5, 1.41, null, 2.34, S4, [4780]),
      ml("h U 6.5", "FIRST_HALF_OR_EARLY_SPECIAL", 6.5, 1.69, null, 1.84, S4, [4781]),
    ],
  },
];

const NON_MLB_ODDS: FootballDraft[] = [
  {
    sport: "FOOTBALL",
    rawLeagueLabel: "UCL",
    displayedStartKst: "04:00",
    rawHome: "루도고레츠",
    rawHomeSecondaryVisible: "L소피아",
    rawAway: "AEK아테",
    screenshot: S1,
    identityStatus: "JOIN_FAILED",
    mappingStatus: "NOT_ON_REGISTERED_SLATE",
    competitionRegistryJoin: "LABEL_NOT_EXACT",
    markets: [
      ml("1X2", "ONE_X_TWO", null, 3.1, 2.9, 2.19, S1, [4648]),
      ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1.0, 1.56, 3.6, 4.6, S1, [4649]),
      ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2.0, 1.14, 6.5, 9.5, S1, [4650]),
      ml("U 2.5", "TOTALS", 2.5, 1.6, null, 2.01, S1, [4651]),
      ml("h 1X2", "FIRST_HALF_OR_EARLY_SPECIAL", null, 3.45, 1.88, 3.05, S1, [4653]),
      ml("SUM", "SUM", null, 1.81, null, 1.79, S1, []),
    ],
  },
  {
    sport: "FOOTBALL",
    rawLeagueLabel: "UCL",
    displayedStartKst: "04:00",
    rawHome: "D자그레",
    rawAway: "비킹FK",
    screenshot: S1,
    identityStatus: "JOIN_FAILED",
    mappingStatus: "NOT_ON_REGISTERED_SLATE",
    competitionRegistryJoin: "LABEL_NOT_EXACT",
    markets: [
      ml("1X2", "ONE_X_TWO", null, 1.67, 3.6, 4.05, S1, [4656]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1.0, 2.85, 3.4, 2.04, S1, [4657]),
      ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2.0, 5.6, 4.75, 1.34, S1, [4658]),
      ml("U 2.5", "TOTALS", 2.5, 2.11, null, 1.54, S1, [4659]),
      ml("h 1X2", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.15, 2.14, 4.6, S1, [4661]),
      ml("SUM", "SUM", null, 1.81, null, 1.79, S1, []),
    ],
  },
  {
    sport: "FOOTBALL",
    rawLeagueLabel: "UCL",
    displayedStartKst: "04:00",
    rawHome: "페네르SK",
    rawAway: "리용",
    screenshot: S1,
    identityStatus: "JOIN_FAILED",
    mappingStatus: "NOT_ON_REGISTERED_SLATE",
    competitionRegistryJoin: "LABEL_NOT_EXACT",
    markets: [
      ml("1X2", "ONE_X_TWO", null, 1.97, 3.35, 3.15, S1, [4664]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1.0, 3.65, 3.6, 1.71, S1, [4665]),
      ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2.0, 8.0, 5.6, 1.2, S1, [4666]),
      ml("U 2.5", "TOTALS", 2.5, 1.98, null, 1.62, S1, [4667]),
      ml("h 1X2", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.55, 2.04, 3.75, S1, [4669]),
      ml("SUM", "SUM", null, 1.81, null, 1.79, S1, []),
    ],
  },
  {
    sport: "FOOTBALL",
    rawLeagueLabel: "코파리베",
    displayedStartKst: "07:00",
    rawHome: "리바다비",
    rawAway: "플루미넨",
    screenshot: S1,
    identityStatus: "JOIN_FAILED",
    mappingStatus: "NOT_ON_REGISTERED_SLATE",
    competitionRegistryJoin: "COMPETITION_NOT_REGISTERED",
    markets: [
      ml("1X2", "ONE_X_TWO", null, 2.22, 2.7, 3.05, S1, [4692]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1.0, 5.1, 3.4, 1.52, S1, [4693]),
      ml("U 2.5", "TOTALS", 2.5, 1.35, null, 2.53, S1, [4694]),
      ml("SUM", "SUM", null, 1.83, null, 1.77, S1, [4695]),
    ],
  },
  {
    sport: "FOOTBALL",
    rawLeagueLabel: "코파리베",
    displayedStartKst: "09:30",
    rawHome: "톨리마",
    rawAway: "델바예",
    screenshot: S4,
    identityStatus: "JOIN_FAILED",
    mappingStatus: "NOT_ON_REGISTERED_SLATE",
    competitionRegistryJoin: "COMPETITION_NOT_REGISTERED",
    markets: [
      ml("1X2", "ONE_X_TWO", null, 2.7, 2.9, 2.3, S4, [4766]),
      ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1.0, 1.48, 3.6, 5.1, S4, [4767]),
      ml("U 2.5", "TOTALS", 2.5, 1.51, null, 2.11, S4, [4768]),
      ml("SUM", "SUM", null, 1.82, null, 1.78, S4, [4769]),
    ],
  },
  {
    sport: "FOOTBALL",
    rawLeagueLabel: "코파리베",
    displayedStartKst: "09:30",
    rawHome: "카톨리카",
    rawAway: "에스라플",
    screenshot: S4,
    identityStatus: "JOIN_FAILED",
    mappingStatus: "NOT_ON_REGISTERED_SLATE",
    competitionRegistryJoin: "COMPETITION_NOT_REGISTERED",
    markets: [
      ml("1X2", "ONE_X_TWO", null, 2.5, 2.8, 2.55, S4, [4770]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1.0, 6.6, 3.8, 1.36, S4, [4771]),
      ml("U 2.5", "TOTALS", 2.5, 1.46, null, 2.22, S4, [4772]),
      ml("SUM", "SUM", null, 1.82, null, 1.78, S4, [4773]),
    ],
  },
];

type LineupDraft = {
  displayedStartEt: string;
  displayedStartKst: string;
  awayTeam: string;
  homeTeam: string;
  screenshot: string;
  awayStarterRaw: string;
  homeStarterRaw: string;
  displayedUsLine: string;
  displayedUsTotal: string;
  umpire: "NOT_ANNOUNCED";
  away: string[];
  home: string[];
  batsVisible: boolean;
};

const LINEUP_GAMES: LineupDraft[] = [
  {
    displayedStartEt: "6:35 PM ET",
    displayedStartKst: "07:35",
    awayTeam: "New York Yankees",
    homeTeam: "Baltimore Orioles",
    screenshot: L1,
    awayStarterRaw: "Carlos Rodon (L), 4-2, 3.30 ERA",
    homeStarterRaw: "Shane Baz (R), 4-12, 4.00 ERA",
    displayedUsLine: "NYY -112",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: false,
    away: [
      "CF|T. Grisham",
      "DH|Ben Rice",
      "RF|S. Jones",
      "1B|Luis Garcia",
      "2B|J. Chisholm",
      "LF|Heliot Ramos",
      "3B|Ryan McMahon",
      "C|Austin Wells",
      "SS|G. Lombard",
    ],
    home: [
      "RF|T. O'Neill",
      "1B|Pete Alonso",
      "2B|J. Holliday",
      "DH|Coby Mayo",
      "SS|G. Henderson",
      "3B|C. Encarnacion-Strand",
      "LF|C. Franklin",
      "CF|L. Taveras",
      "C|C. Narvaez",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "San Francisco Giants",
    homeTeam: "Cleveland Guardians",
    screenshot: L1,
    awayStarterRaw: "C. Whisenhunt (L), 3-3, 6.11 ERA",
    homeStarterRaw: "Foster Griffin (L), 13-4, 3.25 ERA",
    displayedUsLine: "CLE -193",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: false,
    away: [
      "DH|B. Eldridge",
      "RF|Jung Hoo Lee",
      "SS|Willy Adames",
      "1B|R. Devers",
      "2B|O. Basabe",
      "3B|B. Kennedy",
      "LF|V. Bericoto",
      "CF|Jonah Cox",
      "C|A. Knizner",
    ],
    home: [
      "CF|Steven Kwan",
      "DH|C. DeLauter",
      "3B|Jose Ramirez",
      "RF|Jo Adell",
      "LF|A. Martinez",
      "1B|Rhys Hoskins",
      "2B|Angel Genao",
      "C|A. Hedges",
      "SS|B. Rocchio",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "St. Louis Cardinals",
    homeTeam: "Cincinnati Reds",
    screenshot: L1,
    awayStarterRaw: "Kyle Leahy (R), 9-4, 3.37 ERA",
    homeStarterRaw: "Andrew Abbott (L), 6-7, 4.13 ERA",
    displayedUsLine: "STL -116",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: false,
    away: [
      "2B|J. Wetherholt",
      "DH|Ivan Herrera",
      "RF|J. Walker",
      "1B|A. Burleson",
      "LF|Joshua Baez",
      "SS|Masyn Winn",
      "3B|Jose Fermin",
      "CF|E. Pereira",
      "C|Pedro Pages",
    ],
    home: [
      "SS|E. De La Cruz",
      "1B|Sal Stewart",
      "LF|JJ Bleday",
      "C|T. Stephenson",
      "DH|E. Suarez",
      "CF|Dane Myers",
      "RF|Noelvi Marte",
      "3B|K. Hayes",
      "2B|Matt McLain",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "Miami Marlins",
    homeTeam: "Philadelphia Phillies",
    screenshot: L1,
    awayStarterRaw: "Tyler Phillips (R), 3-8, 3.65 ERA",
    homeStarterRaw: "Zack Wheeler (R), 10-4, 2.89 ERA",
    displayedUsLine: "PHI -229",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: false,
    away: [
      "CF|Jakob Marsee",
      "2B|X. Edwards",
      "LF|H. Hernandez",
      "DH|G. Conine",
      "SS|Otto Lopez",
      "3B|J. Sanoja",
      "RF|Owen Caissie",
      "C|Joe Mack",
      "1B|G. Pauley",
    ],
    home: [
      "DH|K. Schwarber",
      "SS|Trea Turner",
      "RF|Bryce Harper",
      "2B|Luis Arraez",
      "1B|Alec Bohm",
      "3B|Bryson Stott",
      "LF|B. Marsh",
      "C|J. Realmuto",
      "CF|J. Crawford",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "Detroit Tigers",
    homeTeam: "Pittsburgh Pirates",
    screenshot: L1,
    awayStarterRaw: "Keider Montero (R), 9-7, 3.22 ERA",
    homeStarterRaw: "Braxton Ashcraft (R), 12-5, 3.82 ERA",
    displayedUsLine: "PIT -140",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: false,
    away: [
      "2B|G. Torres",
      "3B|K. McGonigle",
      "C|D. Dingler",
      "DH|Colt Keith",
      "RF|Z. McKinstry",
      "1B|S. Torkelson",
      "LF|B. Callahan",
      "CF|Max Clark",
      "SS|Javier Baez",
    ],
    home: [
      "1B|S. Horwitz",
      "2B|Brandon Lowe",
      "DH|B. Reynolds",
      "3B|N. Gonzales",
      "CF|Oneil Cruz",
      "RF|E. Valdez",
      "LF|Jake Mangum",
      "C|Henry Davis",
      "SS|J. Gonzalez",
    ],
  },
  {
    displayedStartEt: "6:40 PM ET",
    displayedStartKst: "07:40",
    awayTeam: "Toronto Blue Jays",
    homeTeam: "Tampa Bay Rays",
    screenshot: L1,
    awayStarterRaw: "Jose Soriano (R), 9-6, 3.16 ERA",
    homeStarterRaw: "Nick Martinez (R), 12-3, 2.74 ERA",
    displayedUsLine: "TB -129",
    displayedUsTotal: "7.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: false,
    away: [
      "CF|B. Bateman",
      "RF|Nathan Lukes",
      "DH|G. Springer",
      "C|A. Kirk",
      "LF|J. Sanchez",
      "3B|K. Okamoto",
      "SS|A. Gimenez",
      "2B|E. Clement",
      "1B|C. McAdoo",
    ],
    home: [
      "DH|Yandy Diaz",
      "1B|J. Aranda",
      "3B|J. Caminero",
      "C|Liam Hicks",
      "LF|C. Simpson",
      "RF|Victor Mesa",
      "CF|C. Mullins",
      "2B|R. Palacios",
      "SS|Taylor Walls",
    ],
  },
  {
    displayedStartEt: "7:10 PM ET",
    displayedStartKst: "08:10",
    awayTeam: "Arizona Diamondbacks",
    homeTeam: "Boston Red Sox",
    screenshot: L2,
    awayStarterRaw: "Merrill Kelly (R), 8-10, 5.11 ERA",
    homeStarterRaw: "Ranger Suarez (L), 4-3, 3.25 ERA",
    displayedUsLine: "BOS -165",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
    away: [
      "RF|C. Carroll|L",
      "SS|G. Perdomo|S",
      "DH|G. Moreno|R",
      "3B|N. Arenado|R",
      "CF|J. Lawlar|R",
      "1B|Tim Tawa|R",
      "C|James McCann|R",
      "2B|I. Vargas|S",
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
    displayedStartEt: "7:10 PM ET",
    displayedStartKst: "08:10",
    awayTeam: "San Diego Padres",
    homeTeam: "New York Mets",
    screenshot: L2,
    awayStarterRaw: "Robbie Ray (L), 10-7, 3.28 ERA",
    homeStarterRaw: "Zac Thornton (L), 3-3, 2.78 ERA",
    displayedUsLine: "SD -109",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
    away: [
      "RF|F. Tatis|R",
      "DH|Luis Rengifo|S",
      "3B|M. Machado|R",
      "1B|Ty France|R",
      "CF|J. Merrill|L",
      "LF|Austin Hays|R",
      "C|L. Campusano|R",
      "SS|X. Bogaerts|R",
      "2B|J. Cronenworth|L",
    ],
    home: [
      "LF|A.J. Ewing|L",
      "SS|F. Lindor|S",
      "3B|Bo Bichette|R",
      "CF|Luis Robert|R",
      "DH|F. Alvarez|R",
      "RF|Carson Benge|L",
      "2B|M. Semien|R",
      "1B|C. Morel|R",
      "C|Luis Torrens|R",
    ],
  },
  {
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayTeam: "Athletics",
    homeTeam: "Kansas City Royals",
    screenshot: L2,
    awayStarterRaw: "Jack Perkins (R), 2-9, 7.27 ERA",
    homeStarterRaw: "Mason Black (R), 0-0, 3.51 ERA",
    displayedUsLine: "KC -140",
    displayedUsTotal: "9.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
    away: [
      "CF|Henry Bolte|R",
      "LF|Zack Gelof|R",
      "SS|Jacob Wilson|R",
      "DH|Jonah Heim|S",
      "1B|Tommy White|R",
      "RF|L. Butler|L",
      "3B|Max Muncy|R",
      "C|Brian Serven|R",
      "2B|A. Williams|R",
    ],
    home: [
      "C|C. Jensen|L",
      "SS|Bobby Witt Jr.|R",
      "RF|J. Caglianone|L",
      "3B|M. Garcia|R",
      "1B|V. Pasquantino|L",
      "DH|S. Perez|R",
      "2B|M. Massey|L",
      "LF|I. Collins|S",
      "CF|Kyle Isbel|L",
    ],
  },
  {
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayTeam: "Seattle Mariners",
    homeTeam: "Milwaukee Brewers",
    screenshot: L2,
    awayStarterRaw: "Bryce Miller (R), 4-6, 3.39 ERA",
    homeStarterRaw: "Kyle Harrison (L), 9-3, 2.99 ERA",
    displayedUsLine: "MIL -145",
    displayedUsTotal: "7.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
    away: [
      "RF|Taylor Ward|R",
      "2B|Cole Young|L",
      "LF|R. Arozarena|R",
      "DH|D. Canzone|L",
      "CF|J. Rodriguez|R",
      "1B|Josh Naylor|L",
      "C|Cal Raleigh|S",
      "3B|W. Wilson|R",
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
    displayedStartEt: "7:40 PM ET",
    displayedStartKst: "08:40",
    awayTeam: "Atlanta Braves",
    homeTeam: "Minnesota Twins",
    screenshot: L2,
    awayStarterRaw: "Tyler Mahle (R), 4-9, 4.64 ERA",
    homeStarterRaw: "Zebby Matthews (R), 6-8, 5.34 ERA",
    displayedUsLine: "ATL -124",
    displayedUsTotal: "8.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
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
      "LF|T. Larnach|L",
      "CF|Byron Buxton|R",
      "C|Ryan Jeffers|R",
      "DH|Josh Bell|S",
      "1B|Royce Lewis|R",
      "2B|Kody Clemens|L",
      "RF|L. Keaschall|R",
      "3B|Brooks Lee|S",
      "SS|K. Culpepper|R",
    ],
  },
  {
    displayedStartEt: "8:05 PM ET",
    displayedStartKst: "09:05",
    awayTeam: "Washington Nationals",
    homeTeam: "Texas Rangers",
    screenshot: L2,
    awayStarterRaw: "Jackson Kent (L), 0-0, 6.75 ERA",
    homeStarterRaw: "Cal Quantrill (R), 4-4, 3.44 ERA",
    displayedUsLine: "TEX -148",
    displayedUsTotal: "8.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
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
      "LF|W. Langford|R",
      "DH|Corey Seager|L",
      "SS|E. Duran|R",
      "RF|B. Nimmo|L",
      "1B|Jake Burger|R",
      "2B|J. Foscue|R",
      "C|Elias Diaz|R",
      "3B|Cody Freeman|R",
      "CF|Evan Carter|L",
    ],
  },
  {
    displayedStartEt: "8:05 PM ET",
    displayedStartKst: "09:05",
    awayTeam: "Chicago White Sox",
    homeTeam: "Chicago Cubs",
    screenshot: L3,
    awayStarterRaw: "Erick Fedde (R), 6-8, 4.51 ERA",
    homeStarterRaw: "Kevin Gausman (R), 6-11, 4.53 ERA",
    displayedUsLine: "CHC -161",
    displayedUsTotal: "9.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
    away: [
      "LF|S. Antonacci|L",
      "1B|M. Murakami|L",
      "3B|M. Vargas|R",
      "DH|A. Benintendi|L",
      "RF|B. Montgomery|S",
      "SS|C. Montgomery|L",
      "2B|C. Meidroth|R",
      "CF|T. Peters|L",
      "C|Drew Romo|S",
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
    displayedStartEt: "8:10 PM ET",
    displayedStartKst: "09:10",
    awayTeam: "Los Angeles Angels",
    homeTeam: "Houston Astros",
    screenshot: L3,
    awayStarterRaw: "George Klassen (R), 1-1, 5.52 ERA",
    homeStarterRaw: "Cristian Javier (R), 1-3, 6.68 ERA",
    displayedUsLine: "HOU -162",
    displayedUsTotal: "9.0",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
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
    screenshot: L3,
    awayStarterRaw: "Eric Lauer (L), 7-6, 4.67 ERA",
    homeStarterRaw: "Ryan Feltner (R), 5-8, 5.59 ERA",
    displayedUsLine: "LAD -187",
    displayedUsTotal: "11.5",
    umpire: "NOT_ANNOUNCED",
    batsVisible: true,
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
    throw new Error("STOP: 2026-08-19 schedule appeared; re-audit join policy");
  }
  if (predictionExists) {
    throw new Error("STOP: 2026-08-19 prediction exists; do not regenerate");
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

  const footballRows = NON_MLB_ODDS.map((g) => {
    const shot = screenshotMeta(g.screenshot);
    return {
      sport: g.sport,
      rawLeagueLabel: g.rawLeagueLabel,
      displayedDateKst: SLATE_DATE_KST,
      displayedStartKst: g.displayedStartKst,
      rawHome: g.rawHome,
      rawAway: g.rawAway,
      rawHomeSecondaryVisible: g.rawHomeSecondaryVisible ?? null,
      screenshot: g.screenshot,
      screenshotSha256: shot.sha256,
      sourceScreenshotSha: shot.sha256,
      receivedAtKst: shot.receivedAtKst,
      operatorObservedAt: shot.receivedAtKst,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      identityStatus: g.identityStatus,
      mappingStatus: g.mappingStatus,
      competitionRegistryJoin: g.competitionRegistryJoin,
      matchId: null,
      markets: g.markets,
    };
  });

  const lineupRows = LINEUP_GAMES.map((g) => {
    const shot = screenshotMeta(g.screenshot);
    return {
      displayedDateKst: SLATE_DATE_KST,
      displayedStartEt: g.displayedStartEt,
      displayedStartKst: g.displayedStartKst,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      screenshotFile: g.screenshot,
      screenshotSha256: shot.sha256,
      screenshotRel: `${RAW_REL}/${g.screenshot}`,
      sourceScreenshotSha: shot.sha256,
      receivedAtKst: shot.receivedAtKst,
      operatorObservedAt: shot.receivedAtKst,
      lineupType: "EXPECTED" as const,
      confirmedLineup: false,
      officialLineup: false,
      batsVisibleOnTranscription: g.batsVisible,
      mappingStatus: "TEAM_VISIBLE_NO_SCHEDULE",
      identityStatus: "CARD_TEAM_NAMES_VISIBLE",
      gamePk: null,
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
    };
  });

  const aliasFailed = oddsRows.filter((r) => r.mappingStatus === "JOIN_FAILED");
  if (aliasFailed.length > 0) {
    throw new Error(
      `MLB alias JOIN_FAILED: ${aliasFailed.map((r) => r.rawMatchup).join("; ")}`,
    );
  }

  const document = {
    schemaVersion: "yang-edge-next-pregame-observation-v0",
    batchId: BATCH_ID,
    receivedDateKst: RECEIVED_DATE_KST,
    slateDateKst: SLATE_DATE_KST,
    dateClassification: "DATE_CONFIRMED",
    dateClassificationReason:
      "On-screen betting date is 08.19(수) with status 경기전. Inbox folder 2026-08-18 is save/received date only. File LastWriteTime is 2026-08-18 22:49-22:53 KST. No 2026-08-19 repository schedule/prediction exists yet.",
    receivedAtKst: RECEIVED_AT_KST,
    observedAt: OBSERVED_AT_UTC,
    operatorObservedAt: RECEIVED_AT_KST,
    captureTime: CAPTURE_TIME,
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
    note: "Pregame operator screenshots for slate 2026-08-19 received on 2026-08-18. Not a Prediction input. Lineups are EXPECTED only. No schedule/gamePk join. Football rows are preserved as JOIN_FAILED / NOT_ON_REGISTERED_SLATE. 2026-08-18 frozen artifacts were not opened or rewritten.",
    summary: {
      screenshots: SCREENSHOTS.length,
      oddsScreenshots: 4,
      lineupScreenshots: 3,
      mlbOddsMatchups: oddsRows.length,
      mlbOddsAliasMatched: oddsRows.length,
      mlbGamePkJoined: 0,
      footballOddsFixtures: footballRows.length,
      footballJoined: 0,
      expectedLineups: lineupRows.length,
      lineupOfficial: 0,
      lineupConfirmed: 0,
      teamLineups: lineupRows.length * 2,
      players: lineupRows.reduce(
        (n, r) => n + r.awayLineup.length + r.homeLineup.length,
        0,
      ),
      doubleheaderAmbiguous: 0,
      doubleheaderRisk: "UNKNOWN_NO_SCHEDULE",
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
    expectedLineups: lineupRows,
    identity: {
      policy: "EXACT_CATALOG_ALIAS_ONLY",
      mlbAliasMatched: oddsRows.length,
      mlbBlocked: 0,
      mlbJoinFailed: 0,
      footballJoinFailed: footballRows.length,
      gamePkJoined: 0,
      internalGameIdInvented: 0,
      doubleheaderRisk: "UNKNOWN_NO_SCHEDULE",
      cinStlGamesVisible: 1,
    },
    nextOperatingDay: {
      operatingDate: SLATE_DATE_KST,
      scopeStatus: SCOPE_STATUS,
      sportsVisible: ["MLB", "FOOTBALL"],
      mlbGamesVisibleOnScreenshots: 15,
      footballFixturesVisibleOnScreenshots: 6,
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
    captureTime: CAPTURE_TIME,
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
    inboxPath: "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-18",
    notes: [
      "Raw screenshots copied byte-identical from INBOX. SHA-256 verified on copy.",
      "Windows screenshot filenames encode save time (HHMMSS); that is received/save time, not proven on-screen captureTime.",
      "captureTime remains UNKNOWN.",
      "receivedAtKst is the latest screenshot LastWriteTime (2026-08-18T22:53:44+09:00).",
      "On-screen date is 08.19(수). Inbox folder 2026-08-18 is received date only.",
      "No 2026-08-19 Prediction exists. timingClass = PRE_PREDICTION. predictionInput remains false because schedule/gamePk/required source policy are not met.",
      "MLB lineup screenshots are labeled Expected Lineup — never OFFICIAL/CONFIRMED.",
      "Football UCL/Copa Libertadores rows are preserved as JOIN_FAILED / NOT_ON_REGISTERED_SLATE.",
      "Do not write these observations into frozen 2026-08-18 Snapshot/Prediction/Odds/Result/Grade/Review/Scorecard.",
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
  await writeFile(
    manifestAbs,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

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
      firstDisplayedMlbStartKst: "2026-08-19T07:35:00+09:00",
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
    `mlbOdds=${result.document.summary.mlbOddsMatchups} lineups=${result.document.summary.expectedLineups} football=${result.document.summary.footballOddsFixtures} predictionInput=false scope=${SCOPE_STATUS}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
