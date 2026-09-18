/**
 * Provider-specific automation legal policy — source of truth.
 *
 * Collectors and runners must not invent legal status.
 * Legal Room statuses are Provider-specific and must not collapse
 * into a generic PROVIDER_LAUNCHD flag.
 *
 * This module contains no secrets, API keys, or Plan product names.
 */

export type ProviderLegalStatus =
  | "LEGAL_PASS"
  | "LEGAL_CONDITIONAL"
  | "LEGAL_REVIEW_REQUIRED"
  | "LEGAL_BLOCK";

export type ProviderAutomationKey = "MLB_STATS_API" | "THE_ODDS_API";

export type ExecutionContext = "MANUAL_RESEARCH" | "UNATTENDED_AUTOMATION";

export type ProviderAutomationCollector =
  | "SCHEDULE"
  | "STARTER"
  | "LINEUP"
  | "ODDS";

export const LEGAL_PROVIDER_AUTOMATION_BLOCKED =
  "LEGAL_PROVIDER_AUTOMATION_BLOCKED" as const;

export const PLAN_UNKNOWN = "PLAN_UNKNOWN" as const;

export const LEGAL_CONDITIONAL_UNMET = "LEGAL_CONDITIONAL_UNMET" as const;

/** MLB Stats API — Legal Room. Unattended automation remains HOLD. */
export const MLB_STATS_LEGAL_STATUS: ProviderLegalStatus =
  "LEGAL_REVIEW_REQUIRED";

export const MLB_STATS_AUTOMATION_ALLOWED = false;

/** The Odds API — Legal Room. CONDITIONAL is not live permission. */
export const ODDS_LEGAL_STATUS: ProviderLegalStatus = "LEGAL_CONDITIONAL";

export const MLB_STATS_COLLECTOR_SCRIPTS = [
  "scripts/build-mlb-schedule-artifact-v1.ts",
  "scripts/run-mlb-starter-accumulation-with-summary-v1.ts",
  "scripts/build-mlb-lineup-dataset-v1.ts",
] as const;

export const ODDS_COLLECTOR_SCRIPT =
  "scripts/build-mlb-odds-history-dataset-v1.ts";

export const MLB_PRIVATE_RESEARCH_SCRIPTS = {
  schedule: "research:mlb-schedule",
  starter: "research:starter",
  lineup: "research:mlb-lineup",
  odds: "research:mlb-odds",
} as const;

export function isMlbStatsCollectorScript(
  scriptRel: string | null | undefined,
): boolean {
  if (!scriptRel) return false;
  return (MLB_STATS_COLLECTOR_SCRIPTS as readonly string[]).includes(scriptRel);
}

export function isOddsCollectorScript(
  scriptRel: string | null | undefined,
): boolean {
  return scriptRel === ODDS_COLLECTOR_SCRIPT;
}

export function collectorProvider(
  collector: ProviderAutomationCollector,
): ProviderAutomationKey {
  return collector === "ODDS" ? "THE_ODDS_API" : "MLB_STATS_API";
}

/**
 * Exact `true` only. Unset / any other value is unconfirmed.
 * Do not invent Plan product names.
 */
export function readOddsPlanConfirmed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.ODDS_PLAN_CONFIRMED === "true";
}

/** Presence only — never return or log the key value. */
export function readOddsApiKeyPresent(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.ODDS_API_KEY && env.ODDS_API_KEY.trim().length > 0);
}

/**
 * Generic launchd flag is not a legal decision mechanism.
 * Presence must never override MLB Stats HOLD.
 */
export function readGenericProviderLaunchd(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.PROVIDER_LAUNCHD === "true";
}

export type OddsAutomationFacts = {
  planConfirmed: boolean;
  apiKeyPresent: boolean;
  quotaAllows: boolean;
};

export type OddsAutomationEligibility = {
  provider: "THE_ODDS_API";
  legalStatus: ProviderLegalStatus;
  automationAllowed: boolean;
  reason: typeof PLAN_UNKNOWN | typeof LEGAL_CONDITIONAL_UNMET | null;
  conditions: {
    officialApiKeyPresent: boolean;
    planConfirmed: boolean;
    quotaRespected: boolean;
    noRawFeedResale: true;
  };
};

/**
 * LEGAL_CONDITIONAL does not imply automationAllowed=true.
 * All runtime conditions must actually be satisfied.
 */
export function evaluateOddsLiveAutomation(
  facts: OddsAutomationFacts,
): OddsAutomationEligibility {
  const conditions = {
    officialApiKeyPresent: facts.apiKeyPresent,
    planConfirmed: facts.planConfirmed,
    quotaRespected: facts.quotaAllows,
    noRawFeedResale: true as const,
  };
  if (!facts.planConfirmed) {
    return {
      provider: "THE_ODDS_API",
      legalStatus: ODDS_LEGAL_STATUS,
      automationAllowed: false,
      reason: PLAN_UNKNOWN,
      conditions,
    };
  }
  if (!facts.apiKeyPresent || !facts.quotaAllows) {
    return {
      provider: "THE_ODDS_API",
      legalStatus: ODDS_LEGAL_STATUS,
      automationAllowed: false,
      reason: LEGAL_CONDITIONAL_UNMET,
      conditions,
    };
  }
  return {
    provider: "THE_ODDS_API",
    legalStatus: ODDS_LEGAL_STATUS,
    automationAllowed: true,
    reason: null,
    conditions,
  };
}

export type UnattendedSpawnVerdict = {
  provider: ProviderAutomationKey;
  legalStatus: ProviderLegalStatus;
  automationAllowed: boolean;
  spawnAllowed: boolean;
  reason:
    | typeof LEGAL_PROVIDER_AUTOMATION_BLOCKED
    | typeof PLAN_UNKNOWN
    | typeof LEGAL_CONDITIONAL_UNMET
    | null;
};

export function evaluateUnattendedCollectorSpawn(input: {
  collector: ProviderAutomationCollector;
  executionContext: ExecutionContext;
  genericProviderLaunchd?: boolean;
  oddsPlanConfirmed?: boolean;
  oddsApiKeyPresent?: boolean;
}): UnattendedSpawnVerdict {
  const provider = collectorProvider(input.collector);

  if (input.executionContext !== "UNATTENDED_AUTOMATION") {
    if (provider === "MLB_STATS_API") {
      return {
        provider,
        legalStatus: MLB_STATS_LEGAL_STATUS,
        automationAllowed: MLB_STATS_AUTOMATION_ALLOWED,
        spawnAllowed: true,
        reason: null,
      };
    }
    return {
      provider,
      legalStatus: ODDS_LEGAL_STATUS,
      automationAllowed: false,
      spawnAllowed: true,
      reason: null,
    };
  }

  if (provider === "MLB_STATS_API") {
    void input.genericProviderLaunchd;
    return {
      provider,
      legalStatus: MLB_STATS_LEGAL_STATUS,
      automationAllowed: false,
      spawnAllowed: false,
      reason: LEGAL_PROVIDER_AUTOMATION_BLOCKED,
    };
  }

  const planConfirmed =
    input.oddsPlanConfirmed ?? readOddsPlanConfirmed();
  const apiKeyPresent =
    input.oddsApiKeyPresent ?? readOddsApiKeyPresent();
  const odds = evaluateOddsLiveAutomation({
    planConfirmed,
    apiKeyPresent,
    quotaAllows: true,
  });
  return {
    provider,
    legalStatus: odds.legalStatus,
    automationAllowed: odds.automationAllowed,
    spawnAllowed: odds.automationAllowed,
    reason: odds.reason,
  };
}

export type ProviderAutomationPolicySnapshot = {
  MLB_STATS_API: {
    legalStatus: ProviderLegalStatus;
    automationAllowed: boolean;
  };
  THE_ODDS_API: {
    legalStatus: ProviderLegalStatus;
    planConfirmed: boolean;
    automationAllowed: boolean;
    reason: OddsAutomationEligibility["reason"];
  };
};

export function getProviderAutomationPolicySnapshot(input?: {
  oddsPlanConfirmed?: boolean;
  oddsApiKeyPresent?: boolean;
  oddsQuotaAllows?: boolean;
}): ProviderAutomationPolicySnapshot {
  const planConfirmed = input?.oddsPlanConfirmed ?? readOddsPlanConfirmed();
  const odds = evaluateOddsLiveAutomation({
    planConfirmed,
    apiKeyPresent: input?.oddsApiKeyPresent ?? readOddsApiKeyPresent(),
    quotaAllows: input?.oddsQuotaAllows ?? false,
  });
  return {
    MLB_STATS_API: {
      legalStatus: MLB_STATS_LEGAL_STATUS,
      automationAllowed: MLB_STATS_AUTOMATION_ALLOWED,
    },
    THE_ODDS_API: {
      legalStatus: ODDS_LEGAL_STATUS,
      planConfirmed,
      automationAllowed: odds.automationAllowed,
      reason: odds.reason,
    },
  };
}
