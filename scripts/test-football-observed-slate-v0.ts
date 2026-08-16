/**
 * Football Observed Slate v0 tests.
 * Run: npm run test:football-observed-slate-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertObservedSlateIntegrity,
  buildFootballObservedSlateV0,
  deriveSlateStatuses,
  FOOTBALL_OBSERVED_SLATE_V0_SCHEMA,
} from "../src/lib/football/observed-slate-v0";
import { FOOTBALL_SNAPSHOT_MATCH_STATUSES } from "../src/lib/football/prediction-snapshot-v0/types";
import { normalizeFixtureToScheduleRow } from "../src/lib/football/core/normalize";

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel)))
    .digest("hex");
}

async function main() {
  const doc = await buildFootballObservedSlateV0({
    generatedAt: "2026-08-16T14:00:00.000Z",
  });

  assert.equal(doc.schemaVersion, FOOTBALL_OBSERVED_SLATE_V0_SCHEMA);
  assert.equal(doc.researchOnly, true);
  assert.equal(doc.engineAdmission, "PROHIBITED");
  assert.equal(doc.engineConnected, false);
  assert.equal(doc.doesNotReplaceScheduleV1, true);
  assert.equal(doc.scheduleFilterUnchanged, true);
  assert.deepEqual(assertObservedSlateIntegrity(doc), []);

  assert.equal(doc.summary.observedGames, 15);
  assert.equal(doc.summary.fixtureMapped, 15);
  assert.equal(doc.summary.marketRows, 60);
  assert.equal(doc.summary.registeredCompetition, 6);
  assert.equal(doc.summary.unregisteredCompetition, 9);
  assert.equal(doc.summary.pregameEligible, 14);
  assert.equal(doc.summary.cutoffBlocked, 1);
  assert.equal(doc.summary.droppedFromObservedSlate, 0);
  assert.equal(
    doc.summary.observedGames,
    doc.summary.registeredCompetition + doc.summary.unregisteredCompetition,
  );

  const ids = doc.games.map((g) => g.fixtureId);
  assert.equal(ids.filter((id) => !Number.isFinite(id)).length, 0);
  assert.equal(new Set(ids).size, 15);

  assert.equal(doc.summary.oneX2Observations, 15);
  assert.equal(doc.summary.oneX2Joined, 15);
  assert.equal(doc.summary.oneX2RegisteredEligible, 6);
  assert.equal(doc.summary.oneX2UnsupportedObserved, 8);
  assert.equal(doc.summary.oneX2CutoffBlocked, 1);

  const malaysia = doc.games.find((g) => g.rowId === 1);
  assert.ok(malaysia);
  assert.equal(malaysia.fixtureId, 1619317);
  assert.equal(malaysia.pregameEvidenceStatus, "CUTOFF_BLOCKED");
  assert.equal(malaysia.competitionAdmissionStatus, "UNREGISTERED");
  assert.equal(malaysia.slatePredictionStatus, "NOT_PREGAME_ELIGIBLE");
  assert.equal(malaysia.researchUsageEligibility, "NOT_PREGAME_ELIGIBLE");

  const arsenal = doc.games.find((g) => g.rowId === 2);
  assert.ok(arsenal);
  assert.equal(arsenal.slateResearchStatus, "PASS_UNSUPPORTED_COMPETITION");
  assert.equal(arsenal.slatePredictionStatus, "NOT_SUPPORTED_COMPETITION");

  const espanyol = doc.games.find((g) => g.rowId === 9);
  assert.ok(espanyol);
  assert.equal(espanyol.competitionAdmissionStatus, "REGISTERED");
  assert.equal(espanyol.slatePredictionStatus, "NOT_EVALUATED");
  assert.equal(espanyol.researchUsageEligibility, "FUTURE_RESEARCH_ELIGIBLE");

  const obs = JSON.parse(
    readFileSync(
      "data/operator-observations/structured/2026-08-16/batch-2207-football-manual-market-observation-v0.json",
      "utf8",
    ),
  ) as { games: Array<{ rowId: number; markets: Array<{ prices: unknown }> }> };
  for (const game of doc.games) {
    const src = obs.games.find((g) => g.rowId === game.rowId);
    assert.ok(src);
    assert.deepEqual(
      game.markets.map((m) => m.prices),
      src.markets.map((m) => m.prices),
    );
  }

  assert.equal(
    FOOTBALL_SNAPSHOT_MATCH_STATUSES.includes(
      "PASS_UNSUPPORTED_COMPETITION" as never,
    ),
    false,
  );

  const dropped = normalizeFixtureToScheduleRow({
    dateKst: "2026-08-16",
    provider: "api-football",
    fixture: {
      fixture: { id: 1, date: "2026-08-16T13:00:00+09:00" },
      league: { id: 88, name: "Eredivisie", season: 2026 },
      teams: {
        home: { id: 194, name: "Ajax" },
        away: { id: 210, name: "Heerenveen" },
      },
    },
  });
  assert.deepEqual(dropped, { drop: "UNREGISTERED_COMPETITION" });

  const blocked = deriveSlateStatuses({ registered: false, cutoffBlocked: true });
  assert.equal(blocked.slatePredictionStatus, "NOT_PREGAME_ELIGIBLE");
  const unsupported = deriveSlateStatuses({
    registered: false,
    cutoffBlocked: false,
  });
  assert.equal(unsupported.slateResearchStatus, "PASS_UNSUPPORTED_COMPETITION");

  void sha256File;
  console.log("FOOTBALL_OBSERVED_SLATE_V0_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
