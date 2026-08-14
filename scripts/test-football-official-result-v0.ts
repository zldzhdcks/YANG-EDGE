/**
 * Football Official Result v0 tests.
 * Run: npm run test:football-official-result-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  finalizeFootballScheduleDocument,
  type FootballScheduleRowV1,
} from "../src/lib/football/core";
import {
  buildFootballOfficialResultV0,
  computeFootballOfficialResultArtifactHash,
  extractApiFootballResultScores,
  joinProviderFixtureToScheduleRow,
  mapApiFootballShortStatusToResultStatus,
  resolveOfficialResultMatch,
  type FootballOfficialResultFixtureFetcher,
} from "../src/lib/football/official-result-v0";
import type { FixtureRaw } from "../src/lib/football/types";

const DATE = "2026-08-20";
const KICKOFF = "2026-08-20T14:00:00.000Z";
const OBSERVED = "2026-08-20T16:05:00.000Z";
const OBSERVED_2 = "2026-08-20T17:00:00.000Z";
const GENERATED = "2026-08-20T16:05:01.000Z";
const HOME_ID = "fb-team-v1-api-football-9001";
const AWAY_ID = "fb-team-v1-api-football-9002";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data/research/football/2026-08-14-prediction-snapshot-v0.json",
);
const BASELINE_PATH = path.join(
  process.cwd(),
  "data/research/football/2026-08-14-market-baseline-prediction-v0.json",
);
const ODDS_PATH = path.join(
  process.cwd(),
  "data/research/football/2026-08-14-1x2-odds-v1.json",
);
const SCHEDULE_PATH = path.join(
  process.cwd(),
  "data/research/football/2026-08-14-schedule-v1.json",
);
const RESULT_PATH = path.join(
  process.cwd(),
  "data/research/football/2026-08-14-official-result-v0.json",
);
const EXPECTED_SNAPSHOT_HASH =
  "33b290ba2d901ae4f5c572fc7e846e13512b9e8b6976265893638221933c52b5";
const EXPECTED_BASELINE_HASH =
  "3d8863628440f433ed993c3e196dae2d86217c884115dcde8f48704ab40510cf";
const EXPECTED_RESULT_HASH =
  "389589b67f6bb4711f8c4db64cc34696ee147ae4a4eb4108b10b731e2dfc1865";
const EXPECTED_RESULT_ARTIFACT_HASH =
  "84f4a1295b25a9697c4453c80e63dbb7cfe2ad905f1ac6d2862b7807ff3e80f2";

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function readJsonHashField(p: string, field: string): string {
  const raw = JSON.parse(readFileSync(p, "utf8")) as {
    meta: Record<string, string>;
  };
  return raw.meta[field]!;
}

function eligibleRow(
  over: Partial<FootballScheduleRowV1> = {},
): FootballScheduleRowV1 {
  return {
    dateKst: DATE,
    matchId: "soccer-api-football-999001",
    provider: "api-football",
    providerMatchId: "999001",
    competitionId: "fb-comp-api-football-39",
    seasonId: "2026",
    competitionType: "LEAGUE",
    matchFormat: "LEAGUE_MATCH",
    homeTeamId: HOME_ID,
    awayTeamId: AWAY_ID,
    homeProviderTeamId: "9001",
    awayProviderTeamId: "9002",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    kickoffTimeUtc: KICKOFF,
    status: "SCHEDULED",
    venue: "Test",
    identityStatus: "MATCHED",
    identityReasons: [],
    predictionEligibility: "ELIGIBLE_FORMAT",
    researchOnly: true,
    ...over,
  };
}

function writeSchedule(root: string, rows: FootballScheduleRowV1[]): string {
  const doc = finalizeFootballScheduleDocument({
    dateKst: rows[0]?.dateKst ?? DATE,
    generatedAt: "2026-08-20T00:00:00.000Z",
    provider: "api-football",
    rows,
    droppedUnregisteredCompetition: 0,
  });
  const relDir = path.join(root, "data/research/football");
  mkdirSync(relDir, { recursive: true });
  const rel = `${doc.meta.dateKst}-schedule-v1.json`;
  writeFileSync(
    path.join(relDir, rel),
    `${JSON.stringify(doc, null, 2)}\n`,
    "utf8",
  );
  return doc.meta.artifactHash;
}

function fixture(over: {
  status?: string;
  homeId?: number;
  awayId?: number;
  fixtureId?: number;
  leagueId?: number;
  date?: string;
  fulltime?: { home: number | null; away: number | null };
  extratime?: { home: number | null; away: number | null };
  penalty?: { home: number | null; away: number | null };
  goals?: { home: number | null; away: number | null };
  winnerHome?: boolean | null;
  winnerAway?: boolean | null;
  omitScore?: boolean;
}): FixtureRaw {
  const fulltime = over.fulltime ?? { home: 2, away: 1 };
  const goals = over.goals ?? fulltime;
  const raw: FixtureRaw = {
    fixture: {
      id: over.fixtureId ?? 999001,
      date: over.date ?? KICKOFF,
      status: {
        long: over.status ?? "Match Finished",
        short: over.status ?? "FT",
        elapsed: 90,
      },
    },
    league: {
      id: over.leagueId ?? 39,
      name: "Premier League",
      country: "England",
      season: 2026,
    },
    teams: {
      home: {
        id: over.homeId ?? 9001,
        name: "Home FC",
        winner: over.winnerHome ?? (fulltime.home != null && fulltime.away != null
          ? fulltime.home > fulltime.away
          : null),
      },
      away: {
        id: over.awayId ?? 9002,
        name: "Away FC",
        winner: over.winnerAway ?? (fulltime.home != null && fulltime.away != null
          ? fulltime.away > fulltime.home
          : null),
      },
    },
    goals,
  };
  if (!over.omitScore) {
    raw.score = {
      halftime: { home: 0, away: 0 },
      fulltime,
      extratime: over.extratime ?? { home: null, away: null },
      penalty: over.penalty ?? { home: null, away: null },
    };
  }
  return raw;
}

function fetcherOf(
  fixtures: FixtureRaw[],
  counter?: { n: number },
): FootballOfficialResultFixtureFetcher {
  return {
    async getFixtureById(fixtureId: number) {
      if (counter) counter.n += 1;
      const hit = fixtures.find((f) => f.fixture.id === fixtureId) ?? null;
      return { fixture: hit, cached: false };
    },
  };
}

function readTree(dir: string, acc: string[] = [], prefix = ""): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) readTree(abs, acc, rel);
    else acc.push(rel);
  }
  return acc;
}

function officialSrcFiles(): string[] {
  const dir = path.join(process.cwd(), "src/lib/football/official-result-v0");
  return readdirSync(dir)
    .filter((n) => n.endsWith(".ts"))
    .map((n) => path.join(dir, n));
}

async function main() {
  const snapshotHashBefore = readJsonHashField(SNAPSHOT_PATH, "snapshotHash");
  const baselineHashBefore = readJsonHashField(BASELINE_PATH, "predictionHash");
  const snapshotBytesBefore = shaFile(SNAPSHOT_PATH);
  const baselineBytesBefore = shaFile(BASELINE_PATH);
  const oddsBytesBefore = shaFile(ODDS_PATH);
  const scheduleBytesBefore = shaFile(SCHEDULE_PATH);
  const resultBytesBefore = shaFile(RESULT_PATH);

  assert.equal(snapshotHashBefore, EXPECTED_SNAPSHOT_HASH);
  assert.equal(baselineHashBefore, EXPECTED_BASELINE_HASH);

  const row = eligibleRow();

  // 1-3. FINAL HOME / DRAW / AWAY
  const home = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: 2, away: 1 } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(home.match.oneXTwoOutcome, "HOME");
  assert.equal(home.match.gradingAllowed, true);
  assert.equal(home.match.resultStatus, "FINAL");
  assert.ok(home.match.resultHash);

  const draw = resolveOfficialResultMatch({
    row,
    fixture: fixture({
      fulltime: { home: 1, away: 1 },
      winnerHome: null,
      winnerAway: null,
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(draw.match.oneXTwoOutcome, "DRAW");
  assert.equal(draw.match.gradingAllowed, true);

  const away = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: 0, away: 2 } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(away.match.oneXTwoOutcome, "AWAY");
  assert.equal(away.match.gradingAllowed, true);

  // 4. LIVE → gradingAllowed false
  const live = resolveOfficialResultMatch({
    row,
    fixture: fixture({
      status: "2H",
      fulltime: { home: 1, away: 0 },
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(live.match.resultStatus, "LIVE");
  assert.equal(live.match.gradingAllowed, false);
  assert.equal(live.match.usability, "NOT_FINAL");

  // 5. scheduled / not started
  const ns = resolveOfficialResultMatch({
    row,
    fixture: fixture({
      status: "NS",
      fulltime: { home: null, away: null },
      goals: { home: null, away: null },
      winnerHome: null,
      winnerAway: null,
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(ns.match.resultStatus, "SCHEDULED");
  assert.equal(ns.match.gradingAllowed, false);
  assert.equal(ns.match.oneXTwoOutcome, null);

  // 6. POSTPONED
  const pst = resolveOfficialResultMatch({
    row,
    fixture: fixture({ status: "PST", fulltime: { home: null, away: null } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(pst.match.resultStatus, "POSTPONED");
  assert.equal(pst.match.gradingAllowed, false);
  assert.equal(pst.match.usability, "POSTPONED_NOT_GRADED");

  // 7. CANCELLED
  const canc = resolveOfficialResultMatch({
    row,
    fixture: fixture({ status: "CANC", fulltime: { home: null, away: null } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(canc.match.gradingAllowed, false);
  assert.equal(canc.match.usability, "CANCELLED_NOT_GRADED");

  // 8. ABANDONED → review required
  const abd = resolveOfficialResultMatch({
    row,
    fixture: fixture({ status: "ABD", fulltime: { home: 1, away: 0 } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(abd.match.usability, "ABANDONED_REVIEW_REQUIRED");
  assert.equal(abd.match.gradingAllowed, false);

  // 9. fixtureId mismatch
  const fxMismatch = joinProviderFixtureToScheduleRow(
    fixture({ fixtureId: 888888 }),
    row,
  );
  assert.equal(fxMismatch.ok, false);
  assert.ok(fxMismatch.reasonCodes.includes("FIXTURE_ID_MISMATCH"));

  const fxMismatchResolved = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fixtureId: 888888 }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(fxMismatchResolved.joinOk, false);
  assert.equal(fxMismatchResolved.match.gradingAllowed, false);

  // 10. home/away reversed
  const reversed = joinProviderFixtureToScheduleRow(
    fixture({ homeId: 9002, awayId: 9001 }),
    row,
  );
  assert.equal(reversed.orientation, "REVERSED_SUSPECTED");
  assert.equal(reversed.ok, false);
  const reversedResolved = resolveOfficialResultMatch({
    row,
    fixture: fixture({ homeId: 9002, awayId: 9001 }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(reversedResolved.match.usability, "REVERSED_RESULT_SUSPECTED");
  assert.equal(reversedResolved.match.gradingAllowed, false);

  // 11. team identity mismatch
  const teamMismatch = joinProviderFixtureToScheduleRow(
    fixture({ homeId: 1111, awayId: 2222 }),
    row,
  );
  assert.equal(teamMismatch.ok, false);
  assert.ok(teamMismatch.reasonCodes.includes("HOME_AWAY_MISMATCH"));

  // Kickoff fail-closed join
  const kickoffMissingProvider = joinProviderFixtureToScheduleRow(
    fixture({ date: "" }),
    row,
  );
  assert.equal(kickoffMissingProvider.ok, false);
  assert.ok(kickoffMissingProvider.reasonCodes.includes("PROVIDER_KICKOFF_MISSING"));
  assert.ok(kickoffMissingProvider.reasonCodes.includes("IDENTITY_UNRESOLVED"));

  const kickoffMissingSchedule = joinProviderFixtureToScheduleRow(
    fixture({}),
    eligibleRow({ kickoffTimeUtc: null }),
  );
  assert.equal(kickoffMissingSchedule.ok, false);
  assert.ok(kickoffMissingSchedule.reasonCodes.includes("SCHEDULE_KICKOFF_MISSING"));
  assert.ok(kickoffMissingSchedule.reasonCodes.includes("IDENTITY_UNRESOLVED"));

  const kickoffInvalid = joinProviderFixtureToScheduleRow(
    fixture({ date: "not-an-iso-instant" }),
    row,
  );
  assert.equal(kickoffInvalid.ok, false);
  assert.ok(kickoffInvalid.reasonCodes.includes("PROVIDER_KICKOFF_INVALID"));
  assert.ok(kickoffInvalid.reasonCodes.includes("IDENTITY_UNRESOLVED"));

  const kickoffMismatch = joinProviderFixtureToScheduleRow(
    fixture({ date: "2026-08-20T15:00:00.000Z" }),
    row,
  );
  assert.equal(kickoffMismatch.ok, false);
  assert.ok(kickoffMismatch.reasonCodes.includes("KICKOFF_MISMATCH"));
  assert.ok(kickoffMismatch.reasonCodes.includes("IDENTITY_UNRESOLVED"));

  const kickoffExact = joinProviderFixtureToScheduleRow(fixture({}), row);
  assert.equal(kickoffExact.ok, true);
  assert.equal(kickoffExact.orientation, "MATCHED");
  assert.equal(kickoffExact.reasonCodes.includes("KICKOFF_MISMATCH"), false);
  assert.equal(kickoffExact.reasonCodes.includes("PROVIDER_KICKOFF_MISSING"), false);
  assert.equal(kickoffExact.reasonCodes.includes("SCHEDULE_KICKOFF_MISSING"), false);
  assert.equal(kickoffExact.reasonCodes.includes("IDENTITY_UNRESOLVED"), false);

  // 12. negative score
  const neg = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: -1, away: 0 } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(neg.match.gradingAllowed, false);
  assert.ok(
    neg.match.reasonCodes.some((c) => c.includes("REGULAR_TIME") || c === "INVALID_SCORE") ||
      neg.match.usability === "INVALID_SCORE",
  );

  // 13. invalid/null regulation score on FINAL
  const nullFt = resolveOfficialResultMatch({
    row,
    fixture: fixture({
      status: "FT",
      fulltime: { home: null, away: null },
      goals: { home: 2, away: 1 },
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(nullFt.match.gradingAllowed, false);
  assert.ok(
    nullFt.match.usability === "INVALID_SCORE" ||
      nullFt.match.reasonCodes.includes("REGULAR_TIME_MISSING_FROM_FULLTIME"),
  );

  // 14. AET: 90-minute DRAW preserved (cup/knockout format, not league)
  const aetRow = eligibleRow({
    matchFormat: "KNOCKOUT",
    competitionType: "CUP",
    predictionEligibility: "NOT_SUPPORTED_FORMAT",
    competitionId: "fb-comp-api-football-2",
  });
  const aet = resolveOfficialResultMatch({
    row: aetRow,
    fixture: fixture({
      status: "AET",
      leagueId: 2,
      fulltime: { home: 1, away: 1 },
      extratime: { home: 2, away: 1 },
      goals: { home: 2, away: 1 },
      winnerHome: true,
      winnerAway: false,
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(aet.match.resultStatus, "FINAL_AFTER_EXTRA_TIME");
  assert.equal(aet.match.oneXTwoOutcome, "DRAW");
  assert.equal(aet.match.advancementWinner, "HOME");

  // 15. PEN: 90-minute DRAW preserved
  const pen = resolveOfficialResultMatch({
    row: aetRow,
    fixture: fixture({
      status: "PEN",
      leagueId: 2,
      fulltime: { home: 0, away: 0 },
      extratime: { home: 0, away: 0 },
      penalty: { home: 3, away: 5 },
      goals: { home: 0, away: 0 },
      winnerHome: false,
      winnerAway: true,
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(pen.match.resultStatus, "FINAL_AFTER_PENALTIES");
  assert.equal(pen.match.oneXTwoOutcome, "DRAW");
  assert.equal(pen.match.advancementWinner, "AWAY");

  // 16. Provider winner conflict
  const conflict = resolveOfficialResultMatch({
    row,
    fixture: fixture({
      fulltime: { home: 2, away: 1 },
      winnerHome: false,
      winnerAway: true,
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(conflict.match.usability, "RESULT_CONFLICT");
  assert.equal(conflict.match.gradingAllowed, false);
  assert.ok(conflict.match.reasonCodes.includes("RESULT_CONFLICT"));

  // 17. resultHash deterministic
  const h1 = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: 2, away: 1 } }),
    resultObservedAt: OBSERVED,
  });
  const h2 = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: 2, away: 1 } }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(h1.match.resultHash, h2.match.resultHash);
  assert.ok(h1.match.resultHash);
  assert.match(h1.match.resultHash!, /^[0-9a-f]{64}$/);

  // 18. resultObservedAt-only change → semantic resultHash unchanged
  const obs1 = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: 2, away: 1 } }),
    resultObservedAt: OBSERVED,
  });
  const obs2 = resolveOfficialResultMatch({
    row,
    fixture: fixture({ fulltime: { home: 2, away: 1 } }),
    resultObservedAt: OBSERVED_2,
  });
  assert.equal(obs1.match.resultHash, obs2.match.resultHash);
  assert.notEqual(obs1.match.resultObservedAt, obs2.match.resultObservedAt);

  const tmp = mkdtempSync(path.join(tmpdir(), "fb-official-result-"));
  try {
    writeSchedule(tmp, [eligibleRow()]);
    const counter = { n: 0 };
    const ftFetcher = fetcherOf(
      [fixture({ fulltime: { home: 2, away: 1 } })],
      counter,
    );

    // 20. dry-run → no writes
    const dry = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: true,
      rootDir: tmp,
      fetcher: ftFetcher,
    });
    assert.equal(dry.wrote, false);
    assert.equal(dry.outcome, "SEALED");
    assert.equal(dry.terminalFinal, true);
    assert.ok(dry.document);
    assert.equal(
      existsSync(
        path.join(tmp, "data/research/football", `${DATE}-official-result-v0.json`),
      ),
      false,
    );
    const artifactHash1 = dry.document!.meta.resultArtifactHash;
    const artifactHash2 = computeFootballOfficialResultArtifactHash({
      meta: (() => {
        const { resultArtifactHash: _h, ...meta } = dry.document!.meta;
        void _h;
        return meta;
      })(),
      matches: dry.document!.matches,
    });
    assert.equal(artifactHash1, artifactHash2);

    const written = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: false,
      rootDir: tmp,
      fetcher: ftFetcher,
    });
    assert.equal(written.wrote, true);
    const outPath = path.join(
      tmp,
      "data/research/football",
      `${DATE}-official-result-v0.json`,
    );
    assert.equal(existsSync(outPath), true);
    const beforeBytes = shaFile(outPath);

    // 19. existing result artifact → refuse overwrite
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: ftFetcher,
        }),
      /FOOTBALL_OFFICIAL_RESULT_ALREADY_EXISTS/,
    );
    assert.equal(shaFile(outPath), beforeBytes);

    rmSync(outPath);

    // reversed → fail/block, no write
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: fetcherOf([fixture({ homeId: 9002, awayId: 9001 })]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_REVERSED_HOME_AWAY/,
    );
    assert.equal(existsSync(outPath), false);

    // fixtureId mismatch on provider payload
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: {
            async getFixtureById() {
              return { fixture: fixture({ fixtureId: 1 }), cached: false };
            },
          },
        }),
      /FOOTBALL_OFFICIAL_RESULT_IDENTITY_UNRESOLVED|FIXTURE_ID_MISMATCH/,
    );

    // team mismatch
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: fetcherOf([fixture({ homeId: 1111, awayId: 2222 })]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_IDENTITY_UNRESOLVED/,
    );

    // negative score FINAL
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: fetcherOf([fixture({ fulltime: { home: -1, away: 0 } })]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_INVALID_SCORE/,
    );

    // null regulation on FINAL
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: fetcherOf([
            fixture({
              fulltime: { home: null, away: null },
              goals: { home: 1, away: 0 },
            }),
          ]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_INVALID_SCORE/,
    );

    // provider winner conflict
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: fetcherOf([
            fixture({
              fulltime: { home: 2, away: 1 },
              winnerHome: false,
              winnerAway: true,
            }),
          ]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_CONFLICT/,
    );

    // 21. Provider not-final actual response → no gradeable official result
    const waiting = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: false,
      rootDir: tmp,
      fetcher: fetcherOf([
        fixture({
          status: "NS",
          fulltime: { home: null, away: null },
          goals: { home: null, away: null },
          winnerHome: null,
          winnerAway: null,
        }),
      ]),
    });
    assert.equal(waiting.wrote, false);
    assert.equal(waiting.outcome, "WAITING_FINAL");
    assert.equal(waiting.terminalFinal, false);
    assert.equal(waiting.document, null);
    assert.equal(existsSync(outPath), false);
    assert.equal(waiting.matchSummaries[0]!.gradingAllowed, false);

    const liveRun = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: false,
      rootDir: tmp,
      fetcher: fetcherOf([fixture({ status: "LIVE", fulltime: { home: 1, away: 0 } })]),
    });
    assert.equal(liveRun.wrote, false);
    assert.equal(liveRun.outcome, "WAITING_FINAL");

    const postponedRun = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: false,
      rootDir: tmp,
      fetcher: fetcherOf([
        fixture({ status: "PST", fulltime: { home: null, away: null } }),
      ]),
    });
    assert.equal(postponedRun.wrote, false);
    assert.equal(postponedRun.outcome, "RESULT_NOT_FINAL");

    const cancelledRun = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: false,
      rootDir: tmp,
      fetcher: fetcherOf([
        fixture({ status: "CANC", fulltime: { home: null, away: null } }),
      ]),
    });
    assert.equal(cancelledRun.wrote, false);

    const abandonedRun = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: false,
      rootDir: tmp,
      fetcher: fetcherOf([fixture({ status: "ABD", fulltime: { home: 1, away: 0 } })]),
    });
    assert.equal(abandonedRun.wrote, false);
    assert.equal(
      abandonedRun.matchSummaries[0]!.usability,
      "ABANDONED_REVIEW_REQUIRED",
    );

    const tree = readTree(path.join(tmp, "data/research/football"));
    assert.equal(
      tree.some((f) => f.includes("official-result-v0")),
      false,
    );

    // league unexpected extra time is fail-loud
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: false,
          rootDir: tmp,
          fetcher: fetcherOf([
            fixture({
              status: "AET",
              fulltime: { home: 1, away: 1 },
              extratime: { home: 2, away: 1 },
              goals: { home: 2, away: 1 },
            }),
          ]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_LEAGUE_UNEXPECTED_PERIOD/,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // 22. actual 08-14 Schedule identity join PASS
  const actualSchedule = JSON.parse(readFileSync(SCHEDULE_PATH, "utf8")) as {
    rows: FootballScheduleRowV1[];
  };
  const actualRow = actualSchedule.rows.find(
    (r) => r.matchId === "soccer-api-football-1556021",
  );
  assert.ok(actualRow);
  assert.equal(actualRow!.providerMatchId, "1556021");
  assert.equal(actualRow!.homeProviderTeamId, "306");
  assert.equal(actualRow!.awayProviderTeamId, "281");
  assert.equal(actualRow!.competitionId, "fb-comp-api-football-98");
  const actualJoin = joinProviderFixtureToScheduleRow(
    {
      fixture: {
        id: 1556021,
        date: "2026-08-14T10:00:00.000Z",
        status: { short: "FT", long: "Match Finished", elapsed: 90 },
      },
      league: { id: 98, name: "J1 League", country: "Japan", season: 2027 },
      teams: {
        home: { id: 306, name: "Tokyo Verdy", winner: false },
        away: { id: 281, name: "Kashiwa Reysol", winner: true },
      },
      goals: { home: 0, away: 1 },
      score: {
        fulltime: { home: 0, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    },
    actualRow!,
  );
  assert.equal(actualJoin.ok, true);
  assert.equal(actualJoin.orientation, "MATCHED");

  // actual 08-14 official result artifact unchanged
  const resultDoc = JSON.parse(readFileSync(RESULT_PATH, "utf8")) as {
    meta: { resultArtifactHash: string };
    matches: {
      resultHash: string;
      oneXTwoOutcome: string;
      regularTime: { home: number; away: number };
    }[];
  };
  assert.equal(resultDoc.meta.resultArtifactHash, EXPECTED_RESULT_ARTIFACT_HASH);
  assert.equal(resultDoc.matches[0]!.resultHash, EXPECTED_RESULT_HASH);
  assert.equal(resultDoc.matches[0]!.oneXTwoOutcome, "AWAY");
  assert.equal(resultDoc.matches[0]!.regularTime.home, 1);
  assert.equal(resultDoc.matches[0]!.regularTime.away, 3);
  assert.equal(shaFile(RESULT_PATH), resultBytesBefore);

  // 23-24. Snapshot / Market Baseline unchanged
  assert.equal(readJsonHashField(SNAPSHOT_PATH, "snapshotHash"), EXPECTED_SNAPSHOT_HASH);
  assert.equal(readJsonHashField(BASELINE_PATH, "predictionHash"), EXPECTED_BASELINE_HASH);
  assert.equal(shaFile(SNAPSHOT_PATH), snapshotBytesBefore);
  assert.equal(shaFile(BASELINE_PATH), baselineBytesBefore);
  const baselineDoc = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
    meta: { predictionAt: string };
    matches: { matchId: string; baselineOutcome: string; baselineProbability: number }[];
  };
  assert.equal(baselineDoc.meta.predictionAt, "2026-08-13T17:18:33.639Z");
  const baselineMatch = baselineDoc.matches.find(
    (m) => m.matchId === "soccer-api-football-1556021",
  );
  assert.equal(baselineMatch?.baselineOutcome, "AWAY");
  assert.equal(baselineMatch?.baselineProbability, 0.48328753555203235);

  // 25. no Prediction imports/calls in official-result-v0
  for (const file of officialSrcFiles()) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /prediction-snapshot-v0|market-baseline-prediction-v0|review-scorecard-foundation-v0/.test(
        text,
      ),
      false,
      file,
    );
    assert.equal(/odds-1x2-v1\/build/.test(text), false, file);
  }

  // 26. no Odds / Schedule / Result rewrite
  assert.equal(shaFile(ODDS_PATH), oddsBytesBefore);
  assert.equal(shaFile(SCHEDULE_PATH), scheduleBytesBefore);
  assert.equal(shaFile(RESULT_PATH), resultBytesBefore);

  // score.fulltime is 90-minute; goals is not used as fallback
  const extracted = extractApiFootballResultScores(
    fixture({
      fulltime: { home: 1, away: 1 },
      goals: { home: 3, away: 2 },
    }),
  );
  assert.deepEqual(extracted.regularTime, { home: 1, away: 1 });
  assert.deepEqual(extracted.finalScore, { home: 3, away: 2 });

  assert.equal(mapApiFootballShortStatusToResultStatus("FT"), "FINAL");
  assert.equal(
    mapApiFootballShortStatusToResultStatus("AET"),
    "FINAL_AFTER_EXTRA_TIME",
  );
  assert.equal(
    mapApiFootballShortStatusToResultStatus("PEN"),
    "FINAL_AFTER_PENALTIES",
  );
  assert.equal(mapApiFootballShortStatusToResultStatus("HT"), "HALFTIME");
  assert.equal(mapApiFootballShortStatusToResultStatus("ZZZ"), "UNKNOWN");

  const cli = readFileSync(
    path.join(process.cwd(), "scripts/build-football-official-result-v0.ts"),
    "utf8",
  );
  assert.match(cli, /FOOTBALL_OFFICIAL_RESULT_MANUAL_SCORE_FORBIDDEN/);

  console.log("PASS test-football-official-result-v0");
  console.log(
    JSON.stringify(
      {
        home: home.match.oneXTwoOutcome,
        draw: draw.match.oneXTwoOutcome,
        away: away.match.oneXTwoOutcome,
        liveGrading: live.match.gradingAllowed,
        resultHashPrefix: home.match.resultHash?.slice(0, 12),
        snapshotHash: snapshotHashBefore,
        baselineHash: baselineHashBefore,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
