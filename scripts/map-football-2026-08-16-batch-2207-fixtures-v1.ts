/**
 * Research-only: join batch-2207 football manual observations to api-football fixture.id.
 * Does not run prediction, result, grade, or Engine.
 *
 *   npx tsx --env-file=.env.local scripts/map-football-2026-08-16-batch-2207-fixtures-v1.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import { getFootballProvider, resolveFootballProviderKind } from "../src/lib/football";
import { isCompetitionProfiled } from "../src/lib/football/competition/profiles";
import { footballScheduleV1Rel } from "../src/lib/football/core/paths";
import type { FootballScheduleArtifactV1 } from "../src/lib/football/core/types";
import type { FixtureRaw } from "../src/lib/football/types";

const OBS_REL =
  "data/operator-observations/structured/2026-08-16/batch-2207-football-manual-market-observation-v0.json";
const OUT_REL =
  "data/research/football/2026-08-16-manual-observation-fixture-mapping-v1.json";
const TIME_TOLERANCE_MINUTES = 10;

type MappingStatus =
  | "MATCHED_EXACT"
  | "MATCHED_TIME_TOLERANCE"
  | "MATCHED_WITH_COMPETITION_LABEL_DIFFERENCE"
  | "AMBIGUOUS"
  | "PROVIDER_NOT_FOUND"
  | "DROPPED_UNREGISTERED_COMPETITION"
  | "RAW_LABEL_UNCERTAIN";

type ObservationGame = {
  rowId: number;
  rawLeagueLabel: string;
  rawLeftTeam: string;
  rawRightTeam: string;
  displayedDateKst: string;
  displayedStartKst: string;
  cutoffStatus: string;
  sourceScreenshotFile: string;
  sourceScreenshotSha256: string;
  markets?: unknown[];
};

type IdentityFixture = {
  fixtureId: number;
  providerDateKst: string;
  leagueId: number | null;
  leagueName: string;
  season: number | null;
  homeTeamId: number | null;
  homeTeamName: string;
  awayTeamId: number | null;
  awayTeamName: string;
  kickoffUtc: string | null;
  kickoffKst: string | null;
  inScheduleArtifact: boolean;
  scheduleDateKst: string | null;
};

const TEAM_GROUPS: string[][] = [
  ["malaysia"],
  ["vietnam"],
  ["arsenal", "아스널"],
  ["manchestercity", "mancity", "맨체스c", "맨체스터시티"],
  ["ajax", "아약스"],
  ["heerenveen", "헤이렌베"],
  ["burnley", "번리"],
  ["westham", "westhamunited", "웨스트햄"],
  ["racingsantander", "racing", "라싱산탄"],
  ["villarreal", "비야레알"],
  ["sarpsborg", "sarpsborg08", "사릅스보"],
  ["sandefjord", "사네피오"],
  ["brann", "skbrann", "sk브란"],
  ["hamkam", "함캄"],
  ["molde", "moldefk", "몰데fk"],
  ["tromso", "tromsoe", "tromsoil", "트롬쇠il", "트롬쇠"],
  ["espanyol", "에스파뇰"],
  ["levante", "레반테"],
  ["fredrikstad", "프레드릭"],
  ["kristiansund", "크리스티"],
  ["lens", "rclens", "rc랑스"],
  ["psg", "parissaintgermain", "parissg"],
  ["chicagofire", "시카파이"],
  ["portlandtimbers", "portland", "포틀팀버", "포들팀버"],
  ["newyorkcity", "newyorkcityfc", "nycfc", "뉴욕시티"],
  ["philadelphiaunion", "필라유니"],
  ["austin", "austinfc", "오스틴fc"],
  ["fcdallas", "dallas", "fc댈러스"],
  ["seattlesounders", "seattle", "시애사운"],
  ["vancouverwhitecaps", "whitecaps", "밴쿠화이"],
];

const CANDIDATE_BY_ROW: Record<number, { left: string; right: string }> = {
  1: { left: "Malaysia", right: "Vietnam" },
  2: { left: "Arsenal", right: "Manchester City" },
  3: { left: "Ajax", right: "Heerenveen" },
  4: { left: "Burnley", right: "West Ham" },
  5: { left: "Racing Santander", right: "Villarreal" },
  6: { left: "Sarpsborg 08", right: "Sandefjord" },
  7: { left: "SK Brann", right: "HamKam" },
  8: { left: "Molde FK", right: "Tromso IL" },
  9: { left: "Espanyol", right: "Levante" },
  10: { left: "Fredrikstad", right: "Kristiansund" },
  11: { left: "RC Lens", right: "Paris Saint-Germain" },
  12: { left: "Chicago Fire", right: "Portland Timbers" },
  13: { left: "New York City FC", right: "Philadelphia Union" },
  14: { left: "Austin FC", right: "FC Dallas" },
  15: { left: "Seattle Sounders", right: "Vancouver Whitecaps" },
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function teamKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "")
    .replace(/^(fc|fk|afc|cf)/, "")
    .replace(/(fc|fk|il|sc)$/g, "");
}

function groupIndex(name: string): number {
  const key = teamKey(name);
  if (!key) return -1;
  return TEAM_GROUPS.findIndex((group) =>
    group.some((alias) => key === alias || key.includes(alias) || alias.includes(key)),
  );
}

function teamsMatch(a: string, b: string): boolean {
  const ia = groupIndex(a);
  const ib = groupIndex(b);
  if (ia >= 0 && ib >= 0) return ia === ib;
  const ka = teamKey(a);
  const kb = teamKey(b);
  return ka.length >= 4 && kb.length >= 4 && (ka === kb || ka.includes(kb) || kb.includes(ka));
}

function pairMatch(
  left: string,
  right: string,
  home: string,
  away: string,
): { ok: boolean; orientation: "LEFT_HOME" | "LEFT_AWAY" | null } {
  if (teamsMatch(left, home) && teamsMatch(right, away)) {
    return { ok: true, orientation: "LEFT_HOME" };
  }
  if (teamsMatch(left, away) && teamsMatch(right, home)) {
    return { ok: true, orientation: "LEFT_AWAY" };
  }
  return { ok: false, orientation: null };
}

function displayedKickoffUtc(dateKst: string, startKst: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst) || !/^\d{2}:\d{2}$/.test(startKst)) {
    return null;
  }
  const d = new Date(`${dateKst}T${startKst}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minutesDelta(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

function leagueLabelsEquivalent(raw: string, provider: string): boolean {
  return raw.trim().toLowerCase() === provider.trim().toLowerCase();
}

function identityFromFixture(
  fx: FixtureRaw,
  scheduleIds: Set<string>,
  scheduleDateById: Map<string, string>,
): IdentityFixture | null {
  const fixtureId = fx.fixture?.id;
  if (typeof fixtureId !== "number" || !Number.isFinite(fixtureId)) return null;
  const kickoffUtc = fx.fixture?.date?.trim() || null;
  const kst = kickoffUtc ? instantToKst(kickoffUtc) : null;
  const id = String(fixtureId);
  return {
    fixtureId,
    providerDateKst: kst?.date ?? "",
    leagueId: typeof fx.league?.id === "number" ? fx.league.id : null,
    leagueName: String(fx.league?.name ?? "").trim(),
    season: typeof fx.league?.season === "number" ? fx.league.season : null,
    homeTeamId: typeof fx.teams?.home?.id === "number" ? fx.teams.home.id : null,
    homeTeamName: String(fx.teams?.home?.name ?? "").trim(),
    awayTeamId: typeof fx.teams?.away?.id === "number" ? fx.teams.away.id : null,
    awayTeamName: String(fx.teams?.away?.name ?? "").trim(),
    kickoffUtc: kickoffUtc ? new Date(kickoffUtc).toISOString() : null,
    kickoffKst: kst ? `${kst.date} ${kst.time}` : null,
    inScheduleArtifact: scheduleIds.has(id),
    scheduleDateKst: scheduleDateById.get(id) ?? null,
  };
}

function assertNoResultFields(obj: unknown, pathRel: string): void {
  const text = JSON.stringify(obj);
  for (const banned of [
    '"goals"',
    '"score"',
    '"winner"',
    '"elapsed"',
    '"events"',
    '"homeScore"',
    '"awayScore"',
    '"actualWinner"',
  ]) {
    if (text.includes(banned)) {
      throw new Error(`RESULT_FIELD_LEAK: ${banned} in ${pathRel}`);
    }
  }
}

async function loadSchedule(dateKst: string): Promise<FootballScheduleArtifactV1> {
  const rel = footballScheduleV1Rel(dateKst);
  const raw = JSON.parse(await readFile(path.join(process.cwd(), rel), "utf8"));
  return raw as FootballScheduleArtifactV1;
}

async function main() {
  const kind = resolveFootballProviderKind();
  if (kind === "dummy") {
    throw new Error("DUMMY_PROVIDER_NOT_RESEARCH");
  }

  const obsAbs = path.join(process.cwd(), OBS_REL);
  const obsText = await readFile(obsAbs, "utf8");
  const obs = JSON.parse(obsText) as {
    summary?: Record<string, unknown>;
    games?: ObservationGame[];
    receivedAtKst?: string;
    captureTime?: unknown;
    batchId?: string;
  };
  const games = Array.isArray(obs.games) ? obs.games : [];
  if (games.length !== 15) {
    throw new Error(`OBS_GAME_COUNT: ${games.length}`);
  }
  const marketRows = games.reduce(
    (n, g) => n + (Array.isArray(g.markets) ? g.markets.length : 0),
    0,
  );

  const sched16 = await loadSchedule("2026-08-16");
  const sched17 = await loadSchedule("2026-08-17");
  const scheduleIds = new Set<string>();
  const scheduleDateById = new Map<string, string>();
  for (const row of [...sched16.rows, ...sched17.rows]) {
    scheduleIds.add(row.providerMatchId);
    scheduleDateById.set(row.providerMatchId, row.dateKst);
  }

  const provider = getFootballProvider();
  const fetched16 = await provider.getFixtures({
    date: "2026-08-16",
    timezone: "Asia/Seoul",
  });
  const fetched17 = await provider.getFixtures({
    date: "2026-08-17",
    timezone: "Asia/Seoul",
  });
  if (fetched16.source !== "api-football" || fetched17.source !== "api-football") {
    throw new Error("PROVIDER_NOT_API_FOOTBALL");
  }

  const identities: IdentityFixture[] = [];
  for (const fx of [...fetched16.fixtures, ...fetched17.fixtures]) {
    const idn = identityFromFixture(fx, scheduleIds, scheduleDateById);
    if (idn) identities.push(idn);
  }

  const usedFixtureIds = new Set<number>();
  const mappingRows = games.map((game) => {
    const candidate = CANDIDATE_BY_ROW[game.rowId] ?? {
      left: game.rawLeftTeam,
      right: game.rawRightTeam,
    };
    const displayed = displayedKickoffUtc(
      game.displayedDateKst,
      game.displayedStartKst,
    );
    const teamHits = identities
      .map((fx) => {
        const hit = pairMatch(
          candidate.left,
          candidate.right,
          fx.homeTeamName,
          fx.awayTeamName,
        );
        if (!hit.ok) {
          const rawHit = pairMatch(
            game.rawLeftTeam,
            game.rawRightTeam,
            fx.homeTeamName,
            fx.awayTeamName,
          );
          if (!rawHit.ok) return null;
          return { fx, orientation: rawHit.orientation, delta: null as number | null };
        }
        let delta: number | null = null;
        if (displayed && fx.kickoffUtc) {
          delta = minutesDelta(new Date(fx.kickoffUtc), displayed);
        }
        return { fx, orientation: hit.orientation, delta };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const sameDate = teamHits.filter(
      (h) =>
        h.fx.providerDateKst === game.displayedDateKst ||
        h.fx.scheduleDateKst === game.displayedDateKst,
    );
    const withinTol = (sameDate.length ? sameDate : teamHits).filter(
      (h) => h.delta == null || Math.abs(h.delta) <= TIME_TOLERANCE_MINUTES,
    );
    const exactTime = withinTol.filter((h) => h.delta === 0);

    let mappingStatus: MappingStatus = "PROVIDER_NOT_FOUND";
    let chosen: (typeof teamHits)[number] | null = null;
    let unresolvedReason: string | null = null;

    if (game.rowId === 1 && game.rawLeftTeam === "Malaysia") {
      // Korean glyphs for this row were not character-exact on the screenshot transcription.
      // Mapping still proceeds via candidate names.
    }

    const pool = exactTime.length === 1 ? exactTime : withinTol;
    if (pool.length === 0) {
      mappingStatus = "PROVIDER_NOT_FOUND";
      unresolvedReason =
        teamHits.length === 0
          ? "NO_TEAM_PAIR_ON_PROVIDER_DATES"
          : "TEAM_PAIR_FOUND_BUT_KICKOFF_OUTSIDE_TOLERANCE";
    } else if (pool.length > 1) {
      mappingStatus = "AMBIGUOUS";
      unresolvedReason = `CANDIDATES=${pool.map((p) => p.fx.fixtureId).join(",")}`;
    } else {
      chosen = pool[0]!;
      const profiled =
        chosen.fx.leagueId != null &&
        isCompetitionProfiled("api-football", String(chosen.fx.leagueId));
      if (!profiled || !chosen.fx.inScheduleArtifact) {
        mappingStatus = "DROPPED_UNREGISTERED_COMPETITION";
      } else if ((chosen.delta ?? 0) !== 0) {
        mappingStatus = "MATCHED_TIME_TOLERANCE";
      } else if (
        !leagueLabelsEquivalent(game.rawLeagueLabel, chosen.fx.leagueName)
      ) {
        mappingStatus = "MATCHED_WITH_COMPETITION_LABEL_DIFFERENCE";
      } else {
        mappingStatus = "MATCHED_EXACT";
      }
    }

    if (chosen) {
      if (usedFixtureIds.has(chosen.fx.fixtureId)) {
        mappingStatus = "AMBIGUOUS";
        unresolvedReason = `DUPLICATE_FIXTURE_ID:${chosen.fx.fixtureId}`;
        chosen = null;
      } else if (
        mappingStatus !== "PROVIDER_NOT_FOUND" &&
        mappingStatus !== "AMBIGUOUS" &&
        mappingStatus !== "RAW_LABEL_UNCERTAIN"
      ) {
        usedFixtureIds.add(chosen.fx.fixtureId);
      }
    }

    const fx = chosen?.fx ?? null;
    return {
      rowId: game.rowId,
      sourceScreenshotFile: game.sourceScreenshotFile,
      sourceScreenshotSha256: game.sourceScreenshotSha256,
      rawLeagueLabel: game.rawLeagueLabel,
      rawLeftTeam: game.rawLeftTeam,
      rawRightTeam: game.rawRightTeam,
      candidateLeftTeam: candidate.left,
      candidateRightTeam: candidate.right,
      displayedDateKst: game.displayedDateKst,
      displayedStartKst: game.displayedStartKst,
      cutoffStatus: game.cutoffStatus,
      mappingStatus,
      fixtureId: fx?.fixtureId ?? null,
      providerLeagueId: fx?.leagueId ?? null,
      providerLeagueName: fx?.leagueName ?? null,
      providerHomeTeamId: fx?.homeTeamId ?? null,
      providerHomeTeamName: fx?.homeTeamName ?? null,
      providerAwayTeamId: fx?.awayTeamId ?? null,
      providerAwayTeamName: fx?.awayTeamName ?? null,
      providerKickoffUtc: fx?.kickoffUtc ?? null,
      providerKickoffKst: fx?.kickoffKst ?? null,
      timeDeltaMinutes: chosen?.delta ?? null,
      screenOrientation: chosen?.orientation ?? null,
      inScheduleArtifact: fx?.inScheduleArtifact ?? false,
      evidence: {
        providerSource: "api-football",
        scheduleArtifacts: [
          "data/research/football/2026-08-16-schedule-v1.json",
          "data/research/football/2026-08-17-schedule-v1.json",
        ],
        teamPairHits: teamHits.length,
        resultDataUsed: false,
        koreanRawUncertain: game.rowId === 1,
      },
      unresolvedReason,
    };
  });

  const counts = {
    MATCHED_EXACT: 0,
    MATCHED_TIME_TOLERANCE: 0,
    MATCHED_WITH_COMPETITION_LABEL_DIFFERENCE: 0,
    AMBIGUOUS: 0,
    PROVIDER_NOT_FOUND: 0,
    DROPPED_UNREGISTERED_COMPETITION: 0,
    RAW_LABEL_UNCERTAIN: 0,
  };
  for (const row of mappingRows) {
    counts[row.mappingStatus] += 1;
  }

  const cutoffBlocked = mappingRows.filter(
    (r) => r.cutoffStatus === "NOT_PREGAME_ELIGIBLE",
  ).length;
  const cutoffEligible = mappingRows.filter(
    (r) => r.cutoffStatus === "PRE_GAME_ELIGIBLE_BY_RECEIVED_AT",
  ).length;
  if (cutoffBlocked !== 1 || cutoffEligible !== 14) {
    throw new Error(
      `CUTOFF_MUTATED: eligible=${cutoffEligible} blocked=${cutoffBlocked}`,
    );
  }

  const rowIds = mappingRows.map((r) => r.rowId);
  if (new Set(rowIds).size !== 15) throw new Error("DUPLICATE_ROW_ID");
  const mappedIds = mappingRows
    .map((r) => r.fixtureId)
    .filter((id): id is number => id != null);
  if (new Set(mappedIds).size !== mappedIds.length) {
    throw new Error("DUPLICATE_FIXTURE_ID_MAPPING");
  }

  const document = {
    schemaVersion: "yang-edge-football-manual-observation-fixture-mapping-v1",
    batchId: obs.batchId ?? "2026-08-16/batch-2207",
    sourceObservationPath: OBS_REL,
    sourceObservationHash: sha256Text(obsText),
    receivedAtKst: obs.receivedAtKst ?? "2026-08-16T22:07:00+09:00",
    captureTime: obs.captureTime ?? "UNKNOWN",
    fixtureProvider: "api-football" as const,
    generatedAt: new Date().toISOString(),
    researchOnly: true,
    engineAdmission: "PROHIBITED" as const,
    engineConnected: false,
    autoApply: false,
    resultDataUsed: false,
    timeToleranceMinutes: TIME_TOLERANCE_MINUTES,
    schedule: {
      "2026-08-16": {
        path: footballScheduleV1Rel("2026-08-16"),
        providerFixtures: fetched16.fixtures.length,
        scheduleRows: sched16.meta.scheduleGames,
        identityMatched: sched16.meta.identityMatched,
        identityBlocked: sched16.meta.identityBlocked,
        formatEligible: sched16.meta.formatEligible,
        formatNotSupported: sched16.meta.formatNotSupported,
        droppedUnregisteredCompetition: sched16.meta.droppedUnregisteredCompetition,
      },
      "2026-08-17": {
        path: footballScheduleV1Rel("2026-08-17"),
        providerFixtures: fetched17.fixtures.length,
        scheduleRows: sched17.meta.scheduleGames,
        identityMatched: sched17.meta.identityMatched,
        identityBlocked: sched17.meta.identityBlocked,
        formatEligible: sched17.meta.formatEligible,
        formatNotSupported: sched17.meta.formatNotSupported,
        droppedUnregisteredCompetition: sched17.meta.droppedUnregisteredCompetition,
      },
    },
    summary: {
      manualGames: games.length,
      marketRows,
      mappingRows: mappingRows.length,
      cutoffEligible,
      cutoffBlocked,
      ...counts,
    },
    rows: mappingRows,
  };

  assertNoResultFields(document, OUT_REL);

  const outAbs = path.join(process.cwd(), OUT_REL);
  await mkdir(path.dirname(outAbs), { recursive: true });
  await writeFile(outAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        wrote: OUT_REL,
        provider: kind,
        ...document.summary,
        sourceObservationHash: document.sourceObservationHash,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
