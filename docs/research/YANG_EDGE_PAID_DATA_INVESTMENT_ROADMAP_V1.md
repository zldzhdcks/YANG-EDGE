# YANG EDGE Paid Data Investment Roadmap v1

Recommendation: **HOLD new purchases**. Build unused endpoints first.

Independent model sample stays **0**. No Engine admission from this document.

---

## Principle

Spend is justified only after:

1. Pregame dataset exists  
2. Historical as-of reconstruction works  
3. Sample reliability is measured  
4. Hypothesis + backtest + OOS + calibration  

“wRC+ looks important” is not a purchase order.

---

## Build vs buy (this audit)

**Build / derive without a new vendor**

- MLB batter gameLog + batSide join + lineup playerId
- MLB FIP/xFIP/wOBA/wRC+ via `sabermetrics`
- MLB vs L/R and day/night via `statSplits`
- MLB pitch mix + average velocity via `pitchArsenal`
- MLB K-BB% from BF already in pitching cache
- Football typed XI + injuries from methods already in `ApiFootballProvider`
- Football minutes/goals/shots/key passes/tackles from documented `/players`
- Football team W/D/L/goals/form from `/teams/statistics`
- Football team rest from schedule kickoffs

**Buy later (not now)**

- Statcast Barrel% / EV / LA / spin / CSW / pitch run value  
- Football xG / xA / PSxG / PPDA / field tilt  

**Not currently feasible**

- Scraping Baseball Savant / FBref  
- Using SportsDataIO trial scrambled data  
- Treating Odds API as player strength  

SportsDataIO dictionary duplicates some saber counting (wOBA, FIP) that Stats API already returns. Paying SportsDataIO **only** for those fields is low incremental value while Stats API is research SoT.

---

## Incremental value of current connected providers

| Provider | What we pay/connect for today | Unused value | Buy more? |
|---|---|---|---|
| MLB Stats API | Starter ERA/WHIP, lineup identity, July bullpen/IL | Hitting, saber, splits, arsenal | No (already public) |
| API-Baseball | MLB/KBO schedule identity | Player stats endpoint missing | Do not upgrade for batter stats |
| SportsDataIO | Code path; research unused | Lineups/injuries/weather marketing | HOLD until Stats API gaps are closed |
| API-Football | Fixtures → schedule | Lineups, injuries, players, team stats | HOLD purchase; wire unused endpoints with quota budget |
| Odds API | Market benchmark | Historical odds (paid) | HOLD (prior business audit) |
| Weather | None selected | Forecast | HOLD; P3 |

---

## Suggested spend sequence (research, not Engine)

1. **Zero incremental license:** persist Stats API hitting + saber + splits + arsenal as research datasets (cutoff-safe).  
2. **Zero incremental license if current API-Football key already covers endpoints:** typed XI + injuries + `/players` with a **daily quota cap**. Confirm plan via `/status` in a later operator-approved one-call (not done here).  
3. **Only then** write a purchase brief for Statcast-class or xG — with sample-size policy and license review attached.

No plan change, no bulk backfill, and no Engine weight in this mission.
