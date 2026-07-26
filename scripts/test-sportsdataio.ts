/**
 * SportsDataIO MLB 연결 스모크 테스트.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-sportsdataio.ts
 *
 * Engine / UI / Odds 와 연결하지 않는다.
 * API 키는 로그에 출력하지 않는다.
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  SportsDataApiError,
  SportsDataHttpClient,
  SPORTSDATAIO_DEFAULT_BASE_URL,
  clearSportsDataCache,
  getSportsDataProvider,
  isProviderUnavailable,
  type SportsDataMlbGame,
  type SportsDataRateLimitMeta,
} from "../src/lib/sportsdata";

type SupportLabel = "지원" | "지원 안됨" | "데이터 없음" | "미확인";

type EndpointProbe = {
  name: string;
  support: SupportLabel;
  elapsedMs: number | null;
  detail: string;
  rateLimit: SportsDataRateLimitMeta | null;
};

function formatRateLimit(meta: SportsDataRateLimitMeta | null): string {
  if (!meta) return "없음";
  const parts: string[] = [];
  if (meta.remaining != null) parts.push(`remaining=${meta.remaining}`);
  if (meta.limit != null) parts.push(`limit=${meta.limit}`);
  if (meta.reset != null) parts.push(`reset=${meta.reset}`);
  const rawKeys = Object.keys(meta.raw);
  if (rawKeys.length > 0) parts.push(`headers=${rawKeys.join(",")}`);
  return parts.length > 0 ? parts.join(" ") : "없음";
}

function supportFromError(error: unknown): EndpointProbe["support"] {
  if (error instanceof SportsDataApiError && error.unsupported) {
    return "지원 안됨";
  }
  return "미확인";
}

async function probePath(
  http: SportsDataHttpClient,
  name: string,
  path: string,
): Promise<EndpointProbe> {
  const started = Date.now();
  try {
    const { data, meta } = await http.getJson<unknown>(path);
    const count = Array.isArray(data) ? data.length : data == null ? 0 : 1;
    return {
      name,
      support: count > 0 ? "지원" : "데이터 없음",
      elapsedMs: meta.elapsedMs,
      detail: Array.isArray(data)
        ? `${count}건`
        : typeof data === "number"
          ? String(data)
          : "응답 수신",
      rateLimit: meta.rateLimit,
    };
  } catch (error) {
    const elapsedMs =
      error instanceof SportsDataApiError
        ? error.elapsedMs
        : Date.now() - started;
    const rateLimit =
      error instanceof SportsDataApiError ? error.rateLimit : null;
    return {
      name,
      support: supportFromError(error),
      elapsedMs,
      detail:
        error instanceof SportsDataApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown",
      rateLimit,
    };
  }
}

async function main() {
  clearSportsDataCache();
  const today = getKstToday();
  console.log("=== SportsDataIO MLB 연결 테스트 ===");
  console.log(`대상 날짜(KST): ${today}`);
  console.log(`Base URL: ${SPORTSDATAIO_DEFAULT_BASE_URL}`);

  const providerOrUnavailable = getSportsDataProvider();
  if (isProviderUnavailable(providerOrUnavailable)) {
    console.log("\nAPI 연결 성공 여부: 실패 (키 없음)");
    console.log("이유: SPORTSDATAIO_API_KEY 미설정 → ProviderUnavailable");
    console.log("Current Season: 미확인");
    console.log("오늘 경기 수: 미확인");
    console.log("Starting Pitcher 지원 여부: 미확인");
    console.log("Projected Lineup 지원 여부: 미확인");
    console.log("Confirmed Lineup 지원 여부: 미확인");
    console.log("Injury 지원 여부: 미확인");
    console.log("RateLimit 헤더: 없음");
    console.log("응답시간: 없음");
    return;
  }

  const provider = providerOrUnavailable;
  const apiKey = (process.env.SPORTSDATAIO_API_KEY ?? "").trim();
  const http = new SportsDataHttpClient(SPORTSDATAIO_DEFAULT_BASE_URL, apiKey);

  const probes: EndpointProbe[] = [];
  let connected = false;
  let season: number | null = null;
  let games: SportsDataMlbGame[] = [];
  let seasonElapsed: number | null = null;
  let gamesElapsed: number | null = null;
  let lastRateLimit: SportsDataRateLimitMeta | null = null;

  // 1) Current Season
  {
    const started = Date.now();
    try {
      season = await provider.getCurrentMlbSeason();
      seasonElapsed = Date.now() - started;
      connected = true;
      probes.push({
        name: "Current Season",
        support: "지원",
        elapsedMs: seasonElapsed,
        detail: String(season),
        rateLimit: null,
      });
    } catch (error) {
      seasonElapsed =
        error instanceof SportsDataApiError
          ? error.elapsedMs
          : Date.now() - started;
      if (error instanceof SportsDataApiError) {
        lastRateLimit = error.rateLimit;
      }
      probes.push({
        name: "Current Season",
        support: supportFromError(error),
        elapsedMs: seasonElapsed,
        detail:
          error instanceof Error ? error.message : "CurrentSeason 실패",
        rateLimit:
          error instanceof SportsDataApiError ? error.rateLimit : null,
      });
    }
  }

  // 2) Today's Games
  {
    const started = Date.now();
    try {
      games = await provider.getGames(today);
      gamesElapsed = Date.now() - started;
      connected = true;
      probes.push({
        name: "Today's Games",
        support: games.length > 0 ? "지원" : "데이터 없음",
        elapsedMs: gamesElapsed,
        detail: `${games.length}경기`,
        rateLimit: null,
      });
    } catch (error) {
      gamesElapsed =
        error instanceof SportsDataApiError
          ? error.elapsedMs
          : Date.now() - started;
      if (error instanceof SportsDataApiError) {
        lastRateLimit = error.rateLimit;
      }
      probes.push({
        name: "Today's Games",
        support: supportFromError(error),
        elapsedMs: gamesElapsed,
        detail: error instanceof Error ? error.message : "GamesByDate 실패",
        rateLimit:
          error instanceof SportsDataApiError ? error.rateLimit : null,
      });
    }
  }

  const sampleGame = games[0] ?? null;

  // 3) Starting Pitchers (GamesByDate 필드)
  if (sampleGame) {
    const started = Date.now();
    try {
      const pitchers = await provider.getStartingPitchers(sampleGame.gameId);
      const ok = pitchers?.supported === true;
      probes.push({
        name: "Starting Pitchers",
        support: ok ? "지원" : "데이터 없음",
        elapsedMs: Date.now() - started,
        detail: ok
          ? `home=${pitchers?.home.name ?? "?"} away=${pitchers?.away.name ?? "?"}`
          : "경기 응답에 선발 필드 없음",
        rateLimit: null,
      });
    } catch (error) {
      probes.push({
        name: "Starting Pitchers",
        support: supportFromError(error),
        elapsedMs:
          error instanceof SportsDataApiError
            ? error.elapsedMs
            : Date.now() - started,
        detail: error instanceof Error ? error.message : "선발 조회 실패",
        rateLimit:
          error instanceof SportsDataApiError ? error.rateLimit : null,
      });
    }
  } else {
    probes.push({
      name: "Starting Pitchers",
      support: "미확인",
      elapsedMs: null,
      detail: "오늘 경기 샘플 없음",
      rateLimit: null,
    });
  }

  // 4) Projected Lineups
  const projectedProbe = await probePath(
    http,
    "Projected Lineups",
    `/projections/json/StartingLineupsByDate/${encodeURIComponent(today)}`,
  );
  probes.push(projectedProbe);
  if (projectedProbe.rateLimit) lastRateLimit = projectedProbe.rateLimit;

  // 5) Confirmed Lineups — 동일 StartingLineupsByDate, confirmed 플래그 확인
  if (projectedProbe.support === "지원" || projectedProbe.support === "데이터 없음") {
    if (sampleGame) {
      const started = Date.now();
      try {
        const confirmed = await provider.getConfirmedLineup(sampleGame.gameId);
        probes.push({
          name: "Confirmed Lineups",
          support: confirmed.length > 0 ? "지원" : "데이터 없음",
          elapsedMs: Date.now() - started,
          detail: `${confirmed.length}팀 라인업`,
          rateLimit: null,
        });
      } catch (error) {
        probes.push({
          name: "Confirmed Lineups",
          support: supportFromError(error),
          elapsedMs:
            error instanceof SportsDataApiError
              ? error.elapsedMs
              : Date.now() - started,
          detail: error instanceof Error ? error.message : "확정 라인업 실패",
          rateLimit:
            error instanceof SportsDataApiError ? error.rateLimit : null,
        });
      }
    } else {
      probes.push({
        name: "Confirmed Lineups",
        support: projectedProbe.support,
        elapsedMs: projectedProbe.elapsedMs,
        detail: "StartingLineupsByDate 경로 공유 (샘플 경기 없음)",
        rateLimit: projectedProbe.rateLimit,
      });
    }
  } else {
    probes.push({
      name: "Confirmed Lineups",
      support: "지원 안됨",
      elapsedMs: projectedProbe.elapsedMs,
      detail: "지원 안됨",
      rateLimit: projectedProbe.rateLimit,
    });
  }

  // 6) Injuries
  const injuriesScores = await probePath(
    http,
    "Injuries (scores)",
    "/scores/json/Injuries",
  );
  if (injuriesScores.support === "지원" || injuriesScores.support === "데이터 없음") {
    probes.push({
      ...injuriesScores,
      name: "Injuries",
    });
    if (injuriesScores.rateLimit) lastRateLimit = injuriesScores.rateLimit;
  } else {
    const injuriesProj = await probePath(
      http,
      "Injuries",
      "/projections/json/InjuredPlayers",
    );
    probes.push(injuriesProj);
    if (injuriesProj.rateLimit) lastRateLimit = injuriesProj.rateLimit;
  }

  const elapsedValues = probes
    .map((p) => p.elapsedMs)
    .filter((v): v is number => v != null);
  const avgElapsed =
    elapsedValues.length > 0
      ? Math.round(
          elapsedValues.reduce((sum, v) => sum + v, 0) / elapsedValues.length,
        )
      : null;

  console.log(`\nAPI 연결 성공 여부: ${connected ? "성공" : "실패"}`);
  console.log(`Current Season: ${season ?? "미확인"}`);
  console.log(`오늘 경기 수: ${games.length}`);

  const byName = (name: string) =>
    probes.find((p) => p.name === name)?.support ?? "미확인";

  console.log(`Starting Pitcher 지원 여부: ${byName("Starting Pitchers")}`);
  console.log(`Projected Lineup 지원 여부: ${byName("Projected Lineups")}`);
  console.log(`Confirmed Lineup 지원 여부: ${byName("Confirmed Lineups")}`);
  console.log(`Injury 지원 여부: ${byName("Injuries")}`);
  console.log(`RateLimit 헤더: ${formatRateLimit(lastRateLimit)}`);
  console.log(
    `응답시간: avg ${avgElapsed ?? "?"}ms` +
      (seasonElapsed != null ? ` / season ${seasonElapsed}ms` : "") +
      (gamesElapsed != null ? ` / games ${gamesElapsed}ms` : ""),
  );

  console.log("\nEndpoint 상세");
  for (const probe of probes) {
    console.log(
      `  - ${probe.name}: ${probe.support}` +
        (probe.elapsedMs != null ? ` (${probe.elapsedMs}ms)` : "") +
        ` — ${probe.detail}`,
    );
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : String(error);
  console.error(
    "FAILED:",
    message.replace(/Ocp-Apim-Subscription-Key:\s*\S+/gi, "Ocp-Apim-Subscription-Key: ***"),
  );
  process.exitCode = 1;
});
