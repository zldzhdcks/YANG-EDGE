import Module from "node:module";
import path from "node:path";

async function main() {
  const stub = path.resolve("scripts/stub-server-only.cjs");
  const original = (
    Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
    function (request: string, ...args: unknown[]) {
      if (request === "server-only") return stub;
      return original.call(this, request, ...args);
    };
  const { loadResearchAnalysisView } = await import(
    "../src/lib/research/load-research-analysis-view"
  );
  for (const id of [
    "kbo-181917",
    "kbo-181918",
    "kbo-181919",
    "kbo-181920",
    "kbo-181921",
  ]) {
    const v = await loadResearchAnalysisView(id);
    console.log(
      JSON.stringify({
        id,
        dbg: v.researchPrediction.debugStatus,
        status: v.researchPrediction.officialStatus,
        pick: v.researchPrediction.officialPick,
        reasons: v.researchPrediction.passReasons,
        scorePred: v.researchScore.items.find((i) => i.label === "Prediction"),
        total: v.researchScore.total,
        predPath: v.sources.predictionPath,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
