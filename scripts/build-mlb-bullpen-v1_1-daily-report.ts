/**
 * Bullpen v1.1 Daily Validation Report
 *
 * 기존 `bullpen-v1_1-validation-{date}.json` 을 읽어 Markdown/JSON 요약만 생성한다.
 * 재계산 없음 · Classifier / Engine / Validation 로직 미수정.
 *
 * 실행:
 *   npx tsx scripts/build-mlb-bullpen-v1_1-daily-report.ts [YYYY-MM-DD]
 *   npx tsx scripts/build-mlb-bullpen-v1_1-daily-report.ts --from data/audits/bullpen-v1_1-validation-2026-07-28.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_DATE = "2026-07-28";

type UnknownRecord = Record<string, unknown>;

function asRecord(v: unknown): UnknownRecord | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as UnknownRecord)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function resolveInputPath(argv: string[]): {
  dateKst: string;
  validationPath: string;
} {
  const fromIdx = argv.indexOf("--from");
  if (fromIdx >= 0) {
    const rel = argv[fromIdx + 1];
    if (!rel) throw new Error("--from 경로 필요");
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    const base = path.basename(abs);
    const m = /^bullpen-v1_1-validation-(.+)\.json$/.exec(base);
    return {
      dateKst: m?.[1] ?? DEFAULT_DATE,
      validationPath: abs,
    };
  }
  const date =
    argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
    process.env.MLB_TARGET_DATE_KST?.trim() ||
    DEFAULT_DATE;
  return {
    dateKst: date,
    validationPath: path.join(
      process.cwd(),
      "data/audits",
      `bullpen-v1_1-validation-${date}.json`,
    ),
  };
}

function formatRatio(n: number | null, d: number | null): string {
  if (n == null || d == null) return "n/a";
  return `${n} / ${d}`;
}

function formatPct(v: number | null): string {
  if (v == null) return "n/a";
  return `${v}%`;
}

function buildReport(validation: UnknownRecord, sourcePath: string) {
  const meta = asRecord(validation.meta) ?? {};
  const metrics = asRecord(validation.metrics) ?? {};
  const verification = asRecord(validation.verification) ?? {};
  const slate = asRecord(validation.slate) ?? {};
  const remainingIssues = asStringArray(validation.remainingIssues);

  const finishedGames =
    asNumber(metrics.finishedGames) ?? asNumber(slate.finished);
  const cumulative = asNumber(metrics.cumulativeGradedGames);
  const successStable = asNumber(metrics.successStable);
  const successTotal = asNumber(metrics.successTotal);
  const failWarn = asNumber(metrics.failPregameWarn);
  const failTotal = asNumber(metrics.failTotal);
  const falsePositive = asNumber(metrics.falsePositive);
  const falseNegative = asNumber(metrics.falseNegative);
  const unknownRate = asNumber(metrics.unknownRatePct);
  const classifiedRate = asNumber(metrics.classifiedRatePct);
  const roleCounts = asRecord(metrics.roleCounts) ?? {};
  const unknownCount = asNumber(roleCounts.UNKNOWN);

  const cacheReuse =
    asBool(verification.cacheReuse) ?? asBool(meta.cacheReuseOk);
  const cacheNetwork = asNumber(meta.cacheReuseNetworkCalls);
  const predHash =
    asString(verification.predictionImmutableHash) ??
    asString(meta.predictionImmutableHashAfter) ??
    asString(meta.predictionImmutableHashBefore);
  const bullpenHash =
    asString(verification.bullpenResultHash) ??
    asString(meta.bullpenResultHashAfter) ??
    asString(meta.bullpenResultHashBefore);
  const hashMatched =
    asBool(meta.bullpenHashMatched) ??
    asBool(verification.resultHashReproducible);
  const predUnchanged =
    asBool(verification.predictionImmutableHashUnchanged) ??
    asBool(meta.predictionImmutableUnchanged);
  const conclusion =
    asString(meta.conclusion) ?? "DATA_ACCUMULATION_CONTINUES";
  const dateKst = asString(meta.targetDateKst) ?? "unknown";
  const metricsSource = asString(metrics.metricsSource) ?? dateKst;
  const engineImpact =
    asNumber(verification.engineImpact) ?? asNumber(meta.engineImpact) ?? 0;

  // Fixed field order — do not reorder
  const sections = [
    {
      key: "finishedGames",
      label: "종료 경기 수",
      value: finishedGames,
      display:
        finishedGames == null
          ? "n/a"
          : `${finishedGames}${asNumber(slate.total) != null ? ` / ${asNumber(slate.total)}` : ""}`,
    },
    {
      key: "cumulativeGames",
      label: "누적 경기 수",
      value: cumulative,
      display: cumulative == null ? "n/a" : String(cumulative),
    },
    {
      key: "successFailure",
      label: "Success / Failure",
      value: {
        successStable,
        successTotal,
        failPregameWarn: failWarn,
        failTotal,
      },
      display: `Success ${formatRatio(successStable, successTotal)} · Failure ${formatRatio(failWarn, failTotal)}`,
    },
    {
      key: "bullpenWarning",
      label: "Bullpen Warning",
      value: { failPregameWarn: failWarn, failTotal },
      display: formatRatio(failWarn, failTotal),
    },
    {
      key: "falsePositive",
      label: "False Positive",
      value: falsePositive,
      display: falsePositive == null ? "n/a" : String(falsePositive),
    },
    {
      key: "falseNegative",
      label: "False Negative",
      value: falseNegative,
      display: falseNegative == null ? "n/a" : String(falseNegative),
    },
    {
      key: "unknown",
      label: "UNKNOWN",
      value: { ratePct: unknownRate, count: unknownCount },
      display:
        unknownCount != null
          ? `${formatPct(unknownRate)} (${unknownCount})`
          : formatPct(unknownRate),
    },
    {
      key: "classified",
      label: "CLASSIFIED",
      value: { ratePct: classifiedRate },
      display: formatPct(classifiedRate),
    },
    {
      key: "cache",
      label: "Cache",
      value: { reuseOk: cacheReuse, networkCalls: cacheNetwork },
      display:
        cacheReuse == null
          ? "n/a"
          : cacheReuse
            ? `REUSE_OK (network=${cacheNetwork == null ? "n/a" : cacheNetwork})`
            : `REUSE_FAIL (network=${cacheNetwork == null ? "n/a" : cacheNetwork})`,
    },
    {
      key: "hash",
      label: "Hash",
      value: {
        predictionImmutableHash: predHash,
        predictionImmutableUnchanged: predUnchanged,
        bullpenResultHash: bullpenHash,
        bullpenHashMatched: hashMatched,
      },
      display: [
        `predictionImmutable=${predHash ?? "n/a"}`,
        `unchanged=${predUnchanged ?? "n/a"}`,
        `bullpenResult=${bullpenHash ?? "n/a"}`,
        `matched=${hashMatched ?? "n/a"}`,
      ].join(" · "),
    },
    {
      key: "remainingIssues",
      label: "Remaining Issues",
      value: remainingIssues,
      display:
        remainingIssues.length === 0
          ? "(none)"
          : remainingIssues.map((x) => `- ${x}`).join("\n"),
    },
    {
      key: "officialConclusion",
      label: "Official Conclusion",
      value: conclusion,
      display: conclusion,
    },
  ] as const;

  const jsonDoc = {
    meta: {
      version: "bullpen-v1.1-daily-validation-report-v1",
      kind: "daily-validation-report",
      generatedAt: new Date().toISOString(),
      dateKst,
      classifierVersion:
        asString(meta.classifierVersion) ?? "bullpen-role-classifier-v1.1",
      engineImpact,
      recomputed: false,
      sourceValidationPath: path
        .relative(process.cwd(), sourcePath)
        .replace(/\\/g, "/"),
      metricsSource,
      sourceGeneratedAt: asString(meta.generatedAt),
      sourceConclusion: conclusion,
    },
    // Preserve fixed order as array
    sections: sections.map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      display: s.display,
    })),
    // Flat mirror for machine consumers (same values, no recalc)
    summary: {
      finishedGames,
      cumulativeGames: cumulative,
      successStable,
      successTotal,
      failPregameWarn: failWarn,
      failTotal,
      falsePositive,
      falseNegative,
      unknownRatePct: unknownRate,
      unknownCount,
      classifiedRatePct: classifiedRate,
      cacheReuseOk: cacheReuse,
      cacheNetworkCalls: cacheNetwork,
      predictionImmutableHash: predHash,
      predictionImmutableUnchanged: predUnchanged,
      bullpenResultHash: bullpenHash,
      bullpenHashMatched: hashMatched,
      remainingIssues,
      officialConclusion: conclusion,
    },
  };

  const mdLines: string[] = [
    `# Bullpen v1.1 Daily Validation Report`,
    ``,
    `- dateKst: \`${dateKst}\``,
    `- source: \`${jsonDoc.meta.sourceValidationPath}\``,
    `- metricsSource: \`${metricsSource}\``,
    `- recomputed: \`false\``,
    `- engineImpact: \`${engineImpact}\``,
    ``,
  ];

  for (const s of sections) {
    mdLines.push(`## ${s.label}`);
    if (s.key === "remainingIssues") {
      if (remainingIssues.length === 0) mdLines.push(`(none)`);
      else for (const issue of remainingIssues) mdLines.push(`- ${issue}`);
    } else if (s.key === "officialConclusion") {
      mdLines.push(`\`${s.display}\``);
    } else {
      mdLines.push(s.display);
    }
    mdLines.push(``);
  }

  return { jsonDoc, markdown: `${mdLines.join("\n").trimEnd()}\n` };
}

function assertMatchesSource(
  validation: UnknownRecord,
  summary: UnknownRecord,
): string[] {
  const metrics = asRecord(validation.metrics) ?? {};
  const meta = asRecord(validation.meta) ?? {};
  const verification = asRecord(validation.verification) ?? {};
  const errors: string[] = [];

  const checks: Array<[string, unknown, unknown]> = [
    ["finishedGames", summary.finishedGames, metrics.finishedGames],
    [
      "cumulativeGames",
      summary.cumulativeGames,
      metrics.cumulativeGradedGames,
    ],
    ["successStable", summary.successStable, metrics.successStable],
    ["successTotal", summary.successTotal, metrics.successTotal],
    ["failPregameWarn", summary.failPregameWarn, metrics.failPregameWarn],
    ["failTotal", summary.failTotal, metrics.failTotal],
    ["falsePositive", summary.falsePositive, metrics.falsePositive],
    ["falseNegative", summary.falseNegative, metrics.falseNegative],
    ["unknownRatePct", summary.unknownRatePct, metrics.unknownRatePct],
    [
      "classifiedRatePct",
      summary.classifiedRatePct,
      metrics.classifiedRatePct,
    ],
    [
      "officialConclusion",
      summary.officialConclusion,
      meta.conclusion,
    ],
    [
      "predictionImmutableUnchanged",
      summary.predictionImmutableUnchanged,
      verification.predictionImmutableHashUnchanged ??
        meta.predictionImmutableUnchanged,
    ],
  ];

  for (const [name, a, b] of checks) {
    if (a !== b) errors.push(`${name}: report=${String(a)} source=${String(b)}`);
  }

  if (
    (asNumber(meta.engineImpact) ?? asNumber(verification.engineImpact) ?? 0) !==
    0
  ) {
    errors.push("engineImpact: source is non-zero");
  }

  // remaining issues exact match
  const srcIssues = asStringArray(validation.remainingIssues);
  const repIssues = asStringArray(summary.remainingIssues);
  if (JSON.stringify(srcIssues) !== JSON.stringify(repIssues)) {
    errors.push("remainingIssues mismatch");
  }

  return errors;
}

async function main() {
  const { dateKst, validationPath } = resolveInputPath(process.argv.slice(2));
  console.log(`=== Bullpen v1.1 Daily Validation Report (${dateKst}) ===`);
  console.log(`source: ${validationPath}`);

  const raw = await readFile(validationPath, "utf8");
  const validation = JSON.parse(raw) as UnknownRecord;
  const { jsonDoc, markdown } = buildReport(validation, validationPath);

  const mismatches = assertMatchesSource(
    validation,
    jsonDoc.summary as UnknownRecord,
  );
  if (mismatches.length > 0) {
    throw new Error(
      `Daily report numbers diverge from validation source:\n- ${mismatches.join("\n- ")}`,
    );
  }

  const outDir = path.join(process.cwd(), "data/audits");
  await mkdir(outDir, { recursive: true });
  const jsonOut = path.join(
    outDir,
    `bullpen-v1_1-daily-report-${dateKst}.json`,
  );
  const mdOut = path.join(outDir, `bullpen-v1_1-daily-report-${dateKst}.md`);

  await writeFile(jsonOut, `${JSON.stringify(jsonDoc, null, 2)}\n`, "utf8");
  await writeFile(mdOut, markdown, "utf8");

  console.log(`Markdown: ${mdOut}`);
  console.log(`JSON: ${jsonOut}`);
  console.log(`conclusion=${jsonDoc.summary.officialConclusion}`);
  console.log("regression=PASS (source numbers reused)");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
