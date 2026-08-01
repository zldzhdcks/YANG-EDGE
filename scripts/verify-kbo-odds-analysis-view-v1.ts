import Module from "node:module";
import path from "node:path";

async function main() {
  const stub = path.resolve("scripts/stub-server-only.cjs");
  const original = (
    Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
    function (request: unknown, ...args: unknown[]) {
      if (request === "server-only") return stub;
      return original.call(this, request, ...args);
    };

  const { loadResearchAnalysisView } = await import(
    "../src/lib/research/load-research-analysis-view"
  );

  const ids = [
    "kbo-181917",
    "kbo-181918",
    "kbo-181919",
    "kbo-181920",
    "kbo-181921",
  ];
  for (const id of ids) {
    const v = await loadResearchAnalysisView(id);
    console.log(
      JSON.stringify({
        id,
        match: v.gameInfo.matchLabel,
        domesticPass: v.oddsComparison.domesticPass,
        overseasPass: v.oddsComparison.overseasPass,
        d: [v.oddsComparison.domesticHome, v.oddsComparison.domesticAway],
        o: [v.oddsComparison.overseasHome, v.oddsComparison.overseasAway],
        score: v.researchScore.items.map((i) => `${i.label}:${i.score}`),
        total: v.researchScore.total,
        oddsPath: v.sources.oddsPath,
        starter: v.startingPitchers.availability,
        lineup: v.sources.lineupPath != null,
        pred: v.prediction.availability,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
