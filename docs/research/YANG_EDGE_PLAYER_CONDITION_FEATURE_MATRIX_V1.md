# YANG EDGE Player Condition Feature Matrix v1

Highest stage per feature (repository + local Stats API cache evidence). Cache is gitignored; observed keys are frozen in the audit JSON.

Stages: `PREDICTION_USED` > `FEATURE_READY` > `STORED` > `AVAILABLE_PROVIDER` > `UNKNOWN` / `NOT_AVAILABLE` / `NEEDS_PROVIDER_DOC_REVIEW`.

| Sport | Category | Feature | Provider | Stored | Pregame Safe | Sample Concern | Future Research |
|---|---|---|---|---|---|---|---|
| MLB | Batter base | PA/AB/H/HR/BB/SO (box batting) | Stats API boxscore raw | N | UNKNOWN | Pregame box batting may be empty | Persist cutoff-clean hitting gameLog |
| MLB | Batter base | AVG / OBP / SLG / OPS / ISO | hitting endpoints not fetched | N | UNKNOWN | Small PA | Fetch group=hitting; ISO only after SLG/AVG |
| MLB | Batter base | wOBA / wRC+ | not in observed payloads | N | UNKNOWN | Advanced weights | Separate documented source |
| MLB | Batter base | K% BB% HR% BABIP | not stored; counts only in raw box | N | UNKNOWN | BABIP unstable | Store counts + sampleSize first |
| MLB | Batter base | batSide | /people batSide; expected-lineup bats | N (confirmed) | Y | Identity | Join onto lineup slots |
| MLB | Batter matchup | vs L/R platoon | statSplits not called | N | UNKNOWN | Classic small sample | Shrink to player baseline; no specialist label |
| MLB | Batter matchup | pitch-type splits | not in gameLog keys | N | UNKNOWN | Extremely sparse | Needs pitch-level source |
| MLB | Batter recent | 7/14/30 day hitting | hitting gameLog not fetched | N | Y | Often <20 PA | Window + sampleSize required |
| MLB | Batter recent | hard-hit% / barrel% | not observed | N | UNKNOWN | Statcast | Do not proxy with AVG |
| MLB | Lineup | confirmed 1–9 identity | boxscore / hydrate=lineups | **Y** | Y | Identity ≠ strength | Join strength later; weights UNDEFINED |
| MLB | Lineup | expected 1–9 | operator observation v0 | **Y** | Y | Expected ≠ confirmed | Never auto-promote |
| MLB | Lineup | weighted wOBA/OPS, replacementDelta, platoon counts | missing batter strength + bats | N | Y | Fake lineup score risk | Slot schema first |
| MLB | Starter | ERA / WHIP | pitching gameLog | **Y** | Y | IP shrink already in v0 | Base rate, not whole pitcher |
| MLB | Starter | IP GS W L SO BB HR | pitching gameLog | **Y** | Y | W/L noisy | Derive K/9 HR/9 from stored counts |
| MLB | Starter | throws | people.pitchHand | **Y** | Y | Identity | Platoon matrix |
| MLB | Starter | BF, K/9, BB/9, HR/9, GO-AO, strike%, P/Inn | raw gameLog keys observed | N | Y | Per-start noise | Parse keys already in cache |
| MLB | Starter | FIP xFIP xERA SIERA | not in observed keys | N | UNKNOWN | Do not invent FIP constants | Provider-doc before any derived FIP |
| MLB | Starter | velo / pitch mix / CSW / whiff | not in observed keys | N | UNKNOWN | Pitch-level | New source |
| MLB | Starter condition | recent 3/5 starts | recentStarts[] | **Y** | Y | 3 starts is tiny | Unused by prediction-v0 |
| MLB | Starter condition | rest / velo decline | lastOutingDate only | partial | Y | Team rest ≠ pitcher rest | Pitcher rest from last start |
| MLB | Pitcher×lineup | throws × bats cells | bats not on confirmed lineup | N | Y | 9 flags ≠ 9 edges | Join batSide; no P() this mission |
| MLB | Pitcher×lineup | repertoire × pitch-type | pitch-type absent | N | UNKNOWN | Cell n often <10 | Blocked |
| MLB | Bullpen | identity, role, fatigue | bullpen-role-dataset-v1_1 | **Y** (July) | Y | INSUFFICIENT_SAMPLE already coded | Availability × workload; weight UNDEFINED |
| MLB | Bullpen | reliever FIP / platoon | not on classified rows | N | UNKNOWN | Tiny n | Role+workload first |
| MLB | Availability | IL listed (D* 40-man) | injury-dataset-v1 | **Y** (July) | Y | Listed ≠ limited minutes | Map to INJURED vs LIMITED |
| MLB | Environment | dayNight | schedule raw | N | Y | Split PA | Persist on schedule |
| MLB | Environment | temp/wind/rain | forecast NOT_COLLECTED | N | UNKNOWN | Interaction only | Select weather provider later |
| MLB | Environment | roof type | venue fieldInfo | **Y** (July) | Y | Type ≠ open/closed | roofStatus stays UNKNOWN |
| MLB | Environment | turf / dimensions / elevation | venue cache | N | Y | Park effects are park-specific | Store, do not score |
| MLB | Environment | park factor | none | N | UNKNOWN | Needs dated source | Absent |
| MLB | Environment | team travel/rest | travel-rest-dataset-v1 | **Y** (July) | Y | Team ≠ player | Player rest from appearances |
| Football | Player | minutes/xG/xA/shots/def/GK PSxG | `/players` not wired | N | UNKNOWN | xG field names unknown | NEEDS_PROVIDER_DOC_REVIEW |
| Football | Condition | minutes last 3/5, return from injury | unused methods | N | Y | Available ≠ 100% fit | Separate status vs load |
| Football | XI | confirmed 11 | getLineups wired | N | Y | Identity without replacement | Typed lineup dataset |
| Football | XI | XI strength / replacementDelta | no player base | N | Y | Do not fake an XI score | Slot design first |
| Football | Matchup | positional / formation | lineups raw untyped | N | UNKNOWN | Tactical labels overfit | Formation if present later |
| Football | Environment | rest/home-away | kickoff stored | partial | Y | Team rest until minutes | Derive from schedule |
| Football | Environment | weather/travel/surface | not collected | N | UNKNOWN | No lone weather weight | Reuse MLB pattern later |
| Football | Availability | injuries | getInjuries wired | N | Y | Provider injury ≠ restriction | Typed dataset |
| Basketball | Common | minutes/usage/B2B/travel | not wired | N | UNKNOWN | B2B first-class later | Reuse shells |
| Volleyball | Common | rotation / lineup combo | not wired | N | UNKNOWN | Combo = batting-order analog | Reuse slot + replacementDelta |

Machine-readable copy: `data/audits/yang-edge-player-condition-feature-audit-v1.json`.
