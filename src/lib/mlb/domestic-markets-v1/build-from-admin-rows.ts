/**
 * Build MLB domestic markets artifact from admin-verified screenshot rows.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type {
  DomesticMarketGameRow,
  MlbDomesticMarketsDocument,
  NormalizedDomesticMarket,
  RawDomesticMarket,
  UnresolvedDomesticRow,
} from "./types";
import { MLB_DOMESTIC_MARKETS_SCHEMA } from "./types";

export type AdminScreenshotGameRow = {
  displayOrder: number;
  screenLeftTeamKo: string;
  screenRightTeamKo: string;
  screenStartKst: string;
  moneyline: [number, number];
  threeWay: [number, number, number];
  runLine: { homeHandicap: number; prices: [number, number] };
  totals: { line: number; underFirst: true; prices: [number, number] };
  sum: [number, number];
  firstHalf?: {
    threeWay: [number, number, number];
    runLine: { homeHandicap: number; prices: [number, number] };
    totals: { line: number; prices: [number, number] };
  };
};

type ScheduleGame = {
  internalGameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  startTimeKst: string;
  commenceTimeUtc: string;
  statusAbstract: string;
  statusDetailed: string;
};

const TEAM_ALIASES: Record<string, string> = {
  토론토: "Toronto Blue Jays",
  토론토블루: "Toronto Blue Jays",
  샌디에이고: "San Diego Padres",
  샌디파드: "San Diego Padres",
  탬파베이: "Tampa Bay Rays",
  "시카고 화이트삭스": "Chicago White Sox",
  시애틀: "Seattle Mariners",
  미네소타: "Minnesota Twins",
  "뉴욕 메츠": "New York Mets",
  마이애미: "Miami Marlins",
  신시내티: "Cincinnati Reds",
  피츠버그: "Pittsburgh Pirates",
  볼티모어: "Baltimore Orioles",
  필라델피아: "Philadelphia Phillies",
  휴스턴: "Houston Astros",
  텍사스: "Texas Rangers",
  클리블랜드: "Cleveland Guardians",
  애리조나: "Arizona Diamondbacks",
  "시카고 컵스": "Chicago Cubs",
  "뉴욕 양키스": "New York Yankees",
  애틀랜타: "Atlanta Braves",
  워싱턴: "Washington Nationals",
  "LA 다저스": "Los Angeles Dodgers",
  보스턴: "Boston Red Sox",
  "LA 에인절스": "Los Angeles Angels",
  밀워키: "Milwaukee Brewers",
  애슬레틱스: "Athletics",
  디트로이트: "Detroit Tigers",
  세인트루이스: "St. Louis Cardinals",
  세인트카디: "St. Louis Cardinals",
  카디널스: "St. Louis Cardinals",
  샌프란시스코: "San Francisco Giants",
  샌프자이: "San Francisco Giants",
  자이언츠: "San Francisco Giants",
  콜로라도: "Colorado Rockies",
  캔자스시티: "Kansas City Royals",
};

function canonicalTeam(ko: string): string | null {
  const key = ko.trim();
  return TEAM_ALIASES[key] ?? null;
}

function priceOk(n: number): boolean {
  return Number.isFinite(n) && n > 1;
}

function fileSha256(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function buildMarkets(row: AdminScreenshotGameRow): {
  raw: RawDomesticMarket[];
  normalized: NormalizedDomesticMarket[];
} {
  const raw: RawDomesticMarket[] = [
    {
      rawMarketCode: "MONEYLINE_2WAY",
      screenLabel: "승패",
      prices: [...row.moneyline],
      line: null,
      sideHint: "screenLeft/screenRight",
    },
    {
      rawMarketCode: "승①패",
      screenLabel: "승①패",
      prices: [...row.threeWay],
      line: null,
      sideHint: "home/draw/away screen order",
      notes: [
        "Settlement rule vs standard MLB 1X2 not confirmed; stored as DOMESTIC_THREE_WAY_SPECIAL",
      ],
    },
    {
      rawMarketCode: "H_RUN_LINE",
      screenLabel: `H ${row.runLine.homeHandicap >= 0 ? "+" : ""}${row.runLine.homeHandicap}`,
      prices: [...row.runLine.prices],
      line: row.runLine.homeHandicap,
      sideHint: "H=home handicap",
    },
    {
      rawMarketCode: "U_TOTALS",
      screenLabel: `U ${row.totals.line}`,
      prices: [...row.totals.prices],
      line: row.totals.line,
      sideHint: "Under listed first then Over",
    },
    {
      rawMarketCode: "SUM",
      screenLabel: "SUM",
      prices: [...row.sum],
      line: null,
      sideHint: null,
      notes: ["Meaning unresolved vs standard markets"],
    },
  ];

  const normalized: NormalizedDomesticMarket[] = [];

  if (priceOk(row.moneyline[0]) && priceOk(row.moneyline[1])) {
    normalized.push({
      marketType: "MONEYLINE_2WAY",
      homePrice: row.moneyline[0],
      awayPrice: row.moneyline[1],
      predictionSupport: "SUPPORTED_V0",
    });
  }

  if (
    priceOk(row.threeWay[0]) &&
    priceOk(row.threeWay[1]) &&
    priceOk(row.threeWay[2])
  ) {
    normalized.push({
      marketType: "DOMESTIC_THREE_WAY_SPECIAL",
      rawMarketCode: "승①패",
      homeWinPrice: row.threeWay[0],
      drawPrice: row.threeWay[1],
      awayWinPrice: row.threeWay[2],
      predictionSupport: "NOT_IMPLEMENTED",
    });
  }

  if (priceOk(row.runLine.prices[0]) && priceOk(row.runLine.prices[1])) {
    normalized.push({
      marketType: "RUN_LINE",
      line: Math.abs(row.runLine.homeHandicap),
      homeHandicap: row.runLine.homeHandicap,
      homePrice: row.runLine.prices[0],
      awayPrice: row.runLine.prices[1],
      predictionSupport: "STORED_NOT_USED_V0",
    });
  }

  if (priceOk(row.totals.prices[0]) && priceOk(row.totals.prices[1])) {
    normalized.push({
      marketType: "TOTALS",
      line: row.totals.line,
      underPrice: row.totals.prices[0],
      overPrice: row.totals.prices[1],
      predictionSupport: "STORED_NOT_USED_V0",
    });
  }

  normalized.push({
    marketType: "UNSUPPORTED_OR_UNRESOLVED",
    rawMarketCode: "SUM",
    prices: [...row.sum],
    line: null,
    predictionSupport: "EXCLUDED",
  });

  if (row.firstHalf) {
    raw.push(
      {
        rawMarketCode: "h_THREE_WAY",
        screenLabel: "h(전반)",
        prices: [...row.firstHalf.threeWay],
        line: null,
        sideHint: "first half 1X2",
      },
      {
        rawMarketCode: "h_H_RUN_LINE",
        screenLabel: `h H ${row.firstHalf.runLine.homeHandicap >= 0 ? "+" : ""}${row.firstHalf.runLine.homeHandicap}`,
        prices: [...row.firstHalf.runLine.prices],
        line: row.firstHalf.runLine.homeHandicap,
        sideHint: "first half home handicap",
      },
      {
        rawMarketCode: "h_U_TOTALS",
        screenLabel: `h U ${row.firstHalf.totals.line}`,
        prices: [...row.firstHalf.totals.prices],
        line: row.firstHalf.totals.line,
        sideHint: "first half under/over",
      },
    );
    normalized.push(
      {
        marketType: "FIRST_HALF_THREE_WAY",
        prices: row.firstHalf.threeWay,
        predictionSupport: "NOT_IMPLEMENTED",
      },
      {
        marketType: "FIRST_HALF_RUN_LINE",
        homeHandicap: row.firstHalf.runLine.homeHandicap,
        homePrice: row.firstHalf.runLine.prices[0],
        awayPrice: row.firstHalf.runLine.prices[1],
        predictionSupport: "NOT_IMPLEMENTED",
      },
      {
        marketType: "FIRST_HALF_TOTALS",
        line: row.firstHalf.totals.line,
        underPrice: row.firstHalf.totals.prices[0],
        overPrice: row.firstHalf.totals.prices[1],
        predictionSupport: "NOT_IMPLEMENTED",
      },
    );
  }

  return { raw, normalized };
}

function findExactPair(
  schedule: ScheduleGame[],
  leftCanon: string,
  rightCanon: string,
  startKst: string,
): { game: ScheduleGame; orientation: "left_home" | "left_away" } | null {
  const matches: Array<{
    game: ScheduleGame;
    orientation: "left_home" | "left_away";
  }> = [];
  for (const g of schedule) {
    if (g.startTimeKst !== startKst) continue;
    if (g.homeTeam === leftCanon && g.awayTeam === rightCanon) {
      matches.push({ game: g, orientation: "left_home" });
    } else if (g.homeTeam === rightCanon && g.awayTeam === leftCanon) {
      matches.push({ game: g, orientation: "left_away" });
    }
  }
  if (matches.length === 1) return matches[0]!;
  return null;
}

/** Reorder ML/3way/RL prices so normalized home/away match schedule home/away. */
function orientRow(
  row: AdminScreenshotGameRow,
  orientation: "left_home" | "left_away",
): AdminScreenshotGameRow {
  if (orientation === "left_home") return row;
  return {
    ...row,
    moneyline: [row.moneyline[1], row.moneyline[0]],
    threeWay: [row.threeWay[2], row.threeWay[1], row.threeWay[0]],
    runLine: {
      // Screen H referred to screen-left; after flip, schedule home was screen-right
      // → invert handicap sign and swap prices.
      homeHandicap: -row.runLine.homeHandicap,
      prices: [row.runLine.prices[1], row.runLine.prices[0]],
    },
    // totals/sum unchanged (not team-directional)
  };
}

export async function buildMlbDomesticMarketsV1(input: {
  dateKst: string;
  cwd?: string;
  observedAt: string;
  enteredAt: string;
  screenshotCount: number;
  adminRows: AdminScreenshotGameRow[];
  unresolvedExtras?: UnresolvedDomesticRow[];
}): Promise<{
  document: MlbDomesticMarketsDocument;
  pathRel: string;
  scheduleHash: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  const scheduleRel = `data/research/mlb/${input.dateKst}-schedule-v1.json`;
  const raw = await readFile(path.join(cwd, scheduleRel), "utf8");
  const scheduleHash = fileSha256(raw);
  const scheduleDoc = JSON.parse(raw) as {
    meta?: { dateKst?: string };
    games: ScheduleGame[];
  };
  if (scheduleDoc.meta?.dateKst !== input.dateKst) {
    throw new Error("SCHEDULE_DATE_MISMATCH");
  }

  const schedule = scheduleDoc.games;
  const mapped: DomesticMarketGameRow[] = [];
  const unresolved: UnresolvedDomesticRow[] = [
    ...(input.unresolvedExtras ?? []),
  ];
  const mappedPks = new Set<number>();

  for (const admin of input.adminRows) {
    const leftCanon = canonicalTeam(admin.screenLeftTeamKo);
    const rightCanon = canonicalTeam(admin.screenRightTeamKo);
    if (!leftCanon || !rightCanon) {
      unresolved.push({
        reason: "IDENTITY_UNRESOLVED",
        displayOrder: admin.displayOrder,
        screenLeftTeam: admin.screenLeftTeamKo,
        screenRightTeam: admin.screenRightTeamKo,
        screenStartKst: admin.screenStartKst,
        detail: `canonical missing left=${leftCanon} right=${rightCanon}`,
      });
      continue;
    }

    const hit = findExactPair(
      schedule,
      leftCanon,
      rightCanon,
      admin.screenStartKst,
    );
    if (!hit) {
      unresolved.push({
        reason: "IDENTITY_UNRESOLVED",
        displayOrder: admin.displayOrder,
        screenLeftTeam: admin.screenLeftTeamKo,
        screenRightTeam: admin.screenRightTeamKo,
        screenStartKst: admin.screenStartKst,
        detail: `no exact schedule pair+time for ${leftCanon} vs ${rightCanon} @ ${admin.screenStartKst}`,
      });
      continue;
    }

    if (mappedPks.has(hit.game.gamePk)) {
      unresolved.push({
        reason: "DUPLICATE_MAPPING",
        displayOrder: admin.displayOrder,
        screenLeftTeam: admin.screenLeftTeamKo,
        screenRightTeam: admin.screenRightTeamKo,
        screenStartKst: admin.screenStartKst,
        detail: `gamePk ${hit.game.gamePk} already mapped`,
      });
      continue;
    }

    const observedMs = Date.parse(input.observedAt);
    const enteredMs = Date.parse(input.enteredAt);
    const commenceMs = Date.parse(hit.game.commenceTimeUtc);
    const beforeStart =
      Number.isFinite(observedMs) &&
      Number.isFinite(enteredMs) &&
      Number.isFinite(commenceMs) &&
      observedMs < commenceMs &&
      enteredMs < commenceMs;

    if (!beforeStart) {
      unresolved.push({
        reason: "BLOCKED_AFTER_CUTOFF",
        displayOrder: admin.displayOrder,
        screenLeftTeam: admin.screenLeftTeamKo,
        screenRightTeam: admin.screenRightTeamKo,
        screenStartKst: admin.screenStartKst,
        detail: `observed/entered not before commence ${hit.game.commenceTimeUtc}`,
      });
      continue;
    }

    const oriented = orientRow(admin, hit.orientation);
    const { raw: rawMarkets, normalized } = buildMarkets(oriented);

    mappedPks.add(hit.game.gamePk);
    mapped.push({
      gamePk: hit.game.gamePk,
      internalGameId: hit.game.internalGameId,
      homeTeam: hit.game.homeTeam,
      awayTeam: hit.game.awayTeam,
      homeTeamId: hit.game.homeTeamId,
      awayTeamId: hit.game.awayTeamId,
      commenceTimeUtc: hit.game.commenceTimeUtc,
      startTimeKst: hit.game.startTimeKst,
      displayOrder: admin.displayOrder,
      screenLeftTeam: admin.screenLeftTeamKo,
      screenRightTeam: admin.screenRightTeamKo,
      screenLeftCanonical: leftCanon,
      screenRightCanonical: rightCanon,
      mappingMethod: `EXACT_TEAM_PAIR_AND_START_TIME; orientation=${hit.orientation}`,
      cutoffStatus: "PASS",
      capturedBeforeStart: true,
      rawMarkets,
      normalizedMarkets: normalized,
    });
  }

  const unmappedSchedule = schedule
    .filter((g) => !mappedPks.has(g.gamePk))
    .map((g) => ({
      gamePk: g.gamePk,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      startTimeKst: g.startTimeKst,
      reason: "SCREENSHOT_ROW_NOT_PROVIDED",
      status: "NOT_ENTERED" as const,
    }));

  const marketCounts: Record<string, number> = {};
  let moneylineComplete = 0;
  let totalsComplete = 0;
  let runLineComplete = 0;
  let specialMarketsRawOnly = 0;
  for (const g of mapped) {
    for (const m of g.normalizedMarkets) {
      marketCounts[m.marketType] = (marketCounts[m.marketType] ?? 0) + 1;
      if (m.marketType === "MONEYLINE_2WAY") moneylineComplete++;
      if (m.marketType === "TOTALS") totalsComplete++;
      if (m.marketType === "RUN_LINE") runLineComplete++;
      if (
        m.marketType === "DOMESTIC_THREE_WAY_SPECIAL" ||
        m.marketType === "UNSUPPORTED_OR_UNRESOLVED" ||
        m.marketType.startsWith("FIRST_HALF")
      ) {
        specialMarketsRawOnly++;
      }
    }
  }

  const pathRel = `data/operator-input/mlb/${input.dateKst}-domestic-markets-v1.json`;
  const gamesForHash = mapped.map((g) => ({
    gamePk: g.gamePk,
    normalizedMarkets: g.normalizedMarkets,
    rawMarkets: g.rawMarkets,
  }));
  const rowsHash = sha256(gamesForHash);

  const document: MlbDomesticMarketsDocument = {
    meta: {
      schemaVersion: MLB_DOMESTIC_MARKETS_SCHEMA,
      dateKst: input.dateKst,
      observedAt: input.observedAt,
      enteredAt: input.enteredAt,
      sourceType: "ADMIN_MANUAL_SCREENSHOT",
      extractionMethod: "MANUAL_VISUAL_CONFIRMATION",
      confirmationMethod: "ADMIN_VERIFIED",
      commercialUseStatus: "INTERNAL_ONLY",
      screenshotCount: input.screenshotCount,
      scheduleArtifact: scheduleRel,
      scheduleHash,
      rowsHash,
      marketCounts,
      unresolvedRows: unresolved.length,
      cancelledExcluded: 0,
      capturedBeforeStart: true,
      namespace: "DOMESTIC_OPERATOR_COMPARISON",
      doesNotReplaceOverseasPrior: true,
    },
    summary: {
      totalScheduleGames: schedule.length,
      mappedGames: mapped.length,
      unmappedScheduleGames: unmappedSchedule.length,
      moneylineComplete,
      totalsComplete,
      runLineComplete,
      specialMarketsRawOnly,
    },
    games: mapped.sort((a, b) => a.displayOrder - b.displayOrder),
    unresolved,
    unmappedSchedule,
  };

  return { document, pathRel, scheduleHash };
}

export function mlbDomesticMarketsRel(dateKst: string): string {
  return `data/operator-input/mlb/${dateKst}-domestic-markets-v1.json`;
}
