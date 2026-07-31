/**
 * KBO Odds UI adapter — primary research artifacts only (no Provider calls, no *.rev-*).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveKboTeamIdentity } from "@/lib/kbo/resolve-kbo-team-identity";
import type {
  KboOddsComparisonViewModel,
  KboOddsUiMarket,
  KboOddsUiNamespace,
} from "./kbo-odds-ui-types";

export type {
  KboOddsComparisonViewModel,
  KboOddsUiAvailability,
  KboOddsUiMarket,
  KboOddsUiNamespace,
} from "./kbo-odds-ui-types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function validDecimal(price: number | null): boolean {
  return price != null && Number.isFinite(price) && price > 1;
}
async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function isPrimaryJsonName(name: string): boolean {
  return name.endsWith(".json") && !name.includes(".rev-");
}

export function teamIds(homeName: string, awayName: string) {
  const home = resolveKboTeamIdentity(homeName);
  const away = resolveKboTeamIdentity(awayName);
  return {
    homeTeamId: home.canonicalTeamId,
    awayTeamId: away.canonicalTeamId,
    homeTeamName: home.canonicalNameKo ?? home.canonicalNameEn ?? homeName,
    awayTeamName: away.canonicalNameKo ?? away.canonicalNameEn ?? awayName,
  };
}

export function matchByCanonicalIds(
  rowHomeId: string | null,
  rowAwayId: string | null,
  targetHomeId: string | null,
  targetAwayId: string | null,
): boolean {
  return (
    !!rowHomeId &&
    !!rowAwayId &&
    !!targetHomeId &&
    !!targetAwayId &&
    rowHomeId === targetHomeId &&
    rowAwayId === targetAwayId
  );
}

function marketAvailability(
  home: number | null,
  away: number | null,
  invalidReasons: string[],
): KboOddsUiMarket["availability"] {
  if (invalidReasons.length > 0) return "INVALID";
  const h = validDecimal(home);
  const a = validDecimal(away);
  if (h && a) return "AVAILABLE";
  if (h || a) return "PARTIAL";
  return "MISSING";
}

function emptyMarket(
  namespace: KboOddsUiNamespace,
  sourceLabel: string,
  reason: string,
): KboOddsUiMarket {
  return {
    availability: "MISSING",
    namespace,
    sourceLabel,
    sourceType: null,
    homeTeamId: null,
    awayTeamId: null,
    homeTeamName: null,
    awayTeamName: null,
    homePrice: null,
    awayPrice: null,
    capturedAt: null,
    statusReason: reason,
    warnings: [],
    providerName: null,
    commercialUseStatus: null,
    format: null,
  };
}

type DomesticRow = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homePrice: number | null;
  awayPrice: number | null;
  status: string | null;
  sourceType: string | null;
  capturedAt: string | null;
  commercialUseStatus: string | null;
  pathRel: string;
};

type OverseasRow = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homePrice: number | null;
  awayPrice: number | null;
  status: string | null;
  capturedAt: string | null;
  providerName: string | null;
  formatOk: boolean;
  pathRel: string;
};

async function loadDomesticRows(
  dateKst: string,
  cwd: string,
): Promise<DomesticRow[]> {
  const protoRel = `data/research/kbo/${dateKst}-domestic-proto-snapshot-v1.json`;
  const proto = asRecord(await readJsonFile(path.join(cwd, protoRel)));
  if (proto) {
    const games = Array.isArray(proto.games) ? proto.games : [];
    return games
      .map((raw) => {
        const g = asRecord(raw);
        if (!g) return null;
        const home = asRecord(g.home);
        const away = asRecord(g.away);
        const status = asString(g.status);
        if (
          status &&
          !["MANUAL_COLLECTED", "ADMIN_VERIFIED", "COLLECTED"].includes(status)
        ) {
          return null;
        }
        return {
          gameId: asString(g.gameId) ?? "",
          homeTeam: asString(home?.team) ?? "",
          awayTeam: asString(away?.team) ?? "",
          homePrice: asNumber(home?.odds),
          awayPrice: asNumber(away?.odds),
          status,
          sourceType: asString(g.sourceType) ?? "ADMIN_MANUAL_SCREENSHOT",
          capturedAt: asString(g.capturedAt) ?? asString(g.enteredAt),
          commercialUseStatus: asString(g.commercialUseStatus),
          pathRel: protoRel,
        } satisfies DomesticRow;
      })
      .filter((x): x is DomesticRow => x != null && !!x.gameId);
  }

  const opRel = `data/operator-input/kbo/${dateKst}-operator-markets-v2.json`;
  const op = asRecord(await readJsonFile(path.join(cwd, opRel)));
  if (!op) return [];
  const games = Array.isArray(op.games) ? op.games : [];
  const out: DomesticRow[] = [];
  for (const raw of games) {
    const g = asRecord(raw);
    if (!g) continue;
    const markets = Array.isArray(g.markets) ? g.markets : [];
    const ml = markets
      .map((m) => asRecord(m))
      .find(
        (m) =>
          m &&
          asString(m.marketType) === "MONEYLINE_2WAY" &&
          (asString(m.marketNamespace) === "DOMESTIC_PROTO" ||
            asString(m.displayLabel)?.includes("국내") ||
            asString(m.displayLabel) === "승패"),
      );
    if (!ml) continue;
    const sels = Array.isArray(ml.selections) ? ml.selections : [];
    const homeSel = sels
      .map((s) => asRecord(s))
      .find((s) => s && asString(s.selectionCode) === "HOME");
    const awaySel = sels
      .map((s) => asRecord(s))
      .find((s) => s && asString(s.selectionCode) === "AWAY");
    out.push({
      gameId: asString(g.internalGameId) ?? "",
      homeTeam: asString(g.homeTeamText) ?? "",
      awayTeam: asString(g.awayTeamText) ?? "",
      homePrice: homeSel ? asNumber(homeSel.odds) : null,
      awayPrice: awaySel ? asNumber(awaySel.odds) : null,
      status: asString(ml.status) ?? "MANUAL_COLLECTED",
      sourceType: "ADMIN_MANUAL_SCREENSHOT",
      capturedAt: asString(op.capturedAt) ?? asString(op.enteredAt),
      commercialUseStatus: "INTERNAL_ONLY",
      pathRel: opRel,
    });
  }
  return out.filter((x) => !!x.gameId);
}

async function loadOverseasRows(
  dateKst: string,
  cwd: string,
): Promise<OverseasRow[]> {
  const histRel = `data/research/kbo/${dateKst}-odds-history-dataset-v1.json`;
  const hist = asRecord(await readJsonFile(path.join(cwd, histRel)));
  if (hist) {
    const games = Array.isArray(hist.games) ? hist.games : [];
    return games
      .map((raw) => {
        const g = asRecord(raw);
        if (!g) return null;
        const mapping = asRecord(g.mapping);
        const formatStatus = asString(g.formatValidationStatus);
        const formatOk =
          formatStatus == null ||
          formatStatus === "FORMAT_CONFIRMED_DECIMAL" ||
          formatStatus === "FORMAT_CONVERTED_FROM_AMERICAN";
        return {
          gameId: asString(g.gameId) ?? "",
          homeTeam:
            asString(g.homeTeam) ?? asString(mapping?.canonicalHomeTeam) ?? "",
          awayTeam:
            asString(g.awayTeam) ?? asString(mapping?.canonicalAwayTeam) ?? "",
          homePrice: asNumber(g.homeOdds),
          awayPrice: asNumber(g.awayOdds),
          status: asString(g.status),
          capturedAt:
            asString(g.capturedAt) ??
            asString(g.fetchedAt) ??
            asString(g.marketTimestamp),
          providerName: asString(g.bookmaker) ?? "The Odds API",
          formatOk,
          pathRel: histRel,
        } satisfies OverseasRow;
      })
      .filter((x): x is OverseasRow => x != null && !!x.gameId);
  }

  const cmpRel = `data/research/kbo/${dateKst}-odds-comparison-v1.json`;
  const cmp = asRecord(await readJsonFile(path.join(cwd, cmpRel)));
  if (!cmp) return [];
  const rows = Array.isArray(cmp.rows) ? cmp.rows : [];
  return rows
    .map((raw) => {
      const r = asRecord(raw);
      if (!r) return null;
      const ovs = asRecord(r.overseas);
      if (!ovs) return null;
      const sels = Array.isArray(ovs.selections) ? ovs.selections : [];
      const homeSel = sels
        .map((s) => asRecord(s))
        .find((s) => s && asString(s.selectionCode) === "HOME");
      const awaySel = sels
        .map((s) => asRecord(s))
        .find((s) => s && asString(s.selectionCode) === "AWAY");
      return {
        gameId: asString(r.gameId) ?? "",
        homeTeam: asString(r.homeTeam) ?? "",
        awayTeam: asString(r.awayTeam) ?? "",
        homePrice: homeSel ? asNumber(homeSel.odds) : null,
        awayPrice: awaySel ? asNumber(awaySel.odds) : null,
        status: "COLLECTED",
        capturedAt: asString(r.capturedAt),
        providerName: "The Odds API",
        formatOk: true,
        pathRel: cmpRel,
      } satisfies OverseasRow;
    })
    .filter((x): x is OverseasRow => x != null && !!x.gameId);
}

function findByGameOrCanon(
  rows: Array<{ gameId: string; homeTeam: string; awayTeam: string }>,
  gameId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
): { index: number; reason: string | null } {
  const byId = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.gameId === gameId);
  if (byId.length === 1) return { index: byId[0].i, reason: null };
  if (byId.length > 1) return { index: -1, reason: "MULTIPLE_MATCHES" };

  const byCanon = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => {
      const ids = teamIds(r.homeTeam, r.awayTeam);
      return matchByCanonicalIds(
        ids.homeTeamId,
        ids.awayTeamId,
        homeTeamId,
        awayTeamId,
      );
    });
  if (byCanon.length === 1) return { index: byCanon[0].i, reason: null };
  if (byCanon.length > 1) return { index: -1, reason: "MULTIPLE_MATCHES" };
  if (rows.length === 0) return { index: -1, reason: "MARKET_NOT_FOUND" };
  return { index: -1, reason: "GAME_ID_MISMATCH" };
}

function toDomesticMarket(
  row: DomesticRow | null,
  reason: string | null,
): KboOddsUiMarket {
  if (!row) {
    return emptyMarket(
      "DOMESTIC_PROTO",
      "국내 프로토 — 관리자 입력",
      reason ?? "MARKET_NOT_FOUND",
    );
  }
  const ids = teamIds(row.homeTeam, row.awayTeam);
  const invalid: string[] = [];
  if (row.homePrice != null && !validDecimal(row.homePrice)) {
    invalid.push("HOME_PRICE_INVALID");
  }
  if (row.awayPrice != null && !validDecimal(row.awayPrice)) {
    invalid.push("AWAY_PRICE_INVALID");
  }
  const availability = marketAvailability(
    row.homePrice,
    row.awayPrice,
    invalid,
  );
  return {
    availability,
    namespace: "DOMESTIC_PROTO",
    sourceLabel: "국내 프로토 — 관리자 입력",
    sourceType: row.sourceType,
    homeTeamId: ids.homeTeamId,
    awayTeamId: ids.awayTeamId,
    homeTeamName: ids.homeTeamName,
    awayTeamName: ids.awayTeamName,
    homePrice: validDecimal(row.homePrice) ? row.homePrice : null,
    awayPrice: validDecimal(row.awayPrice) ? row.awayPrice : null,
    capturedAt: row.capturedAt,
    statusReason:
      availability === "AVAILABLE"
        ? null
        : availability === "PARTIAL"
          ? "PARTIAL_MARKET"
          : (invalid[0] ?? reason),
    warnings:
      row.commercialUseStatus === "INTERNAL_ONLY"
        ? ["COMMERCIAL_USE_INTERNAL_ONLY"]
        : [],
    providerName: null,
    commercialUseStatus: row.commercialUseStatus,
    format: "DECIMAL",
  };
}

function toOverseasMarket(
  row: OverseasRow | null,
  reason: string | null,
  scheduledStartTime: string | null,
): KboOddsUiMarket {
  if (!row) {
    return emptyMarket(
      "OVERSEAS_MARKET",
      "해외 시장 · API",
      reason ?? "MARKET_NOT_FOUND",
    );
  }
  const ids = teamIds(row.homeTeam, row.awayTeam);
  const invalid: string[] = [];
  const warnings: string[] = [];
  if (row.status && row.status !== "COLLECTED" && row.status !== "PARTIAL") {
    if (row.status === "FORMAT_MISMATCH") invalid.push("FORMAT_MISMATCH");
    else if (row.status === "ODDS_AFTER_CUTOFF") invalid.push("ODDS_AFTER_CUTOFF");
    else warnings.push(`STATUS_${row.status}`);
  }
  if (!row.formatOk) invalid.push("FORMAT_INVALID");
  if (row.homePrice != null && !validDecimal(row.homePrice)) {
    invalid.push("HOME_PRICE_INVALID");
  }
  if (row.awayPrice != null && !validDecimal(row.awayPrice)) {
    invalid.push("AWAY_PRICE_INVALID");
  }
  const startMs = scheduledStartTime ? Date.parse(scheduledStartTime) : NaN;
  const capturedMs = row.capturedAt ? Date.parse(row.capturedAt) : NaN;
  if (
    Number.isFinite(startMs) &&
    Number.isFinite(capturedMs) &&
    capturedMs >= startMs
  ) {
    invalid.push("ODDS_AFTER_CUTOFF");
  }
  const availability = marketAvailability(
    row.homePrice,
    row.awayPrice,
    invalid,
  );
  return {
    availability,
    namespace: "OVERSEAS_MARKET",
    sourceLabel: "해외 시장 · API",
    sourceType: "LICENSED_API_PROVIDER",
    homeTeamId: ids.homeTeamId,
    awayTeamId: ids.awayTeamId,
    homeTeamName: ids.homeTeamName,
    awayTeamName: ids.awayTeamName,
    homePrice: validDecimal(row.homePrice) ? row.homePrice : null,
    awayPrice: validDecimal(row.awayPrice) ? row.awayPrice : null,
    capturedAt: row.capturedAt,
    statusReason:
      availability === "AVAILABLE"
        ? null
        : (invalid[0] ?? reason ?? "MARKET_NOT_FOUND"),
    warnings,
    providerName: row.providerName,
    commercialUseStatus: null,
    format: "DECIMAL",
  };
}

export async function loadKboOddsComparisonViewModel(input: {
  dateKst: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  scheduledStartTime?: string | null;
  cwd?: string;
}): Promise<KboOddsComparisonViewModel> {
  const cwd = input.cwd ?? process.cwd();
  const homeIds = resolveKboTeamIdentity(input.homeTeam);
  const awayIds = resolveKboTeamIdentity(input.awayTeam);
  const domesticRows = await loadDomesticRows(input.dateKst, cwd);
  const overseasRows = await loadOverseasRows(input.dateKst, cwd);

  const dHit = findByGameOrCanon(
    domesticRows,
    input.gameId,
    homeIds.canonicalTeamId,
    awayIds.canonicalTeamId,
  );
  const oHit = findByGameOrCanon(
    overseasRows,
    input.gameId,
    homeIds.canonicalTeamId,
    awayIds.canonicalTeamId,
  );
  const domesticRow = dHit.index >= 0 ? domesticRows[dHit.index] : null;
  const overseasRow = oHit.index >= 0 ? overseasRows[oHit.index] : null;

  return {
    gameId: input.gameId,
    dateKst: input.dateKst,
    homeTeam: homeIds.canonicalNameKo ?? input.homeTeam,
    awayTeam: awayIds.canonicalNameKo ?? input.awayTeam,
    homeTeamId: homeIds.canonicalTeamId,
    awayTeamId: awayIds.canonicalTeamId,
    scheduledStartTime: input.scheduledStartTime ?? null,
    domestic: toDomesticMarket(domesticRow, dHit.reason),
    overseas: toOverseasMarket(
      overseasRow,
      oHit.reason,
      input.scheduledStartTime ?? null,
    ),
    pathRel: {
      domestic: domesticRow?.pathRel ?? null,
      overseas: overseasRow?.pathRel ?? null,
    },
    mappingReason: dHit.reason ?? oHit.reason,
  };
}

export function kboOddsDebugPass(market: KboOddsUiMarket): boolean {
  return (
    market.availability === "AVAILABLE" &&
    validDecimal(market.homePrice) &&
    validDecimal(market.awayPrice)
  );
}

export function buildDomesticMarketFromPrices(input: {
  status: string;
  homePrice: number | null;
  awayPrice: number | null;
  homeTeam?: string;
  awayTeam?: string;
}): KboOddsUiMarket {
  return toDomesticMarket(
    {
      gameId: "test",
      homeTeam: input.homeTeam ?? "두산",
      awayTeam: input.awayTeam ?? "LG",
      homePrice: input.homePrice,
      awayPrice: input.awayPrice,
      status: input.status,
      sourceType: "ADMIN_MANUAL_SCREENSHOT",
      capturedAt: "2026-07-31T09:00:00.000Z",
      commercialUseStatus: "INTERNAL_ONLY",
      pathRel: "test",
    },
    null,
  );
}

export function buildOverseasMarketFromPrices(input: {
  status: string;
  homePrice: number | null;
  awayPrice: number | null;
  homeTeam?: string;
  awayTeam?: string;
  capturedAt?: string;
  scheduledStartTime?: string;
}): KboOddsUiMarket {
  return toOverseasMarket(
    {
      gameId: "test",
      homeTeam: input.homeTeam ?? "Doosan Bears",
      awayTeam: input.awayTeam ?? "LG Twins",
      homePrice: input.homePrice,
      awayPrice: input.awayPrice,
      status: input.status,
      capturedAt: input.capturedAt ?? "2026-07-31T08:52:41.546Z",
      providerName: "1xBet",
      formatOk: true,
      pathRel: "test",
    },
    null,
    input.scheduledStartTime ?? "2026-07-31T18:30:00+09:00",
  );
}
