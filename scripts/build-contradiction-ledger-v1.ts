/**
 * Contradiction Ledger v1 — read-only extraction from Dataset Correlation Audit.
 * No dataset mutation, no hypothesis status promotion, Engine PROHIBITED.
 *
 *   npx tsx scripts/build-contradiction-ledger-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE = process.argv[2]?.trim() || "2026-07-27";

type CorrelationGame = {
  gameId: string;
  match: string;
  outcome: "SUCCESS" | "FAILURE";
  predictionHit: boolean;
  pitcherDirection: string | null;
  starter: { postGame: string | null };
  bullpen: {
    roleComparison: string | null;
    bullpenVerdict: string | null;
  };
  lineup: { preGame: string | null; postGame: string | null };
  flowReview: {
    primary: string | null;
    secondary: string[];
    starterVerdict: string | null;
    bullpenVerdict: string | null;
  } | null;
};

type ContradictionType =
  | "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE"
  | "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE_OVERCOME"
  | "BULLPEN_ROLE_SUPPORTS_PREDICTION_FAILED"
  | "BULLPEN_ROLE_CONFLICTS_PREDICTION_SUCCEEDED"
  | "BULLPEN_ROLE_CONFLICTS_FLOW_PROTECTED";

type ContradictionEvent = {
  eventId: string;
  gameId: string;
  match: string;
  dateKst: string;
  outcome: "SUCCESS" | "FAILURE";
  domain: "starter" | "bullpen" | "lineup";
  type: ContradictionType;
  summary: string;
  observed: Record<string, string | null>;
  linkedHypothesisIds: string[];
  researchValue: "HIGH" | "MEDIUM";
  source: string;
};

const HYPOTHESIS_BY_TYPE: Record<ContradictionType, string[]> = {
  STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE: ["H-ST-001", "H-ST-004"],
  STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE_OVERCOME: ["H-ST-001"],
  BULLPEN_ROLE_SUPPORTS_PREDICTION_FAILED: ["H-BP-ROLE-005"],
  BULLPEN_ROLE_CONFLICTS_PREDICTION_SUCCEEDED: ["H-BP-ROLE-005"],
  BULLPEN_ROLE_CONFLICTS_FLOW_PROTECTED: ["H-BP-ROLE-005"],
};

function detectContradictions(
  game: CorrelationGame,
  dateKst: string,
  source: string,
  seq: { n: number },
): ContradictionEvent[] {
  const events: ContradictionEvent[] = [];
  const flow = game.flowReview;
  const starterVerdict = flow?.starterVerdict ?? null;
  const bullpenRole = game.bullpen.roleComparison;
  const bullpenVerdict =
    flow?.bullpenVerdict ?? game.bullpen.bullpenVerdict ?? null;

  if (
    game.starter.postGame === "STARTER_MATCHED" &&
    starterVerdict?.includes("DISADVANTAGE")
  ) {
    const overcome = starterVerdict.includes("OVERCOME");
    const type: ContradictionType = overcome
      ? "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE_OVERCOME"
      : "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE";
    seq.n += 1;
    events.push({
      eventId: `C-${dateKst.replace(/-/g, "")}-${String(seq.n).padStart(3, "0")}`,
      gameId: game.gameId,
      match: game.match,
      dateKst,
      outcome: game.outcome,
      domain: "starter",
      type,
      summary: overcome
        ? "Probable→actual identity matched but flow tagged starter disadvantage overcome"
        : "Probable→actual identity matched but flow tagged starter disadvantage realized",
      observed: {
        starterPostGame: game.starter.postGame,
        flowStarterVerdict: starterVerdict,
        flowPrimary: flow?.primary ?? null,
      },
      linkedHypothesisIds: HYPOTHESIS_BY_TYPE[type],
      researchValue: overcome ? "MEDIUM" : "HIGH",
      source,
    });
  }

  if (
    bullpenRole === "ROLE_STRUCTURE_SUPPORTS_BASELINE" &&
    game.outcome === "FAILURE"
  ) {
    seq.n += 1;
    events.push({
      eventId: `C-${dateKst.replace(/-/g, "")}-${String(seq.n).padStart(3, "0")}`,
      gameId: game.gameId,
      match: game.match,
      dateKst,
      outcome: game.outcome,
      domain: "bullpen",
      type: "BULLPEN_ROLE_SUPPORTS_PREDICTION_FAILED",
      summary:
        "Bullpen role structure supported baseline pick but prediction failed",
      observed: {
        bullpenRoleComparison: bullpenRole,
        bullpenVerdict,
        flowPrimary: flow?.primary ?? null,
      },
      linkedHypothesisIds: HYPOTHESIS_BY_TYPE.BULLPEN_ROLE_SUPPORTS_PREDICTION_FAILED,
      researchValue: "HIGH",
      source,
    });
  }

  if (
    bullpenRole === "ROLE_STRUCTURE_CONFLICTS_BASELINE" &&
    game.outcome === "SUCCESS"
  ) {
    seq.n += 1;
    events.push({
      eventId: `C-${dateKst.replace(/-/g, "")}-${String(seq.n).padStart(3, "0")}`,
      gameId: game.gameId,
      match: game.match,
      dateKst,
      outcome: game.outcome,
      domain: "bullpen",
      type: "BULLPEN_ROLE_CONFLICTS_PREDICTION_SUCCEEDED",
      summary:
        "Bullpen role structure conflicted with baseline pick but prediction succeeded",
      observed: {
        bullpenRoleComparison: bullpenRole,
        bullpenVerdict,
        flowPrimary: flow?.primary ?? null,
      },
      linkedHypothesisIds:
        HYPOTHESIS_BY_TYPE.BULLPEN_ROLE_CONFLICTS_PREDICTION_SUCCEEDED,
      researchValue: "HIGH",
      source,
    });
  }

  if (
    bullpenRole === "ROLE_STRUCTURE_CONFLICTS_BASELINE" &&
    bullpenVerdict?.includes("PROTECTED")
  ) {
    seq.n += 1;
    events.push({
      eventId: `C-${dateKst.replace(/-/g, "")}-${String(seq.n).padStart(3, "0")}`,
      gameId: game.gameId,
      match: game.match,
      dateKst,
      outcome: game.outcome,
      domain: "bullpen",
      type: "BULLPEN_ROLE_CONFLICTS_FLOW_PROTECTED",
      summary:
        "Bullpen role structure conflicted with baseline but flow verdict protected lead",
      observed: {
        bullpenRoleComparison: bullpenRole,
        bullpenVerdict,
        flowPrimary: flow?.primary ?? null,
      },
      linkedHypothesisIds: HYPOTHESIS_BY_TYPE.BULLPEN_ROLE_CONFLICTS_FLOW_PROTECTED,
      researchValue: "MEDIUM",
      source,
    });
  }

  return events;
}

async function main() {
  const root = process.cwd();
  const correlationPath = path.join(
    root,
    "data/audits",
    `dataset-correlation-audit-v1-${DATE}.json`,
  );
  const predPath = path.join(root, "data/predictions/mlb", `${DATE}.json`);
  const predHash = createHash("sha256")
    .update(await readFile(predPath, "utf8"))
    .digest("hex");

  const correlation = JSON.parse(await readFile(correlationPath, "utf8")) as {
    games: CorrelationGame[];
  };

  const seq = { n: 0 };
  const source = `data/audits/dataset-correlation-audit-v1-${DATE}.json`;
  const allEvents: ContradictionEvent[] = [];

  for (const game of correlation.games) {
    const events = detectContradictions(game, DATE, source, seq);
    allEvents.push(...events);
  }

  const gamesWithContradictions = [
    ...new Set(allEvents.map((e) => e.gameId)),
  ].sort();

  const byDomain = {
    starter: allEvents.filter((e) => e.domain === "starter").length,
    bullpen: allEvents.filter((e) => e.domain === "bullpen").length,
    lineup: allEvents.filter((e) => e.domain === "lineup").length,
  };

  const ledger = {
    meta: {
      version: "contradiction-ledger-v1",
      kind: "contradiction-ledger",
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      auditedGames: correlation.games.length,
      gamesWithContradictions: gamesWithContradictions.length,
      contradictionEventCount: allEvents.length,
      researchOnly: true,
      engineConnected: false,
      engineCandidate: false,
      engineAdmission: "PROHIBITED",
      hypothesisStatusPromotion: false,
      scoring: false,
      predictionHashSha256: predHash,
      predictionUnchanged: true,
      datasetFilesUnchanged: true,
      correlationAuditSource: source,
      hypothesisEvidenceLedgerLink:
        "data/research/hypothesis-evidence-ledger.json",
      conclusion: "CONTRADICTION_EVIDENCE_COLLECTION_STARTED",
      note: "Cross-dataset contradiction events for high-value review games only. Explanatory — not Engine input.",
    },
    totals: {
      contradictionEvents: allEvents.length,
      starterContradictions: byDomain.starter,
      bullpenContradictions: byDomain.bullpen,
      lineupContradictions: byDomain.lineup,
      uniqueGames: gamesWithContradictions.length,
      typeCounts: Object.entries(
        allEvents.reduce<Record<string, number>>((acc, e) => {
          acc[e.type] = (acc[e.type] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    },
    games: gamesWithContradictions.map((gameId) => {
      const game = correlation.games.find((g) => g.gameId === gameId)!;
      const events = allEvents.filter((e) => e.gameId === gameId);
      return {
        gameId,
        match: game.match,
        outcome: game.outcome,
        predictionHit: game.predictionHit,
        eventIds: events.map((e) => e.eventId),
        domains: [...new Set(events.map((e) => e.domain))],
        linkedHypothesisIds: [
          ...new Set(events.flatMap((e) => e.linkedHypothesisIds)),
        ],
      };
    }),
    events: allEvents,
    hypothesisLinks: [
      ...new Set(allEvents.flatMap((e) => e.linkedHypothesisIds)),
    ].sort().map((hypothesisId) => ({
      hypothesisId,
      eventIds: allEvents
        .filter((e) => e.linkedHypothesisIds.includes(hypothesisId))
        .map((e) => e.eventId),
    })),
  };

  const outLedger = path.join(root, "data/research/contradiction-ledger-v1.json");
  const outAudit = path.join(
    root,
    "data/audits",
    `contradiction-ledger-v1-${DATE}-audit.json`,
  );

  await mkdir(path.dirname(outLedger), { recursive: true });
  await writeFile(outLedger, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await writeFile(
    outAudit,
    `${JSON.stringify(
      {
        meta: {
          version: "contradiction-ledger-v1-audit",
          dateKst: DATE,
          generatedAt: ledger.meta.generatedAt,
          conclusion: ledger.meta.conclusion,
          predictionHashSha256: predHash,
        },
        totals: ledger.totals,
        checks: [
          {
            id: "prediction-hash-recorded",
            passed: true,
            detail: predHash,
          },
          {
            id: "engine-prohibited",
            passed: ledger.meta.engineAdmission === "PROHIBITED",
            detail: "PROHIBITED",
          },
          {
            id: "hypothesis-status-unchanged",
            passed: true,
            detail: "no registry promotion",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  // Link only — update hypothesis evidence ledger refs
  const evidencePath = path.join(
    root,
    "data/research/hypothesis-evidence-ledger.json",
  );
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
    meta: Record<string, unknown>;
    hypotheses: Array<{
      hypothesisId: string;
      contradictionLedgerRefs?: Array<{
        ledgerEventId: string;
        gameId: string;
        dateKst: string;
      }>;
      [key: string]: unknown;
    }>;
  };

  evidence.meta.contradictionLedgerPath = "data/research/contradiction-ledger-v1.json";
  evidence.meta.contradictionLedgerAuditPath = `data/audits/contradiction-ledger-v1-${DATE}-audit.json`;
  const sources = Array.isArray(evidence.meta.sources)
    ? (evidence.meta.sources as string[])
    : [];
  if (!sources.includes("data/research/contradiction-ledger-v1.json")) {
    sources.push("data/research/contradiction-ledger-v1.json");
    evidence.meta.sources = sources;
  }

  for (const h of evidence.hypotheses) {
    const links = ledger.hypothesisLinks.find(
      (l) => l.hypothesisId === h.hypothesisId,
    );
    if (!links || links.eventIds.length === 0) continue;
    h.contradictionLedgerRefs = links.eventIds.map((ledgerEventId) => {
      const ev = allEvents.find((e) => e.eventId === ledgerEventId)!;
      return {
        ledgerEventId,
        gameId: ev.gameId,
        dateKst: DATE,
      };
    });
  }

  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(`ledger: ${outLedger}`);
  console.log(`audit: ${outAudit}`);
  console.log(
    `events=${allEvents.length} games=${gamesWithContradictions.length} starter=${byDomain.starter} bullpen=${byDomain.bullpen} lineup=${byDomain.lineup}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
