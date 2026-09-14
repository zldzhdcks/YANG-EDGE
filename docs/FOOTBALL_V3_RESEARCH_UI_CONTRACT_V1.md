# Football V3 Research UI Contract V1

READ / AUDIT / DESIGN ONLY. No React implementation in this step. Official Forward remains V1.

Source of truth: `data/audits/football-v3-research-ui-contract-v1.json`

Branch: `agent/cursor/football-v31-third-real-batch-preflight-v1`  
HEAD at audit: `c61bcae9291263f1463766b8c4092af9912179d4`  
origin/main: `1b90cdd3d406dd2991f79fe0836c32d8ba08e4b9`  
Line status: **V3/V3.1 RESEARCH LINE CLOSED — UNPROMOTED**. Official Forward = V1.

## Verdict

`CONTRACT_READY_NO_UI_IMPLEMENTATION`

The 추석 prototype may show sealed V1 Official Forward probabilities, V3 research *status words*, and the engine lineage. It must not show research-candidate probabilities as official predictions, raw provider xG/shots/SOT, or betting CTAs.

## 1. Existing UI inventory

Football-specific research UI exists only on this worktree.

| Route | What it shows today | Reuse |
|---|---|---|
| `/internal/football/research` | Local R1 prospective seals: V1/H2/R1 side by side, consensus, market deltas | **Internal only.** Not Official Forward. OS nav does not link it. Production fail-closes. |
| `/` | Baseball HomeBestPicks + `valueEdge` | Shell only. Do not feed football research into this card. |
| `/games` | Date list including 축구 fixtures from API-Football | **Best user surface** for today fixtures. No MODEL_FORWARD probabilities yet. |
| `/analysis/[gameId]` | Public analysis (form, lineup, injuries, market) | Header/shell only. Lineup ≠ V4 model input. |
| `/api/football/fixtures` | Provider schedule | Schedule only. |
| `/picks` | Sample EDGE ranking | Forbidden for football research. |
| `/internal/dashboard` | Football foundation stages, 연구 ≠ 공식 | Owner OS. No probabilities. |

Loaders:

- `loadResearchConsole` reads the R1 prospective INBOX store, **not** `MODEL_FORWARD`.
- `getFootballGamesForDate` reads provider fixtures.
- `validatePregame` already knows Official Forward snapshot fields; it is not wired to UI.

`FootballV31ResearchConsoleView` is the only football-named React view. Proposed prototype names do not collide. Reuse it for owner comparison; do not rename it into the friend demo.

## 2. Information architecture

### A. Official Forward

Only sealed `football-poisson-research-v1` / `MODEL_HASH=6efa82f9…`.

Show: fixture, kickoff, pHome / pDraw / pAway, predictedClass, PREDICTED / PASS, SEALED PREGAME, CORRECT / WRONG when a grade exists.

Docs still mark V1 `VALIDATED_MODEL=NO` / `PUBLIC_RECOMMENDATION=NO`. Prototype language is “공식 예측” of this product, not a betting recommendation.

### B. V3 research status

Display names, not raw provider values:

- xG: RESEARCHED
- Total Shots: RESEARCHED
- Shots on Target: RESEARCHED
- Phase-1: CLOSED
- V3.1 Holdout: COMPLETE
- Promotion: SCREEN_NO
- Official Engine: V1

### C. Engine evolution

V1 Official Forward → research → V2/H2 Unpromoted Backbone → V3 xG+Shots+SOT Research Closed → V3.1 R1/R3 Independent Holdout SCREEN_NO → V4 Player/Lineup **FUTURE / NOT IMPLEMENTED**.

## 3. Artifact → UI field map

Do not invent JSON paths. Confirmed sources:

| UI field | Artifact | JSON path |
|---|---|---|
| Official model id | closure audit | `payload.officialModelStatus.currentForwardModel.id` |
| Forward hash | closure audit | `payload.officialModelStatus.currentForwardModel.hash` |
| Status / pHome / pDraw / pAway / class / passReason | `MODEL_FORWARD/fixtures/{id}/snapshot.json` | `payload.status`, `payload.pHome`, `payload.pDraw`, `payload.pAway`, `payload.predictedClass`, `payload.passReason` |
| Sealed pregame | `seal-receipt.json` | `payload.validPregame` |
| 2026-09-13 grade | forward postgame review | `payload.predicted[].verdict` (`CORRECT`/`WRONG`) |
| Phase-1 | closure audit | `payload.v3StatusMatrix.phase1.phase1Diagnostic` |
| R1 / R3 | closure audit | `payload.v31StatusMatrix.R1.historicalStatus` / `.R3.historicalStatus` |
| Holdout screen | holdout evaluation | `payload.outcomes.V31-R1.screen` |
| Holdout metrics | holdout evaluation | `payload.results[].comparison.candidate.logLoss` / `.brier` (internal only) |
| Feature names | `contracts-v1.ts` `FEATURES` plus closure `featureInventory` | `xG`, `shots`, `sot` |
| Closure | closure audit | `payload.verdict.label` = `RESEARCH_LINE_CLOSED_UNPROMOTED` |
| Rights gate | coverage census | `payload.rights.PUBLIC_RAW_FEATURE_DISPLAY` = `UNRESOLVED` |

`MODEL_FORWARD/postgame/{id}.json` was **not** written for 2026-09-13 (`MODEL_FORWARD_POSTGAME_GRADE_WRITTEN=NO`). Demo grades must come from the review artifact.

Console `FixtureView.v1` is `sameCutoffV1` from the R1 store. Same algorithm family, **different slate**. Never label it Official Forward.

## 4. Label contract

| Internal | Friend-facing |
|---|---|
| OFFICIAL | 공식 예측 |
| SEALED PREGAME | 경기 전 봉인 |
| PREDICTED | 예측 완료 |
| PASS | 예측 보류 |
| RESEARCH | 연구 기록 |
| SHADOW | 비교용 연구 |
| SCREEN_NO | 독립 검증에서 사전 승격 기준 미충족 |
| UNPROMOTED | 미승격 |
| RESEARCH CLOSED | 이 연구 단계 종료 |
| FUTURE | 향후 연구 (V4: 아직 없음) |

Do not translate SCREEN_NO as 실패한 모델 / 나쁜 모델.

## 5. Safety / rights

| Item | Class |
|---|---|
| Official Forward pHome/pDraw/pAway | PUBLIC_ALLOWED (with 경기 전 봉인, not a bet) |
| Raw provider xG / shots / SOT | PROHIBITED_AS_PICK (and blocked on prototype) |
| Provider payload | INTERNAL_ONLY |
| Unresolved commercial/public-rights data | INTERNAL_ONLY |
| R1/R3 as Pick | PROHIBITED_AS_PICK |
| Odds vs research as value/edge | PROHIBITED_AS_PICK |
| Betting CTA | PROHIBITED_AS_PICK |
| Holdout logLoss/Brier tables | INTERNAL_ONLY |
| Poisson `expectedGoals` lambda | INTERNAL_ONLY — do not call it xG |
| XI / injuries as model input | PROHIBITED_AS_PICK |

## 6. Minimum components

- **FootballOfficialPredictionCard** — new; Official Forward only.
- **FootballResearchStatusCard** — new; status words from closure audit.
- **FootballEngineEvolution** — new; V4 FUTURE required.
- **FootballResearchComparison** — keep `FootballV31ResearchConsoleView` on `/internal/football/research`; add SCREEN_NO banner in P1.
- **FootballDataIntegrityBadge** — new chip for sealed / blocked / rights-unresolved.

## 7. Prototype user flow (3–5 min)

1. Home → 오늘 축구 공식 예측 (not HomeBestPicks).
2. `/games?sport=football` → fixtures; Official chip only if a MODEL_FORWARD seal exists.
3. Fixture detail → Official card first.
4. Research status + engine evolution (V4 = 향후 연구 · 아직 없음).
5. Optional 2026-09-13 grades with `SAMPLE_INSUFFICIENT`.

Owner console stays off this path.

## 8. P0 / P1 / P2

P0: read-only MODEL_FORWARD loader, Official card, status + evolution cards, optional `/games` chip. No engine calls.

P1: `/football/[fixtureId]` detail, review grades, internal console banner.

P2: V4 placeholder only; rights unresolved; no promotion.

Do not touch `poisson-research-v1`, `football-forward-shadow-v1.ts`, V3/V3.1 scripts, or sealed snapshots.

## 9. Artifact hashes (already sealed)

- closure: `f1d81d05627b5d4d0e648b65161c671829fcb91aa4680f383384bf2dada032c6`
- holdout: `8ab3dcfd3245490e6b622c1e11def19b026405a9e1a6fd2a07a4610c89fff0c5`
- 2026-09-13 Forward review: `5f06ab7a3a1bdfb229a3eb3ffbc37f0f6b77cd2214b842e4ac32a848a7e10c75`
- console audit: `196af026cc1628ae489372dafd9cacd15923c3d3a6e3c74700634363675e9016`
- phase-1 diagnostic: `1d6b4219774c9e58a0421cc5b91eb5cb0b985a36a143397ebba58fe0b89d9b12`
- V3 development: `b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8`
- coverage census: `0f215fba91a68cdd0a4a53b5124a311f193821baddd2ff1764d8942cb8718c41`
- MODEL_HASH: `6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf`
- this contract envelope: `cb2b535a02193f1ac6935e6f85e9b5341165cfd2222a7ffce85960bfdaab064f`
