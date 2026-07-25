import { ApiFootballProvider } from "./api-football-provider";
import { DummyFootballProvider } from "./dummy-football-provider";
import type { FootballProvider, FootballProviderKind } from "./types";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Football Provider Factory
 *
 * FOOTBALL_PROVIDER=
 *   - api-football  (기본)
 *   - dummy         (개발 테스트 명시 선택만)
 *
 * 환경변수 (서버 전용, NEXT_PUBLIC_* 금지):
 *   FOOTBALL_API_BASE_URL  기본 https://v3.football.api-sports.io
 *   FOOTBALL_API_KEY
 *
 * SportsProvider / OddsProvider 와 독립.
 * Dummy 자동 폴백으로 가짜 fixtures 를 섞지 않는다.
 */
export function resolveFootballProviderKind(): FootballProviderKind {
  const explicit = readEnv("FOOTBALL_PROVIDER").toLowerCase();
  if (explicit === "dummy") return "dummy";
  if (explicit === "api-football" || explicit === "apifootball") {
    return "api-football";
  }
  return "api-football";
}

export function getFootballProvider(): FootballProvider {
  const kind = resolveFootballProviderKind();

  if (kind === "dummy") {
    return new DummyFootballProvider();
  }

  const baseUrl =
    readEnv("FOOTBALL_API_BASE_URL") || "https://v3.football.api-sports.io";
  const apiKey = readEnv("FOOTBALL_API_KEY");

  if (!apiKey) {
    throw new Error(
      "FOOTBALL_API_KEY is not configured. Set FOOTBALL_PROVIDER=dummy for local stub.",
    );
  }

  return new ApiFootballProvider(baseUrl, apiKey);
}
