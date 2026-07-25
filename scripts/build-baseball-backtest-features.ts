/**
 * baseball-2024.json → 누수 없는 백테스트 특징 데이터셋
 *
 * 실행:
 *   npx tsx scripts/build-baseball-backtest-features.ts
 *
 * 원칙:
 * - 각 경기 특징은 해당 경기 시작 전까지 끝난 경기만 사용
 * - 현재·미래 경기 결과 절대 미사용
 * - 처리 순서: ① 직전 특징 계산 → ② 현재 결과를 이력에 추가
 * - Engine / weights / Provider / Odds / UI 미수정
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const SOURCE_PATH = path.join(
  process.cwd(),
  "data",
  "backtest",
  "baseball-2024.json",
);
const OUT_PATH = path.join(
  process.cwd(),
  "data",
  "backtest",
  "baseball-2024-features.json",
);

type Winner = "home" | "away" | "draw";

type SourceGame = {
  providerGameId: number;
  leagueId: number;
  leagueName: string;
  season: number;
  date: string;
  startTime: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  winner: Winner;
  status: string;
};

type SourceFile = {
  meta: unknown;
  games: SourceGame[];
};

/** 팀 관점의 완료 경기 1건 (이력용) */
type TeamGameRecord = {
  providerGameId: number;
  date: string;
  startTime: string;
  /** 해당 팀이 홈이었는지 */
  isHome: boolean;
  runsScored: number;
  runsAllowed: number;
  result: "W" | "L" | "D";
  opponentId: number;
};

type TeamSideFeatures = {
  teamId: number;
  teamName: string;
  gamesPlayedBefore: number;
  winsLast5: number | null;
  lossesLast5: number | null;
  winRateLast5: number | null;
  runsScoredAverageLast5: number | null;
  runsAllowedAverageLast5: number | null;
  seasonWinRateBefore: number | null;
  seasonRunsScoredAverageBefore: number | null;
  seasonRunsAllowedAverageBefore: number | null;
  homeWinRateBefore: number | null;
  awayWinRateBefore: number | null;
  currentWinStreakBefore: number;
  currentLossStreakBefore: number;
  restDaysBefore: number | null;
};

type HeadToHeadFeatures = {
  headToHeadGamesBefore: number;
  homeTeamHeadToHeadWinsBefore: number;
  awayTeamHeadToHeadWinsBefore: number;
  headToHeadHomeWinRateBefore: number | null;
};

type FeatureGame = {
  providerGameId: number;
  leagueId: number;
  leagueName: string;
  season: number;
  date: string;
  startTime: string;
  homeTeam: TeamSideFeatures;
  awayTeam: TeamSideFeatures;
  headToHead: HeadToHeadFeatures;
  dataAvailability: number;
  actualWinner: Winner;
  actualHomeScore: number;
  actualAwayScore: number;
};

type FeatureFile = {
  meta: {
    generatedAt: string;
    source: string;
    totalGames: number;
    featureVersion: string;
    leakagePrevention: string;
  };
  games: FeatureGame[];
};

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function assertFinite(n: number, label: string): number {
  if (!Number.isFinite(n)) {
    throw new Error(`Non-finite value at ${label}: ${n}`);
  }
  return n;
}

function commenceKey(date: string, startTime: string): string {
  return `${date}T${startTime}`;
}

/** date 차이(일). 같은 날이면 0. */
function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`Invalid date for restDays: ${earlier} / ${later}`);
  }
  return Math.round((b - a) / 86_400_000);
}

function winRate(wins: number, played: number): number | null {
  if (played <= 0) return null;
  return round4(wins / played);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return round4(sum / values.length);
}

function computeStreaks(history: TeamGameRecord[]): {
  win: number;
  loss: number;
} {
  let win = 0;
  let loss = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i].result;
    if (r === "D") break;
    if (i === history.length - 1) {
      if (r === "W") win = 1;
      else loss = 1;
      continue;
    }
    if (win > 0) {
      if (r === "W") win += 1;
      else break;
    } else if (loss > 0) {
      if (r === "L") loss += 1;
      else break;
    }
  }
  return { win, loss };
}

function computeTeamFeatures(
  teamId: number,
  teamName: string,
  history: TeamGameRecord[],
  currentDate: string,
): TeamSideFeatures {
  const played = history.length;
  const last5 = history.slice(-5);

  let winsLast5: number | null = null;
  let lossesLast5: number | null = null;
  let winRateLast5: number | null = null;
  let runsScoredAverageLast5: number | null = null;
  let runsAllowedAverageLast5: number | null = null;

  if (last5.length > 0) {
    winsLast5 = last5.filter((g) => g.result === "W").length;
    lossesLast5 = last5.filter((g) => g.result === "L").length;
    winRateLast5 = winRate(winsLast5, last5.length);
    runsScoredAverageLast5 = average(last5.map((g) => g.runsScored));
    runsAllowedAverageLast5 = average(last5.map((g) => g.runsAllowed));
  }

  const seasonWins = history.filter((g) => g.result === "W").length;
  const seasonWinRateBefore = winRate(seasonWins, played);
  const seasonRunsScoredAverageBefore = average(
    history.map((g) => g.runsScored),
  );
  const seasonRunsAllowedAverageBefore = average(
    history.map((g) => g.runsAllowed),
  );

  const homeGames = history.filter((g) => g.isHome);
  const awayGames = history.filter((g) => !g.isHome);
  const homeWins = homeGames.filter((g) => g.result === "W").length;
  const awayWins = awayGames.filter((g) => g.result === "W").length;
  const homeWinRateBefore = winRate(homeWins, homeGames.length);
  const awayWinRateBefore = winRate(awayWins, awayGames.length);

  const streaks = computeStreaks(history);

  let restDaysBefore: number | null = null;
  if (history.length > 0) {
    const last = history[history.length - 1];
    restDaysBefore = assertFinite(
      daysBetween(last.date, currentDate),
      "restDaysBefore",
    );
  }

  return {
    teamId,
    teamName,
    gamesPlayedBefore: played,
    winsLast5,
    lossesLast5,
    winRateLast5,
    runsScoredAverageLast5,
    runsAllowedAverageLast5,
    seasonWinRateBefore,
    seasonRunsScoredAverageBefore,
    seasonRunsAllowedAverageBefore,
    homeWinRateBefore,
    awayWinRateBefore,
    currentWinStreakBefore: streaks.win,
    currentLossStreakBefore: streaks.loss,
    restDaysBefore,
  };
}

function computeHeadToHead(
  homeTeamId: number,
  awayTeamId: number,
  homeHistory: TeamGameRecord[],
): HeadToHeadFeatures {
  const meetings = homeHistory.filter((g) => g.opponentId === awayTeamId);
  let homeWins = 0;
  let awayWins = 0;
  for (const m of meetings) {
    // homeHistory 기준: isHome 이면 현재 홈팀이 당시에도 홈
    // H2H 승리는 "이번 경기의 홈팀" 관점
    if (m.result === "W") homeWins += 1;
    else if (m.result === "L") awayWins += 1;
  }
  return {
    headToHeadGamesBefore: meetings.length,
    homeTeamHeadToHeadWinsBefore: homeWins,
    awayTeamHeadToHeadWinsBefore: awayWins,
    headToHeadHomeWinRateBefore: winRate(homeWins, meetings.length),
  };
}

/** 특징 필드 중 null이 아닌 비율 (dataAvailability) */
function computeAvailability(
  home: TeamSideFeatures,
  away: TeamSideFeatures,
  h2h: HeadToHeadFeatures,
): number {
  const values: unknown[] = [
    home.gamesPlayedBefore,
    home.winsLast5,
    home.lossesLast5,
    home.winRateLast5,
    home.runsScoredAverageLast5,
    home.runsAllowedAverageLast5,
    home.seasonWinRateBefore,
    home.seasonRunsScoredAverageBefore,
    home.seasonRunsAllowedAverageBefore,
    home.homeWinRateBefore,
    home.awayWinRateBefore,
    home.currentWinStreakBefore,
    home.currentLossStreakBefore,
    home.restDaysBefore,
    away.gamesPlayedBefore,
    away.winsLast5,
    away.lossesLast5,
    away.winRateLast5,
    away.runsScoredAverageLast5,
    away.runsAllowedAverageLast5,
    away.seasonWinRateBefore,
    away.seasonRunsScoredAverageBefore,
    away.seasonRunsAllowedAverageBefore,
    away.homeWinRateBefore,
    away.awayWinRateBefore,
    away.currentWinStreakBefore,
    away.currentLossStreakBefore,
    away.restDaysBefore,
    h2h.headToHeadGamesBefore,
    h2h.homeTeamHeadToHeadWinsBefore,
    h2h.awayTeamHeadToHeadWinsBefore,
    h2h.headToHeadHomeWinRateBefore,
  ];
  const available = values.filter((v) => v != null).length;
  return round4(available / values.length);
}

function appendResult(
  history: TeamGameRecord[],
  game: SourceGame,
  asHome: boolean,
): void {
  const runsScored = asHome ? game.homeScore : game.awayScore;
  const runsAllowed = asHome ? game.awayScore : game.homeScore;
  let result: "W" | "L" | "D";
  if (game.winner === "draw") result = "D";
  else if (asHome) result = game.winner === "home" ? "W" : "L";
  else result = game.winner === "away" ? "W" : "L";

  history.push({
    providerGameId: game.providerGameId,
    date: game.date,
    startTime: game.startTime,
    isHome: asHome,
    runsScored,
    runsAllowed,
    result,
    opponentId: asHome ? game.awayTeamId : game.homeTeamId,
  });
}

function buildFeatures(games: SourceGame[]): FeatureGame[] {
  // 리그별로 분리해 시간순 처리 (팀 이력이 리그 내에서만 누적)
  const byLeague = new Map<number, SourceGame[]>();
  for (const g of games) {
    const list = byLeague.get(g.leagueId) ?? [];
    list.push(g);
    byLeague.set(g.leagueId, list);
  }

  const out: FeatureGame[] = [];

  for (const [, leagueGames] of byLeague) {
    leagueGames.sort((a, b) => {
      const k = commenceKey(a.date, a.startTime).localeCompare(
        commenceKey(b.date, b.startTime),
      );
      if (k !== 0) return k;
      return a.providerGameId - b.providerGameId;
    });

    const histories = new Map<number, TeamGameRecord[]>();

    const getHistory = (teamId: number): TeamGameRecord[] => {
      let h = histories.get(teamId);
      if (!h) {
        h = [];
        histories.set(teamId, h);
      }
      return h;
    };

    for (const game of leagueGames) {
      const homeHist = getHistory(game.homeTeamId);
      const awayHist = getHistory(game.awayTeamId);

      // ① 직전 특징 계산 (현재 결과 미포함)
      const homeTeam = computeTeamFeatures(
        game.homeTeamId,
        game.homeTeamName,
        homeHist,
        game.date,
      );
      const awayTeam = computeTeamFeatures(
        game.awayTeamId,
        game.awayTeamName,
        awayHist,
        game.date,
      );
      const headToHead = computeHeadToHead(
        game.homeTeamId,
        game.awayTeamId,
        homeHist,
      );
      const dataAvailability = computeAvailability(
        homeTeam,
        awayTeam,
        headToHead,
      );

      out.push({
        providerGameId: game.providerGameId,
        leagueId: game.leagueId,
        leagueName: game.leagueName,
        season: game.season,
        date: game.date,
        startTime: game.startTime,
        homeTeam,
        awayTeam,
        headToHead,
        dataAvailability,
        actualWinner: game.winner,
        actualHomeScore: game.homeScore,
        actualAwayScore: game.awayScore,
      });

      // ② 현재 결과를 이력에 추가
      appendResult(homeHist, game, true);
      appendResult(awayHist, game, false);
    }
  }

  out.sort((a, b) => {
    const k = commenceKey(a.date, a.startTime).localeCompare(
      commenceKey(b.date, b.startTime),
    );
    if (k !== 0) return k;
    return a.providerGameId - b.providerGameId;
  });

  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function walkNumbers(value: unknown, pathLabel: string, bad: string[]): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) bad.push(`${pathLabel}=${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkNumbers(v, `${pathLabel}[${i}]`, bad));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      walkNumbers(v, `${pathLabel}.${k}`, bad);
    }
  }
}

function containsSecrets(jsonText: string, apiKey?: string): string[] {
  const hits: string[] = [];
  if (/x-apisports-key/i.test(jsonText)) hits.push("x-apisports-key");
  if (/api[_-]?key/i.test(jsonText)) hits.push("apiKey");
  if (apiKey && jsonText.includes(apiKey)) hits.push("raw API key");
  if (/Bearer\s+[A-Za-z0-9._\-]+/i.test(jsonText)) hits.push("Bearer");
  return hits;
}

function spotCheck(label: string, rows: FeatureGame[]) {
  console.log(`\n--- 스팟 체크 ${label} (${rows.length}경기) ---`);
  for (const g of rows) {
    console.log(
      `${g.date} ${g.startTime} | ${g.homeTeam.teamName} vs ${g.awayTeam.teamName}`,
    );
    console.log(
      `  이전 경기 수: home=${g.homeTeam.gamesPlayedBefore} away=${g.awayTeam.gamesPlayedBefore}`,
    );
    console.log(
      `  최근5: home W${g.homeTeam.winsLast5}/L${g.homeTeam.lossesLast5} (${g.homeTeam.winRateLast5 ?? "null"})` +
        ` | away W${g.awayTeam.winsLast5}/L${g.awayTeam.lossesLast5} (${g.awayTeam.winRateLast5 ?? "null"})`,
    );
    console.log(
      `  시즌 승률: home=${g.homeTeam.seasonWinRateBefore ?? "null"} away=${g.awayTeam.seasonWinRateBefore ?? "null"}`,
    );
    console.log(
      `  휴식일: home=${g.homeTeam.restDaysBefore ?? "null"} away=${g.awayTeam.restDaysBefore ?? "null"}`,
    );
    console.log(
      `  실제: ${g.actualHomeScore}-${g.actualAwayScore} (${g.actualWinner}) | avail=${g.dataAvailability}`,
    );
  }
}

function pickSpotGames(games: FeatureGame[], leagueId: number): FeatureGame[] {
  const league = games.filter((g) => g.leagueId === leagueId);
  if (league.length === 0) return [];
  // 초반 / 중반 / 후반 각 1
  const idxs = [
    0,
    Math.floor(league.length / 2),
    Math.max(0, league.length - 1),
  ];
  const unique = [...new Set(idxs)];
  return unique.map((i) => league[i]);
}

async function main() {
  console.log("=== 백테스트 특징 생성 ===");
  console.log("입력:", SOURCE_PATH);

  const source = JSON.parse(
    await readFile(SOURCE_PATH, "utf8"),
  ) as SourceFile;

  if (!Array.isArray(source.games) || source.games.length === 0) {
    throw new Error("source games empty");
  }

  const features = buildFeatures(source.games);
  const again = buildFeatures(source.games);

  // ── 검증 ──────────────────────────────────────────────
  const errors: string[] = [];

  if (features.length !== source.games.length) {
    errors.push(
      `feature count ${features.length} != source ${source.games.length}`,
    );
  }

  // 첫 경기(전체 날짜순) — 리그 내 첫 경기는 gamesPlayedBefore=0
  // 스팟: 각 리그 첫 경기
  for (const leagueId of [2, 5]) {
    const first = features.find((g) => g.leagueId === leagueId);
    if (!first) continue;
    if (
      first.homeTeam.gamesPlayedBefore !== 0 ||
      first.awayTeam.gamesPlayedBefore !== 0
    ) {
      errors.push(
        `league ${leagueId} first game must have 0 history (got home=${first.homeTeam.gamesPlayedBefore} away=${first.awayTeam.gamesPlayedBefore})`,
      );
    }
    if (
      first.homeTeam.seasonWinRateBefore != null ||
      first.awayTeam.seasonWinRateBefore != null
    ) {
      errors.push(`league ${leagueId} first game winRate must be null`);
    }
  }

  // 날짜 오름차순
  for (let i = 1; i < features.length; i++) {
    const prev = commenceKey(features[i - 1].date, features[i - 1].startTime);
    const cur = commenceKey(features[i].date, features[i].startTime);
    if (prev > cur) {
      errors.push(`date order broken at index ${i}: ${prev} > ${cur}`);
      break;
    }
  }

  // providerGameId 중복
  const ids = new Set<number>();
  for (const g of features) {
    if (ids.has(g.providerGameId)) {
      errors.push(`duplicate providerGameId ${g.providerGameId}`);
      break;
    }
    ids.add(g.providerGameId);
  }

  // NaN / Infinity
  const badNumbers: string[] = [];
  walkNumbers(features, "games", badNumbers);
  if (badNumbers.length > 0) {
    errors.push(`non-finite: ${badNumbers.slice(0, 5).join(", ")}`);
  }

  // 결정성
  if (!deepEqual(features, again)) {
    errors.push("deterministic check failed — same input produced different features");
  }

  // 누수: gamesPlayedBefore ≤ 해당 팀의 "이전" 완료 경기 수 (재계산으로 교차검증)
  // 각 리그에서 순회하며 카운터와 비교
  {
    const counters = new Map<string, number>(); // `${leagueId}:${teamId}`
    const sortedSource = [...source.games].sort((a, b) => {
      const k = commenceKey(a.date, a.startTime).localeCompare(
        commenceKey(b.date, b.startTime),
      );
      if (k !== 0) return k;
      return a.providerGameId - b.providerGameId;
    });
    // features도 동일 정렬이므로 id 맵으로 조회
    const byId = new Map(features.map((f) => [f.providerGameId, f]));
    for (const g of sortedSource) {
      const feat = byId.get(g.providerGameId);
      if (!feat) {
        errors.push(`missing feature for ${g.providerGameId}`);
        break;
      }
      const hk = `${g.leagueId}:${g.homeTeamId}`;
      const ak = `${g.leagueId}:${g.awayTeamId}`;
      const homeBefore = counters.get(hk) ?? 0;
      const awayBefore = counters.get(ak) ?? 0;
      if (feat.homeTeam.gamesPlayedBefore !== homeBefore) {
        errors.push(
          `leak/count mismatch home game ${g.providerGameId}: feature=${feat.homeTeam.gamesPlayedBefore} expected=${homeBefore}`,
        );
        break;
      }
      if (feat.awayTeam.gamesPlayedBefore !== awayBefore) {
        errors.push(
          `leak/count mismatch away game ${g.providerGameId}: feature=${feat.awayTeam.gamesPlayedBefore} expected=${awayBefore}`,
        );
        break;
      }
      counters.set(hk, homeBefore + 1);
      counters.set(ak, awayBefore + 1);
    }
  }

  if (errors.length > 0) {
    console.error("검증 실패:");
    for (const e of errors) console.error("  -", e);
    process.exit(1);
  }

  const avgAvailability =
    features.reduce((s, g) => s + g.dataAvailability, 0) / features.length;

  const dataset: FeatureFile = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "baseball-2024.json",
      totalGames: features.length,
      featureVersion: "v1",
      leakagePrevention:
        "features use only completed games before each fixture",
    },
    games: features,
  };

  const jsonText = `${JSON.stringify(dataset, null, 2)}\n`;
  const secrets = containsSecrets(
    jsonText,
    process.env.BASEBALL_API_KEY || process.env.FOOTBALL_API_KEY,
  );
  if (secrets.length > 0) {
    console.error("민감정보 감지:", secrets.join(", "));
    process.exit(1);
  }

  await writeFile(OUT_PATH, jsonText, "utf8");
  const fileStat = await stat(OUT_PATH);

  const firstOverall = features[0];
  console.log("\n=== 결과 ===");
  console.log(`전체 특징 경기 수     : ${features.length}`);
  console.log(
    `첫 경기 특징 상태     : ${firstOverall.date} ${firstOverall.leagueName} ` +
      `homePlayed=${firstOverall.homeTeam.gamesPlayedBefore} awayPlayed=${firstOverall.awayTeam.gamesPlayedBefore} ` +
      `winRate=${firstOverall.homeTeam.seasonWinRateBefore} avail=${firstOverall.dataAvailability}`,
  );
  console.log(`dataAvailability 평균 : ${round4(avgAvailability)}`);
  console.log(`파일 크기             : ${(fileStat.size / 1024).toFixed(1)} KB`);
  console.log(`민감정보              : 없음`);
  console.log(`데이터 누수 검증      : PASS`);
  console.log(`결정성 검증           : PASS`);
  console.log(`저장 경로             : ${OUT_PATH}`);

  spotCheck("KBO", pickSpotGames(features, 5));
  spotCheck("NPB", pickSpotGames(features, 2));
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
