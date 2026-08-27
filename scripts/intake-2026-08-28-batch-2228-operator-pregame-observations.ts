/**
 * One-shot 2026-08-28/batch-2228 operator screenshot intake.
 *
 *   npx tsx scripts/intake-2026-08-28-batch-2228-operator-pregame-observations.ts
 *
 * Recovery + manual odds intake only. Does NOT lock Daily Scope.
 * Does NOT write Prediction / operator-input / Schedule / Result / Grade.
 * Does NOT call providers. Does NOT fuzzy-match identity.
 * formalObservedAt is the frozen intake clock, never file mtime.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1/build-from-admin-rows";

export const BATCH_ID = "2026-08-28/batch-2228";
export const DATE_KST = "2026-08-28";
export const RECEIVED_DATE_KST = "2026-08-28";
export const SLATE_DATE_KST = "2026-08-28";
export const INTAKE_STARTED_AT = "2026-08-27T22:31:14.162+09:00";
export const INTAKE_STARTED_AT_KST = "2026-08-27T22:31:14.162+09:00";
export const INTAKE_STARTED_AT_UTC = "2026-08-27T13:31:14.162Z";
export const FORMAL_OBSERVED_AT = INTAKE_STARTED_AT;
export const CAPTURE_TIME_SOURCE = "INTAKE_STARTED_AT_FROZEN_NOT_FILE_MTIME";
export const TIMING_CLASS = "PREGAME_ELIGIBILITY_UNRESOLVED";
export const SCOPE_STATUS = "NOT_READY_TO_LOCK_DAILY_SCOPE";
export const STATUS = "OPERATOR_REVIEW_REQUIRED";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-28/batch-2228";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-28/batch-2228-next-pregame-v0.json";
export const RECOVERY_AUDIT_REL =
  "data/audits/2026-08-28-pregame-current-state-recovery-v1.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const INBOX_PATH =
  "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-28";
export const REQUIRED_BASE_COMMIT =
  "616afdc32d4a1d963777209d962bebbaa3e392f9";
export const RAW_EVIDENCE_STORAGE = "LOCAL_ONLY_OWNER_PROVIDED_SCREENSHOT";
export const REPOSITORY_EVIDENCE = "HASH_AND_STRUCTURED_OBSERVATION";
export const PNG_GIT_EXCLUDE =
  "data/operator-observations/raw/2026-08-28/batch-2228/*.png";

const S1 = "screenshot_2026-08-27_211819.png";
const S2 = "screenshot_2026-08-27_211829.png";
const S3 = "screenshot_2026-08-27_211836.png";
const S4 = "screenshot_2026-08-27_211843.png";
const S5 = "screenshot_2026-08-27_211850.png";
const S6 = "screenshot_2026-08-27_211857.png";

export const FORBIDDEN_WRITE_PREFIXES = [
  "data/predictions/",
  "data/research/",
  "data/operator-input/",
  "리포트/",
] as const;

export const SEALED_2026_08_26 = [
  {
    rel: "data/audits/2026-08-26-daily-scope-lock-v1.json",
    sha256:
      "97d04ce464c6e062264f20ea3de323a3e60eeac2e410c9ed6cf59c77d8a6c501",
  },
  {
    rel: "data/audits/2026-08-26-schedule-identity-reconciliation-v1.json",
    sha256:
      "405c7f659edc21c9330d65c1bb61289776f8fd4e369b24a07101032105dd20b5",
  },
  {
    rel: "data/audits/2026-08-26-pregame-input-odds-coverage-v1.json",
    sha256:
      "8bea8a2890dd6f62adb490a362daea0edc3b505649e768de5bf10a64382c7d0e",
  },
  {
    rel: "data/audits/2026-08-26-prediction-pass-reconciliation-v1.json",
    sha256:
      "236e8b99f63eb94236422e7ea5a09f392a3a20b36d9018f7919961bf718e728d",
  },
  {
    rel: "data/audits/2026-08-26-pregame-prediction-snapshot-v1.json",
    sha256:
      "a9cf5201441ce72e2a6428534357701e251c7da616e63ef3458c8da0f078070e",
  },
  {
    rel: "data/audits/2026-08-26-stage-e-result-grade-close-v1.json",
    sha256:
      "0a81f3a2b05c67851593491ed8dc683e05b836c6da3e354c1204c62d15875ec3",
  },
  {
    rel: "data/audits/2026-08-26-stage-f-success-failure-review-scorecard-v1.json",
    sha256:
      "08bb1859ab46f0ec6a1f10e28163a4083ad1bec8266bcddde575ca45ee137683",
  },
  {
    rel: "data/audits/2026-08-26-stage-g-daily-close-git-sync-v1.json",
    sha256:
      "78cf768a556996fdb9ac3703a794dd17a8de5437d673005c40f93659d1b69ffc",
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
  | "FOOTBALL_HANDICAP_3WAY"
  | "UNKNOWN";

export const SCREENSHOTS = [
  {
    file: S1,
    originalInboxName: "스크린샷 2026-08-27 211819.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "382fcc848422fdd9bcb6c3d7ea67a11059cbeca33713894f3801cb0087063f93",
    bytes: 189081,
    sourceFileCreatedAt: "2026-08-27T21:18:19.4691068+09:00",
    sourceFileModifiedAt: "2026-08-27T21:18:19.5211047+09:00",
    sourceFileNameTimestamp: "2026-08-27T21:18:19+09:00",
    displayedSourceTimestamp: null,
    sequence: 1,
  },
  {
    file: S2,
    originalInboxName: "스크린샷 2026-08-27 211829.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "969dce7b55cbe81db198316059d5a9b933df101ed0cfb9113bc500050b4ac05e",
    bytes: 171906,
    sourceFileCreatedAt: "2026-08-27T21:18:29.3718399+09:00",
    sourceFileModifiedAt: "2026-08-27T21:18:29.4218390+09:00",
    sourceFileNameTimestamp: "2026-08-27T21:18:29+09:00",
    displayedSourceTimestamp: null,
    sequence: 2,
  },
  {
    file: S3,
    originalInboxName: "스크린샷 2026-08-27 211836.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "1ba56d46931160ef898d3693250a1c975ce67d35eed9d73ef82ad017486db64d",
    bytes: 194199,
    sourceFileCreatedAt: "2026-08-27T21:18:36.7145519+09:00",
    sourceFileModifiedAt: "2026-08-27T21:18:36.7645524+09:00",
    sourceFileNameTimestamp: "2026-08-27T21:18:36+09:00",
    displayedSourceTimestamp: null,
    sequence: 3,
  },
  {
    file: S4,
    originalInboxName: "스크린샷 2026-08-27 211843.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "89a312d543355a5604d8f1853d1092e1cc58500240abed67cd81a340a7f4baf3",
    bytes: 186239,
    sourceFileCreatedAt: "2026-08-27T21:18:43.4058195+09:00",
    sourceFileModifiedAt: "2026-08-27T21:18:43.4558211+09:00",
    sourceFileNameTimestamp: "2026-08-27T21:18:43+09:00",
    displayedSourceTimestamp: null,
    sequence: 4,
  },
  {
    file: S5,
    originalInboxName: "스크린샷 2026-08-27 211850.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "c49ad683101fb739cac948e02d0a5d0f0eb4cd1e2f54593bfc07a193751e13e7",
    bytes: 178233,
    sourceFileCreatedAt: "2026-08-27T21:18:50.7837405+09:00",
    sourceFileModifiedAt: "2026-08-27T21:18:50.8369800+09:00",
    sourceFileNameTimestamp: "2026-08-27T21:18:50+09:00",
    displayedSourceTimestamp: null,
    sequence: 5,
  },
  {
    file: S6,
    originalInboxName: "스크린샷 2026-08-27 211857.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "9bfc25209c8824ea4e16b42d63b0b50b60f6cbb7330da8b8426fcec24374bd41",
    bytes: 95193,
    sourceFileCreatedAt: "2026-08-27T21:18:57.6164308+09:00",
    sourceFileModifiedAt: "2026-08-27T21:18:57.6614268+09:00",
    sourceFileNameTimestamp: "2026-08-27T21:18:57+09:00",
    displayedSourceTimestamp: null,
    sequence: 6,
  },
] as const;

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
  extra?: { rawValueStatus?: "VISIBLE" | "FIELD_REVIEW_REQUIRED" },
) {
  return {
    rawMarketLabel,
    marketType,
    line,
    homePrice,
    drawPrice,
    awayPrice,
    rawValueStatus: extra?.rawValueStatus ?? ("VISIBLE" as const),
    screenshotFile,
    rowIds,
  };
}

function bb(
  rawLeagueLabel: string,
  displayedStartKst: string,
  rawHome: string,
  rawAway: string,
  screenshot: string,
  markets: ReturnType<typeof ml>[],
  extra?: {
    overlapScreenshots?: string[];
    teamLabelStatus?: "VISIBLE" | "FIELD_REVIEW_REQUIRED" | "OWNER_EXPLICIT_CONFIRMATION";
    leagueLabelStatus?: "VISIBLE" | "FIELD_REVIEW_REQUIRED";
    reviewNotes?: string[];
  },
) {
  return {
    sport: "BASKETBALL" as const,
    rawLeagueLabel,
    displayedDateKst: SLATE_DATE_KST,
    displayedStartKst,
    rawHomeLabel: rawHome,
    rawAwayLabel: rawAway,
    rawMatchup:
      rawHome === "FIELD_REVIEW_REQUIRED" || rawAway === "FIELD_REVIEW_REQUIRED"
        ? "FIELD_REVIEW_REQUIRED"
        : `${rawHome} : ${rawAway}`,
    screenshot,
    markets,
    overlapScreenshots: extra?.overlapScreenshots ?? [],
    teamLabelStatus: extra?.teamLabelStatus ?? ("VISIBLE" as const),
    leagueLabelStatus: extra?.leagueLabelStatus ?? ("VISIBLE" as const),
    reviewNotes: extra?.reviewNotes ?? [],
  };
}

function fb(
  rawLeagueLabel: string,
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
    displayedDateKst: SLATE_DATE_KST,
    displayedStartKst,
    rawHome,
    rawAway,
    rawHomeLabel: rawHome,
    rawAwayLabel: rawAway,
    rawMatchup: `${rawHome} : ${rawAway}`,
    rawHomeSecondaryVisible: null as string | null,
    screenshot,
    identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED" as const,
    mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH" as const,
    competitionRegistryJoin: "NOT_ATTEMPTED" as const,
    markets,
    overlapScreenshots: extra?.overlapScreenshots ?? [],
  };
}

function mlbGame(
  displayedStartKst: string,
  rawHome: string,
  rawAway: string,
  screenshot: string,
  markets: ReturnType<typeof ml>[],
  extra?: { overlapScreenshots?: string[] },
) {
  return {
    sport: "MLB" as const,
    rawLeagueLabel: "MLB",
    displayedDateKst: SLATE_DATE_KST,
    displayedStartKst,
    rawHomeLabel: rawHome,
    rawAwayLabel: rawAway,
    rawMatchup: `${rawHome} : ${rawAway}`,
    screenshot,
    markets,
    overlapScreenshots: extra?.overlapScreenshots ?? [],
  };
}

const BASKETBALL_GAMES = [
  bb("남농월예", "00:30", "핀란드M", "스웨덴M", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 1.19, null, 3.38, S1, [6866]),
    ml("H -7.5", "UNKNOWN", -7.5, 1.75, null, 1.77, S1, [6867]),
    ml("U 171.5", "TOTALS", 171.5, 1.78, null, 1.74, S1, [6868]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [6869]),
  ]),
  bb("남농월예", "01:00", "헝가리M", "에스토M", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 1.46, null, 2.22, S1, [6880]),
    ml("H -3.5", "UNKNOWN", -3.5, 1.76, null, 1.76, S1, [6881]),
    ml("U 160.5", "TOTALS", 160.5, 1.79, null, 1.73, S1, [6882]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [6883]),
  ]),
  bb("남농월예", "01:00", "카타르M", "중국M", S1, [
    ml("승패", "MONEYLINE_2WAY", null, 5.44, null, 1.05, S1, [6884]),
    ml("H +14.5", "UNKNOWN", 14.5, 1.79, null, 1.73, S1, [6885]),
    ml("U 161.5", "TOTALS", 161.5, 1.78, null, 1.74, S1, [6886]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [6887]),
  ]),
  bb("남농월예", "02:00", "사우디M", "일본M", S2, [
    ml("승패", "MONEYLINE_2WAY", null, 6.84, null, 1.01, S2, [6913]),
    ml("H +18.5", "UNKNOWN", 18.5, 1.79, null, 1.73, S2, [6914]),
    ml("U 163.5", "TOTALS", 163.5, 1.76, null, 1.76, S2, [6915]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [6916]),
  ]),
  bb("남농월예", "03:00", "크로아M", "라트비M", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.01, null, 6.84, S3, [6937]),
    ml("H -15.5", "UNKNOWN", -15.5, 1.73, null, 1.79, S3, [6938]),
    ml("U 175.5", "TOTALS", 175.5, 1.74, null, 1.78, S3, [6939]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S3, [6940]),
  ]),
  bb("남농월예", "03:00", "독일M", "네덜란M", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.0, null, 1.0, S3, [6941]),
    ml("H -26.5", "UNKNOWN", -26.5, 1.76, null, 1.76, S3, [6942]),
    ml("U 175.5", "TOTALS", 175.5, 1.74, null, 1.78, S3, [6943]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S3, [6944]),
  ]),
  bb("남농월예", "03:00", "이스라M", "폴란드M", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 2.4, null, 1.39, S3, [6945]),
    ml("H +4.5", "UNKNOWN", 4.5, 1.75, null, 1.77, S3, [6946]),
    ml("U 169.5", "TOTALS", 169.5, 1.78, null, 1.74, S3, [6947]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S3, [6948]),
  ]),
  bb("남농월예", "03:00", "레바논M", "한국M", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.26, null, 2.92, S3, [6949]),
    ml("H -6.5", "UNKNOWN", -6.5, 1.79, null, 1.73, S3, [6950]),
    ml("U 162.5", "TOTALS", 162.5, 1.77, null, 1.75, S3, [6951]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S3, [6952]),
  ]),
  bb(
    "남농월예",
    "03:30",
    "프랑스M",
    "슬로베M",
    S4,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.0, null, 1.0, S4, [6973]),
      ml("H -23.5", "UNKNOWN", -23.5, 1.77, null, 1.75, S4, [6974]),
      ml("U 174.5", "TOTALS", 174.5, 1.77, null, 1.75, S4, [6975]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S4, [6976]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Screenshot 4 league glyph also read as 남농원예 on one pass. Not silently normalized.",
      ],
    },
  ),
  bb(
    "남농월예",
    "07:10",
    "아르헨M",
    "푸에르M",
    S4,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.14, null, 3.86, S4, [6983]),
      ml("H -8.5", "UNKNOWN", -8.5, 1.75, null, 1.77, S4, [6984]),
      ml("U 169.5", "TOTALS", 169.5, 1.77, null, 1.75, S4, [6985]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S4, [6986]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Screenshot 4 league glyph also read as 남농원예 on one pass. Not silently normalized.",
      ],
    },
  ),
  bb(
    "남농월예",
    "08:10",
    "칠레M",
    "미국M",
    S5,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.0, null, 1.0, S5, [7002]),
      ml("H +24.5", "UNKNOWN", 24.5, 1.78, null, 1.74, S5, [7003]),
      ml("U 176.5", "TOTALS", 176.5, 1.73, null, 1.79, S5, [7004]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S5, [7005]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Screenshot 5 league glyph also read as 남농원예 on one pass. Not silently normalized.",
      ],
    },
  ),
  bb(
    "남농월예",
    "08:10",
    "브라질M",
    "도미공M",
    S5,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.38, null, 2.43, S5, [7006]),
      ml("H -5.5", "UNKNOWN", -5.5, 1.75, null, 1.77, S5, [7007]),
      ml("U 171.5", "TOTALS", 171.5, 1.75, null, 1.77, S5, [7008]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S5, [7009]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Screenshot 5 league glyph also read as 남농원예 on one pass. Not silently normalized.",
      ],
    },
  ),
  bb(
    "남농월예",
    "08:10",
    "우루과M",
    "바하마M",
    S5,
    [
      ml("승패", "MONEYLINE_2WAY", null, 2.56, null, 1.34, S5, [7010]),
      ml("H +5.5", "UNKNOWN", 5.5, 1.76, null, 1.76, S5, [7011]),
      ml("U 178.5", "TOTALS", 178.5, 1.73, null, 1.79, S5, [7012]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S5, [7013]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Screenshot 5 league glyph also read as 남농원예 on one pass. Not silently normalized.",
      ],
    },
  ),
  bb(
    "남농월예",
    "10:40",
    "파나마",
    "캐나다",
    S6,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.0, null, 1.0, S6, [7023]),
      ml("H +26.5", "UNKNOWN", 26.5, 1.81, null, 1.71, S6, [7024]),
      ml("U 176.5", "TOTALS", 176.5, 1.77, null, 1.75, S6, [7025]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S6, [7026]),
    ],
    {
      teamLabelStatus: "OWNER_EXPLICIT_CONFIRMATION",
      reviewNotes: [
        "OWNER_EXPLICIT_CONFIRMATION for screenshot-6 10:40 labels: 파나마 vs 캐나다. Market IDs 7023-7026. Do not translate or substitute.",
      ],
    },
  ),
  bb(
    "남농월예",
    "11:10",
    "멕시코",
    "콜롬비아",
    S6,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.24, null, 3.03, S6, [7019]),
      ml("H -6.5", "UNKNOWN", -6.5, 1.71, null, 1.81, S6, [7020]),
      ml("U 165.5", "TOTALS", 165.5, 1.77, null, 1.75, S6, [7021]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S6, [7022]),
    ],
    {
      teamLabelStatus: "OWNER_EXPLICIT_CONFIRMATION",
      reviewNotes: [
        "OWNER_EXPLICIT_CONFIRMATION for screenshot-6 11:10 labels: 멕시코 vs 콜롬비아. Market IDs 7019-7022. Do not translate or substitute.",
      ],
    },
  ),
];

const FOOTBALL_GAMES = [
  fb("UEL", "01:00", "아라라트", "U크라이", S1, [
    ml("1X2", "ONE_X_TWO", null, 3.5, 3.2, 1.81, S1, [6870]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.77, 3.6, 3.25, S1, [6871]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.25, 5.0, 6.7, S1, [6872]),
    ml("U 2.5", "TOTALS", 2.5, 1.6, null, 1.96, S1, [6873]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S1, [6874]),
  ]),
  fb("UEL", "01:00", "이베리아", "야기엘로", S1, [
    ml("1X2", "ONE_X_TWO", null, 3.0, 3.2, 1.99, S1, [6875]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.66, 3.85, 3.5, S1, [6876]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.21, 5.3, 7.4, S1, [6877]),
    ml("U 2.5", "TOTALS", 2.5, 1.96, null, 1.6, S1, [6878]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S1, [6879]),
  ]),
  fb("UEL", "02:00", "오모니아", "신트트라", S1, [
    ml("1X2", "ONE_X_TWO", null, 1.83, 3.15, 3.5, S1, [6888]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.45, 3.35, 1.78, S1, [6889]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 7.9, 5.3, 1.2, S1, [6890]),
    ml("U 2.5", "TOTALS", 2.5, 1.68, null, 1.85, S1, [6891]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S1, [6892]),
  ]),
  fb(
    "UEL",
    "02:00",
    "플젠",
    "츠르베나",
    S1,
    [
      ml("1X2", "ONE_X_TWO", null, 2.03, 3.35, 2.8, S1, [6893]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.5, 4.0, 1.63, S1, [6894]),
      ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 6.6, 5.4, 1.23, S1, [6895]),
      ml("U 2.5", "TOTALS", 2.5, 2.07, null, 1.53, S1, [6896]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [6897]),
    ],
    { overlapScreenshots: [S1, S2] },
  ),
  fb("UEL", "02:00", "릴레스트", "에그나티", S2, [
    ml("1X2", "ONE_X_TWO", null, 1.41, 3.75, 5.8, S2, [6898]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.29, 3.2, 2.5, S2, [6899]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 4.25, 4.05, 1.5, S2, [6900]),
    ml("U 2.5", "TOTALS", 2.5, 1.89, null, 1.65, S2, [6901]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S2, [6902]),
  ]),
  fb("UEL", "02:00", "잘츠부르", "미엘뷔", S2, [
    ml("1X2", "ONE_X_TWO", null, 1.15, 5.6, 9.9, S2, [6903]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.57, 4.0, 3.8, S2, [6904]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 2.35, 3.8, 2.17, S2, [6905]),
    ml("U 3.5", "TOTALS", 3.5, 1.56, null, 2.02, S2, [6906]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [6907]),
  ]),
  fb("UEL", "02:00", "카우노잘", "베식타시", S2, [
    ml("1X2", "ONE_X_TWO", null, 6.7, 3.85, 1.35, S2, [6908]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 2.8, 3.35, 2.03, S2, [6909]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.61, 3.9, 3.7, S2, [6910]),
    ml("U 2.5", "TOTALS", 2.5, 1.86, null, 1.67, S2, [6911]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S2, [6912]),
  ]),
  fb("UEL", "03:00", "FC툰", "L포즈난", S2, [
    ml("1X2", "ONE_X_TWO", null, 2.65, 3.35, 2.11, S2, [6922]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.58, 3.8, 3.95, S2, [6923]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.15, 6.0, 8.8, S2, [6924]),
    ml("U 2.5", "TOTALS", 2.5, 2.13, null, 1.5, S2, [6925]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [6926]),
  ]),
  fb("UEL", "03:00", "오르후스", "SL벤피카", S3, [
    ml("1X2", "ONE_X_TWO", null, 5.9, 4.3, 1.34, S3, [6927]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 2.65, 3.7, 1.99, S3, [6928]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.68, 4.0, 3.3, S3, [6929]),
    ml("U 3.5", "TOTALS", 3.5, 1.51, null, 2.11, S3, [6930]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S3, [6931]),
  ]),
  fb("UEL", "03:00", "C소피아", "OFI크레", S3, [
    ml("1X2", "ONE_X_TWO", null, 1.37, 3.8, 6.4, S3, [6932]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.21, 3.2, 2.6, S3, [6933]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 4.05, 3.95, 1.54, S3, [6934]),
    ml("U 2.5", "TOTALS", 2.5, 1.86, null, 1.67, S3, [6935]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S3, [6936]),
  ]),
  fb("UEL", "03:30", "페렌츠바", "트라브존", S4, [
    ml("1X2", "ONE_X_TWO", null, 2.75, 3.15, 2.14, S4, [6958]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.6, 3.75, 3.9, S4, [6959]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.17, 5.6, 8.7, S4, [6960]),
    ml("U 2.5", "TOTALS", 2.5, 1.76, null, 1.76, S4, [6961]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6962]),
  ]),
  fb("UEL", "03:30", "안더레흐", "카이라트", S4, [
    ml("1X2", "ONE_X_TWO", null, 1.31, 4.4, 6.3, S4, [6963]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.03, 3.5, 2.7, S4, [6964]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 3.6, 4.0, 1.61, S4, [6965]),
    ml("U 2.5", "TOTALS", 2.5, 1.91, null, 1.63, S4, [6966]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6967]),
  ]),
  fb("라리가", "03:30", "셀타비고", "오사수나", S4, [
    ml("1X2", "ONE_X_TWO", null, 1.86, 3.15, 3.55, S4, [6968]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.55, 3.3, 1.77, S4, [6969]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 8.1, 5.4, 1.19, S4, [6970]),
    ml("U 2.5", "TOTALS", 2.5, 1.54, null, 2.11, S4, [6971]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S4, [6972]),
  ]),
  fb("라리가", "04:00", "바르셀로", "A빌바오", S4, [
    ml("1X2", "ONE_X_TWO", null, 1.18, 5.5, 9.3, S4, [6977]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.57, 4.0, 3.8, S4, [6978]),
    ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 2.4, 3.75, 2.15, S4, [6979]),
    ml("H -3.5", "UNKNOWN", -3.5, 4.4, null, 1.1, S4, [6980]),
    ml("U 3.5", "TOTALS", 3.5, 1.68, null, 1.89, S4, [6981]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S4, [6982]),
  ]),
];

const MLB_GAMES = [
  mlbGame("02:05", "워싱내셔", "콜로로키", S2, [
    ml("승패", "MONEYLINE_2WAY", null, 1.68, null, 1.85, S2, [6917]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.35, 3.35, 2.35, S2, [6918]),
    ml("H -2.5", "RUN_LINE", -2.5, 3.23, null, 1.21, S2, [6919]),
    ml("U 9.5", "TOTALS", 9.5, 1.67, null, 1.86, S2, [6920]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S2, [6921]),
  ]),
  mlbGame("03:15", "세인카디", "볼티오리", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.82, null, 1.7, S3, [6953]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.7, 3.25, 2.12, S3, [6954]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.28, null, 2.82, S3, [6955]),
    ml("U 8.5", "TOTALS", 8.5, 1.67, null, 1.86, S3, [6956]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S3, [6957]),
  ]),
  mlbGame(
    "08:05",
    "뉴욕양키",
    "휴스애스",
    S4,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.48, null, 2.17, S4, [6987]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.0, 3.35, 2.85, S5, [6988]),
      ml("H -2.5", "RUN_LINE", -2.5, 2.68, null, 1.31, S5, [6989]),
      ml("U 8.5", "TOTALS", 8.5, 1.7, null, 1.82, S5, [6990]),
      ml("SUM", "SUM", null, 1.59, null, 2.07, S5, [6991]),
    ],
    { overlapScreenshots: [S4, S5] },
  ),
  mlbGame("08:07", "토론블루", "캔자로얄", S5, [
    ml("승패", "MONEYLINE_2WAY", null, 1.77, null, 1.75, S5, [6992]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.55, 3.25, 2.22, S5, [6993]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.25, null, 2.97, S5, [6994]),
    ml("U 8.5", "TOTALS", 8.5, 1.66, null, 1.87, S5, [6995]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S5, [6996]),
  ]),
  mlbGame("08:10", "뉴욕메츠", "밀워브루", S5, [
    ml("승패", "MONEYLINE_2WAY", null, 2.72, null, 1.3, S5, [6997]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 4.6, 3.5, 1.55, S5, [6998]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.59, null, 1.97, S5, [6999]),
    ml("U 7.5", "TOTALS", 7.5, 1.7, null, 1.82, S5, [7000]),
    ml("SUM", "SUM", null, 1.6, null, 2.06, S5, [7001]),
  ]),
  mlbGame("08:15", "애틀브레", "LA다저스", S5, [
    ml("승패", "MONEYLINE_2WAY", null, 1.75, null, 1.77, S5, [7014]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.55, 3.15, 2.27, S5, [7015]),
    ml("H -2.5", "RUN_LINE", -2.5, 3.65, null, 1.16, S5, [7016]),
    ml("U 7.5", "TOTALS", 7.5, 1.55, null, 2.04, S5, [7017]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S5, [7018]),
  ]),
  mlbGame("10:45", "샌프자이", "애리다이", S6, [
    ml("승패", "MONEYLINE_2WAY", null, 1.82, null, 1.7, S6, [7027]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.65, 3.25, 2.15, S6, [7028]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.27, null, 2.87, S6, [7029]),
    ml("U 7.5", "TOTALS", 7.5, 1.87, null, 1.66, S6, [7030]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S6, [7031]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.1, 5.7, 2.01, S6, [7032]),
    ml("h H +1.5", "RUN_LINE", 1.5, 1.26, null, 2.92, S6, [7033]),
    ml("h U 4.5", "TOTALS", 4.5, 1.78, null, 1.74, S6, [7034]),
  ]),
];

function provenance(file: string) {
  const shot = screenshotMeta(file);
  return {
    screenshotFile: shot.file,
    screenshotSha256: shot.sha256,
    screenshotRel: `${RAW_REL}/${shot.file}`,
    sourceScreenshotSha: shot.sha256,
    originalInboxName: shot.originalInboxName,
    sourceFileCreatedAt: shot.sourceFileCreatedAt,
    sourceFileModifiedAt: shot.sourceFileModifiedAt,
    sourceFileNameTimestamp: shot.sourceFileNameTimestamp,
    displayedSourceTimestamp: shot.displayedSourceTimestamp,
    formalObservedAt: FORMAL_OBSERVED_AT,
    intakeStartedAt: INTAKE_STARTED_AT,
    operatorObservedAt: FORMAL_OBSERVED_AT,
    receivedAtKst: INTAKE_STARTED_AT_KST,
  };
}

function decorateMarkets(markets: ReturnType<typeof ml>[]) {
  return markets.map((m) => {
    const shot = screenshotMeta(m.screenshotFile);
    return {
      ...m,
      sourceScreenshotSha: shot.sha256,
      originalInboxName: shot.originalInboxName,
      formalObservedAt: FORMAL_OBSERVED_AT,
      sourceFileModifiedAt: shot.sourceFileModifiedAt,
      marketBenchmarkOnly: true as const,
      predictionInput: false as const,
      engineInput: false as const,
      observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION" as const,
    };
  });
}

function commonRowFlags() {
  return {
    sourceType: "MANUAL_OPERATOR_OBSERVATION" as const,
    observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION" as const,
    marketBenchmarkOnly: true as const,
    predictionInput: false as const,
    engineInput: false as const,
    formalObservedAt: FORMAL_OBSERVED_AT,
    scheduledStartAt: null,
    pregameEligibilityStatus: "PREGAME_ELIGIBILITY_UNRESOLVED" as const,
    timingClass: TIMING_CLASS,
    fuzzyMatchingUsed: false as const,
    pick: null,
    yangPick: null,
    recommendation: null,
  };
}

function decorateBasketball(g: (typeof BASKETBALL_GAMES)[number]) {
  return {
    ...commonRowFlags(),
    ...provenance(g.screenshot),
    sport: g.sport,
    rawLeagueLabel: g.rawLeagueLabel,
    displayedDateKst: g.displayedDateKst,
    displayedStartKst: g.displayedStartKst,
    rawHomeLabel: g.rawHomeLabel,
    rawAwayLabel: g.rawAwayLabel,
    rawMatchup: g.rawMatchup,
    identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED" as const,
    mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH" as const,
    canonicalHome: null,
    canonicalAway: null,
    gamePk: null,
    internalGameId: null,
    teamLabelStatus: g.teamLabelStatus,
    leagueLabelStatus: g.leagueLabelStatus,
    reviewNotes: g.reviewNotes,
    overlapScreenshots: g.overlapScreenshots,
    markets: decorateMarkets(g.markets),
  };
}

function decorateFootball(g: (typeof FOOTBALL_GAMES)[number]) {
  return {
    ...commonRowFlags(),
    ...provenance(g.screenshot),
    sport: g.sport,
    rawLeagueLabel: g.rawLeagueLabel,
    displayedDateKst: g.displayedDateKst,
    displayedStartKst: g.displayedStartKst,
    rawHome: g.rawHome,
    rawAway: g.rawAway,
    rawHomeLabel: g.rawHomeLabel,
    rawAwayLabel: g.rawAwayLabel,
    rawMatchup: g.rawMatchup,
    rawHomeSecondaryVisible: g.rawHomeSecondaryVisible,
    identityStatus: g.identityStatus,
    mappingStatus: g.mappingStatus,
    competitionRegistryJoin: g.competitionRegistryJoin,
    matchId: null,
    overlapScreenshots: g.overlapScreenshots,
    markets: decorateMarkets(g.markets),
  };
}

function decorateMlb(g: (typeof MLB_GAMES)[number]) {
  const canonicalHome = canonicalDomesticTeam(g.rawHomeLabel);
  const canonicalAway = canonicalDomesticTeam(g.rawAwayLabel);
  const aliasMatched = canonicalHome !== null && canonicalAway !== null;
  return {
    ...commonRowFlags(),
    ...provenance(g.screenshot),
    sport: g.sport,
    rawLeagueLabel: g.rawLeagueLabel,
    displayedDateKst: g.displayedDateKst,
    displayedStartKst: g.displayedStartKst,
    rawHomeLabel: g.rawHomeLabel,
    rawAwayLabel: g.rawAwayLabel,
    rawMatchup: g.rawMatchup,
    identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED" as const,
    mappingStatus: aliasMatched
      ? ("TEAM_ALIAS_MATCHED_NO_SCHEDULE" as const)
      : ("NO_SCHEDULE_JOIN_THIS_BATCH" as const),
    canonicalHome,
    canonicalAway,
    gamePk: null,
    internalGameId: null,
    doubleheaderRisk: "UNKNOWN_NO_SCHEDULE" as const,
    overlapScreenshots: g.overlapScreenshots,
    markets: decorateMarkets(g.markets),
  };
}

function countMarkets(
  games: { markets: { rowIds: number[] }[] }[],
): number {
  return games.reduce(
    (n, g) => n + g.markets.reduce((m, x) => m + x.rowIds.length, 0),
    0,
  );
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
    const inboxBytes = readFileSync(inboxAbs).byteLength;
    if (inboxBytes !== shot.bytes) {
      throw new Error(`INBOX_BYTE_MISMATCH: ${shot.originalInboxName}`);
    }
  }

  for (const sealed of SEALED_2026_08_26) {
    const abs = path.join(cwd, sealed.rel);
    if (!existsSync(abs)) {
      throw new Error(`SEALED_2026_08_26_MISSING: ${sealed.rel}`);
    }
    const sha = sha256File(abs);
    if (sha !== sealed.sha256) {
      throw new Error(`SEALED_2026_08_26_MUTATED: ${sealed.rel}`);
    }
  }

  const basketballRows = BASKETBALL_GAMES.map(decorateBasketball);
  const footballRows = FOOTBALL_GAMES.map(decorateFootball);
  const mlbRows = MLB_GAMES.map(decorateMlb);

  const rowsObserved = countMarkets([
    ...BASKETBALL_GAMES,
    ...FOOTBALL_GAMES,
    ...MLB_GAMES,
  ]);
  const unreadableMatchups = basketballRows.filter(
    (r) => r.teamLabelStatus === "FIELD_REVIEW_REQUIRED",
  ).length;
  const mlbAliasMatched = mlbRows.filter(
    (r) => r.mappingStatus === "TEAM_ALIAS_MATCHED_NO_SCHEDULE",
  ).length;

  const summary = {
    screenshots: SCREENSHOTS.length,
    oddsScreenshots: 6,
    lineupScreenshots: 0,
    rowsObserved,
    rowsParsed: rowsObserved,
    rowsIdentityMatched: 0,
    rowsIdentityReviewRequired: basketballRows.length + footballRows.length + mlbRows.length,
    rowsPregameEligible: 0,
    rowsPostStart: 0,
    rowsPregameEligibilityUnresolved:
      basketballRows.length + footballRows.length + mlbRows.length,
    unreadableGameRows: unreadableMatchups,
    reviewRequiredSections: 3,
    mlbOddsMatchups: mlbRows.length,
    mlbOddsAliasMatched: mlbAliasMatched,
    mlbOddsAliasFailed: mlbRows.length - mlbAliasMatched,
    mlbGamePkJoined: 0,
    basketballOddsFixtures: basketballRows.length,
    footballOddsFixtures: footballRows.length,
    footballJoined: 0,
    volleyballOddsFixtures: 0,
    npbOddsGames: 0,
    kboOddsGames: 0,
    expectedLineups: 0,
    confirmedLineups: 0,
    overlapGamesDeduped: 2,
    shaDuplicates: 0,
    rawMutation: 0,
    predictionInputTrue: 0,
    predictionCreated: 0,
    fuzzyMatchingUsed: false,
    inventedOddsFields: 0,
    inventedTeamIdentities: 0,
    providerCallCount: 0,
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
  };

  const document = {
    schemaVersion: "yang-edge-next-pregame-observation-v0",
    batchId: BATCH_ID,
    dateKst: DATE_KST,
    receivedDateKst: RECEIVED_DATE_KST,
    slateDateKst: SLATE_DATE_KST,
    intendedOperatingDateKst: SLATE_DATE_KST,
    dateClassification: "DATE_DISPLAYED_NOT_SCOPE_LOCKED",
    dateClassificationReason:
      "On-screen betting date is 08.28(금). Inbox folder is 2026-08-28. Screenshot filenames are 2026-08-27 21:18 KST. formalObservedAt is the frozen intake clock, not file mtime and not filename time. Daily Scope is not locked in this mission.",
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    observedAt: INTAKE_STARTED_AT_UTC,
    operatorObservedAt: FORMAL_OBSERVED_AT,
    captureTime: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    autoApply: false,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    predictionAlreadyFrozen: false,
    officialPredictionHash: null,
    officialPredictionRel: null,
    observationPhase: "PREGAME_CURRENT_STATE_RECOVERY",
    timingClass: TIMING_CLASS,
    availableAtPredictionFreeze: null,
    availableBeforeKickoff: null,
    scopeLockStatus: SCOPE_STATUS,
    status: STATUS,
    fuzzyMatchingUsed: false,
    providerCallCount: 0,
    predictionCreated: 0,
    expectedConfirmedSeparation:
      "No lineup screenshots in this batch. EXPECTED and CONFIRMED arrays remain empty.",
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_GIT_EXCLUDE,
    note: "2026-08-28 current-state recovery and manual odds intake. Inbox screenshots copied byte-identical. RAW PNG copies are LOCAL-ONLY and must not be committed to public GitHub. No schedule/result/prediction/odds-provider calls in the intake writer. MLB aliases recorded where exact; fixture/gamePk join is the slate-recovery writer. Displayed kickoff is not treated as scheduledStartAt until schedule join. Screenshot 6 two basketball matchups need owner glyph confirmation. Do not lock Daily Scope from these odds rows.",
    summary,
    screenshots: SCREENSHOTS.map((s) => ({
      file: s.file,
      originalInboxName: s.originalInboxName,
      category: s.category,
      sha256: s.sha256,
      bytes: s.bytes,
      sourceFileCreatedAt: s.sourceFileCreatedAt,
      sourceFileModifiedAt: s.sourceFileModifiedAt,
      sourceFileNameTimestamp: s.sourceFileNameTimestamp,
      displayedSourceTimestamp: s.displayedSourceTimestamp,
      formalObservedAt: FORMAL_OBSERVED_AT,
      intakeStartedAt: INTAKE_STARTED_AT,
      operatorObservedAt: FORMAL_OBSERVED_AT,
      receivedAtKst: INTAKE_STARTED_AT_KST,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      engineInput: false,
      marketBenchmarkOnly: true,
      source: "MANUAL_SCREENSHOT",
      sequence: s.sequence,
      rel: `${RAW_REL}/${s.file}`,
    })),
    overlapDedup: {
      method: "EVENT_IDENTITY_DISPLAYED_DATE_START_LEAGUE_HOME_AWAY",
      duplicateGameIdentitiesRemoved: 2,
      overlappingGames: [
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "플젠 : 츠르베나",
          screenshots: [S1, S2],
        },
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "뉴욕양키 : 휴스애스",
          screenshots: [S4, S5],
        },
      ],
    },
    reviewRequired: [
      {
        status: "OWNER_EXPLICIT_CONFIRMATION",
        section: "SCREENSHOT_6_BASKETBALL_TEAM_GLYPHS",
        marketIds: [7019, 7020, 7021, 7022, 7023, 7024, 7025, 7026],
        gamesInventedFromGap: 0,
        note: "OWNER confirmed 10:40 파나마 vs 캐나다 (7023-7026) and 11:10 멕시코 vs 콜롬비아 (7019-7022). Labels stored exactly. Not translated.",
      },
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "SCREENSHOT_6_MARKET_ID_VISUAL_ORDER",
        afterLastFullyVisiblePriorMarketId: 7018,
        marketIdsGroupedOnScreenshot6: [
          7019, 7020, 7021, 7022, 7023, 7024, 7025, 7026, 7027, 7028, 7029,
          7030, 7031, 7032, 7033, 7034,
        ],
        gamesInventedFromGap: 0,
        note: "IDs 7019-7034 are all preserved. Visual top-to-bottom order vs ID order needs owner confirmation. No missing IDs were invented.",
      },
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "BASKETBALL_LEAGUE_GLYPH_월예_VS_원예",
        note: "Screenshots 1-3 read 남농월예. Screenshots 4-5 also produced 남농원예 on one visual pass. Label stored as 남농월예 with leagueLabelStatus FIELD_REVIEW_REQUIRED on later games. Not treated as two competitions.",
      },
    ],
    basketballOddsFixtures: basketballRows,
    footballOddsFixtures: footballRows,
    mlbOddsGames: mlbRows,
    volleyballOddsFixtures: [],
    npbOddsGames: [],
    kboOddsGames: [],
    expectedLineups: [],
    confirmedLineups: [],
    footballByLeague: footballByLeague(FOOTBALL_GAMES),
    nextOperatingDay: {
      readyToLockDailyScope: false,
      scheduleJoinRequired: true,
      mlbSchedulePresent: false,
      footballSchedulePresent: false,
      basketballSchedulePresent: false,
      predictionPresent: false,
      mandatoryPercentComputed: false,
    },
  };

  const manifest = {
    schemaVersion: "yang-edge-inbox-raw-batch-v1",
    batchId: BATCH_ID,
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    receivedAtKst: INTAKE_STARTED_AT_KST,
    captureTime: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    sourceType: "MANUAL_OPERATOR_OBSERVATION",
    observationKind: "MANUAL_OPERATOR_MARKET_OBSERVATION",
    source: "MANUAL_SCREENSHOT",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    predictionAlreadyFrozen: false,
    predictionHash: null,
    observationPhase: "PREGAME_CURRENT_STATE_RECOVERY",
    timingClass: TIMING_CLASS,
    officialPredictionRel: null,
    availableAtPredictionFreeze: null,
    availableBeforeKickoff: null,
    slateDateKst: SLATE_DATE_KST,
    receivedDateKst: RECEIVED_DATE_KST,
    inboxPath: INBOX_PATH,
    screenshotCount: SCREENSHOTS.length,
    notes: [
      "Raw screenshots copied byte-identical from INBOX. SHA-256 verified on copy. Inbox originals were not moved, renamed, deleted, overwritten, compressed, or edited.",
      "formalObservedAt = frozen intakeStartedAt. Filesystem mtime and filename 21:18 timestamps are provenance only.",
      "Inbox folder 2026-08-28 is drop location. On-screen 08.28(금) is displayed slate date, not a locked Daily Scope.",
      "No Prediction / Engine / Weights / Result / schedule-provider work in this batch.",
    ],
    files: SCREENSHOTS.map((s) => ({
      file: s.file,
      originalInboxName: s.originalInboxName,
      category: s.category,
      sha256: s.sha256,
      bytes: s.bytes,
      sourceFileCreatedAt: s.sourceFileCreatedAt,
      sourceFileModifiedAt: s.sourceFileModifiedAt,
      sourceFileNameTimestamp: s.sourceFileNameTimestamp,
      displayedSourceTimestamp: s.displayedSourceTimestamp,
      formalObservedAt: FORMAL_OBSERVED_AT,
      intakeStartedAt: INTAKE_STARTED_AT,
      operatorObservedAt: FORMAL_OBSERVED_AT,
      receivedAtKst: INTAKE_STARTED_AT_KST,
      timingClass: TIMING_CLASS,
      predictionInput: false,
      engineInput: false,
      marketBenchmarkOnly: true,
      duplicateSource: false,
      copiedAs: `${RAW_REL}/${s.file}`,
      copiedBytes: s.bytes,
      copiedSha256: s.sha256,
      copyIntegrity: "PASS",
    })),
  };

  const readme = `YANG EDGE — 2026-08-28 Pregame Current-State Recovery Raw Batch
batchId: ${BATCH_ID}
Inbox: ${INBOX_PATH}\\
intakeStartedAt / formalObservedAt: ${INTAKE_STARTED_AT}
captureTimeSource: ${CAPTURE_TIME_SOURCE}
slateDateKst: ${SLATE_DATE_KST}
observationPhase: PREGAME_CURRENT_STATE_RECOVERY
predictionInput: false
engineInput: false
marketBenchmarkOnly: true
scopeLockStatus: ${SCOPE_STATUS}
status: ${STATUS}

Contents
- 6 domestic-odds screenshots (football / basketball / MLB)
- 0 lineup screenshots

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. Odds provenance = MANUAL_OPERATOR_OBSERVATION / MANUAL_OPERATOR_MARKET_OBSERVATION.
3. researchOnly = true, engineAdmission = PROHIBITED, predictionInput = false, engineInput = false.
4. formalObservedAt is the frozen intake clock. Do not treat file mtime as observedAt.
5. Do not lock 2026-08-28 Daily Scope from these odds rows.
6. Screenshot-6 10:40/11:10 basketball labels are OWNER_EXPLICIT_CONFIRMATION only. Do not translate or substitute.
7. Do not call Odds/Starter/Lineup/Result/Grade/Review/Engine/Prediction providers in this batch.
8. RAW PNG copies are LOCAL-ONLY owner-provided evidence. Public Git tracks hashes + structured observations only.
`;

  const recoveryAudit = {
    schemaVersion: "yang-edge-pregame-current-state-recovery-v1",
    dateKst: DATE_KST,
    baseCommit: REQUIRED_BASE_COMMIT,
    batchId: BATCH_ID,
    status: STATUS,
    rawEvidenceStorage: RAW_EVIDENCE_STORAGE,
    repositoryEvidence: REPOSITORY_EVIDENCE,
    originalInboxPath: INBOX_PATH,
    pngGitTracking: "LOCAL_EXCLUDE_NOT_PUBLIC_GITHUB",
    pngGitExcludeRule: PNG_GIT_EXCLUDE,
    statusReason:
      "Inbox inventory and byte-identical copies are complete. RAW PNG copies are local-only. Readable odds rows are preserved with provenance. Screenshot-6 basketball labels 파나마 vs 캐나다 and 멕시코 vs 콜롬비아 are OWNER_EXPLICIT_CONFIRMATION. Fixture identity join is applied by slate recovery, not this intake writer. Daily Scope is not locked in this intake writer.",
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    inboxPath: INBOX_PATH,
    inboxFileCount: SCREENSHOTS.length,
    existing20260828ArtifactsBeforeWork: [],
    sourceFiles: SCREENSHOTS.map((s) => ({
      exactFilename: s.originalInboxName,
      copiedAs: s.file,
      extension: ".png",
      bytes: s.bytes,
      sha256: s.sha256,
      filesystemCreationTime: s.sourceFileCreatedAt,
      filesystemModifiedTime: s.sourceFileModifiedAt,
      sourceFileNameTimestamp: s.sourceFileNameTimestamp,
      displayedSourceTimestamp: s.displayedSourceTimestamp,
      formalObservedAt: FORMAL_OBSERVED_AT,
      filesystemTimestampAuthoritativeForObservedAt: false,
    })),
    rowsObserved: summary.rowsObserved,
    rowsParsed: summary.rowsParsed,
    rowsIdentityMatched: summary.rowsIdentityMatched,
    rowsIdentityReviewRequired: summary.rowsIdentityReviewRequired,
    rowsPregameEligible: summary.rowsPregameEligible,
    rowsPostStart: summary.rowsPostStart,
    rowsPregameEligibilityUnresolved: summary.rowsPregameEligibilityUnresolved,
    unreadableOrReviewRequiredMatchups: unreadableMatchups,
    sportBreakdown: {
      FOOTBALL: footballRows.length,
      BASKETBALL: basketballRows.length,
      MLB: mlbRows.length,
    },
    leagueBreakdownSafelyKnown: {
      UEL: footballByLeague(FOOTBALL_GAMES).UEL ?? 0,
      라리가: footballByLeague(FOOTBALL_GAMES)["라리가"] ?? 0,
      MLB: mlbRows.length,
      남농월예_displayed: basketballRows.length,
    },
    mlbRowsPresent: true,
    mlbRowCount: mlbRows.length,
    structuredObservationPath: STRUCTURED_REL,
    recoveryAuditPath: RECOVERY_AUDIT_REL,
    rawManifestPath: MANIFEST_REL,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    fuzzyMatchingUsed: false,
    inventedOddsFieldsCount: 0,
    inventedTeamIdentitiesCount: 0,
    providerCallCount: 0,
    providerEndpoints: [],
    predictionCalls: 0,
    resultCalls: 0,
    engineCalls: 0,
    predictionCreatedCount: 0,
    engineModified: false,
    weightsModified: false,
    originalInboxFilesUntouched: true,
    sealed20260826FilesUntouched: true,
    retroactive20260827WorkCreatedOrModified: false,
    dailyScopeLocked: false,
    nextRecommendedStep: "2026-08-28 SCOPE / SLATE RECOVERY",
    doNotStartNextStepInThisMission: true,
    wrote: [MANIFEST_REL, README_REL, STRUCTURED_REL, RECOVERY_AUDIT_REL],
    frozenArtifactsOpened: false,
    summary,
  };

  await mkdir(path.dirname(path.join(cwd, STRUCTURED_REL)), { recursive: true });
  await mkdir(path.dirname(path.join(cwd, RECOVERY_AUDIT_REL)), {
    recursive: true,
  });
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
    path.join(cwd, RECOVERY_AUDIT_REL),
    `${JSON.stringify(recoveryAudit, null, 2)}\n`,
    "utf8",
  );

  return { document, manifest, recoveryAudit };
}

async function main() {
  const result = await runIntake();
  console.log(`wrote ${MANIFEST_REL}`);
  console.log(`wrote ${STRUCTURED_REL}`);
  console.log(`wrote ${RECOVERY_AUDIT_REL}`);
  console.log(
    `status=${result.document.status} football=${result.document.summary.footballOddsFixtures} basketball=${result.document.summary.basketballOddsFixtures} mlb=${result.document.summary.mlbOddsMatchups} rows=${result.document.summary.rowsObserved} predictionInput=false`,
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
