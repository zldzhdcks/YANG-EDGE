import { ApiSportsProvider } from "./apisports-provider";
import { DummyProvider } from "./dummy-provider";
import { TheSportsDbProvider } from "./thesportsdb-provider";
import type { SportsProvider, SportsProviderKind } from "./types";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Provider Factory 선택 규칙
 *
 * SPORTS_PROVIDER=
 *   - dummy       → DummyProvider 만 사용 (명시적 테스트 모드)
 *   - thesportsdb → TheSportsDB (실패 시 Dummy 폴백 없음)
 *   - apisports   → ApiSports (실패 시 Dummy 폴백 없음)
 *
 * 하위 호환: `api` → thesportsdb
 *
 * 미지정 시:
 *   - SPORTS_API_BASE_URL 에 thesportsdb 포함 → thesportsdb
 *   - SPORTS_API_BASE_URL 있음 → apisports
 *   - 없으면 thesportsdb 스켈레톤(설정 오류 시 throw) — Dummy 자동 사용 안 함
 *
 * 키는 서버 전용. NEXT_PUBLIC_* 에 넣지 않는다.
 */
export function resolveSportsProviderKind(): SportsProviderKind {
  const explicit = readEnv("SPORTS_PROVIDER").toLowerCase();

  if (explicit === "dummy") return "dummy";
  if (explicit === "thesportsdb" || explicit === "api") return "thesportsdb";
  if (explicit === "apisports") return "apisports";

  const baseUrl = readEnv("SPORTS_API_BASE_URL").toLowerCase();
  if (!baseUrl) return "thesportsdb";
  if (baseUrl.includes("thesportsdb.com")) return "thesportsdb";
  return "apisports";
}

/**
 * Dummy 는 SPORTS_PROVIDER=dummy 일 때만 반환한다.
 * 운영 Provider 실패 시 자동 Dummy 대체는 하지 않는다.
 */
export function getSportsProvider(): SportsProvider {
  const explicit = readEnv("SPORTS_PROVIDER").toLowerCase();
  if (explicit === "dummy") {
    return new DummyProvider();
  }

  const kind = resolveSportsProviderKind();
  const baseUrl = readEnv("SPORTS_API_BASE_URL");
  const apiKey = readEnv("SPORTS_API_KEY");

  if (kind === "apisports") {
    return new ApiSportsProvider(baseUrl, apiKey);
  }

  return new TheSportsDbProvider(baseUrl, apiKey);
}
