/**
 * MLB h2h Historical Odds Minimal Probe v1
 * Caps: ≤4 snapshot pulls (40 credits est.), ≤10 bookmakers, 1 game.
 * Not a production builder. Does not touch Prediction/Engine/Registry.
 *
 *   npx tsx --env-file=.env.local scripts/probe-mlb-h2h-historical-odds-v1.ts
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CREDIT_CAP = 50;
const CREDIT_PER_HISTORICAL = 10; // docs: 10 × regions × markets (featured/event)
const MAX_SNAPSHOT_PULLS = 4; // 4 × 10 = 40 ≤ 50
const MAX_BOOKMAKERS = 10;
const REGION = "us";
const MARKET = "h2h";
const SPORT_KEY = "baseball_mlb";

const TARGET = {
  internalGameId: "mlb-179589",
  providerEventId: "210e6566d3641ee245e8a099a1679244",
  homeTeam: "Philadelphia Phillies",
  awayTeam: "New York Yankees",
  scheduledStartTime: "2026-07-26T23:21:00Z",
  dateKst: "2026-07-27",
};

type FitStatus =
  | "DIRECT_MATCH"
  | "DERIVABLE"
  | "MISSING"
  | "AMBIGUOUS"
  | "PROVIDER_SPECIFIC";

type Phase =
  | "OPENING_CANDIDATE"
  | "INTERMEDIATE"
  | "LATEST_PRE_GAME"
  | "CLOSING_CANDIDATE"
  | "POST_START"
  | "POST_GAME";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readUsage(res: Response) {
  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");
  const last = res.headers.get("x-requests-last");
  return {
    remaining: remaining == null ? null : Number(remaining),
    used: used == null ? null : Number(used),
    last: last == null ? null : Number(last),
  };
}

async function main() {
  const cwd = process.cwd();
  const baseUrl = (
    process.env.ODDS_API_BASE_URL?.trim() || "https://api.the-odds-api.com/v4"
  ).replace(/\/$/, "");
  const apiKey = process.env.ODDS_API_KEY?.trim() || "";

  const estimatedCredits = MAX_SNAPSHOT_PULLS * CREDIT_PER_HISTORICAL;
  const auditBase = {
    meta: {
      version: "mlb-h2h-historical-odds-probe-v1",
      generatedAt: new Date().toISOString(),
      conclusion: "MLB_H2H_HISTORICAL_ODDS_MINIMAL_PROBE_COMPLETED",
    },
    target: {
      ...TARGET,
      market: MARKET,
      region: REGION,
      bookmakerLimit: MAX_BOOKMAKERS,
      snapshotLimitRequested: MAX_SNAPSHOT_PULLS,
      snapshotLimitDesignMax: 12,
      estimatedCredits,
      creditCap: CREDIT_CAP,
    },
  };

  if (!apiKey) {
    await writeOutputs(cwd, {
      ...auditBase,
      probeStatus: "API_KEY_MISSING",
      historicalPlanAvailable: false,
      actualCredits: null,
      requestsMade: 0,
    });
    console.log("API_KEY_MISSING");
    return;
  }

  if (estimatedCredits > CREDIT_CAP) {
    await writeOutputs(cwd, {
      ...auditBase,
      probeStatus: "COST_CAP_BLOCKED",
      historicalPlanAvailable: "UNKNOWN",
      actualCredits: null,
      requestsMade: 0,
      note: "Estimated credits exceed cap before any Historical call",
    });
    console.log("COST_CAP_BLOCKED");
    return;
  }

  // Free /sports for remaining credits
  const sportsRes = await fetch(
    `${baseUrl}/sports?apiKey=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );
  const sportsUsage = readUsage(sportsRes);
  if (!sportsRes.ok) {
    await writeOutputs(cwd, {
      ...auditBase,
      probeStatus: "PROVIDER_ERROR",
      historicalPlanAvailable: "UNKNOWN",
      sportsStatus: sportsRes.status,
      requestsMade: 0,
      usageBefore: sportsUsage,
    });
    console.log("PROVIDER_ERROR sports", sportsRes.status);
    return;
  }

  const commenceMs = Date.parse(TARGET.scheduledStartTime);
  const offsetsMin = [24 * 60, 6 * 60, 60, 5]; // 24h, 6h, 1h, 5m before
  const requestDates = offsetsMin.map(
    (m) => new Date(commenceMs - m * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
  );

  type RawEnvelope = {
    timestamp?: string;
    previous_timestamp?: string | null;
    next_timestamp?: string | null;
    data?: {
      id?: string;
      sport_key?: string;
      commence_time?: string;
      home_team?: string;
      away_team?: string;
      bookmakers?: Array<{
        key?: string;
        title?: string;
        last_update?: string;
        markets?: Array<{
          key?: string;
          last_update?: string;
          outcomes?: Array<{
            name?: string;
            price?: number | string;
            point?: number | null;
          }>;
        }>;
      }>;
    };
  };

  const pulls: Array<{
    requestedDate: string;
    status: number;
    usage: ReturnType<typeof readUsage>;
    envelope: RawEnvelope | null;
    errorBodySnippet: string | null;
  }> = [];

  let remainingBefore = sportsUsage.remaining;
  let planBlocked = false;
  let providerError = false;

  for (const date of requestDates) {
    const url =
      `${baseUrl}/historical/sports/${SPORT_KEY}/events/${TARGET.providerEventId}/odds` +
      `?apiKey=${encodeURIComponent(apiKey)}` +
      `&regions=${REGION}&markets=${MARKET}&oddsFormat=decimal&dateFormat=iso&date=${encodeURIComponent(date)}`;

    const res = await fetch(url, { cache: "no-store" });
    const usage = readUsage(res);
    const text = await res.text();
    let envelope: RawEnvelope | null = null;
    try {
      envelope = JSON.parse(text) as RawEnvelope;
    } catch {
      envelope = null;
    }

    pulls.push({
      requestedDate: date,
      status: res.status,
      usage,
      envelope: res.ok ? envelope : null,
      errorBodySnippet: res.ok
        ? null
        : text.slice(0, 240).replace(apiKey, "[REDACTED]"),
    });

    if (res.status === 401 || res.status === 403) {
      planBlocked = true;
      break;
    }
    if (!res.ok) {
      // 404 / empty may be NO_EVENTS for that timestamp — continue if credits ok
      if (res.status >= 500) {
        providerError = true;
        break;
      }
    }
  }

  const requestsMade = pulls.length;
  const usageAfterLast = pulls[pulls.length - 1]?.usage ?? sportsUsage;
  const actualCreditsUsed =
    remainingBefore != null && usageAfterLast.remaining != null
      ? remainingBefore - usageAfterLast.remaining
      : null;

  if (planBlocked) {
    await writeOutputs(cwd, {
      ...auditBase,
      probeStatus: "PLAN_BLOCKED",
      historicalPlanAvailable: false,
      estimatedCreditsBefore: estimatedCredits,
      actualCreditsUsed,
      requestsMade,
      usageBefore: sportsUsage,
      usageAfter: usageAfterLast,
      pullStatuses: pulls.map((p) => ({
        requestedDate: p.requestedDate,
        status: p.status,
        snippet: p.errorBodySnippet,
      })),
      complianceGates: defaultGates("PLAN_BLOCKED"),
    });
    console.log("PLAN_BLOCKED");
    return;
  }

  if (providerError && pulls.every((p) => !p.envelope)) {
    await writeOutputs(cwd, {
      ...auditBase,
      probeStatus: "PROVIDER_ERROR",
      historicalPlanAvailable: "UNKNOWN",
      estimatedCreditsBefore: estimatedCredits,
      actualCreditsUsed,
      requestsMade,
      pullStatuses: pulls.map((p) => ({
        requestedDate: p.requestedDate,
        status: p.status,
        snippet: p.errorBodySnippet,
      })),
      complianceGates: defaultGates(),
    });
    console.log("PROVIDER_ERROR");
    return;
  }

  // Normalize
  type NormSelection = {
    selectionCode: "HOME" | "AWAY" | "DRAW" | "OTHER" | "SELECTION_MAPPING_FAILED";
    selectionLabel: string;
    oddsDecimal: number | null;
    rawPrice: unknown;
    point: number | null;
    valid: boolean;
  };

  type NormSnap = {
    requestedDate: string;
    snapshotTime: string | null;
    previousTimestamp: string | null;
    nextTimestamp: string | null;
    scheduledStartTimeAtSnapshot: string | null;
    isPreGame: boolean | null;
    phase: Phase | null;
    providerEventId: string | null;
    sportKey: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
    bookmakers: Array<{
      bookmakerKey: string;
      bookmakerName: string;
      lastUpdateAtSnapshot: string | null;
      marketKey: string | null;
      marketLastUpdate: string | null;
      selections: NormSelection[];
    }>;
  };

  const snapshots: NormSnap[] = [];
  let invalidOdds = 0;
  let selectionMappingFailed = 0;

  for (const pull of pulls) {
    const env = pull.envelope;
    if (!env?.data) continue;
    const data = env.data;
    const commence = data.commence_time ?? TARGET.scheduledStartTime;
    const snapTime = env.timestamp ?? null;
    const isPreGame =
      snapTime != null && commence != null
        ? Date.parse(snapTime) < Date.parse(commence)
        : null;

    const books = (data.bookmakers ?? []).slice(0, MAX_BOOKMAKERS);
    const bookmakers = books.map((b) => {
      const h2h = (b.markets ?? []).find((m) => m.key === "h2h");
      const selections: NormSelection[] = [];
      for (const o of h2h?.outcomes ?? []) {
        const label = (o.name ?? "").trim();
        let selectionCode: NormSelection["selectionCode"] = "OTHER";
        if (label === data.home_team || label === TARGET.homeTeam) {
          selectionCode = "HOME";
        } else if (label === data.away_team || label === TARGET.awayTeam) {
          selectionCode = "AWAY";
        } else if (label.toLowerCase() === "draw") {
          selectionCode = "DRAW";
        } else if (label) {
          selectionCode = "SELECTION_MAPPING_FAILED";
          selectionMappingFailed += 1;
        }
        const price = o.price;
        let oddsDecimal: number | null = null;
        let valid = false;
        if (typeof price === "number" && Number.isFinite(price) && price > 1) {
          oddsDecimal = price;
          valid = true;
        } else {
          invalidOdds += 1;
        }
        selections.push({
          selectionCode,
          selectionLabel: label,
          oddsDecimal,
          rawPrice: price,
          point: typeof o.point === "number" ? o.point : null,
          valid,
        });
      }
      return {
        bookmakerKey: (b.key ?? "").trim() || "UNKNOWN",
        bookmakerName: (b.title ?? "").trim() || "UNKNOWN",
        lastUpdateAtSnapshot: b.last_update ?? null,
        marketKey: h2h?.key ?? null,
        marketLastUpdate: h2h?.last_update ?? null,
        selections,
      };
    });

    snapshots.push({
      requestedDate: pull.requestedDate,
      snapshotTime: snapTime,
      previousTimestamp: env.previous_timestamp ?? null,
      nextTimestamp: env.next_timestamp ?? null,
      scheduledStartTimeAtSnapshot: commence,
      isPreGame,
      phase: null,
      providerEventId: data.id ?? null,
      sportKey: data.sport_key ?? null,
      homeTeam: data.home_team ?? null,
      awayTeam: data.away_team ?? null,
      bookmakers,
    });
  }

  // Classify phases among unique snapshotTimes (pre-game only for opening/latest)
  const preGame = snapshots.filter((s) => s.isPreGame === true);
  preGame.sort((a, b) =>
    String(a.snapshotTime).localeCompare(String(b.snapshotTime)),
  );
  const firstPre = preGame[0]?.snapshotTime ?? null;
  const lastPre = preGame[preGame.length - 1]?.snapshotTime ?? null;

  for (const s of snapshots) {
    if (s.isPreGame === false) {
      s.phase = "POST_START";
      continue;
    }
    if (s.isPreGame !== true || !s.snapshotTime) {
      s.phase = null;
      continue;
    }
    if (s.snapshotTime === firstPre && s.snapshotTime === lastPre) {
      s.phase = "OPENING_CANDIDATE"; // also latest — mark opening; latest noted separately
    } else if (s.snapshotTime === firstPre) {
      s.phase = "OPENING_CANDIDATE";
    } else if (s.snapshotTime === lastPre) {
      s.phase = "LATEST_PRE_GAME";
    } else {
      s.phase = "INTERMEDIATE";
    }
  }

  // Identity mapping
  let identityMapping: "MATCHED" | "AMBIGUOUS" | "UNMATCHED" = "UNMATCHED";
  const idHits = snapshots.filter(
    (s) =>
      s.providerEventId === TARGET.providerEventId &&
      s.homeTeam === TARGET.homeTeam &&
      s.awayTeam === TARGET.awayTeam &&
      s.sportKey === SPORT_KEY,
  );
  if (idHits.length > 0) identityMapping = "MATCHED";
  else if (snapshots.length > 0) identityMapping = "AMBIGUOUS";

  // Duplicates / revisions
  type Key = string;
  const byKey = new Map<Key, number[]>();
  for (const s of snapshots) {
    for (const b of s.bookmakers) {
      for (const sel of b.selections) {
        if (!sel.valid) continue;
        const key = [
          "THE_ODDS_API",
          TARGET.providerEventId,
          b.bookmakerKey,
          MARKET,
          s.snapshotTime,
          sel.selectionCode,
        ].join("|");
        const arr = byKey.get(key) ?? [];
        arr.push(sel.oddsDecimal!);
        byKey.set(key, arr);
      }
    }
  }
  let exactDuplicates = 0;
  let revisionCandidates = 0;
  for (const odds of byKey.values()) {
    if (odds.length < 2) continue;
    const uniq = new Set(odds);
    if (uniq.size === 1) exactDuplicates += odds.length - 1;
    else revisionCandidates += 1;
  }

  // observedMovementCount (schema observation only)
  let observedMovementCount = 0;
  const series = new Map<string, number[]>();
  const ordered = [...snapshots].sort((a, b) =>
    String(a.snapshotTime).localeCompare(String(b.snapshotTime)),
  );
  for (const s of ordered) {
    if (s.isPreGame !== true) continue;
    for (const b of s.bookmakers) {
      for (const sel of b.selections) {
        if (!sel.valid) continue;
        const k = `${b.bookmakerKey}|${MARKET}|${sel.selectionCode}`;
        const arr = series.get(k) ?? [];
        if (arr.length > 0 && arr[arr.length - 1] !== sel.oddsDecimal) {
          observedMovementCount += 1;
        }
        arr.push(sel.oddsDecimal!);
        series.set(k, arr);
      }
    }
  }

  // Opening / latest odds sample from first bookmaker HOME if present
  function pickOdds(
    snap: NormSnap | undefined,
    code: "HOME" | "AWAY",
  ): number | null {
    if (!snap) return null;
    for (const b of snap.bookmakers) {
      const hit = b.selections.find((s) => s.selectionCode === code && s.valid);
      if (hit?.oddsDecimal != null) return hit.oddsDecimal;
    }
    return null;
  }

  const firstSnap = preGame[0];
  const latestSnap = preGame[preGame.length - 1];

  const bookmakerKeys = new Set<string>();
  for (const s of snapshots) {
    for (const b of s.bookmakers) bookmakerKeys.add(b.bookmakerKey);
  }

  const schemaFit = [
    {
      field: "Game Identity",
      providerSourcePath: "data.id + home_team/away_team + commence_time",
      fitStatus: identityMapping === "MATCHED" ? "DIRECT_MATCH" : "AMBIGUOUS",
      notes: `identityMapping=${identityMapping}`,
    },
    {
      field: "Provider",
      providerSourcePath: "envelope + data.sport_key",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "THE_ODDS_API event historical endpoint",
    },
    {
      field: "Bookmaker",
      providerSourcePath: "data.bookmakers[].key/title/last_update",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "raw keys preserved; no AGGREGATE_BEST",
    },
    {
      field: "Market",
      providerSourcePath: "bookmakers[].markets[].key",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "h2h featured market",
    },
    {
      field: "Snapshot",
      providerSourcePath: "timestamp / previous_timestamp / next_timestamp",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "closest ≤ requested date",
    },
    {
      field: "Selection",
      providerSourcePath: "outcomes[].name/price",
      fitStatus: "DERIVABLE" as FitStatus,
      notes: "HOME/AWAY via team name match to event home/away",
    },
    {
      field: "Odds",
      providerSourcePath: "outcomes[].price",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "decimal format requested",
    },
    {
      field: "Line",
      providerSourcePath: "outcomes[].point",
      fitStatus: "MISSING" as FitStatus,
      notes: "h2h typically null point",
    },
    {
      field: "Market Rule",
      providerSourcePath: "not in payload",
      fitStatus: "MISSING" as FitStatus,
      notes: "OT inclusion not in response → UNVERIFIED",
    },
    {
      field: "Provider Timestamp",
      providerSourcePath: "timestamp + bookmaker/market last_update",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "",
    },
    {
      field: "Scheduled Start at Snapshot",
      providerSourcePath: "data.commence_time",
      fitStatus: "DIRECT_MATCH" as FitStatus,
      notes: "stored as scheduledStartTimeAtSnapshot",
    },
    {
      field: "Legal Metadata",
      providerSourcePath: "not in payload",
      fitStatus: "MISSING" as FitStatus,
      notes: "must be stamped by collector",
    },
    {
      field: "Hash Inputs",
      providerSourcePath: "derivable from normalized row",
      fitStatus: "DERIVABLE" as FitStatus,
      notes: "",
    },
  ];

  const missingProviderFields = schemaFit
    .filter((f) => f.fitStatus === "MISSING")
    .map((f) => f.field);
  const providerSpecificFields = [
    "previous_timestamp",
    "next_timestamp",
    "sport_key",
    "bookmakers[].last_update",
  ];

  const probeStatus =
    snapshots.length === 0
      ? "NO_EVENTS_FOUND"
      : identityMapping === "UNMATCHED"
        ? "EVENT_IDENTITY_UNMATCHED"
        : "PROBE_COMPLETED";

  const schemaFitOverall =
    snapshots.length > 0 && identityMapping === "MATCHED"
      ? "FIT_FOR_PROBE"
      : "SCHEMA_NOT_FIT";

  // Abbreviated sample for git (truncate books/outcomes)
  const schemaSample = {
    note: "Abbreviated probe sample for schema validation only — not full Historical raw archive",
    target: TARGET,
    snapshotCount: snapshots.length,
    snapshots: snapshots.map((s) => ({
      snapshotTime: s.snapshotTime,
      previousTimestamp: s.previousTimestamp,
      nextTimestamp: s.nextTimestamp,
      scheduledStartTimeAtSnapshot: s.scheduledStartTimeAtSnapshot,
      isPreGame: s.isPreGame,
      phase: s.phase,
      bookmakerCount: s.bookmakers.length,
      bookmakers: s.bookmakers.slice(0, 3).map((b) => ({
        bookmakerKey: b.bookmakerKey,
        bookmakerName: b.bookmakerName,
        lastUpdateAtSnapshot: b.lastUpdateAtSnapshot,
        marketKey: b.marketKey,
        selections: b.selections.map((sel) => ({
          selectionCode: sel.selectionCode,
          selectionLabel: sel.selectionLabel,
          oddsDecimal: sel.oddsDecimal,
          valid: sel.valid,
        })),
      })),
    })),
  };

  const payloadHash = sha256(
    JSON.stringify({
      target: TARGET,
      snapshotTimes: snapshots.map((s) => s.snapshotTime),
      bookmakers: [...bookmakerKeys].sort(),
    }),
  );

  await writeOutputs(cwd, {
    ...auditBase,
    probeStatus,
    historicalPlanAvailable: true,
    estimatedCreditsBefore: estimatedCredits,
    actualCreditsUsed:
      actualCreditsUsed == null ? "UNKNOWN" : actualCreditsUsed,
    requestsMade,
    snapshotRequests: requestsMade,
    snapshotsReturned: snapshots.length,
    preGameSnapshots: preGame.length,
    postStartSnapshots: snapshots.filter((s) => s.isPreGame === false).length,
    bookmakersReturned: bookmakerKeys.size,
    selectionsNormalized: snapshots.reduce(
      (n, s) =>
        n +
        s.bookmakers.reduce(
          (m, b) =>
            m +
            b.selections.filter(
              (sel) =>
                sel.selectionCode === "HOME" || sel.selectionCode === "AWAY",
            ).length,
          0,
        ),
      0,
    ),
    invalidOdds,
    selectionMappingFailed,
    exactDuplicates,
    revisionCandidates,
    identityMapping,
    marketRuleStatus: "UNVERIFIED",
    officialOpeningStatus: "NOT_AVAILABLE",
    firstObservedPreGameAt: firstPre,
    firstObservedOddsHome: pickOdds(firstSnap, "HOME"),
    firstObservedOddsAway: pickOdds(firstSnap, "AWAY"),
    latestPreGameAt: lastPre,
    latestPreGameOddsHome: pickOdds(latestSnap, "HOME"),
    latestPreGameOddsAway: pickOdds(latestSnap, "AWAY"),
    officialClosingStatus: "NOT_AVAILABLE",
    observedMovementCount,
    observedMovementNote:
      "Schema-validation observation only — not research evidence / not Steam / not win-probability claim",
    schemaFitOverall,
    schemaFit,
    missingProviderFields,
    providerSpecificFields,
    rawStoragePolicy:
      "ABBREVIATED_SCHEMA_SAMPLE_ONLY_NO_FULL_RAW_IN_GIT",
    cachePolicy:
      "NO_PERSISTENT_RAW_CACHE_CACHE_GATE_NOT_PASSED_IN_MEMORY_ONLY",
    usageBefore: sportsUsage,
    usageAfter: usageAfterLast,
    pullStatuses: pulls.map((p) => ({
      requestedDate: p.requestedDate,
      status: p.status,
      snapshotTime: p.envelope?.timestamp ?? null,
      bookmakerCount: p.envelope?.data?.bookmakers?.length ?? 0,
      creditsLastHeader: p.usage.last,
    })),
    payloadIdentityHashSha256: payloadHash,
    complianceGates: {
      LEGAL_GATE: "NOT_PASSED",
      LICENSE_GATE: "NEEDS_REVIEW",
      CACHE_GATE: "NOT_PASSED",
      REDISTRIBUTION_GATE: "NOT_PASSED",
      COST_GATE: actualCreditsUsed != null && actualCreditsUsed <= CREDIT_CAP
        ? "PROBE_WITHIN_CAP"
        : "NEEDS_REVIEW",
      DATA_QUALITY_GATE: probeStatus === "PROBE_COMPLETED" ? "PROBE_OK" : "NOT_PASSED",
      MARKET_RULE_GATE: "NOT_PASSED",
      note: "Probe success does not clear legal/license/redistribution gates",
    },
    impact: {
      dataset: 0,
      registry: 0,
      framework: 0,
      prediction: 0,
      engine: 0,
      existingMlbOddsHistory: 0,
    },
  }, schemaSample);

  console.log(
    JSON.stringify(
      {
        probeStatus,
        snapshotsReturned: snapshots.length,
        preGame: preGame.length,
        bookmakers: bookmakerKeys.size,
        estimatedCredits,
        actualCreditsUsed,
        requestsMade,
        identityMapping,
        schemaFitOverall,
      },
      null,
      2,
    ),
  );
}

function defaultGates(extra?: string) {
  return {
    LEGAL_GATE: "NOT_PASSED",
    LICENSE_GATE: "NOT_PASSED",
    CACHE_GATE: "NOT_PASSED",
    REDISTRIBUTION_GATE: "NOT_PASSED",
    COST_GATE: extra === "PLAN_BLOCKED" ? "NOT_APPLICABLE" : "NOT_PASSED",
    DATA_QUALITY_GATE: "NOT_PASSED",
    MARKET_RULE_GATE: "NOT_PASSED",
  };
}

async function writeOutputs(
  cwd: string,
  audit: Record<string, unknown>,
  schemaSample?: unknown,
) {
  const auditPath = path.join(
    cwd,
    "data/audits/mlb-h2h-historical-odds-probe-v1.json",
  );
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  if (schemaSample) {
    const samplePath = path.join(
      cwd,
      "data/probes/market-intelligence/mlb-h2h-historical-v1/schema-sample.json",
    );
    await mkdir(path.dirname(samplePath), { recursive: true });
    await writeFile(
      samplePath,
      `${JSON.stringify(schemaSample, null, 2)}\n`,
      "utf8",
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
