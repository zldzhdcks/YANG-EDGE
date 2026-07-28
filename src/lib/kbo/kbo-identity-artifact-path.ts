import path from "node:path";
import type { KboIdentityProviderId } from "./schedule-result-identity-types";

export function getKboIdentityArtifactFileName(
  dateKst: string,
  provider: KboIdentityProviderId,
): string {
  if (provider === "API_BASEBALL") {
    return `${dateKst}-schedule-result-identity-v1-api-baseball.json`;
  }
  return `${dateKst}-schedule-result-identity-v1.json`;
}

export function getKboIdentityArtifactPath(
  dateKst: string,
  provider: KboIdentityProviderId,
  cwd = process.cwd(),
): string {
  return path.join(
    cwd,
    "data/research/kbo",
    getKboIdentityArtifactFileName(dateKst, provider),
  );
}
