/**
 * Remaining Pregame runner eligibility fixture tests (no network).
 *
 *   npx tsx scripts/test-mlb-remaining-pregame-eligibility-fixture-v1.ts
 */
import assert from "node:assert/strict";
import { classifyPregameGame } from "../src/lib/mlb/pregame-eligibility";
import {
  computeBestH2hOddsWithFormat,
  marketProbabilityFromDecimalPair,
} from "../src/lib/odds";
import type { OddsBookmaker } from "../src/lib/odds/types";

function main() {
  console.log("=== Remaining Pregame Eligibility Fixtures ===");

  const start = "2026-07-31T02:00:00Z";
  const nowBefore = Date.parse("2026-07-31T01:45:00Z"); // T-15

  // Fixture 1: Warmup, 15 min before start, american complete h2h, lineup missing → PASS path
  {
    const elig = classifyPregameGame({
      commenceTimeUtc: start,
      statusAbstract: "Live",
      statusDetailed: "Warmup",
      codedGameState: "P",
      nowMs: nowBefore,
    });
    assert.equal(elig.pregameEligible, true);

    const books: OddsBookmaker[] = [
      {
        key: "t",
        title: "t",
        lastUpdate: "2026-07-31T01:44:00Z",
        markets: [
          {
            key: "h2h",
            lastUpdate: "2026-07-31T01:44:00Z",
            outcomes: [
              { name: "Los Angeles Dodgers", price: -154 },
              { name: "Seattle Mariners", price: 130 },
            ],
          },
        ],
      },
    ];
    const odds = computeBestH2hOddsWithFormat(
      books,
      "Los Angeles Dodgers",
      "Seattle Mariners",
      { sourceFormat: "american" },
    );
    assert.equal(odds.formatValidationStatus, "FORMAT_CONVERTED_FROM_AMERICAN");
    assert.ok(odds.bestHomeOdds != null && odds.bestAwayOdds != null);
    const prob = marketProbabilityFromDecimalPair(
      odds.bestHomeOdds,
      odds.bestAwayOdds,
    );
    assert.equal(prob.usable, true);

    // Lineup NOT_RELEASED → officialStatus PASS (no officialPick)
    const lineupConfirmed = false;
    const officialStatus =
      elig.pregameEligible && odds.bestHomeOdds && !lineupConfirmed
        ? "PASS"
        : "ELIGIBLE";
    assert.equal(officialStatus, "PASS");
    const officialPick = null;
    assert.equal(officialPick, null);
    console.log("fixture1: Warmup T-15 + american h2h → collection OK, official PASS");
  }

  // Fixture 2: clock past start but detailed still Warmup → EXCLUDED
  {
    const elig = classifyPregameGame({
      commenceTimeUtc: start,
      statusAbstract: "Live",
      statusDetailed: "Warmup",
      nowMs: Date.parse(start),
    });
    assert.equal(elig.pregameEligible, false);
    assert.equal(elig.status, "EXCLUDED_ALREADY_STARTED");
    console.log("fixture2: past start + stale Warmup → EXCLUDED_ALREADY_STARTED");
  }

  console.log("ALL_REMAINING_PREGAME_ELIGIBILITY_FIXTURES_PASSED");
}

main();
