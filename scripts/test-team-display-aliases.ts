/**
 * MLB / MLS 팀 표시명 alias 검증.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-team-display-aliases.ts
 *
 * UI 표시 계층만 검증한다. Provider·Odds·gameId 원본은 변경하지 않는다.
 */
import { buildGameId } from "../src/lib/game-id";
import { normalizeTeamNameForOdds } from "../src/lib/odds";
import {
  TEAM_ALIASES,
  countIdMappings,
  countNameFallbacks,
  getTeamDisplayName,
  normalizeTeamName,
} from "../src/lib/teams";
import { filterGamesClientSide } from "../src/lib/games/recommendation-filter";
import { toBareGameWithOdds } from "../src/types/game-with-odds";
import type { GameData } from "../src/types/game";

const MLB_EXPECTED: Array<{ original: string; display: string }> = [
  { original: "Arizona Diamondbacks", display: "애리조나 다이아몬드백스" },
  { original: "Athletics", display: "애슬레틱스" },
  { original: "Oakland Athletics", display: "애슬레틱스" },
  { original: "Atlanta Braves", display: "애틀랜타 브레이브스" },
  { original: "Baltimore Orioles", display: "볼티모어 오리올스" },
  { original: "Boston Red Sox", display: "보스턴 레드삭스" },
  { original: "Chicago Cubs", display: "시카고 컵스" },
  { original: "Chi Cubs", display: "시카고 컵스" },
  { original: "Chicago White Sox", display: "시카고 화이트삭스" },
  { original: "Chi White Sox", display: "시카고 화이트삭스" },
  { original: "Cincinnati Reds", display: "신시내티 레즈" },
  { original: "Cleveland Guardians", display: "클리블랜드 가디언스" },
  { original: "Colorado Rockies", display: "콜로라도 로키스" },
  { original: "Detroit Tigers", display: "디트로이트 타이거스" },
  { original: "Houston Astros", display: "휴스턴 애스트로스" },
  { original: "Kansas City Royals", display: "캔자스시티 로열스" },
  { original: "Los Angeles Angels", display: "LA 에인절스" },
  { original: "LA Angels", display: "LA 에인절스" },
  { original: "Los Angeles Dodgers", display: "LA 다저스" },
  { original: "LA Dodgers", display: "LA 다저스" },
  { original: "Miami Marlins", display: "마이애미 말린스" },
  { original: "Milwaukee Brewers", display: "밀워키 브루어스" },
  { original: "Minnesota Twins", display: "미네소타 트윈스" },
  { original: "New York Mets", display: "뉴욕 메츠" },
  { original: "NY Mets", display: "뉴욕 메츠" },
  { original: "New York Yankees", display: "뉴욕 양키스" },
  { original: "NY Yankees", display: "뉴욕 양키스" },
  { original: "Philadelphia Phillies", display: "필라델피아 필리스" },
  { original: "Pittsburgh Pirates", display: "피츠버그 파이리츠" },
  { original: "San Diego Padres", display: "샌디에이고 파드리스" },
  { original: "San Francisco Giants", display: "샌프란시스코 자이언츠" },
  { original: "Seattle Mariners", display: "시애틀 매리너스" },
  { original: "St. Louis Cardinals", display: "세인트루이스 카디널스" },
  { original: "St.Louis Cardinals", display: "세인트루이스 카디널스" },
  { original: "Tampa Bay Rays", display: "탬파베이 레이스" },
  { original: "Texas Rangers", display: "텍사스 레인저스" },
  { original: "Toronto Blue Jays", display: "토론토 블루제이스" },
  { original: "Washington Nationals", display: "워싱턴 내셔널스" },
];

/** 2026-07-26 API-Football MLS fixtures 실제 노출 팀 */
const MLS_FIXTURE_TEAMS: Array<{
  id: string;
  original: string;
  display: string;
}> = [
  { id: "1608", original: "Atlanta United FC", display: "애틀랜타 유나이티드" },
  { id: "16489", original: "Austin", display: "오스틴 FC" },
  { id: "1614", original: "CF Montreal", display: "CF 몬트리올" },
  { id: "18310", original: "Charlotte", display: "샬럿 FC" },
  { id: "1607", original: "Chicago Fire", display: "시카고 파이어" },
  { id: "1610", original: "Colorado Rapids", display: "콜로라도 래피즈" },
  { id: "1613", original: "Columbus Crew", display: "콜럼버스 크루" },
  { id: "1615", original: "DC United", display: "DC 유나이티드" },
  { id: "2242", original: "FC Cincinnati", display: "FC 신시내티" },
  { id: "1597", original: "FC Dallas", display: "FC 댈러스" },
  { id: "1600", original: "Houston Dynamo", display: "휴스턴 다이너모" },
  { id: "9568", original: "Inter Miami", display: "인터 마이애미" },
  { id: "1616", original: "Los Angeles FC", display: "로스앤젤레스 FC" },
  { id: "1605", original: "Los Angeles Galaxy", display: "LA 갤럭시" },
  {
    id: "1612",
    original: "Minnesota United FC",
    display: "미네소타 유나이티드",
  },
  { id: "9569", original: "Nashville SC", display: "내슈빌 SC" },
  {
    id: "1609",
    original: "New England Revolution",
    display: "뉴잉글랜드 레볼루션",
  },
  { id: "1604", original: "New York City FC", display: "뉴욕 시티 FC" },
  { id: "1602", original: "New York Red Bulls", display: "뉴욕 레드불스" },
  { id: "1598", original: "Orlando City SC", display: "올랜도 시티" },
  { id: "1599", original: "Philadelphia Union", display: "필라델피아 유니언" },
  { id: "1617", original: "Portland Timbers", display: "포틀랜드 팀버스" },
  { id: "1606", original: "Real Salt Lake", display: "레알 솔트레이크" },
  { id: "25484", original: "San Diego", display: "샌디에이고 FC" },
  {
    id: "1596",
    original: "San Jose Earthquakes",
    display: "산호세 어스퀘이크스",
  },
  { id: "1595", original: "Seattle Sounders", display: "시애틀 사운더스" },
  {
    id: "1611",
    original: "Sporting Kansas City",
    display: "스포팅 캔자스시티",
  },
  { id: "20787", original: "St. Louis City", display: "세인트루이스 시티" },
  { id: "1601", original: "Toronto FC", display: "토론토 FC" },
  {
    id: "1603",
    original: "Vancouver Whitecaps",
    display: "밴쿠버 화이트캡스",
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`검증 실패: ${message}`);
}

function mlbEntries() {
  return TEAM_ALIASES.filter((entry) => entry.league === "MLB");
}

function mlsEntries() {
  return TEAM_ALIASES.filter((entry) => entry.league === "MLS");
}

function makeGame(
  league: "MLB" | "MLS",
  homeTeam: string,
  awayTeam: string,
): GameData {
  return {
    id: buildGameId(league, homeTeam, awayTeam),
    sport: league === "MLB" ? "baseball" : "football",
    league,
    homeTeam,
    awayTeam,
    startTime: "12:00",
    date: "2026-07-26",
    aiAnalysisAvailable: false,
    externalProvider: league === "MLB" ? "api-baseball" : "api-football",
    externalId: "1",
  };
}

function main() {
  const mlbTeams = mlbEntries();
  const mlsTeams = mlsEntries();
  assert(mlbTeams.length === 30, `MLB 구단 alias는 30개여야 함 (실제 ${mlbTeams.length})`);
  assert(
    mlsTeams.length === MLS_FIXTURE_TEAMS.length,
    `MLS alias는 실제 노출 ${MLS_FIXTURE_TEAMS.length}팀이어야 함 (실제 ${mlsTeams.length})`,
  );

  for (const sample of MLB_EXPECTED) {
    const first = getTeamDisplayName({
      originalName: sample.original,
      sport: "baseball",
      league: "MLB",
    });
    const second = getTeamDisplayName({
      originalName: sample.original,
      sport: "baseball",
      league: "MLB",
    });
    assert(first === sample.display, `${sample.original} → ${sample.display}`);
    assert(first === second, `결정성: ${sample.original}`);
  }

  for (const sample of MLS_FIXTURE_TEAMS) {
    const byName = getTeamDisplayName({
      originalName: sample.original,
      sport: "football",
      league: "MLS",
    });
    const byId = getTeamDisplayName({
      originalName: "UNKNOWN TEAM NAME",
      provider: "api-football",
      externalTeamId: sample.id,
      sport: "football",
      league: "MLS",
    });
    assert(byName === sample.display, `${sample.original} → ${sample.display}`);
    assert(byId === sample.display, `ID ${sample.id} → ${sample.display}`);
  }

  // 충돌 방지
  assert(
    getTeamDisplayName({
      originalName: "New York Yankees",
      sport: "baseball",
      league: "MLB",
    }) === "뉴욕 양키스",
    "Yankees 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "New York Mets",
      sport: "baseball",
      league: "MLB",
    }) === "뉴욕 메츠",
    "Mets 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Los Angeles Dodgers",
      sport: "baseball",
      league: "MLB",
    }) === "LA 다저스",
    "Dodgers 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Los Angeles Angels",
      sport: "baseball",
      league: "MLB",
    }) === "LA 에인절스",
    "Angels 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Los Angeles FC",
      sport: "football",
      league: "MLS",
    }) === "로스앤젤레스 FC",
    "LAFC 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Los Angeles Galaxy",
      sport: "football",
      league: "MLS",
    }) === "LA 갤럭시",
    "Galaxy 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Philadelphia Phillies",
      sport: "baseball",
      league: "MLB",
    }) === "필라델피아 필리스",
    "Phillies 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Philadelphia Union",
      sport: "football",
      league: "MLS",
    }) === "필라델피아 유니언",
    "Union 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Colorado Rockies",
      sport: "baseball",
      league: "MLB",
    }) === "콜로라도 로키스",
    "Rockies 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Colorado Rapids",
      sport: "football",
      league: "MLS",
    }) === "콜로라도 래피즈",
    "Rapids 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Houston Astros",
      sport: "baseball",
      league: "MLB",
    }) === "휴스턴 애스트로스",
    "Astros 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Houston Dynamo",
      sport: "football",
      league: "MLS",
    }) === "휴스턴 다이너모",
    "Dynamo 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "Cincinnati Reds",
      sport: "baseball",
      league: "MLB",
    }) === "신시내티 레즈",
    "Reds 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "FC Cincinnati",
      sport: "football",
      league: "MLS",
    }) === "FC 신시내티",
    "FC Cincinnati 충돌",
  );
  assert(
    getTeamDisplayName({
      originalName: "San Diego",
      sport: "football",
      league: "MLS",
    }) === "샌디에이고 FC",
    "MLS San Diego",
  );
  assert(
    getTeamDisplayName({
      originalName: "San Diego Padres",
      sport: "baseball",
      league: "MLB",
    }) === "샌디에이고 파드리스",
    "MLB Padres",
  );

  // 원본명·매칭·gameId 불변
  const home = "New York Yankees";
  const away = "Los Angeles Dodgers";
  const beforeId = buildGameId("MLB", home, away);
  const beforeOdds = normalizeTeamNameForOdds(home);
  assert(
    getTeamDisplayName({ originalName: home, league: "MLB" }) === "뉴욕 양키스",
    "표시명 변환",
  );
  assert(home === "New York Yankees", "원본 문자열 불변");
  assert(buildGameId("MLB", home, away) === beforeId, "gameId 불변");
  assert(normalizeTeamNameForOdds(home) === beforeOdds, "Odds 정규화 불변");

  // 미등록 fallback
  assert(
    getTeamDisplayName("Unknown FC XYZ") === "Unknown FC XYZ",
    "미등록 원문 fallback",
  );

  // 검색: 한글·영문
  const games = [
    makeGame("MLB", "New York Yankees", "Boston Red Sox"),
    makeGame("MLS", "Inter Miami", "Atlanta United FC"),
    makeGame("MLS", "San Diego", "Los Angeles Galaxy"),
  ].map(toBareGameWithOdds);

  const byKorean = filterGamesClientSide(games, {
    search: "양키스",
    sport: "all",
    recommendation: "all",
  });
  const byEnglish = filterGamesClientSide(games, {
    search: "Yankees",
    sport: "all",
    recommendation: "all",
  });
  const byMlsKorean = filterGamesClientSide(games, {
    search: "샌디에이고",
    sport: "all",
    recommendation: "all",
  });
  assert(byKorean.length === 1, "한글 검색 양키스");
  assert(byEnglish.length === 1, "영문 검색 Yankees");
  assert(byMlsKorean.length === 1, "한글 검색 샌디에이고");

  const mlbOriginalAliasCount = mlbTeams.reduce(
    (n, entry) => n + entry.originalNames.length,
    0,
  );
  const mlsOriginalAliasCount = mlsTeams.reduce(
    (n, entry) => n + entry.originalNames.length,
    0,
  );
  const mlsIdMappings = mlsTeams.reduce(
    (n, entry) => n + (entry.externalIds?.length ?? 0),
    0,
  );

  console.log(
    JSON.stringify(
      {
        mlbTeamCount: mlbTeams.length,
        mlsTeamCount: mlsTeams.length,
        mlbOriginalAliasCount,
        mlsOriginalAliasCount,
        totalOriginalAliasSlots: countNameFallbacks(),
        mlbIdMappings: mlbTeams.reduce(
          (n, entry) => n + (entry.externalIds?.length ?? 0),
          0,
        ),
        mlsIdMappings,
        totalIdMappings: countIdMappings(),
        collisionChecksPassed: true,
        koreanSearchHits: byKorean.length,
        englishSearchHits: byEnglish.length,
        originalNameUnchanged: true,
        oddsNormalizeUnchanged: true,
        gameIdUnchanged: true,
        unknownFallback: getTeamDisplayName("Unknown FC XYZ"),
        sampleNormalize: {
          stLouis: normalizeTeamName("St.Louis Cardinals"),
          stLouisSpaced: normalizeTeamName("St. Louis Cardinals"),
        },
      },
      null,
      2,
    ),
  );
}

main();
