/**
 * TheSportsDB 연동 스모크 테스트
 * 사용: npx tsx --env-file=.env.local scripts/verify-thesportsdb.ts
 *
 * 확인 항목
 * 1. eventsday.php HTTP 응답
 * 2. 실응답 → GameData 매핑 (KST 날짜/시간, 리그, 팀명, gameId)
 * 3. 엔진 분석 입력 연결 여부
 * 4. 빈 일정 / 미지원 엔드포인트 동작 (Dummy 자동 폴백 없음)
 */
import { TheSportsDbProvider } from "../src/lib/sports/thesportsdb-provider";
import { getSportsProvider } from "../src/lib/sports/get-provider";
import { getEngineAnalysisData } from "../src/lib/engine/analysis-data-provider";
import { getTeamDisplayName } from "../src/lib/teams";
import { getKstToday } from "../src/lib/datetime/kst";

async function httpProbe(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

async function main() {
  const base =
    process.env.SPORTS_API_BASE_URL ??
    "https://www.thesportsdb.com/api/v1/json";
  const key = process.env.SPORTS_API_KEY ?? "123";
  const date = getKstToday();

  const urls = [
    `${base}/${key}/lookupleague.php?id=4591`,
    `${base}/${key}/lookupleague.php?id=4830`,
    `${base}/${key}/eventsday.php?d=${date}&l=4591`,
    `${base}/${key}/eventsday.php?d=${date}&l=4830`,
  ];

  console.log("=== 1) HTTP probes ===");
  console.log(`KST today: ${date}`);
  for (const url of urls) {
    const result = await httpProbe(url);
    // 키가 경로에 포함되므로 URL 전체를 출력하지 않는다.
    const endpoint = url.slice(url.indexOf("?") - 20);
    console.log(`\nendpoint: ...${endpoint}`);
    console.log(`HTTP: ${result.status}`);
  }

  console.log("\n=== 2) getGames 매핑 ===");
  const api = new TheSportsDbProvider(base, key);
  const games = await api.getGames({ date, sport: "baseball" });
  console.log(`mapped count: ${games.length}`);
  for (const game of games) {
    console.log({
      id: game.id,
      league: game.league,
      date: game.date,
      startTime: game.startTime,
      home: `${game.homeTeam} → ${getTeamDisplayName(game.homeTeam)}`,
      away: `${game.awayTeam} → ${getTeamDisplayName(game.awayTeam)}`,
      dateMatchesRequest: game.date === date,
    });
  }

  console.log("\n=== 3) 엔진 분석 입력 연결 ===");
  for (const game of games) {
    const engineInput = await getEngineAnalysisData(game.id);
    console.log({
      id: game.id,
      engineInput: engineInput ? "FOUND" : "NONE",
      aiAnalysisAvailable: game.aiAnalysisAvailable,
    });
  }

  console.log("\n=== 4) 빈 일정 / 미지원 엔드포인트 ===");
  const emptyDay = await api.getGames({ date: "2099-01-01", sport: "baseball" });
  console.log(`empty day count (정상 빈 배열 기대): ${emptyDay.length}`);

  const provider = getSportsProvider();
  console.log(`getSportsProvider().kind: ${provider.kind}`);

  try {
    await api.getAnalysis("npb-softbank-orix");
    console.log("getAnalysis: unexpected success");
  } catch (error) {
    console.log(
      "getAnalysis throws (Dummy 폴백 없음):",
      (error as Error).message,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
