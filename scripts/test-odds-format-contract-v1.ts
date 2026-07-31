/**
 * Odds format contract + moneyline completeness regression tests.
 *
 *   npx tsx scripts/test-odds-format-contract-v1.ts
 */
import assert from "node:assert/strict";
import {
  americanToDecimal,
  computeBestH2hOddsWithFormat,
  marketProbabilityFromDecimalPair,
  normalizeOddsPrice,
} from "../src/lib/odds";
import type { OddsBookmaker } from "../src/lib/odds/types";
import { classifyPregameGame } from "../src/lib/mlb/pregame-eligibility";

function book(
  home: string,
  away: string,
  homePrice: number,
  awayPrice: number,
): OddsBookmaker[] {
  return [
    {
      key: "test",
      title: "Test",
      lastUpdate: "2026-07-31T01:00:00Z",
      markets: [
        {
          key: "h2h",
          lastUpdate: "2026-07-31T01:00:00Z",
          outcomes: [
            { name: home, price: homePrice },
            { name: away, price: awayPrice },
          ],
        },
      ],
    },
  ];
}

function nearly(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `expected ${b} got ${a}`);
}

function main() {
  console.log("=== Odds Format Contract Tests ===");

  // American positive +172 → 2.72
  {
    const r = normalizeOddsPrice({ price: 172, sourceFormat: "american" });
    assert.equal(r.conversionStatus, "CONVERTED");
    nearly(r.decimalPrice!, 2.72);
  }

  // American negative -200 → 1.50
  {
    const r = normalizeOddsPrice({ price: -200, sourceFormat: "american" });
    assert.equal(r.conversionStatus, "CONVERTED");
    nearly(r.decimalPrice!, 1.5);
  }

  // Decimal unchanged
  {
    const r = normalizeOddsPrice({ price: 1.91, sourceFormat: "decimal" });
    assert.equal(r.conversionStatus, "ALREADY_DECIMAL");
    nearly(r.decimalPrice!, 1.91);
  }

  // Unknown format → no market use
  {
    const r = normalizeOddsPrice({ price: 172, sourceFormat: "unknown" });
    assert.equal(r.conversionStatus, "UNKNOWN_FORMAT");
    assert.equal(r.decimalPrice, null);
  }

  // Declared decimal but american negative → FORMAT_MISMATCH
  {
    const r = normalizeOddsPrice({ price: -175, sourceFormat: "decimal" });
    assert.equal(r.conversionStatus, "FORMAT_MISMATCH");
    assert.equal(r.decimalPrice, null);
  }

  // Complete h2h american → COLLECTED decimals
  {
    const r = computeBestH2hOddsWithFormat(
      book("San Diego Padres", "San Francisco Giants", -175, 152),
      "San Diego Padres",
      "San Francisco Giants",
      { sourceFormat: "american" },
    );
    assert.equal(r.formatValidationStatus, "FORMAT_CONVERTED_FROM_AMERICAN");
    nearly(r.bestHomeOdds!, americanToDecimal(-175)!);
    nearly(r.bestAwayOdds!, americanToDecimal(152)!);
    assert.equal(r.homeOutcomePresent, true);
    assert.equal(r.awayOutcomePresent, true);
  }

  // Declared decimal with american payload → FORMAT_MISMATCH (do not hide as outcome missing)
  {
    const r = computeBestH2hOddsWithFormat(
      book("Athletics", "Boston Red Sox", 155, -200),
      "Athletics",
      "Boston Red Sox",
      { sourceFormat: "decimal" },
    );
    assert.equal(r.formatValidationStatus, "FORMAT_MISMATCH");
    assert.ok(r.partialReasons.includes("FORMAT_MISMATCH"));
    assert.equal(r.bestHomeOdds, null);
    assert.equal(r.bestAwayOdds, null);
  }

  // Partial h2h — one outcome only
  {
    const books: OddsBookmaker[] = [
      {
        key: "test",
        title: "Test",
        lastUpdate: "2026-07-31T01:00:00Z",
        markets: [
          {
            key: "h2h",
            lastUpdate: "2026-07-31T01:00:00Z",
            outcomes: [{ name: "Athletics", price: 2.72 }],
          },
        ],
      },
    ];
    const r = computeBestH2hOddsWithFormat(
      books,
      "Athletics",
      "Boston Red Sox",
      { sourceFormat: "decimal" },
    );
    assert.equal(r.bestHomeOdds, 2.72);
    assert.equal(r.bestAwayOdds, null);
    assert.ok(r.partialReasons.includes("AWAY_OUTCOME_MISSING"));
  }

  // Probability guard — one sided
  {
    const p = marketProbabilityFromDecimalPair(2.72, null);
    assert.equal(p.usable, false);
    assert.equal(p.homePct, null);
  }

  // Probability guard — both sides
  {
    const p = marketProbabilityFromDecimalPair(1.5714, 2.52);
    assert.equal(p.usable, true);
    assert.ok(p.homePct != null && p.homePct > 0 && p.homePct < 100);
  }

  // Cutoff / Warmup eligibility
  {
    const start = "2026-07-31T01:40:00Z";
    const before = Date.parse("2026-07-31T01:28:00Z");
    const after = Date.parse("2026-07-31T01:40:00Z");
    const ok = classifyPregameGame({
      commenceTimeUtc: start,
      statusAbstract: "Live",
      statusDetailed: "Warmup",
      nowMs: before,
    });
    assert.equal(ok.pregameEligible, true);
    const blockedClock = classifyPregameGame({
      commenceTimeUtc: start,
      statusAbstract: "Live",
      statusDetailed: "Warmup",
      nowMs: after,
    });
    assert.equal(blockedClock.pregameEligible, false);
    assert.equal(blockedClock.status, "EXCLUDED_ALREADY_STARTED");
  }

  console.log("ALL_ODDS_FORMAT_CONTRACT_TESTS_PASSED");
}

main();
