import type {
  KboProviderCrosswalkRef,
  KboScheduleResultIdentityDocument,
} from "./schedule-result-identity-types";
import type { KboEnrichedScheduleGame } from "./build-schedule-result-identity-dataset";

function buildMatchKey(input: {
  canonicalHomeTeamId: string | null;
  canonicalAwayTeamId: string | null;
  startTimeKst: string | null;
}): string | null {
  if (
    !input.canonicalHomeTeamId ||
    !input.canonicalAwayTeamId ||
    !input.startTimeKst
  ) {
    return null;
  }
  return `${input.canonicalHomeTeamId}|${input.canonicalAwayTeamId}|${input.startTimeKst}`;
}

export function buildKboProviderCrosswalk(params: {
  observedAt: string;
  primaryProviderId: "API_BASEBALL" | "THESPORTSDB";
  primaryGames: KboEnrichedScheduleGame[];
  secondaryDocument?: KboScheduleResultIdentityDocument | null;
}): Map<string, KboProviderCrosswalkRef[]> {
  const out = new Map<string, KboProviderCrosswalkRef[]>();
  const secondaryByKey = new Map<string, KboProviderCrosswalkRef>();

  for (const row of params.secondaryDocument?.rows ?? []) {
    const key = buildMatchKey({
      canonicalHomeTeamId: row.homeTeam.canonicalTeamId,
      canonicalAwayTeamId: row.awayTeam.canonicalTeamId,
      startTimeKst: row.time.startTimeKst,
    });
    if (!key) continue;
    secondaryByKey.set(key, {
      providerId: row.provider.id,
      providerGameId: row.providerGameId,
      providerHomeTeamId: row.homeTeamId,
      providerAwayTeamId: row.awayTeamId,
      providerStartTime: row.time.providerStartTime,
      mappingStatus: "MATCHED",
      mappingEvidence: "canonicalTeamIds + startTimeKst + direction",
      observedAt: params.observedAt,
    });
  }

  for (const game of params.primaryGames) {
    const internalGameId = `kbo-${game.providerGameId}`;
    const refs: KboProviderCrosswalkRef[] = [
      {
        providerId: params.primaryProviderId,
        providerGameId: game.providerGameId,
        providerHomeTeamId: game.homeTeamProviderId,
        providerAwayTeamId: game.awayTeamProviderId,
        providerStartTime: game.providerStartTime,
        mappingStatus: "MATCHED",
        mappingEvidence: "primary provider normalized row",
        observedAt: params.observedAt,
      },
    ];

    const key = buildMatchKey({
      canonicalHomeTeamId: game.homeTeam.canonicalTeamId,
      canonicalAwayTeamId: game.awayTeam.canonicalTeamId,
      startTimeKst: game.startTimeKst,
    });
    if (key && secondaryByKey.has(key)) {
      refs.push(secondaryByKey.get(key)!);
    }

    out.set(internalGameId, refs);
  }

  return out;
}
