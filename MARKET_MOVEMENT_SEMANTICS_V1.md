# Market Movement Semantics v1

Companion to [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md).

**Status:** Semantics candidates only. No movement calculation, no Steam/RLM auto-labeling, no Engine mapping.

---

## 1. Purpose

Define vocabulary for describing **price changes on a fixed market key** without claiming that movement causes wins or reflects “smart money.”

---

## 2. Movement count (definition candidate)

Compute only inside an identical key:

```text
game + provider + bookmaker + market + period + line + selection
```

Rules:

- Count +1 only when `oddsDecimal` **actually changes** vs previous snapshot in that key.
- Identical odds repeated → movement 0.
- Bookmaker `lastUpdate` changes but odds unchanged → movement 0.
- Do not mix bookmakers or lines in one count series.

**Not implemented in this mission.**

---

## 3. Movement direction (candidates)

| Code | Meaning (price language) |
|------|---------------------------|
| `SHORTENED` | Decimal odds decreased (price shortened) |
| `DRIFTED` | Decimal odds increased (price lengthened) |
| `UNCHANGED` | No odds change |
| `REVERSAL` | Direction flipped vs prior move segment (candidate) |
| `FLIPPED_FAVORITE` | Favorite/underdog role flipped on moneyline (candidate) |
| `UNKNOWN` | Cannot classify |

### Allowed phrasing

- “시장 가격이 짧아짐”
- “시장 가격이 길어짐”

### Forbidden phrasing

- 승률 상승 확정
- 전문가 확신 증가 확정
- 자금 유입을 사실로 단정

Decimal odds drop implies **implied probability up** under a fixed conversion assumption — still **not** equal to true win probability.

---

## 4. Movement speed (status: unset)

Candidate inputs only:

- odds delta
- elapsed minutes
- snapshot count
- time-to-start

Candidate metrics (formulas **not fixed**):

- `absoluteOddsChangePerHour`
- `relativeOddsChangePercentPerHour`
- `lateMoveWindowMinutes`

Leakage risks:

- Using POST_START snapshots
- Using final start time to re-bucket past moves without audit
- Comparing unequal lines/markets

---

## 5. Consensus (status: formula not selected)

Allowed only after raw bookmaker odds preserved.

Candidates: median · mean · weighted · best · worst · bookmaker count · dispersion.

**`AGGREGATE_BEST` ≠ Consensus.**

---

## 6. CLV research boundary

CLV is a **future research candidate**, not a shipped metric.

Needs:

- prediction decision time
- odds available at decision time
- `latestPreGame` odds
- same market
- same bookmaker **or** an explicit consensus policy
- `marketRuleStatus = VERIFIED`

Forbidden:

- picking bookmaker after seeing result
- cross-market / cross-line compares
- labeling non-official Closing as Closing

Field name for latest pre-game: `latestPreGameSnapshot` — never `closingOdds`.

---

## 7. Labels reserved (not auto-classified)

From coverage audit — candidates only, not facts:

`ODDS_SHORTENING` · `ODDS_DRIFTING` · `FAVORITE_FLIP` · `UNDERDOG_TO_FAVORITE` · `REVERSAL` · `LATE_MOVE` · `EARLY_MOVE` · `CONSENSUS_MOVE` · `BOOKMAKER_DIVERGENCE` · `STEAM_MOVE_CANDIDATE` · `REVERSE_LINE_MOVEMENT_CANDIDATE`

No automatic Steam / Reverse Line Movement detection in v1 design.

---

## 8. Engine rule

No movement feature may enter Engine weights without:

- verified market rules
- licensed storage
- sufficient sample
- backtest evidence
- Charter Evidence First gate
