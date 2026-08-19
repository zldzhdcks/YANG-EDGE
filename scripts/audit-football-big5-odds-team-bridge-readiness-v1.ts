/**
 * Football Big-5 Odds Team Bridge Readiness Audit v1.
 * Existing code + existing artifacts only. No Provider calls.
 *
 *   npm run audit:football-big5-odds-team-bridge-readiness-v1
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FOOTBALL_TEAM_CATALOG_V1 } from "../src/lib/football/core/team-catalog";
import type { FootballScheduleRowV1 } from "../src/lib/football/core/types";
import { FOOTBALL_COMPETITION_PROFILES_V1 } from "../src/lib/football/competition/profiles";
import { FOOTBALL_ODDS_SPORT_KEY_MAP_V1 } from "../src/lib/football/odds-1x2-v1/sport-keys";
import {
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  getOddsTeamNames,
} from "../src/lib/football/odds-1x2-v1/team-bridge";
import { FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES } from "../src/lib/football/odds-1x2-v1/types";

export const AUDIT_REL =
  "data/audits/football-big5-odds-team-bridge-readiness-v1.json";
export const SCHEMA =
  "yang-edge-football-big5-odds-team-bridge-readiness-v1";

export const FROZEN_REL = {
  schedule: "data/research/football/2026-08-20-schedule-v1.json",
  odds0818: "data/research/football/2026-08-18-1x2-odds-v1.json",
  hybrid: "data/audits/football-schedule-hybrid-identity-gate-v1.json",
} as const;

const BIG5 = [
  {
    key: "EPL" as const,
    competitionId: "fb-comp-api-football-39",
    canonicalName: "Premier League",
  },
  {
    key: "LaLiga" as const,
    competitionId: "fb-comp-api-football-140",
    canonicalName: "La Liga",
  },
  {
    key: "SerieA" as const,
    competitionId: "fb-comp-api-football-135",
    canonicalName: "Serie A",
  },
  {
    key: "Bundesliga" as const,
    competitionId: "fb-comp-api-football-78",
    canonicalName: "Bundesliga",
  },
  {
    key: "Ligue1" as const,
    competitionId: "fb-comp-api-football-61",
    canonicalName: "Ligue 1",
  },
];

const SCHEDULE_DATES = [
  "2026-08-12",
  "2026-08-14",
  "2026-08-16",
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
] as const;

type SportKeyStatus =
  | "LIVE_VERIFIED"
  | "HISTORICAL_VERIFIED"
  | "CONFIGURED_NOT_PROVEN"
  | "MISSING";

type OddsEventLite = {
  sourceRel: string;
  sportKey: string;
  oddsProviderEventId: string;
  home: string;
  away: string;
  commenceTime: string;
  timing: "pregame" | "unknown";
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function readJson<T>(abs: string): T {
  return JSON.parse(readFileSync(abs, "utf8")) as T;
}

function minutesBetween(aIso: string, bIso: string): number | null {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60_000;
}

function catalogByProviderId(): Map<string, (typeof FOOTBALL_TEAM_CATALOG_V1)[number]> {
  return new Map(
    FOOTBALL_TEAM_CATALOG_V1.map((t) => [t.providerTeamId, t]),
  );
}

function bridgeByCanonical(): Map<string, (typeof FOOTBALL_ODDS_TEAM_BRIDGE_V1)[number]> {
  return new Map(
    FOOTBALL_ODDS_TEAM_BRIDGE_V1.map((e) => [e.canonicalTeamId, e]),
  );
}

function assertCompetitionIds(): void {
  for (const league of BIG5) {
    const profile = FOOTBALL_COMPETITION_PROFILES_V1.find(
      (p) => p.competitionId === league.competitionId,
    );
    if (!profile) {
      throw new Error(`COMPETITION_PROFILE_MISSING:${league.competitionId}`);
    }
    if (profile.canonicalName !== league.canonicalName) {
      throw new Error(
        `COMPETITION_NAME_MISMATCH:${league.competitionId} profile=${profile.canonicalName} expected=${league.canonicalName}`,
      );
    }
  }
}

function loadSchedules(cwd: string): Array<{
  dateKst: string;
  rel: string;
  rows: FootballScheduleRowV1[];
}> {
  const out: Array<{ dateKst: string; rel: string; rows: FootballScheduleRowV1[] }> = [];
  for (const dateKst of SCHEDULE_DATES) {
    const rel = `data/research/football/${dateKst}-schedule-v1.json`;
    const abs = path.join(cwd, rel);
    if (!existsSync(abs)) continue;
    const doc = readJson<{ rows: FootballScheduleRowV1[] }>(abs);
    out.push({ dateKst, rel, rows: doc.rows });
  }
  return out;
}

function sportKeyStatusFor(competitionId: string, cwd: string): {
  sportKey: string | null;
  source: string | null;
  status: SportKeyStatus;
  liveExactVerified: boolean;
  historicalOnly: boolean;
  lastEvidenceDate: string | null;
  confidence: string;
  evidence: string[];
} {
  const mapped = FOOTBALL_ODDS_SPORT_KEY_MAP_V1.find(
    (e) => e.competitionId === competitionId,
  );
  if (!mapped) {
    return {
      sportKey: null,
      source: null,
      status: "MISSING",
      liveExactVerified: false,
      historicalOnly: false,
      lastEvidenceDate: null,
      confidence: "none",
      evidence: [],
    };
  }
  const historicalRel = "data/audits/multi-sport-historical-odds-coverage-audit-v1.json";
  const historical = existsSync(path.join(cwd, historicalRel))
    ? readJson<{
        leagueCoverage?: Array<{
          providerSportKey?: string;
          coverageStatus?: string;
          earliestDocumentedSnapshot?: string;
        }>;
      }>(path.join(cwd, historicalRel))
    : { leagueCoverage: [] };
  const histRow = (historical.leagueCoverage ?? []).find(
    (s) => s.providerSportKey === mapped.sportKey,
  );
  const laLigaEvidenceRel =
    "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json";
  const laLigaAbs = path.join(cwd, laLigaEvidenceRel);
  if (competitionId === "fb-comp-api-football-140" && existsSync(laLigaAbs)) {
    const ev = readJson<{
      observedAt?: string;
      sportKey?: string;
      sportKeyExactMatch?: { key?: string; title?: string; active?: boolean };
    }>(laLigaAbs);
    const live =
      ev.sportKeyExactMatch?.key === mapped.sportKey &&
      ev.sportKeyExactMatch?.active === true;
    if (live) {
      return {
        sportKey: mapped.sportKey,
        source: mapped.source,
        status: "LIVE_VERIFIED",
        liveExactVerified: true,
        historicalOnly: false,
        lastEvidenceDate: ev.observedAt ?? null,
        confidence: "high",
        evidence: [
          laLigaEvidenceRel,
          `sportKeyExactMatch.key=${ev.sportKeyExactMatch?.key}`,
          `title=${ev.sportKeyExactMatch?.title ?? ""}`,
        ],
      };
    }
  }
  if (histRow?.coverageStatus === "DOCUMENTED_AVAILABLE_NOT_PROBED") {
    return {
      sportKey: mapped.sportKey,
      source: mapped.source,
      status: "CONFIGURED_NOT_PROVEN",
      liveExactVerified: false,
      historicalOnly: true,
      lastEvidenceDate: histRow.earliestDocumentedSnapshot ?? null,
      confidence: "historical-key-only",
      evidence: [
        historicalRel,
        `coverageStatus=${histRow.coverageStatus}`,
        "code map exists; no live /sports exact-key football artifact",
      ],
    };
  }
  return {
    sportKey: mapped.sportKey,
    source: mapped.source,
    status: "CONFIGURED_NOT_PROVEN",
    liveExactVerified: false,
    historicalOnly: true,
    lastEvidenceDate: null,
    confidence: "code-only",
    evidence: [mapped.source],
  };
}

function collectOddsEvents(cwd: string): OddsEventLite[] {
  const events: OddsEventLite[] = [];
  const evidenceRel =
    "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json";
  const evidenceAbs = path.join(cwd, evidenceRel);
  if (existsSync(evidenceAbs)) {
    const doc = readJson<{
      events?: Array<{
        oddsProviderEventId: string;
        sportKey: string;
        rawHomeTeam: string;
        rawAwayTeam: string;
        commenceTime: string;
      }>;
    }>(evidenceAbs);
    for (const e of doc.events ?? []) {
      events.push({
        sourceRel: evidenceRel,
        sportKey: e.sportKey,
        oddsProviderEventId: e.oddsProviderEventId,
        home: e.rawHomeTeam,
        away: e.rawAwayTeam,
        commenceTime: e.commenceTime,
        timing: "unknown",
      });
    }
  }
  const oddsFiles = [
    "data/research/football/2026-08-12-1x2-odds-v1.json",
    "data/research/football/2026-08-14-1x2-odds-v1.json",
    "data/research/football/2026-08-18-1x2-odds-v1.json",
  ];
  for (const rel of oddsFiles) {
    const abs = path.join(cwd, rel);
    if (!existsSync(abs)) continue;
    const doc = readJson<{
      observations?: Array<{
        oddsProviderEventId: string | null;
        sportKey: string | null;
        oddsHomeTeamName: string | null;
        oddsAwayTeamName: string | null;
        oddsCommenceTimeUtc: string | null;
        scheduleKickoffTimeUtc?: string;
        minutesBeforeKickoff?: number | null;
        pregameUsable?: boolean;
      }>;
    }>(abs);
    for (const o of doc.observations ?? []) {
      if (!o.oddsProviderEventId || !o.sportKey || !o.oddsHomeTeamName || !o.oddsAwayTeamName) {
        continue;
      }
      events.push({
        sourceRel: rel,
        sportKey: o.sportKey,
        oddsProviderEventId: o.oddsProviderEventId,
        home: o.oddsHomeTeamName,
        away: o.oddsAwayTeamName,
        commenceTime: o.oddsCommenceTimeUtc ?? "",
        timing: o.pregameUsable ? "pregame" : "unknown",
      });
    }
  }
  const cmpRel = "data/research/football/2026-08-16-1x2-market-comparison-v0.json";
  const cmpAbs = path.join(cwd, cmpRel);
  if (existsSync(cmpAbs)) {
    const doc = readJson<{
      rows?: Array<{
        external?: {
          sportKey?: string | null;
          oddsHomeTeamName?: string | null;
          oddsAwayTeamName?: string | null;
          providerEventId?: string | null;
          commenceTimeUtc?: string | null;
          cutoffStatus?: string | null;
        };
      }>;
    }>(cmpAbs);
    for (const row of doc.rows ?? []) {
      const f = row.external;
      if (!f?.sportKey || !f.oddsHomeTeamName || !f.oddsAwayTeamName) continue;
      events.push({
        sourceRel: cmpRel,
        sportKey: f.sportKey,
        oddsProviderEventId: f.providerEventId ?? "",
        home: f.oddsHomeTeamName,
        away: f.oddsAwayTeamName,
        commenceTime: f.commenceTimeUtc ?? "",
        timing: f.cutoffStatus === "PRE_GAME_COLLECTED" ? "pregame" : "unknown",
      });
    }
  }
  return events;
}

function uniqueOddsEventForRow(input: {
  sportKey: string;
  kickoffTimeUtc: string | null;
  events: OddsEventLite[];
}): { status: "unique"; event: OddsEventLite } | { status: "none" } | {
  status: "ambiguous";
  ids: string[];
} {
  if (!input.kickoffTimeUtc) return { status: "none" };
  const hits: OddsEventLite[] = [];
  const seen = new Set<string>();
  for (const event of input.events) {
    if (event.sportKey !== input.sportKey) continue;
    if (!event.commenceTime) continue;
    const delta = minutesBetween(input.kickoffTimeUtc, event.commenceTime);
    if (delta == null || Math.abs(delta) > FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES) {
      continue;
    }
    const id = `${event.sportKey}|${event.oddsProviderEventId}|${event.home}|${event.away}`;
    if (seen.has(id)) continue;
    seen.add(id);
    hits.push(event);
  }
  if (hits.length === 0) return { status: "none" };
  const distinctIds = [...new Set(hits.map((h) => `${h.home}|${h.away}`))];
  if (distinctIds.length > 1) {
    return { status: "ambiguous", ids: hits.map((h) => h.oddsProviderEventId) };
  }
  return { status: "unique", event: hits[0]! };
}

export function buildFootballBig5OddsTeamBridgeReadinessAudit(cwd: string) {
  assertCompetitionIds();
  const frozenHashes = Object.fromEntries(
    Object.entries(FROZEN_REL).map(([k, rel]) => {
      const abs = path.join(cwd, rel);
      if (!existsSync(abs)) {
        return [k, { rel, sha256: "NOT_FOUND" as const }];
      }
      return [k, { rel, sha256: sha256File(abs) }];
    }),
  );

  const catalog = catalogByProviderId();
  const bridge = bridgeByCanonical();
  const schedules = loadSchedules(cwd);
  const oddsEvents = collectOddsEvents(cwd);
  const openingRel = "data/audits/football-2026-27-opening-readiness-v1.json";
  const opening = existsSync(path.join(cwd, openingRel))
    ? readJson<{
        leagues?: Array<{
          competitionId?: string;
          coverage?: {
            oddsBridgeCount?: number;
            canonicalRegisteredTeamCount?: number;
            catalogProviderTeamIds?: string[];
            oddsBridgedProviderTeamIds?: string[];
            seasonTeamCount?: string;
          };
        }>;
      }>(path.join(cwd, openingRel))
    : { leagues: [] };

  const countryHint: Record<(typeof BIG5)[number]["key"], string> = {
    EPL: "England",
    LaLiga: "Spain",
    SerieA: "Italy",
    Bundesliga: "Germany",
    Ligue1: "France",
  };

  const leagues = BIG5.map((league) => {
    const sport = sportKeyStatusFor(league.competitionId, cwd);
    const profile = FOOTBALL_COMPETITION_PROFILES_V1.find(
      (p) => p.competitionId === league.competitionId,
    )!;
    if (profile.competitionId !== league.competitionId) {
      throw new Error("STOP_COMPETITION_ID_MISMATCH");
    }

    const observedTeams = new Map<
      string,
      {
        providerTeamId: string;
        fixtureName: string;
        dates: string[];
        canonicalTeamId: string | null;
        catalogMatched: boolean;
        bridged: boolean;
      }
    >();
    let observedRows = 0;
    let eligibleFormatRows = 0;
    for (const sch of schedules) {
      for (const row of sch.rows) {
        if (row.competitionId !== league.competitionId) continue;
        observedRows += 1;
        if (row.predictionEligibility === "ELIGIBLE_FORMAT") eligibleFormatRows += 1;
        for (const side of [
          { id: row.homeProviderTeamId, name: row.homeTeamName },
          { id: row.awayProviderTeamId, name: row.awayTeamName },
        ]) {
          const hit = catalog.get(side.id);
          const canonicalTeamId = hit?.canonicalTeamId ?? null;
          const bridged = canonicalTeamId
            ? bridge.has(canonicalTeamId)
            : false;
          const prev = observedTeams.get(side.id);
          if (!prev) {
            observedTeams.set(side.id, {
              providerTeamId: side.id,
              fixtureName: side.name,
              dates: [sch.dateKst],
              canonicalTeamId,
              catalogMatched: hit != null,
              bridged,
            });
          } else if (!prev.dates.includes(sch.dateKst)) {
            prev.dates.push(sch.dateKst);
          }
        }
      }
    }

    const observedList = [...observedTeams.values()];
    const observedCanonical = observedList.filter((t) => t.catalogMatched);
    const observedPending = observedList.filter((t) => !t.catalogMatched);
    const bridgeReady = observedCanonical.filter((t) => t.bridged);
    const bridgeMissing = observedCanonical.filter((t) => !t.bridged);
    const observedCoveragePercent =
      observedCanonical.length === 0
        ? null
        : Math.round((bridgeReady.length / observedCanonical.length) * 1000) / 10;

    const openingLeague = (opening.leagues ?? []).find(
      (l) => l.competitionId === league.competitionId,
    );
    const openingKnownIds = openingLeague?.coverage?.catalogProviderTeamIds ?? [];
    const leagueBridge = FOOTBALL_ODDS_TEAM_BRIDGE_V1.filter((e) => {
      const providerTeamId = e.canonicalTeamId.replace(
        "fb-team-v1-api-football-",
        "",
      );
      return (
        observedCanonical.some((o) => o.canonicalTeamId === e.canonicalTeamId) ||
        openingKnownIds.includes(providerTeamId)
      );
    });

    const catalogCountryHintTeams = FOOTBALL_TEAM_CATALOG_V1.filter(
      (t) => t.country === countryHint[league.key],
    );

    const joinedOddsRel = [
      "data/research/football/2026-08-18-1x2-odds-v1.json",
      "data/research/football/2026-08-14-1x2-odds-v1.json",
      "data/research/football/2026-08-12-1x2-odds-v1.json",
    ];
    let existingJoinedOddsGames = 0;
    for (const rel of joinedOddsRel) {
      const abs = path.join(cwd, rel);
      if (!existsSync(abs)) continue;
      const doc = readJson<{
        meta?: { joinedGames?: number };
        observations?: Array<{ competitionId?: string; joinStatus?: string }>;
      }>(abs);
      existingJoinedOddsGames += (doc.observations ?? []).filter(
        (o) =>
          o.competitionId === league.competitionId && o.joinStatus === "JOINED",
      ).length;
    }

    const evidenceReadyForBridge: Array<Record<string, unknown>> = [];
    const notSafeToBridge: Array<Record<string, unknown>> = [];
    const seenNotSafe = new Set<string>();
    const pushNotSafe = (row: Record<string, unknown>) => {
      const key = `${row.reason}:${row.providerTeamId ?? row.canonicalTeamId ?? ""}`;
      if (seenNotSafe.has(key)) return;
      seenNotSafe.add(key);
      notSafeToBridge.push(row);
    };

    if (sport.sportKey) {
      for (const sch of schedules) {
        for (const row of sch.rows) {
          if (row.competitionId !== league.competitionId) continue;
          const join = uniqueOddsEventForRow({
            sportKey: sport.sportKey,
            kickoffTimeUtc: row.kickoffTimeUtc,
            events: oddsEvents,
          });
          const sides = [
            {
              id: row.homeProviderTeamId,
              name: row.homeTeamName,
              oddsName: join.status === "unique" ? join.event.home : null,
            },
            {
              id: row.awayProviderTeamId,
              name: row.awayTeamName,
              oddsName: join.status === "unique" ? join.event.away : null,
            },
          ];
          for (const side of sides) {
            const hit = catalog.get(side.id);
            if (!hit) {
              if (join.status === "unique" && side.oddsName) {
                pushNotSafe({
                  reason: "CANONICAL_TEAM_MISSING",
                  providerTeamId: side.id,
                  fixtureName: side.name,
                  oddsExactNameObserved: side.oddsName,
                  oddsProviderEventId: join.event.oddsProviderEventId,
                  evidenceSource: join.event.sourceRel,
                  note: "Same-match Odds event exists, but catalog MATCHED canonical ID is missing. Not EVIDENCE_READY_FOR_BRIDGE.",
                });
              }
              continue;
            }
            if (bridge.has(hit.canonicalTeamId)) continue;
            if (join.status === "ambiguous") {
              pushNotSafe({
                reason: "KICKOFF_AMBIGUOUS",
                canonicalTeamId: hit.canonicalTeamId,
                providerTeamId: side.id,
                candidateEventIds: join.ids,
              });
              continue;
            }
            if (join.status === "none") {
              pushNotSafe({
                reason: "ODDS_EVENT_EVIDENCE_MISSING",
                canonicalTeamId: hit.canonicalTeamId,
                providerTeamId: side.id,
                fixtureName: side.name,
              });
              continue;
            }
            evidenceReadyForBridge.push({
              league: league.key,
              canonicalTeamId: hit.canonicalTeamId,
              providerTeamId: side.id,
              oddsExactName: side.oddsName,
              evidenceSource: join.event.sourceRel,
              oddsProviderEventId: join.event.oddsProviderEventId,
              scheduleMatchId: row.matchId,
              kickoffTimeUtc: row.kickoffTimeUtc,
              joinConfidence: "EXACT_HOME_AWAY_KICKOFF_SPORT_KEY",
            });
          }
        }
      }
    }

    const uniqueReady = new Map<string, Record<string, unknown>>();
    for (const row of evidenceReadyForBridge) {
      uniqueReady.set(String(row.canonicalTeamId), row);
    }
    evidenceReadyForBridge.length = 0;
    evidenceReadyForBridge.push(...uniqueReady.values());

    for (const team of observedPending) {
      pushNotSafe({
        reason: "CANONICAL_TEAM_MISSING",
        providerTeamId: team.providerTeamId,
        fixtureName: team.fixtureName,
        dates: team.dates,
      });
    }
    for (const team of bridgeMissing) {
      pushNotSafe({
        reason: "ODDS_EVENT_EVIDENCE_MISSING",
        canonicalTeamId: team.canonicalTeamId,
        providerTeamId: team.providerTeamId,
        fixtureName: team.fixtureName,
        note: "Catalog MATCHED on observed Big-5 schedule but no unambiguous same-match Odds exact-name join in repo artifacts.",
      });
    }
    for (const seeded of catalogCountryHintTeams) {
      const observed = observedList.some(
        (t) => t.providerTeamId === seeded.providerTeamId,
      );
      if (observed) continue;
      const oddsNameHit = oddsEvents.find(
        (e) =>
          e.sportKey === sport.sportKey &&
          (e.home === seeded.canonicalName || e.away === seeded.canonicalName),
      );
      pushNotSafe({
        reason: oddsNameHit ? "ONLY_DISPLAY_NAME_MATCH" : "NO_CURRENT_EVIDENCE",
        canonicalTeamId: seeded.canonicalTeamId,
        canonicalName: seeded.canonicalName,
        note: oddsNameHit
          ? "Odds payload contains a display-equal team string, but no Big-5 schedule row exists for that fixture. Forbidden as bridge evidence."
          : "Catalog country hint only. No Big-5 schedule row in scanned artifacts. Not 2026-27 membership proof.",
      });
    }
    if (observedRows === 0 && leagueBridge.length === 0) {
      pushNotSafe({
        reason: "NO_CURRENT_EVIDENCE",
        league: league.key,
        note: "No Big-5 schedule rows and no registry bridge entries for this competition in scanned artifacts.",
      });
    }

    const sportKeyBlocker = sport.status !== "LIVE_VERIFIED";
    const teamBridgeBlocker = bridgeMissing.length > 0;
    const sportKeyVsTeamBridge =
      sportKeyBlocker && (teamBridgeBlocker || leagueBridge.length === 0)
        ? "BOTH"
        : sportKeyBlocker
          ? "SPORT_KEY"
          : teamBridgeBlocker
            ? "TEAM_BRIDGE"
            : observedPending.length > 0
              ? "NEITHER_CATALOG_PENDING_ON_SLATE"
              : observedRows === 0
                ? "NEITHER_ON_OBSERVED_SLATE_NO_GAMES"
                : "NEITHER";

    return {
      key: league.key,
      canonicalName: league.canonicalName,
      competitionId: league.competitionId,
      sportKey: sport.sportKey,
      sportKeyStatus: sport.status,
      sportKeySource: sport.source,
      sportKeyLiveExactVerified: sport.liveExactVerified,
      sportKeyHistoricalOnly: sport.historicalOnly,
      sportKeyLastEvidenceDate: sport.lastEvidenceDate,
      sportKeyConfidence: sport.confidence,
      sportKeyEvidence: sport.evidence,
      observedScheduleRows: observedRows,
      eligibleFormatRowsOnArtifacts: eligibleFormatRows,
      observedProviderTeamIds: observedList.map((t) => t.providerTeamId).sort(),
      observedCanonicalTeams: observedCanonical.length,
      observedCanonicalTeamList: observedCanonical.map((t) => ({
        canonicalTeamId: t.canonicalTeamId,
        providerTeamId: t.providerTeamId,
        fixtureName: t.fixtureName,
      })),
      observedCanonicalPending: observedPending.map((t) => ({
        providerTeamId: t.providerTeamId,
        fixtureName: t.fixtureName,
      })),
      bridgeReady: bridgeReady.length,
      bridgeReadyIds: bridgeReady.map((t) => t.canonicalTeamId),
      bridgeMissing: bridgeMissing.length,
      bridgeMissingIds: bridgeMissing.map((t) => t.canonicalTeamId),
      observedCoveragePercent,
      observedCoverageDenominator: "observedCanonicalTeams_currentCatalogResolve",
      notFullSeasonCoverage: true,
      catalogCountryHintCount: catalogCountryHintTeams.length,
      bridgeEntries: leagueBridge.length,
      bridgeEntryList: leagueBridge.map((e) => ({
        canonicalTeamId: e.canonicalTeamId,
        oddsTeamNames: e.oddsTeamNames,
        source: e.source,
        verifiedAt: e.verifiedAt ?? null,
      })),
      openingReadinessAlignment: {
        oddsBridgeCount: openingLeague?.coverage?.oddsBridgeCount ?? null,
        matchesCode: (openingLeague?.coverage?.oddsBridgeCount ?? null) ===
          leagueBridge.length,
        canonicalRegisteredTeamCount:
          openingLeague?.coverage?.canonicalRegisteredTeamCount ?? null,
        seasonTeamCount: openingLeague?.coverage?.seasonTeamCount ?? null,
      },
      existingJoinedOddsGames,
      evidenceReadyForBridge,
      notSafeToBridge,
      sportKeyVsTeamBridge,
      blockers: {
        sportKey: sportKeyBlocker,
        teamBridge: teamBridgeBlocker,
        catalogPendingOnObservedSlate: observedPending.length > 0,
        noObservedFixtures: observedRows === 0,
      },
      p0Status:
        league.key === "LaLiga"
          ? observedPending.length > 0
            ? "PARTIAL_OBSERVED_CANONICAL_BRIDGED_CATALOG_PENDING_REMAINS"
            : "OBSERVED_CANONICAL_BRIDGED"
          : "NO_OBSERVED_SLATE_SPORT_KEY_NOT_LIVE_VERIFIED_BRIDGE_EMPTY",
    };
  });

  const laLigaTrace = {
    scheduleRel: "data/research/football/2026-08-18-schedule-v1.json",
    matchId: "soccer-api-football-1570337",
    fixtureId: "1570337",
    competitionId: "fb-comp-api-football-140",
    homeCanonical: "fb-team-v1-api-football-544",
    awayCanonical: "fb-team-v1-api-football-797",
    sportKey: "soccer_spain_la_liga",
    bridgeHome: getOddsTeamNames("fb-team-v1-api-football-544"),
    bridgeAway: getOddsTeamNames("fb-team-v1-api-football-797"),
    oddsRel: "data/research/football/2026-08-18-1x2-odds-v1.json",
    oddsProviderEventId: "7b9f4d89d66c48e0c496aab1679e4ae4",
    join: "JOINED",
    snapshotRel: "data/research/football/2026-08-18-prediction-snapshot-v0.json",
    predictionRel:
      "data/research/football/2026-08-18-market-baseline-prediction-v0.json",
    identityEvidenceRel:
      "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json",
  };

  const evidenceReadyCandidates = leagues.flatMap(
    (l) => l.evidenceReadyForBridge,
  );

  const document = {
    schemaVersion: SCHEMA,
    generatedAt: readJson<{ meta?: { generatedAt?: string } }>(
      path.join(cwd, FROZEN_REL.schedule),
    ).meta?.generatedAt ?? "2026-08-19T15:49:51.881Z",
    researchOnly: true,
    networkCalls: { apiFootball: 0, theOddsApi: 0 },
    predictionCalls: 0,
    resultCalls: 0,
    frozenMutations: 0,
    mandatoryCompletion: {
      dateKst: "2026-08-20",
      total: "60%",
      unchanged: true,
    },
    oddsCallGraph: {
      schedule: "data/research/football/{date}-schedule-v1.json",
      eligibility:
        "src/lib/football/odds-1x2-v1/build.ts planOddsFetches requires predictionEligibility=ELIGIBLE_FORMAT",
      sportKey: "src/lib/football/odds-1x2-v1/sport-keys.ts getOddsSportKey",
      canonicalTeamIds: "schedule row.homeTeamId / awayTeamId (catalog MATCHED)",
      teamBridge:
        "src/lib/football/odds-1x2-v1/team-bridge.ts getOddsTeamNames — missing ⇒ teamBridgeMissing skip",
      provider:
        "scripts/build-football-1x2-odds-v1.ts live The Odds API only when sportKeysToFetch nonempty",
      eventJoin:
        "src/lib/football/odds-1x2-v1/event-join.ts joinScheduleRowToOddsEvent exact names + sportKey + |kickoff|<=15m",
      quotes: "src/lib/football/odds-1x2-v1/quotes.ts extractEventBookmakerQuotes",
      artifact: "football-1x2-odds-v1",
    },
    joinContract: {
      canonicalIdsRequired: true,
      oddsTeamExactStrings: true,
      kickoffToleranceMinutes: FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
      competitionSportKeyRequired: true,
      fuzzy: false,
      slug: false,
      substring: false,
      caseInsensitiveAutoMatch: false,
      homeAwayAutoReverseCorrection: false,
      matchFn: "Array.prototype.includes exact string",
    },
    p0Definition: {
      not: "pre-register every 2026-27 league team",
      is: "for each official Schedule ELIGIBLE_FORMAT Big-5 match that has a The Odds API event, join with exact sport-key + canonical IDs + exact odds names before kickoff",
      dailySlateVsFullSeason:
        "Opening ops need daily slate coverage. Full-season catalog completeness is a separate P1/P2 denominator and is NOT_PROVEN here.",
    },
    denominators: {
      FULL_CURRENT_SEASON_TEAM_COUNT: {
        status: "NOT_PROVEN",
        reason:
          "No 2026 /teams roster artifact. Free plan previously rejected season 2026. Do not guess 20-club tables.",
      },
      KNOWN_CANONICAL_BIG5_TEAMS: {
        status: "PARTIAL",
        note: "Catalog country hints are not 2026-27 membership. Proven canonical Big-5 membership = observed on Big-5 schedule + current catalog MATCHED.",
        catalogCountryHint: Object.fromEntries(
          BIG5.map((l) => [
            l.key,
            FOOTBALL_TEAM_CATALOG_V1.filter(
              (t) => t.country === countryHint[l.key],
            ).length,
          ]),
        ),
        observedCanonicalTotal: leagues.reduce(
          (n, l) => n + l.observedCanonicalTeams,
          0,
        ),
      },
      OBSERVED_BIG5_SCHEDULE_TEAMS: {
        uniqueProviderTeamIds: leagues.reduce(
          (n, l) => n + l.observedProviderTeamIds.length,
          0,
        ),
        uniqueCanonicalIds: leagues.reduce(
          (n, l) => n + l.observedCanonicalTeams,
          0,
        ),
        scannedScheduleDates: schedules.map((s) => s.dateKst),
      },
    },
    leagues,
    global: {
      fullSeasonDenominatorStatus: "NOT_PROVEN",
      bridgeEntriesTotal: FOOTBALL_ODDS_TEAM_BRIDGE_V1.length,
      big5BridgeEntries: leagues.reduce((n, l) => n + l.bridgeEntries, 0),
      evidenceReadyCandidates: evidenceReadyCandidates.length,
      oddsEventEvidenceCount: oddsEvents.length,
      football1x2OddsArtifacts: readdirSync(
        path.join(cwd, "data/research/football"),
      ).filter((n) => n.endsWith("-1x2-odds-v1.json")).length,
      openingReadinessLaLigaBridgeCountExpected: 6,
      openingReadinessLaLigaBridgeCountActual: leagues.find((l) => l.key === "LaLiga")
        ?.bridgeEntries,
    },
    evidenceReadyCandidates,
    blockerMatrix: leagues.map((l) => ({
      league: l.key,
      sportKey: l.sportKeyStatus,
      sportKeyBlocker: l.blockers.sportKey,
      teamBridge: l.bridgeEntries,
      teamBridgeBlocker: l.blockers.teamBridge,
      other: l.blockers.catalogPendingOnObservedSlate
        ? "CATALOG_PENDING_ON_OBSERVED_SLATE"
        : l.blockers.noObservedFixtures
          ? "NO_OBSERVED_FIXTURES"
          : "NONE",
      sportKeyVsTeamBridge: l.sportKeyVsTeamBridge,
      p0Status: l.p0Status,
    })),
    existingOddsEvidence: {
      artifacts: [
        {
          rel: "data/research/football/2026-08-12-1x2-odds-v1.json",
          joinedGames: 0,
          providerCalled: false,
          note: "UCL/UEL notSupportedFormat; no Big-5",
        },
        {
          rel: "data/research/football/2026-08-14-1x2-odds-v1.json",
          sportKey: "soccer_japan_j_league",
          note: "J1 not Big-5",
        },
        {
          rel: "data/research/football/2026-08-16-1x2-market-comparison-v0.json",
          sportKeys: ["soccer_spain_la_liga", "soccer_usa_mls"],
          note: "comparison overlay; La Liga names already on team-bridge",
        },
        {
          rel: "data/research/football/2026-08-18-1x2-odds-v1.json",
          sportKey: "soccer_spain_la_liga",
          joinedGames: 1,
          officialDataset: true,
        },
        {
          rel: "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json",
          eventCount: 16,
          officialOddsDataset: false,
          note: "raw Odds names for identity evidence; extra events lack same-match canonical schedule join except Deportivo/Elche",
        },
      ],
    },
    laLigaReferenceTrace: laLigaTrace,
    incrementalStrategy: {
      dailyExactEventBridgeCandidateModel: "PARTIAL",
      legal:
        "Copy exact The Odds API home_team/away_team from a pregame collect already justified by sport-key. Do not invent names from Schedule display strings.",
      leakage:
        "SAFE if candidates are registry proposals only. FORBIDDEN to rewrite sealed Snapshot/Prediction with postgame names.",
      falseJoinRisk:
        "Mitigated by exact string + sport-key + 15m kickoff. Still requires human confirm before team-bridge.ts write. No auto-reverse.",
      operationalBurden:
        "Admin review per new club. Fits YANG EDGE explicit registry. Lower than paid /teams full-roster guess.",
      seasonAdaptability: "HIGH for promoted/new clubs if they appear on official fixtures + Odds events.",
      implementThisMission: false,
    },
    p0Blockers: [
      "ELIGIBLE_FORMAT still requires canonical catalog MATCHED before Odds planOddsFetches",
      "Observed catalog-pending Big-5 teams (La Liga 530/535/542/546/536/728) cannot enter Odds collection",
      "EPL/Serie A/Bundesliga/Ligue 1: zero observed 2026-27 schedule rows in repo, zero Big-5 bridge entries beyond La Liga observed six",
    ],
    p1Blockers: [
      "EPL/Serie A/Bundesliga/Ligue 1 sport keys are CONFIGURED_NOT_PROVEN (historical DOCUMENTED_AVAILABLE_NOT_PROBED, no live /sports exact-key football artifact)",
      "FULL_CURRENT_SEASON_TEAM_COUNT NOT_PROVEN",
      "08-18 extra La Liga Odds names (Real Madrid, Barcelona, …) lack same-match sealed Schedule canonical join",
    ],
    p2Blockers: [
      "Provider-independent canonical IDs still deferred",
      "No automated bridge drift detection beyond exact-name collision asserts",
    ],
    nextMissionRecommendation:
      "Football Daily Odds Bridge Candidate Intake v1",
    nextMissionWhy:
      "Existing immutable Odds evidence has zero safe unbridged same-match canonical joins left to add. Bridge Completion v1 would be empty. Live sport-key verification is P1. Opening P0 is an intake path that turns a day's exact Odds events + sealed Schedule canonical IDs into reviewed bridge entries without guessing.",
    frozenHashes,
  };

  return { document, frozenHashes };
}

export async function writeFootballBig5OddsTeamBridgeReadinessAudit(cwd: string) {
  const { document } = buildFootballBig5OddsTeamBridgeReadinessAudit(cwd);
  const abs = path.join(cwd, AUDIT_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return { document };
}

async function main() {
  const cwd = process.cwd();
  const { document } = await writeFootballBig5OddsTeamBridgeReadinessAudit(cwd);
  console.log(
    [
      `wrote ${AUDIT_REL}`,
      `leagues=${document.leagues.length}`,
      `fullSeason=${document.global.fullSeasonDenominatorStatus}`,
      `bridgeTotal=${document.global.bridgeEntriesTotal}`,
      `big5Bridge=${document.global.big5BridgeEntries}`,
      `evidenceReady=${document.global.evidenceReadyCandidates}`,
      `next=${document.nextMissionRecommendation}`,
    ].join("\n"),
  );
}

const isDirect = process.argv[1]?.replaceAll("\\", "/").endsWith(
  "audit-football-big5-odds-team-bridge-readiness-v1.ts",
);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
