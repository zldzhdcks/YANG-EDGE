# KBO Market Result Feedback v1

경기 종료 후 **최종 결과**와 **경기 전 국내·해외 배당**을 읽기 전용으로 연결하는 post-game observation dataset.

## Scope

- dataset: `kbo-market-result-feedback`
- identity provider: `API_BASEBALL`
- domestic source: operator market v2 `MONEYLINE_2WAY` only
- overseas source: odds comparison v1 `h2h` (The Odds API)
- observation only — no prediction, ROI, edge, or learning

## Out of scope

- KBO Prediction snapshot 생성
- EDGE PICK 적중 판정
- Confidence / Engine Learning
- DRAFT 국내 배당 VERIFIED 승격
- MARKET_RULE_UNVERIFIED 상태 ROI 계산
- 5경기 표본 시장 우위 결론

## CLI

```bash
npm run research:kbo-market-feedback -- YYYY-MM-DD
```

예시:

```bash
npm run research:kbo-market-feedback -- 2026-07-28
```

## Inputs (read-only)

- `data/research/kbo/{DATE}-schedule-result-identity-v1-api-baseball.json`
- `data/operator-input/kbo/{DATE}-operator-markets-v2.json`
- `data/research/kbo/{DATE}-odds-comparison-v1.json`

## Outputs

- `data/research/kbo/{DATE}-market-result-feedback-v1.json`
- `data/audits/{DATE}-kbo-market-result-feedback-v1-audit.json`

## Observation fields

각 경기 row:

- final result (status, score, winner)
- domestic MONEYLINE_2WAY odds + reviewStatus (DRAFT preserved)
- overseas h2h odds + marketRuleStatus
- `domesticFavoredSide` / `overseasFavoredSide` (lower decimal odds)
- `domesticDirectionMatchedResult` / `overseasDirectionMatchedResult`
- `domesticOverseasDirectionAgreement`

## Prediction boundary

모든 날짜에서 KBO Prediction Pipeline 미구현 시:

- `predictionStatus`: `NOT_IMPLEMENTED`
- `predictionGrade`: `NOT_APPLICABLE`
- `learningImpact`: `NONE`

## Regression

생성 시 다음 artifact hash **변경 금지**:

- KBO Identity (immutable region)
- Operator Market v2
- Odds Comparison v1
- MLB Prediction / TODAY EDGE PICK

## Files

- Builder: `src/lib/kbo/market-result-feedback/build-kbo-market-result-feedback-v1.ts`
- Types: `src/lib/kbo/market-result-feedback/kbo-market-result-feedback-types.ts`
- Script: `scripts/build-kbo-market-result-feedback-v1.ts`
