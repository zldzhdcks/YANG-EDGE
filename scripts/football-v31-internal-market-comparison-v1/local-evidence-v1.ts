import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {
  RELATIVE_DEFAULT_MARKET_FILE,
  type OwnerOnlyMarketRow,
} from "./contract-v1";

export function resolveMarketEvidenceFile(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const override = env.FOOTBALL_V31_INTERNAL_MARKET_EVIDENCE?.trim();
  if (override) return override;
  return join(cwd, ...RELATIVE_DEFAULT_MARKET_FILE.split("/"));
}

function isSelection(value: unknown): value is OwnerOnlyMarketRow["selection"] {
  return (
    value === "HOME" ||
    value === "DRAW" ||
    value === "AWAY" ||
    value === "HOME_DRAW_AWAY" ||
    value === "OVER" ||
    value === "UNDER" ||
    value === "HANDICAP_HOME" ||
    value === "HANDICAP_AWAY"
  );
}

function parseRow(raw: unknown): OwnerOnlyMarketRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const odds = row.odds as Record<string, unknown> | undefined;
  if (
    typeof row.fixtureId !== "number" ||
    typeof row.leagueId !== "number" ||
    typeof row.season !== "number" ||
    typeof row.kickoffUtc !== "string" ||
    typeof row.homeTeamId !== "number" ||
    typeof row.awayTeamId !== "number" ||
    typeof row.observedAt !== "string" ||
    (row.marketType !== "1X2" && row.marketType !== "TOTAL" && row.marketType !== "HANDICAP") ||
    !isSelection(row.selection) ||
    typeof row.sourceSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.sourceSha256) ||
    row.roundIdentityConfirmed !== false ||
    row.captureTimeVerified !== false ||
    !odds
  ) {
    return null;
  }
  return {
    fixtureId: row.fixtureId,
    leagueId: row.leagueId,
    season: row.season,
    kickoffUtc: row.kickoffUtc,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    observedAt: row.observedAt,
    marketType: row.marketType,
    line: typeof row.line === "string" || row.line === null ? row.line : null,
    selection: row.selection,
    odds: {
      home: typeof odds.home === "number" || odds.home === null ? odds.home : null,
      draw: typeof odds.draw === "number" || odds.draw === null ? odds.draw : null,
      away: typeof odds.away === "number" || odds.away === null ? odds.away : null,
    },
    sourceSha256: row.sourceSha256,
    roundIdentityConfirmed: false,
    captureTimeVerified: false,
  };
}

export function loadOwnerOnlyMarkets(file: string): OwnerOnlyMarketRow[] {
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    rows?: unknown;
    payload?: {rows?: unknown};
  };
  const rows = Array.isArray(parsed.rows)
    ? parsed.rows
    : Array.isArray(parsed.payload?.rows)
      ? parsed.payload.rows
      : [];
  return rows.map(parseRow).filter((row): row is OwnerOnlyMarketRow => row !== null);
}
