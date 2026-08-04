# Football Foundation Pre-Design Audit v0

**결론:** `FOOTBALL_FOUNDATION_AUDIT_COMPLETE`  
**범위:** Design / Audit only — Prediction · Engine · Weight · Model · Dataset Schema · Pipeline · Provider Call **금지**  
**생성일:** 2026-08-04  
**목적:** MLB에서 발생한 운영 실패(Artifact≠Usable, Kickoff 후 Prediction, Invalid Pregame 표본 오염)를 Football에서 처음부터 차단한다.

관련 선행 문서:
- [SOCCER_RESEARCH_PIPELINE_V1_DESIGN.md](./SOCCER_RESEARCH_PIPELINE_V1_DESIGN.md)
- [MLB_KBO_SOCCER_COMMON_DIFFERENCE_AUDIT.md](./MLB_KBO_SOCCER_COMMON_DIFFERENCE_AUDIT.md)
- [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md)
- [ROADMAP.md](./ROADMAP.md) — Soccer = `NOT_STARTED / FUTURE_GATED`
- Machine audit: `data/audits/2026-08-04-football-foundation-pre-design-audit-v0.json`

---

## 1. Football Foundation Architecture

```
[League Registry]  →  competition / season / team IDs (provider-native + internal)
[Match Identity]   →  matchId · home · away · kickoffUtc · timezone · venue
        ↓
[Schedule Artifact]  READY only if required fields complete
        ↓
[Odds Artifact]      1X2 = PREDICTION_ELIGIBLE | O/U·AH·BTTS·DC = COLLECT_ONLY
        ↓
[Lineup Artifact]    NOT_RELEASED | CONFIRMED | AFTER_CUTOFF
        ↓
[Prediction Gate]    ALL gates pass → freeze allowed (future mission)
        ↓
[Result Artifact]    FINAL only (ET/PEN split) — Result ≠ Prediction
        ↓
[Review]             Research observation ≠ Official KPI
        ↓
[Scorecard]          Accuracy/Brier/LogLoss — Engine impact = NONE
```

**계층 분리 (고정):**

| Layer | Role | Football now |
|---|---|---|
| Provider adapter | Fixtures/odds fetch | Partial (`src/lib/football/*`, `/games` merge) |
| Research datasets | Schedule/Odds/Lineup/Result | **NOT_STARTED** |
| Prediction consumer | Frozen snapshot | **NOT_IMPLEMENTED** |
| Engine / Weight | Scoring model | **PROHIBITED until sample + Foundation** |
| YANG EDGE OS | READY/WARNING/BLOCKED/OFF | OFF / PREPARING (honest) |

**표시용 관심 리그 ≠ 연구 범위:**  
`src/constants/football-leagues.ts`는 `/games` 필터용 API-Football league id 화이트리스트다. ROADMAP의 배트맨 편성 후보 범위와 **동일하지 않다**. Research Foundation은 배트맨 편성 + Provider coverage를 별도 확인해야 한다.

---

## 2. Football Data Flow

```
Schedule  →  Odds  →  Lineup  →  Prediction  →  Result  →  Review  →  Scorecard
```

| Stage | Required inputs | Output status values | Prediction allowed? |
|---|---|---|---|
| Schedule | matchId, home, away, kickoff, status, competition, season, round?, venue?, timezone | READY / PARTIAL / MISSING | No if not READY |
| Odds | matchId ↔ provider event map, 1X2 quotes, collected as-of | USABLE / PRESENT_UNUSABLE / MISSING | No if not USABLE (1X2) |
| Lineup | XI when released; otherwise NOT_RELEASED | NOT_RELEASED / CONFIRMED / AFTER_CUTOFF | CONFIRMED preferred; AFTER_CUTOFF never for freeze |
| Prediction | Gate bundle + freeze timestamp | VALID_FOR_PREGAME / INVALID_FOR_PREGAME | Only when all gates pass **before kickoff** |
| Result | FINAL FT (and separate ET/PEN if needed) | FINAL / NON_FINAL / VOID… | N/A — Result never feeds Prediction |
| Review | Prediction + FINAL Result only | RESEARCH / OFFICIAL split | N/A |
| Scorecard | Graded research rows only | observational metrics | Engine impact NONE |

**MLB 교훈 이식:** Artifact 파일이 있어도 `collected=0` / identity fail / kickoff 이후면 `ARTIFACT_PRESENT_UNUSABLE` 또는 `INVALID_FOR_PREGAME` — COMPLETE로 승격 금지.

---

## 3. Football Gate

### 3.1 Schedule Gate — missing field ⇒ Prediction 금지

필수:

- `matchId` (internal stable id)
- `providerFixtureId` (external)
- `homeTeamId` / `awayTeamId` (provider + mapped internal)
- `kickoffUtc`
- `timezone`
- `status` (NS/TBD/LIVE/FT/…)
- `competitionId` + `season`
- `venue` (권장; 없으면 WARNING, Kickoff 확정 전이면 BLOCKED 후보)

누락 시: `SCHEDULE_NOT_READY` → Prediction 생성 금지.

### 3.2 Odds Gate

| Market | Foundation role |
|---|---|
| 1X2 | **PREDICTION_TARGET** (only) |
| O/U | COLLECT_ONLY |
| AH | COLLECT_ONLY |
| BTTS | COLLECT_ONLY |
| Double Chance | COLLECT_ONLY |

Usability:

- file missing → `DATA_MISSING`
- file exists, 1X2 collected=0 → `ARTIFACT_PRESENT_UNUSABLE` (MLB 08-03 odds pattern)
- partial slate → `DATA_PARTIAL` → Prediction blocked for incomplete matches

### 3.3 Lineup Gate (MLB와 동일 철학)

| State | Meaning | Freeze |
|---|---|---|
| `NOT_RELEASED` | 발표 전 | Lineup feature OFF; may still freeze **without** lineup weight (future) |
| `CONFIRMED` | 발표 후·Kickoff 전 | usable if integrity ok |
| `AFTER_CUTOFF` | Kickoff 이후 확정/백필 | Prediction 입력·표본 **금지** |

### 3.4 Prediction Gate (필수 존재 — 구현은 후속)

모두 만족할 때만 Freeze 허용:

1. Schedule READY  
2. Odds 1X2 USABLE for that match  
3. Kickoff **이전** (`asOf < kickoffUtc`)  
4. Identity verified (no AMBIGUOUS home/away/provider map)  
5. Result dependency = 0 (결과·라이브 스코어 미사용)  
6. Leakage = 0 (post-game lineup/table/odds close 금지)  
7. Validity sidecar → else `INVALID_FOR_PREGAME` and **exclude from research denominator**

### 3.5 Result / Review / Scorecard Gates

- Result FINAL 이전 Review 금지  
- Research observation ≠ Official KPI 혼합 금지  
- Scorecard metrics do **not** auto-change Engine/Weight

---

## 4. Identity Audit

### 4.1 League Identity

| League (display) | API-Football id (UI list) | Season risk | Duplicate risk |
|---|---|---|---|
| EPL | 39 | season year vs campaign | High (same clubs cup vs league) |
| LaLiga | 140 | same | High |
| Serie A | 135 | same | High |
| Bundesliga | 78 | same | High |
| Ligue 1 | 61 | same | High |
| UCL | 2 | multi-country clubs | Very high (club dual competition) |
| UEL | 3 | same | Very high |
| K League 1 | 292 | local season | Medium |
| J1 | 98 | local season | Medium |
| MLS | 253 | calendar year | Medium + DST |
| Other Betman leagues | **NOT in UI list** | must resolve per slate | High if name-only |

**감사 결론:**

- Competition + season + providerLeagueId를 primary로 둔다.  
- 팀명 문자열만으로 league 귀속 금지.  
- UCL/UEL과 국내리그 동시 편성 시 **match는 competition으로 분리** (팀 ID 재사용 가능, match ID 공유 금지).

### 4.2 Match Identity

필수 키:

`sport=SOCCER` + `provider` + `providerFixtureId` → internal `matchId`  
권장: `soccer-{provider}-{fixtureId}` (선행 설계와 동일)

**현재 코드 리스크 (사실):**  
`mapFixtureToGame`는 `externalId=fixture.id`를 쓰지만 내부 `GameData.id`는 `buildGameId(league, home, away)` 이름 기반이다. 같은 날짜 더블헤더·컵 재경기·표기 변경 시 **충돌/재매핑** 위험. Foundation Dataset에서는 **fixtureId 기반 matchId**를 의무화하고 UI slug는 secondary로 둔다.

Home/Away: provider team id 필수. Odds event mapping은 fixture↔event 명시 테이블 없이 문자열 매칭만 하면 MLB odds miss와 같은 `PRESENT_UNUSABLE` 재발.

Kickoff: UTC 저장 + display timezone 병기. KST 표시는 derived.

---

## 5. Football Risk Audit

| ID | Risk | MLB parallel | Mitigation |
|---|---|---|---|
| R1 | Artifact exists ≠ usable | 08-03 odds 0/15 | Usability enum before COMPLETE |
| R2 | Prediction after kickoff | INVALID_FOR_PREGAME | Hard cutoff gate + validity sidecar |
| R3 | Name-based match id collision | — | fixtureId primary |
| R4 | Multi-competition same clubs | — | competitionId on every row |
| R5 | Draw / ET / PEN grading confusion | baseball winner-only | Result taxonomy soccer-specific |
| R6 | Lineup post-kickoff leakage | lineup post-game confirmed | AFTER_CUTOFF exclude |
| R7 | Collect-only markets treated as model input | — | 1X2-only prediction target |
| R8 | Research Accuracy shown as product KPI | OS principle | Research Lab only + label |
| R9 | Engine change from thin sample | DEC-ENGINE-NO-CHANGE | Engine impact NONE / PROHIBITED |
| R10 | UI league whitelist ≠ Betman scope | ROADMAP | Separate registries |
| R11 | Provider legal unclear | prior soccer audit | NEEDS_LEGAL_REVIEW before public |
| R12 | Odds provider ≠ schedule provider drift | MLB mapping fails | Explicit identity map artifact |

---

## 6. Football Reuse Matrix

| MLB structure | Reuse for Football? | Notes |
|---|---|---|
| Pregame usability gates (`ARTIFACT_PRESENT_UNUSABLE`, cutoff) | **YES** — pattern | Sport-specific field names; keep enum philosophy |
| Prediction validity sidecar (`INVALID_FOR_PREGAME`) | **YES** — pattern | New soccer schema; do not mutate MLB files |
| Review Research vs Official split | **YES** — contract | New result taxonomy |
| Scorecard observational + Engine NONE | **YES** — contract | No auto weight update |
| OS levels READY/WARNING/BLOCKED/OFF | **YES** | Already used; Football currently OFF |
| Operation Memory / Decision Center | **YES** | Sport-agnostic memory |
| Daily pregame orchestrator scripts | **ADAPT** | New football package; do not fork MLB starters |
| Starter / probable pitcher dataset | **NO** | Baseball-only |
| Bullpen role dataset | **NO** | Baseball-only |
| Batting lineup order | **NO** | Baseball-only |
| MLB moneyline 2-way grading | **NO** | Soccer needs 1X2 + draw |
| Hash algorithm / frozen prediction identity idea | **YES** — idea | New inputs; do not share MLB hash domain |
| Provider call utilities / cache layout idea | **YES** — idea | Separate sport cache roots |
| API-Football fixtures → GameData | **PARTIAL** | Schedule display only; not research dataset |

---

## 7. Football TODO (implementation order — future missions)

1. **Schedule/Result Identity Dataset v0 design lock** (matchId = provider fixture based)  
2. **League + Team registry** (provider ids, mapping status MATCHED/UNMATCHED/AMBIGUOUS)  
3. **Odds 1X2 usability gate** (+ COLLECT_ONLY markets storage contract)  
4. **Lineup phase enum** NOT_RELEASED / CONFIRMED / AFTER_CUTOFF  
5. **Football Prediction Gate module** (no Engine)  
6. **Validity sidecar** for invalid freeze isolation  
7. **Result FINAL taxonomy** (FT/ET/PEN/VOID) before any Review  
8. **Research Review + Scorecard** (observation only)  
9. **OS Data Center wire** from OFF → real READY/WARNING/BLOCKED  
10. **Legal review** API-Football / Odds before public or paid scale  
11. **Betman slate ↔ fixture map** (scope only; no crawl)  
12. **Owner approval** before first Football Prediction Freeze mission

**이번 미션에서 하지 않음:** Engine, Weight, Model, Prediction builder, Provider call, Dataset write, git commit.

---

## 8. Operation Audit (YANG EDGE OS)

| Surface | Football today | Target after Foundation data exists |
|---|---|---|
| Dashboard league card | OFF / 준비 중 | READY/WARNING/BLOCKED/OFF from gates |
| Data Center Football card | OFF / NOT_STARTED | same levels; no fake % |
| Mission Control | Football Foundation pending | gate-blocked actions |
| Research Lab | no soccer research rows | research-only labels |
| Engine Center | N/A / disabled | remains DISABLED until sample policy |

OsLevel vocabulary is **already compatible**. Missing piece is Football gate reader — not a new status system.

---

## 9. Regression / Mutation

- MLB Prediction / Engine / Weight / Review / Scorecard / Hash / Dataset schema: **unchanged**  
- Provider calls in this mission: **0**  
- This audit is documentation + static JSON + test reader only
