/**
 * SportsDataIO Provider Factory.
 *
 * SPORTSDATAIO_API_KEY 가 없으면 throw 하지 않고 ProviderUnavailable 을 반환한다.
 * Engine / Games / Odds 와 연결하지 않는다.
 */

import { SportsDataIoProvider } from "./sportsdata-provider";
import { SPORTSDATAIO_DEFAULT_BASE_URL } from "./provider";
import type { ProviderUnavailable, SportsDataProvider } from "./types";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getSportsDataProvider():
  | SportsDataProvider
  | ProviderUnavailable {
  const apiKey = readEnv("SPORTSDATAIO_API_KEY");
  if (!apiKey) {
    return { kind: "unavailable", reason: "missing-api-key" };
  }

  const baseUrl =
    readEnv("SPORTSDATAIO_API_BASE_URL") || SPORTSDATAIO_DEFAULT_BASE_URL;
  return new SportsDataIoProvider(apiKey, baseUrl);
}
