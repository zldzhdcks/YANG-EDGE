# Provider Coverage Audit — 2026-07-28

감사 전용. prediction 추가/삭제·Provider 병합·런타임 Stats 연결 없음.  
근거: `data/audits/2026-07-28-provider-coverage-audit.json`

**공식 결론: `COVERAGE_DIFFERENCE_EXPLAINED`**

---

## 요약

`API-BASEBALL 12` vs `MLB Stats 15`는 **같은 KST 날짜의 누락**이 아니라 **날짜 기준(calendar basis) 불일치**다.

| 기준 | 경기 수 |
|------|---------|
| API-BASEBALL `date=2026-07-28` + `timezone=Asia/Seoul` | **12** |
| MLB Stats `dates[].date = 2026-07-28` (공식/US 일정일) | **15** (전부 KST **2026-07-29**) |
| Stats `gameDate` → KST `2026-07-28` | **12** (= API와 동일) |

KST로 맞추면 **12 = 12**, 팀 페어 매칭 **12/12**.

---

## Prediction snapshot

- 경로: `data/predictions/mlb/2026-07-28.json`
- `total = 12` — analysis-coverage/baseline이 API-BASEBALL KST 슬레이트를 그대로 사용
- **의도적 12경기** (Stats US-date 15를 미러하지 않음)
- immutable hash: `f0e94499…` 불변

---

## Naive 비교 (오해의 근원)

Stats 공식일 `2026-07-28` (15) vs API KST `2026-07-28` (12)를 직접 비교하면:

| | 수 |
|--|----|
| team-pair matched | 11 |
| API-BASEBALL only | 1 — Mariners @ Rangers (`179605`, 03:35 KST) |
| MLB Stats only | 4 — Rays/Twins/Padres/Dodgers 홈 경기 |

### API only

| externalId | Matchup | startTimeKst | Stats 위치 |
|------------|---------|--------------|------------|
| 179605 | SEA @ TEX | 03:35 | Stats **공식일 07-27**, gamePk **822868**, KST는 07-28 |

### Stats only (공식일 07-28 · 실제 KST는 07-29)

| gamePk | Matchup | startTimeKst | DH | gameNumber | status |
|--------|---------|--------------|----|------------|--------|
| 822949 | TEX @ TB | 07:40 | N | 1 | Preview |
| 823676 | KC @ MIN | 08:40 | N | 1 | Preview |
| 823275 | COL @ SD | 10:40 | N | 1 | Preview |
| 823923 | SEA @ LAD | 11:10 | N | 1 | Preview |

더블헤더·연기(`ifNecessary`/`resumeDate`) 아님.

---

## KST 정렬 비교 (올바른 기준)

Stats cache에서 `gameDate` → Asia/Seoul 변환:

- KST `2026-07-28` 경기: **12** (전부 Stats 공식일 **2026-07-27**)
- API/prediction: **12**
- 매칭: **12/12**

감사 스크립트의 `St.Louis` vs `St. Louis` 표기 차이는 **팀명 정규화 이슈(감사 도구)** 이며, 실경기 누락이 아니다.

주의: Cubs @ Cardinals는 연속일(Stats 07-27 gamePk `823025` / Stats 07-28 gamePk `823026`)로 팀 페어만으로 조인하면 **날짜를 건너뛴 오매칭**이 난다. `gamePk`·timestamp 필수.

---

## 분류

| 가설 | 결과 |
|------|------|
| Provider coverage 누락 (동일 KST일) | **기각** |
| 더블헤더 | **기각** (DH=0) |
| 연기/재일정 | **기각** |
| League filter 차이 | **기각** (둘 다 MLB) |
| 제품 팀명 매핑 실패 | **기각** (감사 alias만) |
| **Calendar basis 불일치** | **채택** |

---

## 표본 편향 리스크

- KST 파이프라인 기준: **낮음** (스냅샷이 API KST와 일치)
- Stats 공식일 건수를 KST 연구일과 나란히 두면 **과대 차이(15 vs 12)** 로 보임
- 연속 동카드 매치업은 team-pair 조인 시 편향/오결합 위험

---

## 권장 조치 (수정 없음 · 제안만)

1. 커버리지 비교 시 Stats는 반드시 `gameDate` → KST 변환 후 비교
2. 연구 join은 `gamePk`/시각 우선
3. 이번 감사에서 prediction·Provider 코드 변경 없음

---

## 검증

| 항목 | 결과 |
|------|------|
| prediction hash | 불변 |
| 경기 추가/삭제 | 0 |
| Provider runtime 변경 | 0 |
| Engine/Bullpen/Starter/Framework | 0 |
