# 축구 독립 확률 모델 v1 — 개발용 후보

상태: `RESEARCH_ONLY`, 확률 보정·성능 검증·운영 승격 전.
공식 Baseline 명칭: `FOOTBALL_POISSON_RESEARCH_V1`. `VALIDATED_MODEL=NO`, `PUBLIC_RECOMMENDATION=NO`, `PRODUCTION_ENGINE=NO`.
범위: 정규시간(추가시간 포함, 연장·승부차기 제외) 홈 승 / 무 / 원정 승.

## 구현

- `src/lib/football/poisson-research-v1/index.ts`: 네트워크·배당 없이 준비된 과거 경기 기록으로 계산하는 순수 함수.
- `scripts/run-football-poisson-research-v1.ts`: 준비한 JSON 입력을 읽고 결과를 stdout으로 출력. 저장·동결·공개하지 않는다.
- `scripts/test-football-poisson-research-v1.ts`: 수학적 기준값, 확률 합, 시간 제한, 중복, 결측, 순서 불변성 검증.

같은 대회의 최근 365일 기록을 사용한다. 홈 팀의 홈 득점·실점과 원정 팀의 원정 득점·실점을 대회 평균으로 수축한다.

`shrunkRate = (venueGoals + 5 * leagueVenueMean) / (venueMatches + 5)`

`expectedHome = homeScoringRate * awayConcedingRate / leagueHomeMean`

`expectedAway = awayScoringRate * homeConcedingRate / leagueAwayMean`

독립 Poisson 득점 분포를 합산하여 승무패 확률을 산출한다. 이 구현은 최대우도 학습이나 Dixon–Coles 저득점 보정을 구현한 모델이 아니다. 참고 문헌: https://doi.org/10.1111/1467-9876.00065 (축구 득점 모델링의 배경이며 이 구현의 성능 근거가 아님).

대회 30경기, 홈 팀 홈 5경기, 원정 팀 원정 5경기 미만이면 확률을 출력하지 않는다. 이 수치는 초기 개발 가정이며 성능을 보장하는 표본 기준이 아니다. 최대 기대득점 10 초과도 보류한다.

## 입력 및 실행

`PredictionInput` 타입이 입력 계약이다. 모든 팀·대회 ID는 동일한 canonical namespace를 사용해야 한다. 날짜에는 timezone이 있어야 한다.

```json
{
  "target": {
    "matchId": "target-fixture-id",
    "competitionId": "canonical-competition-id",
    "homeTeamId": "canonical-home-id",
    "awayTeamId": "canonical-away-id",
    "kickoffAt": "2026-09-12T14:00:00Z"
  },
  "cutoffAt": "2026-09-12T13:00:00Z",
  "history": []
}
```

위 예시는 의도적으로 `INSUFFICIENT_DATA`를 반환한다. 실제 history의 각 행에는 `matchId`, `competitionId`, `homeTeamId`, `awayTeamId`, `kickoffAt`, `resultObservedAt`, `regulationHomeGoals`, `regulationAwayGoals`가 필요하다. 최종 결과·정규시간 점수·출처 확인은 입력을 준비하는 Producer가 담당해야 한다. 기존 official-result artifact의 `regularTime`을 사용할 수 있으나 `finalScore`를 무조건 대입하면 안 된다.

```powershell
npx tsx scripts/run-football-poisson-research-v1.ts prepared-input.json
npx tsx scripts/test-football-poisson-research-v1.ts
```

결과 관측 시각이 cutoff 이상인 기록, 대상 경기 자체, 다른 대회, 365일 이전 기록은 제외한다. 중복 ID와 잘못된 점수는 오류로 처리한다. 준비된 입력의 진위·해시를 확인하는 수집/동결 어댑터는 아직 연결하지 않았다. 과거 결과를 지금 내려받았다고 과거에 관측했던 기록으로 표시하면 안 된다. 실행기는 historical replay에도 쓰이므로 현재 시각을 강제하지 않으며, 출력은 실시간 동결된 예측으로 간주할 수 없다.

## 확인한 데이터 및 남은 작업

2026-09-09 확인 시 `data/research/football/*-official-result-v0.json`은 2개 파일, 각 1개 완료 경기였다. 다른 raw cache의 전체 가용성을 감사한 결과는 아니다.

1. 기존 Provider/cache의 대회별 과거 경기·정규시간 결과·팀 ID·출처 가용성을 확인하고, 준비된 입력을 만드는 어댑터 연결.
2. 시간순 평가 및 비교용 시장 기준 모델과 동일 경기에서 Brier score/log loss, 무승부 성능, 예측 커버리지 측정. 훈련·검증·최종 평가 기간 분리.
3. 데이터 분포, 승격 팀, 컵/중립 경기, 최근성, 상대 강도, 저득점 상관을 검토. 현재 버전은 이 요소들을 모델링하지 않는다.
4. 검증된 모델 버전과 입력 해시를 경기 전 저장하고, 기존 결과/복기 및 UI에 연결.

현재 `officialPick=null`, `calibrated=false`를 고정한다. 테스트 통과는 수학·코드 계약 확인이며, 적중률·시장 대비 우위의 검증이 아니다. 기존 생산 엔진과 배당 기준 모델은 변경하지 않았다.

## Baseline freeze 계약 확인

- 계산식·표본 기준·수축 상수는 최초 구현 그대로 봉인하며 결과를 보고 조정하지 않는다.
- PASS의 실제 schema 표현은 `status=INSUFFICIENT_DATA`, `probabilities=null`, `expectedGoals=null`, `reasons`이다. 잘못된 ID/점수/시각 및 cutoff 위반은 오류로 fail closed한다.
- 시장 배당과 Provider prediction은 읽지 않는다. timestamp 유틸리티만 기존 odds 디렉터리에서 재사용하며 배당 데이터 의존은 없다.
- `postgameUsed=false`라는 향후 계약은 **대상 경기 사후 정보 미사용**을 뜻한다. 과거 완료 경기의 정규시간 결과는 모델에 필요한 입력이다.
- `cutoffAt < target.kickoffAt`, `history.kickoffAt < cutoffAt`, `history.resultObservedAt < cutoffAt`을 강제한다. 경계와 같은 시각은 제외한다.
- 이 함수는 ID 문자열의 유효성만 확인한다. Provider ID/검증된 bridge에 의한 identity 해결과 실제 관측 시각·최종 결과 출처 검증은 입력 Producer 책임이며, 현재 계산 함수만으로 입증되지 않는다.
- 1X2는 홈 득점 > 원정 득점 / 동일 / 미만인 joint Poisson mass를 합산·정규화한다. 테스트 tolerance는 합계 `1e-12`, 대칭·독립적인 무승부 기준값 `1e-10`이다.
- 기존 전체 프로젝트 타입 오류는 이 Baseline 밖에 있으며, 변경 파일의 독립 타입 검사와 기능 테스트·lint 결과를 구분한다.
