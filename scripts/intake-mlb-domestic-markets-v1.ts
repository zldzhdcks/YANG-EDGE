/**
 * Intake: MLB 2026-08-02 domestic proto markets from admin-verified screenshot values.
 *
 *   npx tsx --env-file=.env.local scripts/intake-mlb-domestic-markets-v1.ts 2026-08-02
 *
 * Does NOT store screenshot image files.
 * Does NOT write prediction / starter / overseas odds / lineup.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  buildMlbDomesticMarketsV1,
  type AdminScreenshotGameRow,
} from "../src/lib/mlb/domestic-markets-v1/build-from-admin-rows";
import type { UnresolvedDomesticRow } from "../src/lib/mlb/domestic-markets-v1/types";

const DATE = process.argv[2]?.trim() || "2026-08-02";

/** Admin-verified rows transcribed from 4 screenshots (images not persisted). */
const ADMIN_ROWS_2026_08_02: AdminScreenshotGameRow[] = [
  {
    displayOrder: 1,
    screenLeftTeamKo: "토론토블루",
    screenRightTeamKo: "세인트카디",
    screenStartKst: "04:07",
    moneyline: [1.5, 2.13],
    threeWay: [2.05, 3.35, 2.75],
    runLine: { homeHandicap: -2.5, prices: [2.77, 1.29] },
    totals: { line: 8.5, underFirst: true, prices: [1.74, 1.78] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 2,
    screenLeftTeamKo: "탬파베이",
    screenRightTeamKo: "시카고 화이트삭스",
    screenStartKst: "05:10",
    moneyline: [1.44, 2.26],
    threeWay: [1.95, 3.35, 2.95],
    runLine: { homeHandicap: -2.5, prices: [2.6, 1.33] },
    totals: { line: 8.5, underFirst: true, prices: [1.66, 1.87] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 3,
    screenLeftTeamKo: "시애틀",
    screenRightTeamKo: "미네소타",
    screenStartKst: "05:10",
    moneyline: [1.42, 2.31],
    threeWay: [1.91, 3.35, 3.05],
    runLine: { homeHandicap: -2.5, prices: [2.56, 1.34] },
    totals: { line: 7.5, underFirst: true, prices: [1.79, 1.73] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 4,
    screenLeftTeamKo: "뉴욕 메츠",
    screenRightTeamKo: "마이애미",
    screenStartKst: "05:10",
    moneyline: [1.63, 1.91],
    threeWay: [2.28, 3.3, 2.45],
    runLine: { homeHandicap: -2.5, prices: [3.16, 1.22] },
    totals: { line: 8.5, underFirst: true, prices: [1.81, 1.71] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 5,
    screenLeftTeamKo: "신시내티",
    screenRightTeamKo: "피츠버그",
    screenStartKst: "07:40",
    moneyline: [1.82, 1.7],
    threeWay: [2.65, 3.3, 2.13],
    runLine: { homeHandicap: 2.5, prices: [1.28, 2.82] },
    totals: { line: 8.5, underFirst: true, prices: [1.74, 1.78] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 6,
    screenLeftTeamKo: "볼티모어",
    screenRightTeamKo: "필라델피아",
    screenStartKst: "08:05",
    moneyline: [2.04, 1.55],
    threeWay: [3.1, 3.3, 1.91],
    runLine: { homeHandicap: 2.5, prices: [1.36, 2.49] },
    totals: { line: 8.5, underFirst: true, prices: [1.73, 1.79] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 7,
    screenLeftTeamKo: "휴스턴",
    screenRightTeamKo: "텍사스",
    screenStartKst: "08:10",
    moneyline: [1.96, 1.6],
    threeWay: [2.9, 3.3, 1.99],
    runLine: { homeHandicap: 2.5, prices: [1.33, 2.6] },
    totals: { line: 8.5, underFirst: true, prices: [1.71, 1.81] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 8,
    screenLeftTeamKo: "클리블랜드",
    screenRightTeamKo: "애리조나",
    screenStartKst: "08:15",
    moneyline: [1.46, 2.22],
    threeWay: [1.98, 3.4, 2.85],
    runLine: { homeHandicap: -2.5, prices: [2.64, 1.32] },
    totals: { line: 8.5, underFirst: true, prices: [1.75, 1.77] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 9,
    screenLeftTeamKo: "시카고 컵스",
    screenRightTeamKo: "뉴욕 양키스",
    screenStartKst: "08:15",
    moneyline: [1.94, 1.61],
    threeWay: [3.0, 3.0, 2.07],
    runLine: { homeHandicap: 2.5, prices: [1.28, 2.82] },
    totals: { line: 6.5, underFirst: true, prices: [1.66, 1.87] },
    sum: [1.53, 2.07],
  },
  {
    displayOrder: 10,
    screenLeftTeamKo: "애틀랜타",
    screenRightTeamKo: "워싱턴",
    screenStartKst: "08:15",
    moneyline: [1.37, 2.46],
    threeWay: [1.8, 3.55, 3.2],
    runLine: { homeHandicap: -2.5, prices: [2.31, 1.42] },
    totals: { line: 9.5, underFirst: true, prices: [1.72, 1.8] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 11,
    screenLeftTeamKo: "샌디파드",
    screenRightTeamKo: "샌프자이",
    screenStartKst: "09:40",
    moneyline: [1.57, 2.0],
    threeWay: [2.18, 3.35, 2.55],
    runLine: { homeHandicap: -2.5, prices: [2.97, 1.25] },
    totals: { line: 8.5, underFirst: true, prices: [1.84, 1.69] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 12,
    screenLeftTeamKo: "LA 다저스",
    screenRightTeamKo: "보스턴",
    screenStartKst: "10:10",
    moneyline: [1.47, 2.19],
    threeWay: [2.0, 3.35, 2.85],
    runLine: { homeHandicap: -2.5, prices: [2.68, 1.31] },
    totals: { line: 8.5, underFirst: true, prices: [1.74, 1.78] },
    sum: [1.56, 2.02],
  },
  {
    displayOrder: 13,
    screenLeftTeamKo: "LA 에인절스",
    screenRightTeamKo: "밀워키",
    screenStartKst: "10:38",
    moneyline: [1.82, 1.7],
    threeWay: [2.65, 3.3, 2.13],
    runLine: { homeHandicap: 2.5, prices: [1.28, 2.82] },
    totals: { line: 8.5, underFirst: true, prices: [1.81, 1.71] },
    sum: [1.55, 2.04],
  },
  {
    displayOrder: 14,
    screenLeftTeamKo: "애슬레틱스",
    screenRightTeamKo: "디트로이트",
    screenStartKst: "10:40",
    moneyline: [1.97, 1.59],
    threeWay: [2.9, 3.45, 1.94],
    runLine: { homeHandicap: 2.5, prices: [1.35, 2.53] },
    totals: { line: 10.5, underFirst: true, prices: [1.81, 1.71] },
    sum: [1.56, 2.02],
    firstHalf: {
      threeWay: [2.35, 6.6, 1.75],
      runLine: { homeHandicap: 1.5, prices: [1.39, 2.4] },
      totals: { line: 5.5, prices: [1.81, 1.71] },
    },
  },
];

const UNRESOLVED_EXTRAS_2026_08_02: UnresolvedDomesticRow[] = [];

async function main() {
  if (DATE !== "2026-08-02") {
    console.error("This intake script currently embeds 2026-08-02 admin rows only.");
    process.exitCode = 1;
    return;
  }

  const scheduleRel = `data/research/mlb/${DATE}-schedule-v1.json`;
  try {
    await readFile(path.join(process.cwd(), scheduleRel), "utf8");
  } catch {
    console.error(`SCHEDULE_REQUIRED: missing ${scheduleRel}`);
    process.exitCode = 1;
    return;
  }

  // User message time (mission start window, KST evening Aug 1 / UTC morning).
  const observedAt =
    process.env.MLB_DOMESTIC_OBSERVED_AT?.trim() ||
    "2026-08-01T09:37:00.000Z";
  const enteredAt = new Date().toISOString();

  const { document, pathRel, scheduleHash } = await buildMlbDomesticMarketsV1({
    dateKst: DATE,
    observedAt,
    enteredAt,
    screenshotCount: 4,
    adminRows: ADMIN_ROWS_2026_08_02,
    unresolvedExtras: UNRESOLVED_EXTRAS_2026_08_02,
  });

  const abs = path.join(process.cwd(), pathRel);
  await mkdir(path.dirname(abs), { recursive: true });

  // Preserve previous primary as revision before overwrite
  try {
    const prev = await readFile(abs, "utf8");
    const revName = pathRel.replace(
      ".json",
      `.rev-${enteredAt.replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(path.join(process.cwd(), revName), prev, "utf8");
    console.log(`revisionPreserved=${revName}`);
  } catch {
    /* no previous */
  }

  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");

  const auditRel = `data/audits/${DATE}-mlb-domestic-markets-intake-v1.json`;
  const audit = {
    schemaVersion: "mlb-domestic-markets-intake-audit-v1",
    dateKst: DATE,
    generatedAt: enteredAt,
    observedAt,
    scheduleArtifact: scheduleRel,
    scheduleHash,
    operatorArtifact: pathRel,
    operatorRowsHash: document.meta.rowsHash,
    screenshotCount: 4,
    screenshotGames: document.summary.mappedGames,
    identityUnresolved: document.unresolved.length,
    scheduleWithoutDomesticMarket: document.summary.unmappedScheduleGames,
    imagesPersisted: false,
    summary: document.summary,
    unresolved: document.unresolved,
    unmappedSchedule: document.unmappedSchedule,
    resolvedThisRun: [
      {
        screen: "토론토블루:세인트카디 @04:07",
        gamePk: 822781,
        orientation: "left_home",
      },
      {
        screen: "샌디파드:샌프자이 @09:40",
        gamePk: 823269,
        orientation: "left_home",
      },
    ],
    cutoff: {
      capturedBeforeStart: document.meta.capturedBeforeStart,
      earliestCommenceUtc: document.games
        .map((g) => g.commenceTimeUtc)
        .sort()[0] ?? null,
      allMappedBeforeStart: document.games.every((g) => g.capturedBeforeStart),
    },
    marketPolicy: {
      MONEYLINE_2WAY: "SUPPORTED_V0_COMPARISON_NAMESPACE",
      TOTALS: "STORED_NOT_USED_V0",
      RUN_LINE: "STORED_NOT_USED_V0",
      "승①패": "DOMESTIC_THREE_WAY_SPECIAL_NOT_IMPLEMENTED",
      SUM: "UNSUPPORTED_OR_UNRESOLVED",
      FIRST_HALF: "NOT_IMPLEMENTED",
      overseasPriorReplacement: false,
    },
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
  const auditAbs = path.join(process.cwd(), auditRel);
  await mkdir(path.dirname(auditAbs), { recursive: true });
  await writeFile(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`dateKst=${DATE}`);
  console.log(`scheduleHash=${scheduleHash.slice(0, 16)}…`);
  console.log(
    `mapped=${document.summary.mappedGames}/${document.summary.totalScheduleGames}`,
  );
  console.log(`unresolved=${document.unresolved.length}`);
  console.log(`moneylineComplete=${document.summary.moneylineComplete}`);
  console.log(`totalsComplete=${document.summary.totalsComplete}`);
  console.log(`runLineComplete=${document.summary.runLineComplete}`);
  console.log(`unmapped=${JSON.stringify(document.unmappedSchedule)}`);
  console.log(`artifact=${pathRel}`);
  console.log(`audit=${auditRel}`);
  console.log("MLB_DOMESTIC_MARKETS_V1_INTAKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
