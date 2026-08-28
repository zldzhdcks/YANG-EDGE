/**
 * One-shot 2026-08-29/batch-2130 operator screenshot intake.
 *
 *   npx tsx scripts/intake-2026-08-29-batch-2130-operator-pregame-observations.ts
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

export const BATCH_ID = "2026-08-29/batch-2130";
export const DATE_KST = "2026-08-29";
export const RECEIVED_DATE_KST = "2026-08-29";
export const SLATE_DATE_KST = "2026-08-29";
export const INTAKE_STARTED_AT = "2026-08-28T21:30:45.648+09:00";
export const INTAKE_STARTED_AT_KST = "2026-08-28T21:30:45.648+09:00";
export const INTAKE_STARTED_AT_UTC = "2026-08-28T12:30:45.648Z";
export const FORMAL_OBSERVED_AT = INTAKE_STARTED_AT;
export const CAPTURE_TIME_SOURCE = "INTAKE_STARTED_AT_FROZEN_NOT_FILE_MTIME";
export const TIMING_CLASS = "PREGAME_ELIGIBILITY_UNRESOLVED";
export const SCOPE_STATUS = "NOT_READY_TO_LOCK_DAILY_SCOPE";
export const STATUS = "OPERATOR_REVIEW_REQUIRED";
export const RAW_REL =
  "data/operator-observations/raw/2026-08-29/batch-2130";
export const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-29/batch-2130-next-pregame-v0.json";
export const RECOVERY_AUDIT_REL =
  "data/audits/2026-08-29-pregame-current-state-recovery-v1.json";
export const MANIFEST_REL = `${RAW_REL}/manifest.json`;
export const README_REL = `${RAW_REL}/README.txt`;
export const INBOX_PATH =
  "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\2026-08-29";
export const REQUIRED_BASE_COMMIT =
  "4cde41bc32935b780f1115d0a56dca4b99e591af";
export const RAW_EVIDENCE_STORAGE = "LOCAL_ONLY_OWNER_PROVIDED_SCREENSHOT";
export const REPOSITORY_EVIDENCE = "HASH_AND_STRUCTURED_OBSERVATION";
export const PNG_GIT_EXCLUDE =
  "data/operator-observations/raw/2026-08-29/batch-2130/*.png";

const S1 = "screenshot_2026-08-28_212653.png";
const S2 = "screenshot_2026-08-28_212702.png";
const S3 = "screenshot_2026-08-28_212708.png";
const S4 = "screenshot_2026-08-28_212714.png";
const S5 = "screenshot_2026-08-28_212720.png";

export const FORBIDDEN_WRITE_PREFIXES = [
  "data/predictions/",
  "data/research/",
  "data/operator-input/",
  "리포트/",
] as const;

export const SEALED_2026_08_28 = [
  {
    rel: "data/audits/2026-08-28-daily-scope-lock-v1.json",
    sha256:
      "8574ecddda2a53d7feaafc627ca2aba18deb64bf6cc7458d08a5ea6a9b8949e7",
  },
  {
    rel: "data/audits/2026-08-28-pregame-current-state-recovery-v1.json",
    sha256:
      "cd36be5f6865d92a70cd56bbe01835be6d9f3d48536b1d9320795fdbcb12d7b5",
  },
  {
    rel: "data/audits/2026-08-28-scope-slate-recovery-v1.json",
    sha256:
      "9e2e6627b8b4cfc1ecad9780cec04a7b4e68adc55bf2024a71c3c3be7fdc0fd6",
  },
  {
    rel: "data/operator-observations/structured/2026-08-28/batch-2228-next-pregame-v0.json",
    sha256:
      "6607a02e438551b9c18cf641db8f296becee1d27789497186ef98ba9de97a7ea",
  },
  {
    rel: "data/operator-observations/raw/2026-08-28/batch-2228/manifest.json",
    sha256:
      "b2d79bfc038d6def3898fdaf4725e8cce5546a5f11c2c66eb97c19a5d1a5bdab",
  },
  {
    rel: "data/operator-observations/raw/2026-08-28/batch-2228/README.txt",
    sha256:
      "37cc9bce5e63cb2d8ef3d36c664f3143372a8965eb45b55e676a699b3de15514",
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
    originalInboxName: "스크린샷 2026-08-28 212653.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "67089f903c1acaf9baeb60ce344a23a55d9db19ee0f2aadffd5fcf5a7176b4d0",
    bytes: 197587,
    sourceFileCreatedAt: "2026-08-28T21:26:53.5629085+09:00",
    sourceFileModifiedAt: "2026-08-28T21:26:53.6147845+09:00",
    sourceFileNameTimestamp: "2026-08-28T21:26:53+09:00",
    displayedSourceTimestamp: null,
    sequence: 1,
  },
  {
    file: S2,
    originalInboxName: "스크린샷 2026-08-28 212702.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "b202c9de9e05f702951074fc465916d3ea6b2e20131116a5cdcd21c534933ca0",
    bytes: 177450,
    sourceFileCreatedAt: "2026-08-28T21:27:02.0727634+09:00",
    sourceFileModifiedAt: "2026-08-28T21:27:02.1232789+09:00",
    sourceFileNameTimestamp: "2026-08-28T21:27:02+09:00",
    displayedSourceTimestamp: null,
    sequence: 2,
  },
  {
    file: S3,
    originalInboxName: "스크린샷 2026-08-28 212708.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "e8cd83be8b10c1e5e68a321305106cc7887d16e95b1d9683db449296e9370a77",
    bytes: 170979,
    sourceFileCreatedAt: "2026-08-28T21:27:08.9492948+09:00",
    sourceFileModifiedAt: "2026-08-28T21:27:09.0013011+09:00",
    sourceFileNameTimestamp: "2026-08-28T21:27:08+09:00",
    displayedSourceTimestamp: null,
    sequence: 3,
  },
  {
    file: S4,
    originalInboxName: "스크린샷 2026-08-28 212714.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "b7451cf2b0f438d6bba77973edd970b58e2fa063f10058c63f67776e69766e76",
    bytes: 163233,
    sourceFileCreatedAt: "2026-08-28T21:27:14.8432056+09:00",
    sourceFileModifiedAt: "2026-08-28T21:27:14.8952326+09:00",
    sourceFileNameTimestamp: "2026-08-28T21:27:14+09:00",
    displayedSourceTimestamp: null,
    sequence: 4,
  },
  {
    file: S5,
    originalInboxName: "스크린샷 2026-08-28 212720.png",
    category: "SPORTS_DOMESTIC_ODDS_SCREENSHOT" as const,
    sha256:
      "490ca03d3512edbcf86d43be3fa6b271769512081f56f03c328933930fdb626b",
    bytes: 113866,
    sourceFileCreatedAt: "2026-08-28T21:27:20.3787365+09:00",
    sourceFileModifiedAt: "2026-08-28T21:27:20.4223471+09:00",
    sourceFileNameTimestamp: "2026-08-28T21:27:20+09:00",
    displayedSourceTimestamp: null,
    sequence: 5,
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
    displayedDateKst?: string;
    teamLabelStatus?: "VISIBLE" | "FIELD_REVIEW_REQUIRED" | "OWNER_EXPLICIT_CONFIRMATION";
    leagueLabelStatus?: "VISIBLE" | "FIELD_REVIEW_REQUIRED";
    reviewNotes?: string[];
  },
) {
  return {
    sport: "BASKETBALL" as const,
    rawLeagueLabel,
    displayedDateKst: extra?.displayedDateKst ?? SLATE_DATE_KST,
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
    scopeMembership:
      (extra?.displayedDateKst ?? SLATE_DATE_KST) === SLATE_DATE_KST
        ? ("IN_TARGET_DATE_SCOPE" as const)
        : ("EXCLUDED_NON_TARGET_DATE" as const),
  };
}

function fb(
  rawLeagueLabel: string,
  displayedStartKst: string,
  rawHome: string,
  rawAway: string,
  screenshot: string,
  markets: ReturnType<typeof ml>[],
  extra?: {
    overlapScreenshots?: string[];
    leagueLabelStatus?: "VISIBLE" | "FIELD_REVIEW_REQUIRED";
    reviewNotes?: string[];
  },
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
    identityStatus: "ODDS_IDENTITY_REVIEW_REQUIRED" as const,
    mappingStatus: "NO_SCHEDULE_JOIN_THIS_BATCH" as const,
    competitionRegistryJoin: "NOT_ATTEMPTED" as const,
    leagueLabelStatus: extra?.leagueLabelStatus ?? ("VISIBLE" as const),
    reviewNotes: extra?.reviewNotes ?? [],
    scopeMembership: "IN_TARGET_DATE_SCOPE" as const,
    screenshot,
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
    scopeMembership: "IN_TARGET_DATE_SCOPE" as const,
  };
}

const BB_GLYPH_NOTE = [
  "Screenshot 1 league glyph read 남농원예. Screenshots 2-3 read 남농월예. Not silently normalized to one competition label.",
];

const BASKETBALL_GAMES = [
  bb(
    "남농원예",
    "21:30",
    "요르단M",
    "필리핀M",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.84, null, 1.69, S1, [7121]),
      ml("H +1.5", "UNKNOWN", 1.5, 1.72, null, 1.8, S1, [7122]),
      ml("U 159.5", "TOTALS", 159.5, 1.78, null, 1.74, S1, [7123]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [7124]),
    ],
    {
      displayedDateKst: "2026-08-28",
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        ...BB_GLYPH_NOTE,
        "Displayed date is 08.28(금), not the 2026-08-29 operating date. Row retained as evidence with scopeMembership=EXCLUDED_NON_TARGET_DATE. Not a 2026-08-29 official Scope game. IDs 7125-7128 are not on any screenshot and were not invented.",
      ],
    },
  ),
  bb(
    "남농원예",
    "00:30",
    "조지아M",
    "몬테네M",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.11, null, 4.25, S1, [7129]),
      ml("H -9.5", "UNKNOWN", -9.5, 1.72, null, 1.8, S1, [7130]),
      ml("U 158.5", "TOTALS", 158.5, 1.74, null, 1.78, S1, [7131]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [7132]),
    ],
    { leagueLabelStatus: "FIELD_REVIEW_REQUIRED", reviewNotes: BB_GLYPH_NOTE },
  ),
  bb(
    "남농원예",
    "01:00",
    "우크라M",
    "그리스M",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 2.17, null, 1.48, S1, [7133]),
      ml("H +3.5", "UNKNOWN", 3.5, 1.75, null, 1.77, S1, [7134]),
      ml("U 159.5", "TOTALS", 159.5, 1.74, null, 1.78, S1, [7135]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [7136]),
    ],
    { leagueLabelStatus: "FIELD_REVIEW_REQUIRED", reviewNotes: BB_GLYPH_NOTE },
  ),
  bb(
    "남농원예",
    "03:00",
    "튀르키M",
    "리투아M",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.06, null, 5.18, S1, [7145]),
      ml("H -10.5", "UNKNOWN", -10.5, 1.73, null, 1.79, S1, [7146]),
      ml("U 169.5", "TOTALS", 169.5, 1.78, null, 1.74, S1, [7147]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [7148]),
    ],
    { leagueLabelStatus: "FIELD_REVIEW_REQUIRED", reviewNotes: BB_GLYPH_NOTE },
  ),
  bb(
    "남농원예",
    "03:00",
    "세르비M",
    "아이슬M",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.0, null, 1.0, S1, [7149]),
      ml("H -29.5", "UNKNOWN", -29.5, 1.78, null, 1.74, S1, [7150]),
      ml("U 177.5", "TOTALS", 177.5, 1.78, null, 1.74, S1, [7151]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [7152]),
    ],
    { leagueLabelStatus: "FIELD_REVIEW_REQUIRED", reviewNotes: BB_GLYPH_NOTE },
  ),
  bb(
    "남농원예",
    "03:00",
    "보스니M",
    "이탈리M",
    S1,
    [
      ml("승패", "MONEYLINE_2WAY", null, 2.05, null, 1.54, S1, [7153]),
      ml("H +2.5", "UNKNOWN", 2.5, 1.78, null, 1.74, S1, [7154]),
      ml("U 164.5", "TOTALS", 164.5, 1.74, null, 1.78, S1, [7155]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [7156]),
    ],
    {
      overlapScreenshots: [S1, S2],
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        ...BB_GLYPH_NOTE,
        "SUM market 7156 continues onto screenshot 2, where the league glyph also read 남농월예.",
      ],
    },
  ),
  bb(
    "남농월예",
    "04:00",
    "스페인M",
    "포르투M",
    S3,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.02, null, 6.41, S3, [7186]),
      ml("H -12.5", "UNKNOWN", -12.5, 1.77, null, 1.75, S3, [7187]),
      ml("U 160.5", "TOTALS", 160.5, 1.78, null, 1.74, S3, [7188]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S3, [7189]),
    ],
    { leagueLabelStatus: "FIELD_REVIEW_REQUIRED", reviewNotes: BB_GLYPH_NOTE },
  ),
];

const FOOTBALL_GAMES = [
  fb("라리가", "02:00", "라싱산탄", "엘체", S1, [
    ml("1X2", "ONE_X_TWO", null, 1.98, 3.3, 3.05, S1, [7137]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 3.75, 3.55, 1.66, S1, [7138]),
    ml("U 2.5", "TOTALS", 2.5, 1.91, null, 1.67, S1, [7139]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S1, [7140]),
  ]),
  fb("에레디비", "03:00", "흐로닝언", "F시타르", S1, [
    ml("1X2", "ONE_X_TWO", null, 1.43, 4.15, 4.8, S1, [7141]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.2, 3.6, 2.4, S1, [7142]),
    ml("U 3.5", "TOTALS", 3.5, 1.67, null, 1.86, S1, [7143]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S1, [7144]),
  ]),
  fb(
    "분데스리",
    "03:30",
    "바이뮌헨",
    "슈투트가",
    S2,
    [
      ml("1X2", "ONE_X_TWO", null, 1.19, 5.8, 8.1, S2, [7162]),
      ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 1.56, 4.15, 3.75, S2, [7163]),
      ml("H -2.0", "FOOTBALL_HANDICAP_3WAY", -2, 2.2, 4.0, 2.25, S2, [7164]),
      ml("H -3.5", "UNKNOWN", -3.5, 3.46, null, 1.18, S2, [7165]),
      ml("U 4.5", "TOTALS", 4.5, 1.58, null, 2.04, S2, [7166]),
      ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [7167]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Displayed league glyph is 분데스리. Not silently expanded to 분데스리가.",
      ],
    },
  ),
  fb("세리에A", "03:45", "AC밀란", "베네치아", S2, [
    ml("1X2", "ONE_X_TWO", null, 1.31, 4.4, 6.3, S2, [7168]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 2.02, 3.6, 2.65, S2, [7169]),
    ml("U 2.5", "TOTALS", 2.5, 1.86, null, 1.67, S2, [7170]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S2, [7171]),
  ]),
  fb(
    "프리그1",
    "03:45",
    "릴OSC",
    "PSG",
    S2,
    [
      ml("1X2", "ONE_X_TWO", null, 4.05, 3.45, 1.63, S2, [7172]),
      ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 2.03, 3.35, 2.8, S2, [7173]),
      ml("U 2.5", "TOTALS", 2.5, 1.94, null, 1.61, S2, [7174]),
      ml("SUM", "SUM", null, 1.81, null, 1.79, S2, [7175]),
    ],
    {
      leagueLabelStatus: "FIELD_REVIEW_REQUIRED",
      reviewNotes: [
        "Displayed league glyph is 프리그1. Not silently rewritten to 리그 1.",
      ],
    },
  ),
  fb("EFL챔", "04:00", "렉섬", "버밍엄C", S2, [
    ml("1X2", "ONE_X_TWO", null, 2.22, 3.05, 2.7, S2, [7176]),
    ml("H -1.0", "FOOTBALL_HANDICAP_3WAY", -1, 4.6, 3.65, 1.52, S2, [7177]),
    ml("U 2.5", "TOTALS", 2.5, 1.67, null, 1.86, S2, [7178]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S2, [7179]),
  ]),
  fb("EPL", "04:00", "크리스털", "맨체스C", S2, [
    ml("1X2", "ONE_X_TWO", null, 4.75, 3.8, 1.54, S2, [7180]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 2.26, 3.4, 2.5, S2, [7181]),
    ml("H +2.0", "FOOTBALL_HANDICAP_3WAY", 2, 1.39, 4.6, 5.0, S2, [7182]),
    ml("H +3.5", "UNKNOWN", 3.5, 1.01, null, 6.84, S2, [7183]),
    ml("U 2.5", "TOTALS", 2.5, 2.09, null, 1.55, S2, [7184]),
    ml("SUM", "SUM", null, 1.8, null, 1.8, S2, [7185]),
  ]),
  fb("라리가", "04:30", "알라베스", "비야레알", S3, [
    ml("1X2", "ONE_X_TWO", null, 2.8, 3.25, 2.12, S3, [7190]),
    ml("H +1.0", "FOOTBALL_HANDICAP_3WAY", 1, 1.58, 3.65, 4.1, S3, [7191]),
    ml("U 2.5", "TOTALS", 2.5, 1.88, null, 1.69, S3, [7192]),
    ml("SUM", "SUM", null, 1.81, null, 1.79, S3, [7193]),
  ]),
];

const MLB_GAMES = [
  mlbGame("03:20", "시카컵스", "신시레즈", S2, [
    ml("승패", "MONEYLINE_2WAY", null, 1.35, null, 2.53, S2, [7157]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.78, 3.45, 3.35, S2, [7158]),
    ml("H -2.5", "RUN_LINE", -2.5, 2.34, null, 1.41, S2, [7159]),
    ml("U 8.5", "TOTALS", 8.5, 1.66, null, 1.87, S2, [7160]),
    ml("SUM", "SUM", null, 1.6, null, 2.06, S2, [7161]),
  ]),
  mlbGame("07:40", "디트타이", "LA다저스", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 2.64, null, 1.32, S3, [7194]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 4.4, 3.4, 1.59, S3, [7195]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.55, null, 2.04, S3, [7196]),
    ml("U 7.5", "TOTALS", 7.5, 1.65, null, 1.89, S3, [7197]),
    ml("SUM", "SUM", null, 1.6, null, 2.06, S3, [7198]),
  ]),
  mlbGame("07:45", "워싱내셔", "마이말린", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 2.13, null, 1.5, S3, [7199]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.25, 3.35, 1.84, S3, [7200]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.39, null, 2.4, S3, [7201]),
    ml("U 8.5", "TOTALS", 8.5, 1.73, null, 1.79, S3, [7202]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S3, [7203]),
  ]),
  mlbGame("08:10", "탬파레이", "샌디파드", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.58, null, 1.99, S3, [7204]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.21, 3.2, 2.6, S3, [7205]),
    ml("H -2.5", "RUN_LINE", -2.5, 3.03, null, 1.24, S3, [7206]),
    ml("U 7.5", "TOTALS", 7.5, 1.74, null, 1.78, S3, [7207]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S3, [7208]),
  ]),
  mlbGame("08:10", "뉴욕메츠", "휴스애스", S3, [
    ml("승패", "MONEYLINE_2WAY", null, 1.91, null, 1.63, S3, [7209]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.85, 3.25, 2.04, S3, [7210]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.3, null, 2.72, S3, [7211]),
    ml("U 7.5", "TOTALS", 7.5, 1.79, null, 1.73, S3, [7212]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S3, [7213]),
  ]),
  mlbGame(
    "08:10",
    "클리가디",
    "캔자로얄",
    S3,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.61, null, 1.94, S3, [7214]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.26, 3.25, 2.5, S3, [7215]),
      ml("H -2.5", "RUN_LINE", -2.5, 3.16, null, 1.22, S3, [7216]),
      ml("U 7.5", "TOTALS", 7.5, 1.81, null, 1.71, S4, [7217]),
      ml("SUM", "SUM", null, 1.58, null, 2.09, S4, [7218]),
    ],
    { overlapScreenshots: [S3, S4] },
  ),
  mlbGame("08:15", "토론블루", "시애매리", S4, [
    ml("승패", "MONEYLINE_2WAY", null, 1.45, null, 2.24, S4, [7219]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.99, 3.25, 2.95, S4, [7220]),
    ml("H -2.5", "RUN_LINE", -2.5, 2.68, null, 1.31, S4, [7221]),
    ml("U 7.5", "TOTALS", 7.5, 1.7, null, 1.82, S4, [7222]),
    ml("SUM", "SUM", null, 1.58, null, 2.09, S4, [7223]),
  ]),
  mlbGame("08:15", "뉴욕양키", "보스레드", S4, [
    ml("승패", "MONEYLINE_2WAY", null, 1.42, null, 2.31, S4, [7224]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.91, 3.35, 3.05, S4, [7225]),
    ml("H -2.5", "RUN_LINE", -2.5, 2.56, null, 1.34, S4, [7226]),
    ml("U 7.5", "TOTALS", 7.5, 1.77, null, 1.75, S4, [7227]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S4, [7228]),
  ]),
  mlbGame("08:15", "애틀브레", "콜로로키", S4, [
    ml("승패", "MONEYLINE_2WAY", null, 1.3, null, 2.72, S4, [7229]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.68, 3.6, 3.6, S4, [7230]),
    ml("H -2.5", "RUN_LINE", -2.5, 2.17, null, 1.48, S4, [7231]),
    ml("U 8.5", "TOTALS", 8.5, 1.8, null, 1.72, S4, [7232]),
    ml("SUM", "SUM", null, 1.6, null, 2.06, S4, [7233]),
  ]),
  mlbGame("08:40", "밀워브루", "텍사레인", S4, [
    ml("승패", "MONEYLINE_2WAY", null, 1.39, null, 2.4, S4, [7234]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 1.87, 3.35, 3.15, S4, [7235]),
    ml("H -2.5", "RUN_LINE", -2.5, 2.49, null, 1.36, S4, [7236]),
    ml("U 7.5", "TOTALS", 7.5, 1.78, null, 1.74, S4, [7237]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S4, [7238]),
  ]),
  mlbGame("09:10", "미네트윈", "시카화이", S4, [
    ml("승패", "MONEYLINE_2WAY", null, 1.67, null, 1.86, S4, [7239]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.35, 3.35, 2.35, S4, [7240]),
    ml("H -2.5", "RUN_LINE", -2.5, 3.23, null, 1.21, S4, [7241]),
    ml("U 8.5", "TOTALS", 8.5, 1.93, null, 1.62, S4, [7242]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S4, [7243]),
  ]),
  mlbGame(
    "09:15",
    "세인카디",
    "피츠파이",
    S4,
    [
      ml("승패", "MONEYLINE_2WAY", null, 1.82, null, 1.7, S4, [7244]),
      ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.7, 3.2, 2.14, S4, [7245]),
      ml("H +2.5", "RUN_LINE", 2.5, 1.27, null, 2.87, S4, [7246]),
      ml("U 7.5", "TOTALS", 7.5, 1.69, null, 1.84, S5, [7247]),
      ml("SUM", "SUM", null, 1.58, null, 2.09, S5, [7248]),
    ],
    { overlapScreenshots: [S4, S5] },
  ),
  mlbGame("10:38", "LA에인절", "필라필리", S5, [
    ml("승패", "MONEYLINE_2WAY", null, 2.07, null, 1.53, S5, [7249]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.15, 3.3, 1.89, S5, [7250]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.37, null, 2.46, S5, [7251]),
    ml("U 8.5", "TOTALS", 8.5, 1.66, null, 1.87, S5, [7252]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S5, [7253]),
  ]),
  mlbGame("10:40", "애슬레틱", "볼티오리", S5, [
    ml("승패", "MONEYLINE_2WAY", null, 2.13, null, 1.5, S5, [7254]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 3.25, 3.5, 1.8, S5, [7255]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.42, null, 2.31, S5, [7256]),
    ml("U 10.5", "TOTALS", 10.5, 1.71, null, 1.81, S5, [7257]),
    ml("SUM", "SUM", null, 1.6, null, 2.06, S5, [7258]),
  ]),
  mlbGame("11:15", "샌프자이", "애리다이", S5, [
    ml("승패", "MONEYLINE_2WAY", null, 1.85, null, 1.68, S5, [7259]),
    ml("승①패", "DOMESTIC_THREE_WAY_SPECIAL", null, 2.7, 3.25, 2.12, S5, [7260]),
    ml("H +2.5", "RUN_LINE", 2.5, 1.28, null, 2.82, S5, [7261]),
    ml("U 8.5", "TOTALS", 8.5, 1.68, null, 1.85, S5, [7262]),
    ml("SUM", "SUM", null, 1.59, null, 2.07, S5, [7263]),
    ml("h(전반)", "FIRST_HALF_OR_EARLY_SPECIAL", null, 2.15, 5.5, 1.99, S5, [7264]),
    ml("h H +1.5", "RUN_LINE", 1.5, 1.26, null, 2.92, S5, [7265]),
    ml("h U 4.5", "TOTALS", 4.5, 1.64, null, 1.9, S5, [7266]),
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
    scopeMembership: g.scopeMembership,
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
    leagueLabelStatus: g.leagueLabelStatus,
    reviewNotes: g.reviewNotes,
    scopeMembership: g.scopeMembership,
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
    scopeMembership: g.scopeMembership,
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

  for (const sealed of SEALED_2026_08_28) {
    const abs = path.join(cwd, sealed.rel);
    if (!existsSync(abs)) {
      throw new Error(`SEALED_2026_08_28_MISSING: ${sealed.rel}`);
    }
    const sha = sha256File(abs);
    if (sha !== sealed.sha256) {
      throw new Error(`SEALED_2026_08_28_MUTATED: ${sealed.rel}`);
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
  const offDateBasketball = basketballRows.filter(
    (r) => r.displayedDateKst !== SLATE_DATE_KST,
  ).length;

  const summary = {
    screenshots: SCREENSHOTS.length,
    oddsScreenshots: 5,
    lineupScreenshots: 0,
    rowsObserved,
    rowsParsed: rowsObserved,
    matchupCount:
      basketballRows.length + footballRows.length + mlbRows.length,
    observedBatchCount:
      basketballRows.length + footballRows.length + mlbRows.length,
    officialTargetDateScopeCount: [
      ...basketballRows,
      ...footballRows,
      ...mlbRows,
    ].filter((r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE").length,
    excludedCrossDateCount: offDateBasketball,
    rowsIdentityMatched: 0,
    rowsIdentityReviewRequired:
      basketballRows.length + footballRows.length + mlbRows.length,
    rowsPregameEligible: 0,
    rowsPostStart: 0,
    rowsPregameEligibilityUnresolved:
      basketballRows.length + footballRows.length + mlbRows.length,
    unreadableGameRows: unreadableMatchups,
    offDateDisplayedMatchups: offDateBasketball,
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
    overlapGamesDeduped: 3,
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
      "Inbox folder is 2026-08-29. Screenshot filenames are 2026-08-28 21:26-21:27 KST. On-screen betting date is mostly 08.29(토); one leftover 08.28(금) 21:30 basketball matchup is preserved in operator observations with scopeMembership=EXCLUDED_NON_TARGET_DATE and is not a 2026-08-29 official Scope game. formalObservedAt is the frozen intake clock, not file mtime and not filename time. Daily Scope is not locked in this intake writer.",
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
    note: "2026-08-29 current-state recovery and manual odds intake. Inbox screenshots copied byte-identical. RAW PNG copies are LOCAL-ONLY and must not be committed to public GitHub. No schedule/result/prediction/odds-provider calls in the intake writer. MLB aliases recorded where exact; fixture/gamePk join is the slate-recovery writer. Displayed kickoff is not treated as scheduledStartAt until schedule join. 1.00 moneyline values are preserved. Market IDs 7125-7128 were not on any screenshot and were not invented. One 08.28 leftover basketball matchup remains in structured observations with scopeMembership=EXCLUDED_NON_TARGET_DATE and is excluded from the 2026-08-29 official Daily Scope denominator. Do not lock Daily Scope from these odds rows.",
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
      duplicateGameIdentitiesRemoved: 3,
      overlappingGames: [
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "보스니M : 이탈리M",
          screenshots: [S1, S2],
        },
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "클리가디 : 캔자로얄",
          screenshots: [S3, S4],
        },
        {
          displayedDateKst: SLATE_DATE_KST,
          matchup: "세인카디 : 피츠파이",
          screenshots: [S4, S5],
        },
      ],
    },
    reviewRequired: [
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "BASKETBALL_LEAGUE_GLYPH_원예_VS_월예",
        note: "Screenshot 1 read 남농원예. Screenshots 2-3 read 남농월예. Labels stored as displayed per screenshot. Not treated as two competitions and not silently unified.",
      },
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "FOOTBALL_TRUNCATED_LEAGUE_GLYPHS",
        note: "분데스리 and 프리그1 stored exactly as displayed. Not expanded to 분데스리가 or 리그 1. 세리에A, EPL, EFL챔, 에레디비 stored as displayed.",
      },
      {
        status: "OPERATOR_REVIEW_REQUIRED",
        section: "OFF_DATE_08_28_BASKETBALL_LEFTOVER",
        marketIds: [7121, 7122, 7123, 7124],
        displayedDateKst: "2026-08-28",
        displayedStartKst: "21:30",
        rawMatchup: "요르단M : 필리핀M",
        note: "Visible leftover 08.28(금) 21:30 basketball matchup at the top of screenshot 1. Preserved in operator observations with scopeMembership=EXCLUDED_NON_TARGET_DATE. Not a 2026-08-29 official Scope game. Not used to reopen sealed 2026-08-28 artifacts.",
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
      "formalObservedAt = frozen intakeStartedAt. Filesystem mtime and filename 21:26 timestamps are provenance only.",
      "Inbox folder 2026-08-29 is drop location. On-screen 08.29(토) is displayed slate date, not a locked Daily Scope. One 08.28 leftover basketball matchup is retained with its displayed date.",
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

  const readme = `YANG EDGE — 2026-08-29 Pregame Current-State Recovery Raw Batch
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
- 5 domestic-odds screenshots (football / basketball / MLB)
- 0 lineup screenshots

Rules
1. RAW EVIDENCE. Do not crop, resize, recompress, or overwrite images.
2. Odds provenance = MANUAL_OPERATOR_OBSERVATION / MANUAL_OPERATOR_MARKET_OBSERVATION.
3. researchOnly = true, engineAdmission = PROHIBITED, predictionInput = false, engineInput = false.
4. formalObservedAt is the frozen intake clock. Do not treat file mtime as observedAt.
5. Do not lock 2026-08-29 Daily Scope from these odds rows.
6. Do not alter sealed 2026-08-28 artifacts.
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
      "Inbox inventory and byte-identical copies are complete. RAW PNG copies are local-only. Readable odds rows are preserved with provenance. One 08.28 leftover basketball matchup (요르단M : 필리핀M, IDs 7121-7124) is preserved with scopeMembership=EXCLUDED_NON_TARGET_DATE and is excluded from the 2026-08-29 official Daily Scope denominator. Fixture identity join is applied by slate recovery, not this intake writer. Daily Scope is not locked in this intake writer.",
    intakeStartedAt: INTAKE_STARTED_AT,
    intakeStartedAtKst: INTAKE_STARTED_AT_KST,
    formalObservedAt: FORMAL_OBSERVED_AT,
    captureTimeSource: CAPTURE_TIME_SOURCE,
    inboxPath: INBOX_PATH,
    inboxFileCount: SCREENSHOTS.length,
    existing20260829ArtifactsBeforeWork: [],
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
    matchupCount: summary.matchupCount,
    observedBatchCount: summary.observedBatchCount,
    officialTargetDateScopeCount: summary.officialTargetDateScopeCount,
    excludedCrossDateCount: summary.excludedCrossDateCount,
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
      ...footballByLeague(FOOTBALL_GAMES),
      MLB: mlbRows.length,
      남농원예_or_남농월예_displayed: basketballRows.length,
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
    sealed20260828FilesUntouched: true,
    retroactive20260828WorkCreatedOrModified: false,
    dailyScopeLocked: false,
    nextRecommendedStep: "2026-08-29 SCOPE / SLATE RECOVERY",
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
    `status=${result.document.status} football=${result.document.summary.footballOddsFixtures} basketball=${result.document.summary.basketballOddsFixtures} mlb=${result.document.summary.mlbOddsMatchups} matchups=${result.document.summary.matchupCount} rows=${result.document.summary.rowsObserved} predictionInput=false`,
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
