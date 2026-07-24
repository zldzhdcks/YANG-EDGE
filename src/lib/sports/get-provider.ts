import { ApiSportsProvider } from "./apisports-provider";
import { DummyProvider } from "./dummy-provider";
import { TheSportsDbProvider } from "./thesportsdb-provider";
import type { SportsProvider, SportsProviderKind } from "./types";

/**
 * 외부 Provider 실패 시 Dummy로 폴백해 UI가 깨지지 않게 한다.
 */
class FallbackProvider implements SportsProvider {
  readonly kind: SportsProvider["kind"];

  constructor(
    private readonly primary: SportsProvider,
    private readonly fallback: SportsProvider,
  ) {
    this.kind = primary.kind;
  }

  async getGames(params?: Parameters<SportsProvider["getGames"]>[0]) {
    try {
      return await this.primary.getGames(params);
    } catch {
      const rest = { ...(params ?? {}) };
      delete rest.date;
      return this.fallback.getGames(rest);
    }
  }

  async getAnalysis(gameId: string) {
    try {
      return await this.primary.getAnalysis(gameId);
    } catch {
      return this.fallback.getAnalysis(gameId);
    }
  }

  async getToto() {
    try {
      return await this.primary.getToto();
    } catch {
      return this.fallback.getToto();
    }
  }

  async getTodayPick() {
    try {
      return await this.primary.getTodayPick();
    } catch {
      return this.fallback.getTodayPick();
    }
  }

  async getTodayGames() {
    try {
      return await this.primary.getTodayGames();
    } catch {
      return this.fallback.getTodayGames();
    }
  }

  async getFeatured() {
    try {
      return await this.primary.getFeatured();
    } catch {
      return this.fallback.getFeatured();
    }
  }
}

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Provider Factory 선택 규칙
 *
 * SPORTS_PROVIDER=
 *   - dummy
 *   - thesportsdb
 *   - apisports
 *
 * 하위 호환: `api` → thesportsdb
 *
 * 미지정 시:
 *   - SPORTS_API_BASE_URL 에 thesportsdb 포함 → thesportsdb
 *   - SPORTS_API_BASE_URL 있음 → apisports (향후 실연동)
 *   - 없으면 dummy
 *
 * 키는 서버 전용. NEXT_PUBLIC_* 에 넣지 않는다.
 */
export function resolveSportsProviderKind(): SportsProviderKind {
  const explicit = readEnv("SPORTS_PROVIDER").toLowerCase();

  if (explicit === "dummy") return "dummy";
  if (explicit === "thesportsdb" || explicit === "api") return "thesportsdb";
  if (explicit === "apisports") return "apisports";

  const baseUrl = readEnv("SPORTS_API_BASE_URL").toLowerCase();
  if (!baseUrl) return "dummy";
  if (baseUrl.includes("thesportsdb.com")) return "thesportsdb";
  return "apisports";
}

export function getSportsProvider(): SportsProvider {
  const kind = resolveSportsProviderKind();
  const dummy = new DummyProvider();

  if (kind === "dummy") {
    return dummy;
  }

  const baseUrl = readEnv("SPORTS_API_BASE_URL");
  const apiKey = readEnv("SPORTS_API_KEY");

  if (kind === "thesportsdb") {
    if (!baseUrl) return dummy;
    return new FallbackProvider(
      new TheSportsDbProvider(baseUrl, apiKey),
      dummy,
    );
  }

  // apisports — 스텁이므로 실패 시 Dummy로 폴백
  return new FallbackProvider(new ApiSportsProvider(baseUrl, apiKey), dummy);
}
