/**
 * Runtime verification: HTTP /api/games must return full KBO/NPB slate.
 * Requires local next server. Run after: npm run dev
 *
 * npx tsx scripts/verify-baseball-slate-runtime-v1.ts [port]
 */
const port = Number(process.argv[2] ?? 3000);
const base = `http://127.0.0.1:${port}`;

async function main() {
  const url = `${base}/api/games?date=2026-07-31`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let body: {
    games?: Array<{ game: { id: string; league: string } }>;
    meta?: {
      dateKstResolved?: string;
      sources?: { frozenBaseballSlate?: unknown };
      slateDebug?: Record<string, unknown>;
    };
    message?: string;
  };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    console.error("NON_JSON", res.status, text.slice(0, 400));
    process.exit(1);
  }

  const games = body.games ?? [];
  const kbo = games.filter((g) => g.game.league === "KBO");
  const npb = games.filter((g) => g.game.league === "NPB");

  console.log(
    JSON.stringify(
      {
        url,
        httpStatus: res.status,
        total: games.length,
        kbo: kbo.length,
        npb: npb.length,
        kboIds: kbo.map((g) => g.game.id),
        npbIds: npb.map((g) => g.game.id),
        dateKstResolved: body.meta?.dateKstResolved ?? null,
        frozen: body.meta?.sources?.frozenBaseballSlate ?? null,
        slateDebug: body.meta?.slateDebug ?? null,
      },
      null,
      2,
    ),
  );

  if (res.status !== 200) {
    console.error("FAIL http", res.status, body.message);
    process.exit(1);
  }
  if (kbo.length !== 5) {
    console.error("FAIL expected KBO 5 got", kbo.length);
    process.exit(1);
  }
  if (npb.length !== 6) {
    console.error("FAIL expected NPB 6 got", npb.length);
    process.exit(1);
  }
  console.log("PASS verify-baseball-slate-runtime-v1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
