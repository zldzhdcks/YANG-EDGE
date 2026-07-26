/**
 * MLB SportsDataIO 보강 후보 안전 계층 검증.
 *
 * Engine 미연결. Scrambled Trial 값은 usableForEngine=false.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-mlb-enrichment-candidate.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildMlbEnrichmentCandidates,
  detectScrambledStatus,
  toSportsDataMatchGame,
} from "../src/lib/mlb/build-mlb-enrichment-candidate";
import type {
  MlbBaselineMatchGame,
  MlbEnrichmentCandidate,
} from "../src/lib/mlb/types-enrichment";
import {
  getSportsDataProvider,
  isProviderUnavailable,
  type SportsDataInjury,
  type SportsDataLineup,
  type SportsDataMlbGame,
  type SportsDataProvider,
} from "../src/lib/sportsdata";

const TARGET_DATE_KST = "2026-07-27";
const PREVIOUS_DATE = "2026-07-26";
const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-enrichment-candidate.json`,
);

type BaselineFile = {
  games?: Array<{
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    commenceTimeUtc: string;
    startTimeKst: string;
    dateKst: string;
  }>;
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function loadBaselines(file: BaselineFile): MlbBaselineMatchGame[] {
  const games = file.games ?? [];
  return games
    .filter((game) => game.dateKst === TARGET_DATE_KST)
    .map((game) => ({
      gameId: game.gameId,
      externalId: game.gameId.replace(/^mlb-/, ""),
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      commenceTimeUtc: game.commenceTimeUtc,
      startTimeKst: game.startTimeKst,
      dateKst: game.dateKst,
    }))
    .sort((a, b) => {
      const t = (a.commenceTimeUtc ?? "").localeCompare(b.commenceTimeUtc ?? "");
      if (t !== 0) return t;
      return a.gameId.localeCompare(b.gameId);
    });
}

function toMatchGames(games: SportsDataMlbGame[]) {
  return games
    .map((game) =>
      toSportsDataMatchGame({
        gameId: game.gameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        dateTimeUtc: game.dateTimeUtc,
        dateTime: game.dateTime,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homePitcherId: game.homePitcherId,
        awayPitcherId: game.awayPitcherId,
        homePitcherName: game.homePitcherName,
        awayPitcherName: game.awayPitcherName,
        raw: game.raw,
      }),
    )
    .filter((game): game is NonNullable<typeof game> => game != null);
}

async function collectEnrichment(
  provider: SportsDataProvider,
  sportsGames: SportsDataMlbGame[],
): Promise<{
  byGameId: Map<
    string,
    {
      projectedLineups: SportsDataLineup[];
      confirmedLineups: SportsDataLineup[];
      homeInjuries: SportsDataInjury[];
      awayInjuries: SportsDataInjury[];
    }
  >;
  rawPayloads: unknown[];
}> {
  const byGameId = new Map<
    string,
    {
      projectedLineups: SportsDataLineup[];
      confirmedLineups: SportsDataLineup[];
      homeInjuries: SportsDataInjury[];
      awayInjuries: SportsDataInjury[];
    }
  >();
  const rawPayloads: unknown[] = sportsGames.map((game) => game.raw);
  const injuryCache = new Map<number, SportsDataInjury[]>();

  const injuriesFor = async (teamId: number | null) => {
    if (teamId == null) return [] as SportsDataInjury[];
    const cached = injuryCache.get(teamId);
    if (cached) return cached;
    try {
      const list = await provider.getInjuries(teamId);
      injuryCache.set(teamId, list);
      rawPayloads.push(...list.map((item) => item.raw));
      return list;
    } catch {
      injuryCache.set(teamId, []);
      return [];
    }
  };

  for (const game of sportsGames) {
    let projected: SportsDataLineup[] = [];
    let confirmed: SportsDataLineup[] = [];
    try {
      projected = await provider.getProjectedLineup(game.gameId);
      rawPayloads.push(...projected.map((item) => item.raw));
    } catch {
      projected = [];
    }
    try {
      confirmed = await provider.getConfirmedLineup(game.gameId);
      rawPayloads.push(...confirmed.map((item) => item.raw));
    } catch {
      confirmed = [];
    }

    // ensure pitchers index via provider API (uses gameIndex from getGames)
    try {
      await provider.getStartingPitchers(game.gameId);
    } catch {
      // ignore — candidate builder reads mapped game fields
    }

    const homeInjuries = await injuriesFor(game.homeTeamId);
    const awayInjuries = await injuriesFor(game.awayTeamId);

    byGameId.set(game.gameId, {
      projectedLineups: projected,
      confirmedLineups: confirmed,
      homeInjuries,
      awayInjuries,
    });
  }

  return { byGameId, rawPayloads };
}

function summarize(candidates: MlbEnrichmentCandidate[]) {
  const matched = candidates.filter((c) => c.matchStatus === "MATCHED").length;
  const ambiguous = candidates.filter((c) => c.matchStatus === "AMBIGUOUS")
    .length;
  const unmatched = candidates.filter((c) => c.matchStatus === "UNMATCHED")
    .length;
  const scrambledTrue = candidates.filter((c) => c.scrambled === true).length;
  const scrambledFalse = candidates.filter((c) => c.scrambled === false).length;
  const scrambledUnknown = candidates.filter((c) => c.scrambled == null).length;
  const startingPitcher = candidates.filter((c) =>
    Boolean(c.startingPitchers?.available),
  ).length;
  const projected = candidates.filter((c) =>
    Boolean(c.projectedLineup?.available),
  ).length;
  const confirmed = candidates.filter((c) =>
    Boolean(c.confirmedLineup?.available),
  ).length;
  const injuries = candidates.filter((c) => Boolean(c.injuries?.available))
    .length;
  const usable = candidates.filter((c) => c.usableForEngine).length;

  const warningCounts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const warning of candidate.warnings) {
      warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1);
    }
  }
  const commonWarnings = [...warningCounts.entries()]
    .filter(([, count]) => count === candidates.length)
    .map(([warning]) => warning)
    .sort();

  return {
    total: candidates.length,
    matched,
    ambiguous,
    unmatched,
    scrambledTrue,
    scrambledFalse,
    scrambledUnknown,
    startingPitcher,
    projected,
    confirmed,
    injuries,
    usable,
    commonWarnings,
    warningCounts: Object.fromEntries(
      [...warningCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    ),
  };
}

async function runOnce(
  baselines: MlbBaselineMatchGame[],
  provider: SportsDataProvider,
): Promise<{
  candidates: MlbEnrichmentCandidate[];
  sportsGameCount: number;
  scrambledDetection: ReturnType<typeof detectScrambledStatus>;
}> {
  // SportsDataIO GamesByDate는 미국 현지 캘린더 — KST 경계를 위해 인접일 조회
  const gamesPrev = await provider.getGames(PREVIOUS_DATE);
  const gamesTarget = await provider.getGames(TARGET_DATE_KST);
  const byId = new Map<string, SportsDataMlbGame>();
  for (const game of [...gamesPrev, ...gamesTarget]) {
    byId.set(game.gameId, game);
  }
  const sportsGames = [...byId.values()];
  const matchGames = toMatchGames(sportsGames);
  const { byGameId, rawPayloads } = await collectEnrichment(
    provider,
    sportsGames,
  );
  const scrambledDetection = detectScrambledStatus(rawPayloads);
  const candidates = buildMlbEnrichmentCandidates(
    baselines,
    matchGames,
    byGameId,
    scrambledDetection,
  );
  return {
    candidates,
    sportsGameCount: sportsGames.length,
    scrambledDetection,
  };
}

async function main() {
  console.log(`=== MLB Enrichment Candidate (${TARGET_DATE_KST} KST) ===`);
  console.log("Engine 전달: 없음 (안전 계층만)");

  const baselineFile = JSON.parse(
    await readFile(BASELINE_PATH, "utf8"),
  ) as BaselineFile;
  const baselines = loadBaselines(baselineFile);
  if (baselines.length === 0) {
    throw new Error("baseline games 없음");
  }

  const providerOrUnavailable = getSportsDataProvider();
  if (isProviderUnavailable(providerOrUnavailable)) {
    throw new Error(`SportsDataIO unavailable: ${providerOrUnavailable.reason}`);
  }
  const provider = providerOrUnavailable;

  const first = await runOnce(baselines, provider);
  const second = await runOnce(baselines, provider);

  const fingerprint = (rows: MlbEnrichmentCandidate[]) =>
    stableStringify(
      rows.map((row) => ({
        gameId: row.gameId,
        sportsDataGameId: row.sportsDataGameId,
        matchStatus: row.matchStatus,
        scrambled: row.scrambled,
        usableForEngine: row.usableForEngine,
        warnings: row.warnings,
        dataAvailability: row.dataAvailability,
        startingPitchersAvailable: row.startingPitchers?.available ?? false,
        projectedAvailable: row.projectedLineup?.available ?? false,
        confirmedAvailable: row.confirmedLineup?.available ?? false,
        injuriesCount: row.injuries?.count ?? 0,
      })),
    );

  const deterministic =
    fingerprint(first.candidates) === fingerprint(second.candidates);

  const summary = summarize(first.candidates);
  const output = {
    meta: {
      version: "mlb-enrichment-candidate-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      baselineInput: path.relative(process.cwd(), BASELINE_PATH),
      provider: "sportsdataio",
      engineConnected: false,
      standingsImplemented: false,
      note: "SportsDataIO 보강 후보 안전 계층. Engine에 전달하지 않음.",
    },
    scrambledDetection: first.scrambledDetection,
    summary: {
      ...summary,
      deterministic,
      sportsDataGameCount: first.sportsGameCount,
    },
    games: first.candidates.map((candidate) => ({
      gameId: candidate.gameId,
      sportsDataGameId: candidate.sportsDataGameId,
      homeTeam: candidate.homeTeam,
      awayTeam: candidate.awayTeam,
      startTime: candidate.startTime,
      matchStatus: candidate.matchStatus,
      matchConfidence: candidate.matchConfidence,
      scrambled: candidate.scrambled,
      startingPitcherAvailable: candidate.startingPitchers?.available ?? false,
      projectedLineupAvailable: candidate.projectedLineup?.available ?? false,
      confirmedLineupAvailable: candidate.confirmedLineup?.available ?? false,
      injuriesCount: candidate.injuries?.count ?? 0,
      standings: candidate.standings,
      usableForEngine: candidate.usableForEngine,
      dataAvailability: candidate.dataAvailability,
      warnings: candidate.warnings,
      candidate,
    })),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`기준 경기: ${summary.total}`);
  console.log(
    `매칭: MATCHED ${summary.matched} / AMBIGUOUS ${summary.ambiguous} / UNMATCHED ${summary.unmatched}`,
  );
  console.log(
    `scrambled: true=${summary.scrambledTrue} false=${summary.scrambledFalse} null=${summary.scrambledUnknown}`,
  );
  console.log(`선발 확보: ${summary.startingPitcher}`);
  console.log(`projected lineup: ${summary.projected}`);
  console.log(`confirmed lineup: ${summary.confirmed}`);
  console.log(`injuries 확보: ${summary.injuries}`);
  console.log(`usableForEngine: ${summary.usable}`);
  console.log(
    `공통 warnings: ${
      summary.commonWarnings.length > 0
        ? summary.commonWarnings.join(", ")
        : "없음"
    }`,
  );
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
