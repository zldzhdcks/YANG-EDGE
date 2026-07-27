# Dataset Common Audit — Bullpen v1.1 × Starter v1

감사 전용. Framework / Engine / Bullpen / Starter / Prediction 미수정.  
근거: `data/audits/research-framework-common-audit.json`

---

## 공통 요소

- `researchOnly`, `engineConnected=false`, Engine admission **PROHIBITED**
- `legal`: `INTERNAL_RESEARCH_ONLY`, public/commercial runtime 금지, raw cache 연구 전용
- `dateKst`, `generatedAt`, `predictionHashSha256`, `predictionUnchanged`, `resultHashSha256`
- `cacheUsage`: raw/derived hit·miss + `networkCalls`
- Stats research cache 경로 패턴 (`data/cache/research/mlb/raw` + `derived/{domain}`)
- 엔티티 단위 `cutoffTime` + as-of / pre-cutoff 파생 원칙
- Lifecycle: dated `data/research/mlb/*` + `data/audits/*`, registry `COLLECTING`, hypothesis 링크
- 적중률만으로 PROMISING/VALIDATED 승격 금지 (Framework 문서 원칙)

---

## Bullpen 전용 요소

- Role classifier: `primaryRole` / `secondaryRoles` / `roleScores`
- Role vocabulary: CLOSER · SETUP · HL · MIDDLE · LONG · OPENER · MOP_UP · UNKNOWN
- Sample policy status: INSUFFICIENT_SAMPLE · PROVISIONAL · CLASSIFIED
- `starterAppearancesExcluded`, fatigue / role risk flags
- Game-level `overallRoleComparison` (ROLE_STRUCTURE_*)
- Fail-collapse / success-protected pregame 지표
- Success·Failure flow review를 **입력 해시**로 고정
- Hypotheses `H-BP-ROLE-001`…`005`

---

## Starter 전용 요소

- Probable identity: id · name · throws · `probableStatus` (`PROBABLE_ONLY` | `MISSING` only)
- `seasonStats` / `recentStarts` / `sampleSize` (target game·cutoff 이후 제외)
- Side별 row (`home` | `away`)
- `joinQuality` (`MATCHED` | `AMBIGUOUS` | `UNLINKED`)
- `postGameReview` + 별도 postgame review artifact (pre-game 불변)
- Integrity counters: `targetGameIncludedInStats`, `cutoffViolations`, `confirmedRows=0`
- Hypotheses `H-ST-001`…`004`

---

## Framework가 실제 재사용한 요소

- `RESEARCH_DATASET_REGISTRY` / `registry.json` 항목 (`mlb-bullpen-role`, `mlb-starter`)
- Adapter: `bullpenV11FrameworkMetadata()`, `starterV1FrameworkMetadata()`
- Status · schemaVersion · builderVersion · engineAdmission · hypothesisIds · artifact path
- Starter **audit 스크립트**만 `createResearchAuditShell` 사용
- `HYPOTHESIS_REGISTRY.md` + `DATASET_FRAMEWORK.md` 계약 문서

---

## Framework가 사용하지 않는 요소

- 도메인 builder의 `buildResearchResultHash` / `buildResearchInputHash` (양쪽 모두 로컬 hash)
- `scorecard.ts` / Variable Scorecard (미사용)
- `ResearchDatasetBase`로 games/rows 강제 wrapping (미사용)
- Bullpen builder → `src/lib/research` import **0**
- Starter domain lib → `src/lib/research` import **0**
- Framework가 `joinQuality` · roleCounts · seasonStats를 강제하지 않음

---

## 제거 가능한 추상화

- **지금 당장 삭제할 필요는 없음** (감사만; 코드 변경 금지)
- 후보(향후 trim 논의용): 사용 전인 `scorecard.ts`; weather/travel `NOT_STARTED` stub는 운영상 유지해도 무방
- Bullpen·Starter 동작에 Framework scorecard는 불필요

---

## 아직 추상화하면 안 되는 요소

- Bullpen role 분류 로직 / threshold / roleScores
- Starter probable freeze · season/recent as-of 규칙
- `joinQuality` (Starter 전용)
- Bullpen `overallRoleComparison` vs Starter `postGameReview` (다른 질문)
- 두 audit JSON을 한 스키마로 강제 통합
- “공통 pitcher dataset”으로 role+starter feature 혼합

---

## Remaining Questions

1. Bullpen audit를 선택적으로 `createResearchAuditShell`에 맞출 가치가 있는가? (도메인 meta 불변 전제)
2. 교차 도구를 위해 `resultHash`를 Framework helper로 옮길 것인가, 로컬 hash를 유지할 것인가?
3. `scorecard.ts`는 ≥100경기 이후 첫 사용인가, 이 두 Dataset에는 불필요한가?
4. `registry.ts` ↔ `registry.json` dual-write drift를 어떻게 운영적으로 막을 것인가?

---

## 공식 결론

`FRAMEWORK_APPROPRIATE_AS_IS`

현재 Framework는 registry + legal/status 계약 + 선택적 audit shell로 두 Dataset을 무리 없이 표현한다. 도메인 builder는 Framework 없이도 독립 실행 가능하다. Framework 확장·스키마 강제·신규 추상화는 불필요하다.
