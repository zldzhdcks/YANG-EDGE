# RELEASE v0.8 CHECKLIST

Version: 0.8.0  
문서 역할: Private Beta 준비 상태를 한눈에 보는 운영 체크리스트  
관련: `PROJECT_STATUS_v1.0.md` · `PROVIDER_POLICY_v1.0.md` · `KNOWN_ISSUES_v1.0.md` · `YANG_EDGE_INDEX_v1.0.md`

상태값: `READY` · `IN_PROGRESS` · `BLOCKED` · `NOT_STARTED`

---

# Release Status

| 항목 | 값 |
|------|-----|
| Current Version | **v0.8** |
| Target | **Private Beta** |
| Status | **IN_PROGRESS** |

---

# Major Progress

| 영역 | 상태 | 한줄 |
|------|------|------|
| MLB | **IN_PROGRESS** | Daily pregame · freeze · review/scorecard 연구 운영 가능. Safety gate·hygiene 정리 중 |
| Football | **IN_PROGRESS** | Identity / Odds / Result / Review·Scorecard Foundation 완료. Prediction·Engine 미착수 |
| KBO | **IN_PROGRESS** | Operator intake · T45 · Research Lab reader. Prediction 의도적 미구현 |
| OS | **IN_PROGRESS** | Dashboard / Mission / CTO / Developer / Op Memory 표면 구축. 커밋·안정화 필요 |
| Provider | **IN_PROGRESS** | `PROVIDER_POLICY` Registry 문서화. 다수 Provider는 Review Required |
| Research | **IN_PROGRESS** | Framework·Pipeline 존재. 표본·Backtest·품질 확장 중 |
| Engine | **NOT_STARTED** | RESEARCH ONLY. 자동 변경·승인 Engine 없음 |
| Legal | **IN_PROGRESS** | Provider Policy·Constitution 준법 원칙 있음. Commercial / Terms / 공개 전 법무 미완 |

---

# MLB

| 항목 | 상태 | 체크 |
|------|------|------|
| Schedule | READY | [x] 일별 schedule artifact · audit |
| Starter | IN_PROGRESS | [ ] deterministic hash / usability gate 작업 tree 정리·검증 후 READY |
| Odds | READY | [x] overseas odds history 수집 경로 |
| Lineup | READY | [x] lineup dataset · near-first-pitch 한계는 Known Issue |
| Freeze | READY | [x] pregame freeze 운영 (예: 2026-08-02 frozen slate) |
| Prediction | READY | [x] Research Baseline v0 (RESEARCH ONLY). Official pick 아님 |
| Review | READY | [x] postgame review / detail 경로 |
| Scorecard | READY | [x] scorecard v0 |
| Learning | IN_PROGRESS | [ ] dashboard / learning loop 안정·커밋 정책 정리 |

### MLB 운영 메모

- 2026-08-02 frozen prediction hash 보호 대상.
- 2026-08-03 = `INVALID_FOR_PREGAME` 운영 실패 기록 (정상 연구 표본 아님).
- Doubleheader `internalGameId`, 표본 부족 → `KNOWN_ISSUES`.

---

# Football

| 항목 | 상태 | 체크 |
|------|------|------|
| Foundation | READY | [x] Pre-Design Audit + foundation 모듈 |
| Identity | READY | [x] competition/team registry · matchId · identity gate |
| Odds | READY | [x] 1X2 contract · usability · domestic/overseas 분리 (collect-only) |
| Result | READY | [x] FT 1X2 vs ET/PEN · finality · resultHash |
| Review | READY | [x] RESEARCH vs OFFICIAL lane · exact 3-way grade 골격 |
| Scorecard | READY | [x] framework only · `predictionFormulaConnected: false` · engineImpact NONE |
| Prediction | NOT_STARTED | [ ] Football Prediction Baseline |
| Engine | NOT_STARTED | [ ] Football Engine 승인·반영 금지 상태 유지 |

### Football 운영 메모

- Foundation 완료 ≠ Prediction 가능.
- Private Beta 전 Prediction 착수는 v0.8 필수 조건이 **아님** (아래 Private Beta 조건 참고).

---

# KBO

| 항목 | 상태 | 체크 |
|------|------|------|
| Schedule | IN_PROGRESS | [ ] 운영일 bootstrap · revision 안정·커밋 |
| Operator | IN_PROGRESS | [ ] personnel / starter / lineup confirmation · screenshot intake |
| Domestic Odds | IN_PROGRESS | [ ] proto / operator markets · OCR·clipboard |
| Research | IN_PROGRESS | [ ] Research Lab · operational-state unified reader |
| Prediction | NOT_STARTED | [ ] 의도적 NOT_IMPLEMENTED (KBO Prediction Pipeline) |

### KBO 운영 메모

- T45 readiness · Proto OCR · Clipboard는 연구/운영 도구.
- Prediction 없이 Private Beta 내부 운영 가능 범위로 한정.

---

# OS

| 항목 | 상태 | 체크 |
|------|------|------|
| Dashboard | IN_PROGRESS | [ ] 종목·게이트 요약 안정 · 커밋 |
| Mission | IN_PROGRESS | [ ] Mission Control |
| CTO | IN_PROGRESS | [ ] CTO Room · Decision Center |
| Developer | IN_PROGRESS | [ ] Developer Console |
| Research Lab | IN_PROGRESS | [ ] Lab / Analysis 통합 reader · OS shell 연동 |
| Operation Memory | IN_PROGRESS | [ ] Op Memory v0 · Decision Registry |

### OS 운영 메모

- 표면은 구축됐으나 working tree hygiene / 커밋 전에는 Private Beta “안정”으로 보지 않음.

---

# Provider

| 항목 | 상태 | 체크 |
|------|------|------|
| Approved | IN_PROGRESS | [ ] 연구용 APPROVED 행 확정·운영 준수 |
| Review Required | IN_PROGRESS | [ ] Odds API · Football providers 등 검토 큐 |
| Blocked | READY | [x] Betman crawl 등 BLOCKED 원칙 문서화 |
| Registry | IN_PROGRESS | [ ] `PROVIDER_POLICY` Registry 유지·갱신 |
| Adapter | IN_PROGRESS | [ ] Adapter ↔ Artifact ↔ Engine 분리 준수 검증 |

### Provider 운영 메모

- Prediction 단계 Provider 직접 호출 금지.
- 공개·상업 전 Legal Review 필수.

---

# Legal

| 항목 | 상태 | 체크 |
|------|------|------|
| Provider Policy | READY | [x] `PROVIDER_POLICY_v1.0.md` |
| Commercial | NOT_STARTED | [ ] 상업/Private Beta 계약·표시 조건 |
| Redistribution | IN_PROGRESS | [ ] paid-provider · artifact 재배포 경계 |
| Terms | NOT_STARTED | [ ] 이용약관 / 면책 (공개·베타용) |
| Registry | IN_PROGRESS | [ ] Legal 관점 Registry 상태와 동기 |

---

# Critical Issues

Private Beta 전에 **반드시** 다루거나 명시적으로 수용할 항목:

| # | 이슈 | 상태 | 비고 |
|---|------|------|------|
| 1 | Starter deterministic hash | IN_PROGRESS | wall-clock 필드 hash 제외 등 — 코드 정리·검증·커밋 |
| 2 | Pregame usability gates | IN_PROGRESS | exists ≠ usable · INVALID snapshot 차단 |
| 3 | Football Prediction | NOT_STARTED | v0.8 Private Beta 필수 아님 · v1.0 후보 |
| 4 | Repository Hygiene | IN_PROGRESS | 214-path working tree — 기능/데이터 분리 커밋 · cache 제외 |
| 5 | Doubleheader internalGameId | OPEN | `KNOWN_ISSUES` ISSUE-001 |
| 6 | Dataset 표본 부족 | OPEN | Engine 승인 전 해소 필요 |
| 7 | KBO Prediction | NOT_STARTED | 의도적 · v1.0 |
| 8 | Engine 승인 | NOT_STARTED | RESEARCH ONLY 유지 |
| 9 | Legal Commercial / Terms | NOT_STARTED | 공개·유료 전 차단선 |
| 10 | Frozen artifact 보호 | READY (운영) | 08-02 hash 보호 · 08-03 invalid 분리 기록 |

---

# Private Beta 조건

v0.8 → Private Beta 진입에 **필요한** 조건:

| # | 조건 | 현재 | 충족 |
|---|------|------|------|
| 1 | MLB 운영 안정 (schedule→freeze→review 반복 가능) | IN_PROGRESS | [ ] |
| 2 | Football Foundation 완료 (Identity~Scorecard, Prediction 제외) | READY | [x] |
| 3 | OS 안정 (핵심 화면 커밋·스모크) | IN_PROGRESS | [ ] |
| 4 | Provider Registry 문서·운영 가능 | IN_PROGRESS | [ ] |
| 5 | 법무 문서 최소 세트 (Policy + Beta 범위 고지) | IN_PROGRESS | [ ] |
| 6 | Repository Hygiene (코드/데이터 분리 커밋, cache 미혼입) | IN_PROGRESS | [ ] |
| 7 | Pregame safety gates 검증·반영 | IN_PROGRESS | [ ] |
| 8 | Engine = RESEARCH ONLY 유지 (자동 승인 없음) | READY | [x] |

**Private Beta에 포함하지 않는 것 (명시)**

- Football / KBO Prediction 완성
- Engine 공식 승인
- Public 상용 Terms 완비
- Backtest 완료

---

# v1.0 조건

Public / 제품 v1.0 전:

| # | 조건 | 현재 |
|---|------|------|
| 1 | Football Prediction Baseline | NOT_STARTED |
| 2 | KBO Prediction Pipeline | NOT_STARTED |
| 3 | Provider 안정 (승인·quota·장애 운영) | IN_PROGRESS |
| 4 | Engine 검증·승인 절차 통과 | NOT_STARTED |
| 5 | 연구 Sample 충분 | BLOCKED / OPEN (표본 부족) |
| 6 | Backtest | NOT_STARTED |
| 7 | Legal Commercial + Terms + Redistribution 확정 | NOT_STARTED / IN_PROGRESS |
| 8 | MLB Learning loop 운영 품질 | IN_PROGRESS |

---

# 운영 규칙

- 본 문서는 **상태 보드**이다. Engine / Prediction 공식 / Dataset을 변경하지 않는다.
- 상태 갱신 시 `PROJECT_STATUS` · `KNOWN_ISSUES` · `CHANGELOG`와 모순되지 않게 맞춘다.
- Frozen prediction · INVALID 운영일은 정상 sample과 섞어 보고하지 않는다.
- 체크리스트 `[x]`는 검증·문서·커밋이 대표 기준으로 확인된 항목만 표시한다.

---

# 다음 액션 (요약)

1. Working tree Commit Plan 실행 (Football → OS → MLB safety → data 분리)  
2. MLB pregame gates · starter hash 검증  
3. OS 스모크 후 Private Beta 체크 재평가  
4. Provider Registry · Legal 최소 고지  
5. **하지 않음:** Football/KBO Prediction · Engine 변경 · 08-05 전까지 무분별 Prediction 재생성
