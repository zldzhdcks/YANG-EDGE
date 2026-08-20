# YANG EDGE Provider Data Gap Matrix v1

Machine-readable SoT: `data/audits/yang-edge-provider-capability-audit-v1.json`.

Columns: Available = provider-side verdict. **Stored / Pregame dataset / Feature ready / Prediction used** are YANG EDGE utilization.

Current paid/connected plans: **CURRENT_PLAN_UNKNOWN** except MLB Stats API (public, no plan).

| Sport | Feature | Provider | Available | Plan known | Stored | Pregame DS | Feature ready | Pred. used | Ev | Gap |
|---|---|---|---|---|---|---|---|---|---|---|
| MLB | PA/AB/H/HR/RBI/BB/SO | Stats API hitting gameLog | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Unused endpoint |
| MLB | AVG/OBP/SLG/OPS | Stats API hitting gameLog | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Unused endpoint |
| MLB | ISO | seasonAdvanced / derive | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Unused |
| MLB | BABIP K% BB% | gameLog + advanced | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Unused |
| MLB | wOBA wRC+ | sabermetrics hitting | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Unused saber |
| MLB | OPS+ | — | UNKNOWN | — | N | N | N | N | D | Not observed |
| MLB | HardHit Barrel EV LA | tracking empty | NOT_AVAILABLE | Y | N | N | N | N | B | Buy Statcast-class later |
| MLB | expected avg/slg/woba | expectedStatistics | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Don't rename to xwOBA |
| MLB | batSide | /people | AVAILABLE_CURRENT_PROVIDER | Y | N | N | N | N | B | Not joined to lineup |
| MLB | vs L/R home away day night | statSplits | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Need sampleSize=PA |
| MLB | last 7/30 / l10 | sitCodes / lastXGames | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | A/C | Body of lastXGames not probed |
| MLB | batter vs pitch type | pitchLog unverified | UNKNOWN | Y | N | N | N | N | C | Not gameLog |
| MLB | ERA WHIP IP K BB HR | pitching gameLog | STORED_ALREADY | Y | **Y** | **Y** | **Y** | **ERA/WHIP** | B | K/BB/HR unused in logit |
| MLB | K/9 BF K-BB% | raw pitching gameLog | AVAILABLE_CURRENT_PROVIDER | Y | N | N | N | N | B | Keys already cached |
| MLB | FIP xFIP | sabermetrics pitching | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | Unused |
| MLB | SIERA named xERA | — | NOT_AVAILABLE | Y | N | N | N | N | B | Don't alias xfip |
| MLB | pitch mix + avg velo | pitchArsenal | AVAILABLE_DIFFERENT_ENDPOINT | Y | N | N | N | N | B | FF/SI/FC/SL/ST/CU/CH |
| MLB | spin CSW RV | — | NOT_AVAILABLE | Y | N | N | N | N | B | Beyond arsenal |
| MLB | recent 3/5 starts | recentStarts[] | STORED_ALREADY | Y | **Y** | **Y** | N | N | B | Unused by v0 |
| MLB | bullpen role+fatigue | bullpen-role-dataset | STORED_ALREADY | Y | **Y** | **Y** | N | N | B | July only; weight 0 |
| MLB | confirmed 1–9 | lineup-dataset | STORED_ALREADY | Y | **Y** | **Y** | completeness | N | B | No batter join |
| MLB | expected lineup | operator v0 | STORED_ALREADY | Y | **Y** | **Y** | N | N | B | Not confirmed |
| MLB | SDIO lineups | SportsDataIO | AVAILABLE_CURRENT_PROVIDER | UNKNOWN | N | N | N | N | C | Not SoT; ID map |
| MLB | IL listed | injury-dataset | STORED_ALREADY | Y | **Y** | **Y** | N | N | B | July |
| MLB | dayNight | schedule raw | AVAILABLE_CURRENT_PROVIDER | Y | N | N | N | N | B | Not on schedule-v1 |
| MLB | roof / elevation | venues | STORED / cache | Y | partial | partial | N | N | B | roofStatus UNKNOWN |
| MLB | forecast weather | none selected | NOT_AVAILABLE | UNKNOWN | N | N | N | N | B | Not postgame weather |
| MLB | park factor | — | NOT_AVAILABLE | Y | N | N | N | N | B | Don't invent |
| FB | XI + formation | /fixtures/lineups | AVAILABLE_CURRENT_PROVIDER | UNKNOWN | N | N | N | N | A | Method unused |
| FB | injuries | /injuries | AVAILABLE_CURRENT_PROVIDER | UNKNOWN | N | N | N | N | A | Method unused |
| FB | minutes goals shots | /players | AVAILABLE_DIFFERENT_ENDPOINT | UNKNOWN | N | N | N | N | A | Not wired |
| FB | xG xA | — | NOT_AVAILABLE | UNKNOWN | N | N | N | N | A | Other provider later |
| FB | key passes tackles | /players | AVAILABLE_DIFFERENT_ENDPOINT | UNKNOWN | N | N | N | N | A | Not wired |
| FB | progressive / PPDA | — | NOT_AVAILABLE | UNKNOWN | N | N | N | N | A | Not documented |
| FB | team W/D/L goals form | /teams/statistics | AVAILABLE_CURRENT_PROVIDER | UNKNOWN | N | N | N | N | A | Raw unused |
| FB | team xG PPDA | — | NOT_AVAILABLE | UNKNOWN | N | N | N | N | A | Other provider later |
| FB | rest days | schedule derive | STORED kickoff only | UNKNOWN | partial | Y | N | N | B | Not derived |
| FB | 1x2 market | Odds API | STORED_ALREADY | UNKNOWN | **Y** | **Y** | **Y** | **Y** | A | Forbidden in Independent P |
| NBA | minutes/B2B | API-NBA | NEEDS_PROVIDER_DOC_REVIEW | UNKNOWN | N | N | N | N | C | Not wired |
| Vball | rotation/lineup | API-Volleyball | NEEDS_PROVIDER_DOC_REVIEW | UNKNOWN | N | N | N | N | D | Not wired |

Utilization summary: connected paid APIs currently feed **identity + odds**. Player advanced stats that we can already receive from Stats API / API-Football are **mostly not stored**.
