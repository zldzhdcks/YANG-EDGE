/**
 * Contradiction Severity Audit v1 — classify ledger events LOW/MEDIUM/HIGH.
 * Research priority only. No scores, no Engine, no hypothesis promotion.
 *
 *   npx tsx scripts/build-contradiction-severity-audit-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE = process.argv[2]?.trim() || "2026-07-27";

type Severity = "LOW" | "MEDIUM" | "HIGH";

type LedgerEvent = {
  eventId: string;
  gameId: string;
  match: string;
  dateKst: string;
  outcome: "SUCCESS" | "FAILURE";
  domain: string;
  type: string;
  summary: string;
  observed: Record<string, string | null>;
  linkedHypothesisIds: string[];
  researchValue: string;
  source: string;
};

type SeverityRule = {
  severity: Severity;
  rationale: string;
};

function classifySeverity(event: LedgerEvent): SeverityRule {
  switch (event.type) {
    case "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE":
      if (event.outcome === "FAILURE") {
        return {
          severity: "HIGH",
          rationale:
            "Identity matched (no scratch) but flow reports starter disadvantage on a failed prediction — direct cross-artifact tension on outcome.",
        };
      }
      return {
        severity: "MEDIUM",
        rationale:
          "Starter disadvantage tag with matched identity on non-failure outcome — review signal without prediction miss.",
      };

    case "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE_OVERCOME":
      return {
        severity: "MEDIUM",
        rationale:
          "Disadvantage tag present but outcome succeeded (overcome) — contradiction is explanatory, not predictive failure.",
      };

    case "BULLPEN_ROLE_SUPPORTS_PREDICTION_FAILED":
      return {
        severity: "HIGH",
        rationale:
            "Bullpen role structure aligned with baseline pick yet prediction failed — strongest bullpen-structure vs outcome tension.",
      };

    case "BULLPEN_ROLE_CONFLICTS_PREDICTION_SUCCEEDED":
      return {
        severity: "HIGH",
        rationale:
            "Bullpen role structure conflicted with baseline yet prediction succeeded — false-negative style tension for role compare.",
      };

    case "BULLPEN_ROLE_CONFLICTS_FLOW_PROTECTED":
      return {
        severity: "MEDIUM",
        rationale:
            "Role conflict coexists with protected-lead flow verdict on a hit — secondary tension on same game; outcome not contradicted.",
      };

    default:
      return {
        severity: "LOW",
        rationale:
            "Unclassified contradiction type on small sample — log only, no priority escalation.",
      };
  }
}

async function main() {
  const root = process.cwd();
  const ledgerPath = path.join(root, "data/research/contradiction-ledger-v1.json");
  const predPath = path.join(root, "data/predictions/mlb", `${DATE}.json`);
  const predHash = createHash("sha256")
    .update(await readFile(predPath, "utf8"))
    .digest("hex");

  const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as {
    meta: Record<string, unknown>;
    events: LedgerEvent[];
    hypothesisLinks: Array<{ hypothesisId: string; eventIds: string[] }>;
  };

  const classified = ledger.events.map((event) => {
    const { severity, rationale } = classifySeverity(event);
    return {
      eventId: event.eventId,
      gameId: event.gameId,
      match: event.match,
      dateKst: event.dateKst,
      domain: event.domain,
      type: event.type,
      outcome: event.outcome,
      severity,
      severityRationale: rationale,
      linkedHypothesisIds: event.linkedHypothesisIds,
      ledgerResearchValue: event.researchValue,
      source: event.source,
    };
  });

  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const row of classified) counts[row.severity] += 1;

  const byHypothesis = ledger.hypothesisLinks.map((link) => {
    const rows = classified.filter((c) =>
      link.eventIds.includes(c.eventId),
    );
    const sev = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const r of rows) sev[r.severity] += 1;
    return {
      hypothesisId: link.hypothesisId,
      eventCount: rows.length,
      severity: sev,
      highestSeverity:
        sev.HIGH > 0 ? "HIGH" : sev.MEDIUM > 0 ? "MEDIUM" : "LOW",
      eventIds: rows.map((r) => ({
        eventId: r.eventId,
        severity: r.severity,
      })),
    };
  });

  const audit = {
    meta: {
      version: "contradiction-severity-audit-v1",
      kind: "contradiction-severity-audit",
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      auditedEvents: classified.length,
      severityCounts: counts,
      engineCandidate: false,
      engineAdmission: "PROHIBITED",
      hypothesisStatusPromotion: false,
      scoring: false,
      predictionHashSha256: predHash,
      predictionUnchanged: true,
      datasetFilesUnchanged: true,
      contradictionLedgerSource: "data/research/contradiction-ledger-v1.json",
      correlationAuditSource: `data/audits/dataset-correlation-audit-v1-${DATE}.json`,
      hypothesisEvidenceLedgerLink:
        "data/research/hypothesis-evidence-ledger.json",
      conclusion: "CONTRADICTION_SEVERITY_COLLECTION_STARTED",
      note: "Severity labels are research-priority hints only — not Engine weights or hypothesis promotion.",
    },
    severityRules: [
      {
        type: "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE",
        failureOutcome: "HIGH",
        otherOutcome: "MEDIUM",
      },
      {
        type: "STARTER_IDENTITY_MATCHED_FLOW_DISADVANTAGE_OVERCOME",
        default: "MEDIUM",
      },
      {
        type: "BULLPEN_ROLE_SUPPORTS_PREDICTION_FAILED",
        default: "HIGH",
      },
      {
        type: "BULLPEN_ROLE_CONFLICTS_PREDICTION_SUCCEEDED",
        default: "HIGH",
      },
      {
        type: "BULLPEN_ROLE_CONFLICTS_FLOW_PROTECTED",
        default: "MEDIUM",
      },
    ],
    events: classified,
    hypothesisSeveritySummary: byHypothesis,
    limitations: [
      "Single slate (10 events) — severity counts are descriptive only",
      "No causal ranking or Engine admission implied",
      "LOW bucket unused on 2026-07-27 slate",
    ],
  };

  const outResearch = path.join(
    root,
    "data/research/contradiction-severity-audit-v1.json",
  );
  const outAudit = path.join(
    root,
    "data/audits",
    `contradiction-severity-audit-v1-${DATE}.json`,
  );

  await mkdir(path.dirname(outResearch), { recursive: true });
  await writeFile(outResearch, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  // Link only — contradiction ledger meta
  ledger.meta.severityAuditPath = "data/research/contradiction-severity-audit-v1.json";
  ledger.meta.severityAuditAuditPath = `data/audits/contradiction-severity-audit-v1-${DATE}.json`;
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  // Link only — hypothesis evidence ledger
  const evidencePath = path.join(
    root,
    "data/research/hypothesis-evidence-ledger.json",
  );
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
    meta: Record<string, unknown>;
    hypotheses: Array<{
      hypothesisId: string;
      severityAuditRefs?: Array<{
        eventId: string;
        severity: Severity;
      }>;
      [key: string]: unknown;
    }>;
  };

  evidence.meta.contradictionSeverityAuditPath =
    "data/research/contradiction-severity-audit-v1.json";
  const sources = Array.isArray(evidence.meta.sources)
    ? (evidence.meta.sources as string[])
    : [];
  if (!sources.includes("data/research/contradiction-severity-audit-v1.json")) {
    sources.push("data/research/contradiction-severity-audit-v1.json");
    evidence.meta.sources = sources;
  }

  for (const h of evidence.hypotheses) {
    const summary = byHypothesis.find(
      (s) => s.hypothesisId === h.hypothesisId,
    );
    if (!summary || summary.eventCount === 0) continue;
    h.severityAuditRefs = summary.eventIds;
  }

  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(`severity audit: ${outResearch}`);
  console.log(
    `LOW=${counts.LOW} MEDIUM=${counts.MEDIUM} HIGH=${counts.HIGH} events=${classified.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
