# YANG EDGE Feature Utilization Matrix v1

Audit only. Stages:

1. Provider / repository has the data  
2. Dataset stored  
3. Pregame feature object  
4. Used in frozen Prediction probability  

`UNKNOWN` means repository code does not prove the provider contract’s full field list.

Independent Statistical Model uses none of the “stored only” sports layers below. Sample = **0**.

---

## MLB

| Category | Data | Provider / Source | Collected | Stored | Feature | Prediction | Gap |
|---|---|---|---|---|---|---|---|
| A. Starter | ERA | MLB Stats API gameLog → starter-dataset-v1 | Y | Y | Y | **Y** | Used in v0 `starterScoreFromStats` and legacy `pitcherQuality`. |
| A. Starter | WHIP | same | Y | Y | Y | **Y** | Same. |
| A. Starter | IP / sample shrink | starter-dataset-v1 `inningsPitched` | Y | Y | Y | **Y** | v0 shrink toward league ERA 4.1 / WHIP 1.3. Not a workload model. |
| A. Starter | K, BB counts | seasonStats; copied to `StarterFeature` | Y | Y | Y | N | `starterScoreFromStats` ignores K/BB. |
| A. Starter | Throws | starter-dataset-v1 | Y | Y | Y | N | Unused in logit. |
| A. Starter | Recent starts / pitch counts | `recentStarts[]` | Y | Y | N | N | Dataset only. v0 does not read the array. |
| A. Starter | W/L, GS, HR count | seasonStats | Y | Y | N | N | Stored. Unused. |
| A. Starter | FIP | none in types | N | N | N | N | Absent. |
| A. Starter | xFIP / xERA | none | N | N | N | N | Absent. |
| A. Starter | K% / BB% / K-BB% | none as rates | N | N | N | N | Absent. |
| A. Starter | HR/9 / GB% | none | N | N | N | N | HR count stored, no rate feature. |
| A. Starter | Pitch mix / velo / pitch value / whiff% / CSW% | none | N | N | N | N | No pitch-tracking artifacts. |
| B. Batter | AVG / OBP / SLG / OPS / ISO | none | N | N | N | N | Absent. Dummy UI copy is not evidence. |
| B. Batter | wOBA / wRC+ | none | N | N | N | N | No matches in `src/`. |
| B. Batter | K% / BB% / vs LHP / vs RHP / recent form | none | N | N | N | N | Absent. |
| B. Batter | Batting-order quality | lineup slot number only | Y | Y | N | N | Slot stored; not a strength feature. |
| C. Lineup | Confirmed 1–9 identity | MLB Stats API → lineup-dataset-v1 | Y | Y | Y | N | Completeness + confirmed flag. Weight = 0. |
| C. Lineup | Handedness | not in `LineupBatterRow` | N | N | N | N | Fields: slot, playerId, playerName, defensivePosition. |
| C. Lineup | Key absence / replacement delta | none | N | N | N | N | Injury dataset is separate and unused. |
| C. Lineup | Weighted lineup / platoon / vs starter | none | N | N | N | N | Absent. |
| D. Bullpen | Role / closer-setup / fatigue / back-to-back / pitch counts | bullpen-role-dataset-v1_1 (July sample dates) | Y | Y | N | N | `buildDisabledBullpenFeature`. Weight = 0. |
| D. Bullpen | Handedness splits | not used even if appearances exist | UNKNOWN | UNKNOWN | N | N | Role dataset classifies roles; not a prediction feature. |
| E. Defense | Team/player defensive metrics | none dedicated | N | N | N | N | Legacy “defense” = concededAvg when AnalysisData populated. Consumer currently NaN. |
| F. Baserunning | SB / CS / BsR | none | N | N | N | N | Absent. |
| G. Team form | Travel / rest | travel-rest-dataset-v1 (July samples) | Y | Y | N | N | engineAdmission PROHIBITED. Not loaded by v0. |
| G. Team form | Recent form / standings / H2H / scoring | early baseline-analysis; consumer placeholders | partial | partial | partial | N* | *Used on 2026-07-27 legacy snapshot usedFactors; not used by v0. |
| H. Context | Weather forecast | weather-dataset-v1 | N | Y (venue) | N | N | `provider.selected=null`. Forecast `NOT_COLLECTED`. |
| H. Context | Park factor | none | N | N | N | N | Absent. |
| H. Context | Home advantage | v0 constant 0.08 | N | N | Y | **Y** | Not park-specific. |
| I. Market | De-vig moneyline | The Odds API → odds-history-dataset-v1 | Y | Y | Y | **Y (v0)** / display (legacy) | Probability input in v0. |
| I. Market | Run line / totals | odds-history normalized markets | Y | Y | N | N | `NOT_IMPLEMENTED` for prediction. |
| I. Market | Odds movement | odds-history movement | Y | Y | N | N | Snapshot field only. |
| I. Market | Book consensus distribution | AGGREGATE_BEST price | Y | Y | Y | via prior | Not a movement/consensus model beyond best/aggregate h2h. |

SportsDataIO MLB provider code exists (`getGames`, lineups, injuries). Research starter/lineup/injury builders use **MLB Stats API**. 2026-07-27 baseline-analysis records `sportsDataIoUsed: false`. SportsDataIO scrambled-trial fields are not a prediction source.

---

## Football

| Category | Data | Provider / Source | Collected | Stored | Feature | Prediction | Gap |
|---|---|---|---|---|---|---|---|
| A. Starting XI | Confirmed 11 | API-Football `GET /fixtures/lineups` | method exists | N | N | N | Schedule builder uses fixtures only. |
| A. Starting XI | Position value / replacement | none | N | N | N | N | Absent. |
| B. Availability | Injuries | API-Football `GET /injuries` | method exists | N | N | N | Not a research dataset. Unused by market baseline. |
| C. Attack | Goals / xG / npxG / shots / SoT / xA | `getTeamStatistics` raw unknown | UNKNOWN | N | N | N | Raw envelope not persisted as typed metrics. |
| D. Midfield | Key passes / progressive passes / PPDA | none in artifacts | N | N | N | N | Dummy UI mention of PPDA is not collection. |
| E. Defense | Tackles / interceptions / xGA | none | N | N | N | N | Absent. |
| F. GK | Save% / PSxG-GA | none | N | N | N | N | Absent. |
| G. Team advanced | xGD / possession / field tilt | none | N | N | N | N | Absent. |
| H. Tactical | Formation / matchup | lineups unused | N | N | N | N | Absent. |
| I. Schedule / rest | Kickoff, venue, competition, identity | API-Football fixtures → schedule-v1 | Y | Y | cutoff only | N as strength | Freeze window / eligibility, not team quality. |
| J. Market | 1x2 median de-vig | The Odds API → football-1x2-odds-v1 | Y | Y | Y | **Y** | Argmax = the prediction. |

API-Football full commercial field catalog: **UNKNOWN** (repository only shows the endpoints we call: fixtures, fixture-by-id, standings, team statistics, injuries, lineups).

The Odds API request default is `markets=h2h`. Additional Odds API markets not requested: **UNKNOWN**.

---

## Provider utilization gap (compact)

| Sport | Data | Provider | Collected | Stored | Feature | Prediction | Gap |
|---|---|---|---|---|---|---|---|
| MLB | Probable starter identity + ERA/WHIP/IP/K/BB/HR/recent | MLB Stats API | Y | Y | ERA/WHIP/IP | ERA/WHIP/IP only | K/BB/HR/recent unused. |
| MLB | Confirmed lineup identity | MLB Stats API | Y | Y | completeness | N | Weight 0. |
| MLB | Bullpen appearances / roles | MLB Stats API | sample dates | Y | N | N | Disabled. |
| MLB | 40-man / IL transactions | MLB Stats API | sample dates | Y | N | N | Not in prediction. |
| MLB | Venue roof type | weather dataset | Y (venue) | Y | N | N | Forecast not collected. |
| MLB | Travel / rest | schedule-derived | sample dates | Y | N | N | Not in prediction. |
| MLB | Moneyline + RL + totals | The Odds API | Y | Y | ML | ML only (v0 prior) | RL/totals collect-only. |
| MLB | Games / lineups / injuries API | SportsDataIO | code exists | not research SoT | N | N | Not used by current research datasets. |
| Football | Fixtures | API-Football | Y | Y (schedule) | identity | N | No strength model. |
| Football | Lineups / injuries / standings / team stats | API-Football | methods exist | N | N | N | Unused by prediction. |
| Football | 1x2 odds | The Odds API | Y | Y | Y | **Y** | Entire football prediction. |

---

## Reading rule

If a row is `Prediction = N`, it must not be described as “YANG EDGE used this to predict.”

If a row is `Prediction = Y` and the source is market probability, it is **not** Independent Sports Research.
