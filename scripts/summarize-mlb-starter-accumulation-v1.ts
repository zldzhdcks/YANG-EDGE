/**
 * Starter Dataset v1 accumulation summary — reads audits only (no recompute).
 *
 * 실행:
 *   npx tsx scripts/summarize-mlb-starter-accumulation-v1.ts
 */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function main() {
  const auditDir = path.join(process.cwd(), "data/audits");
  const files = (await readdir(auditDir))
    .filter((f) => /starter-dataset-v1-audit\.json$/.test(f))
    .sort();

  const days: Array<Record<string, unknown>> = [];
  let games = 0;
  let rows = 0;
  let probable = 0;
  let missing = 0;
  let matched = 0;
  let changed = 0;
  let awaiting = 0;
  let season = 0;
  let recent = 0;

  for (const file of files) {
    const raw = JSON.parse(
      await readFile(path.join(auditDir, file), "utf8"),
    ) as unknown;
    const root = asRecord(raw);
    const meta = asRecord(root?.meta) ?? {};
    const totals = asRecord(root?.totals) ?? {};
    // support both accumulation audit and older ResearchAuditReport shell
    const dateKst =
      asString(meta.dateKst) ??
      file.replace(/-starter-dataset-v1-audit\.json$/, "").replace(/^.*?(20\d{2}-\d{2}-\d{2}).*$/, "$1");
    const gameCount =
      asNumber(totals.gameCount) ??
      asNumber(totals.totalGames) ??
      null;
    const rowCount =
      asNumber(totals.rowCount) ?? asNumber(totals.totalRows) ?? null;
    const probableAvailable =
      asNumber(totals.probableAvailable) ??
      asNumber(asRecord(totals.classificationOrStatusCounts)?.PROBABLE_ONLY) ??
      null;
    const probableMissing =
      asNumber(totals.probableMissing) ??
      asNumber(asRecord(totals.classificationOrStatusCounts)?.MISSING) ??
      null;
    const starterMatched = asNumber(totals.starterMatched) ?? null;
    const starterChanged =
      asNumber(totals.starterChanged) ??
      asNumber(asRecord(totals.classificationOrStatusCounts)?.STARTER_CHANGED) ??
      null;
    const awaitingResult = asNumber(totals.awaitingResult) ?? null;
    const seasonStatsAvailable = asNumber(totals.seasonStatsAvailable) ?? null;
    const recentStartsAvailable =
      asNumber(totals.recentStartsAvailable) ?? null;
    const resultHash =
      asString(totals.resultHash) ??
      asString(meta.resultHashSha256) ??
      null;

    days.push({
      dateKst,
      file: `data/audits/${file}`,
      gameCount,
      rowCount,
      probableAvailable,
      probableMissing,
      starterMatched,
      starterChanged,
      awaitingResult,
      seasonStatsAvailable,
      recentStartsAvailable,
      joinQuality: totals.joinQuality ?? null,
      averageSampleSize: totals.averageSampleSize ?? null,
      targetGameIncluded: totals.targetGameIncluded ?? null,
      cutoffViolation: totals.cutoffViolation ?? null,
      resultHash,
    });

    games += gameCount ?? 0;
    rows += rowCount ?? 0;
    probable += probableAvailable ?? 0;
    missing += probableMissing ?? 0;
    matched += starterMatched ?? 0;
    changed += starterChanged ?? 0;
    awaiting += awaitingResult ?? 0;
    season += seasonStatsAvailable ?? 0;
    recent += recentStartsAvailable ?? 0;
  }

  const summary = {
    meta: {
      version: "mlb-starter-accumulation-summary-v1",
      generatedAt: new Date().toISOString(),
      recomputed: false,
      engineAdmission: "PROHIBITED",
      note: "Read-only aggregation of starter-dataset-v1 audit JSON files.",
    },
    cumulative: {
      auditFiles: files.length,
      gameCount: games,
      rowCount: rows,
      probableAvailable: probable,
      probableMissing: missing,
      seasonStatsAvailable: season,
      recentStartsAvailable: recent,
      starterMatched: matched,
      starterChanged: changed,
      awaitingResult: awaiting,
    },
    days,
  };

  const out = path.join(
    process.cwd(),
    "data/audits/starter-dataset-v1-accumulation-summary.json",
  );
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary.cumulative, null, 2));
  console.log(`저장: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
