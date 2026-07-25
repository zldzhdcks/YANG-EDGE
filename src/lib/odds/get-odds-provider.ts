import { DummyOddsProvider } from "./dummy-odds-provider";
import { TheOddsApiProvider } from "./the-odds-api-provider";
import type { OddsProvider, OddsProviderKind } from "./types";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Odds Provider Factory
 *
 * ODDS_PROVIDER=
 *   - the-odds-api  (기본)
 *   - dummy         (개발 테스트 전용 — 명시적 선택만)
 *
 * 환경변수 (서버 전용, NEXT_PUBLIC_* 금지):
 *   ODDS_API_BASE_URL  기본 https://api.the-odds-api.com/v4
 *   ODDS_API_KEY
 *
 * SportsProvider 와 독립. 실패해도 경기 화면에는 영향 없음.
 * Dummy 자동 폴백 없음 — 잘못된 배당을 숨기지 않는다.
 */
export function resolveOddsProviderKind(): OddsProviderKind {
  const explicit = readEnv("ODDS_PROVIDER").toLowerCase();
  if (explicit === "dummy") return "dummy";
  if (explicit === "the-odds-api" || explicit === "theoddsapi") {
    return "the-odds-api";
  }
  // 미지정 시 실 API (키 없으면 getOddsProvider 가 오류)
  return "the-odds-api";
}

export function getOddsProvider(): OddsProvider {
  const kind = resolveOddsProviderKind();

  if (kind === "dummy") {
    return new DummyOddsProvider();
  }

  const baseUrl =
    readEnv("ODDS_API_BASE_URL") || "https://api.the-odds-api.com/v4";
  const apiKey = readEnv("ODDS_API_KEY");

  if (!apiKey) {
    throw new Error(
      "ODDS_API_KEY is not configured. Set ODDS_PROVIDER=dummy for local stub.",
    );
  }

  return new TheOddsApiProvider(baseUrl, apiKey);
}
