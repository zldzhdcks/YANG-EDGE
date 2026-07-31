import { loadFrozenBaseballSlate } from "../src/lib/baseball/load-frozen-baseball-slate";

async function main() {
  const r = await loadFrozenBaseballSlate({ dateKst: "2026-07-31" });
  console.log(JSON.stringify(r.meta, null, 2));
  console.log(
    "KBO",
    r.kbo.map(
      (g) =>
        `${g.gameId} ${g.awayTeamName}@${g.homeTeamName} ${g.officialStatus}`,
    ),
  );
  console.log(
    "NPB",
    r.npb.map(
      (g) =>
        `${g.gameId} ${g.awayTeamName}@${g.homeTeamName} src=${g.sources.join(",")}`,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
