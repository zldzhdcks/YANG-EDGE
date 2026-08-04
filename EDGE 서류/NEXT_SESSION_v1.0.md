# NEXT_SESSION

Version: 1.0.0

## 목적

다음 개발 세션에서 가장 먼저 수행할 작업과,  
세션 간 **인수인계 핵심**을 함께 관리하는 공식 문서이다.

- 구 `TRANSFER_NOTES`의 “다음 사람이 알아야 할 것”을 본 문서로 **통합**한다.
- 현재 상태 요약은 `PROJECT_STATUS_v1.0.md`를 본다.
- 읽기 순서는 `YANG_EDGE_INDEX_v1.0.md`.

---

# 작성 원칙 (인수인계)

- 짧고 명확하게
- 추측 금지
- 완료 / 미완료 구분
- 현재 우선순위 반영
- 임시 잡담 금지 — 다음 세션 생산성에 필요한 것만

---

# 현재 Active Mission

## KBO Lineup Screenshot Intake v1

상태: T45 Partial/Cancelled readiness blockers 수정 완료(미커밋 가능). 다음으로 라인업 스크린샷 Intake.

선행 완료(origin/main):

- Proto OCR + Clipboard Intake (HEAD `12ead3f` — 문서 기록 기준)

로컬 미커밋 가능:

- T45 null starter guard + cancelled NOT_APPLICABLE

### Verified (문서 기록)

- `npm run test:kbo-t45-readiness`
- `npm run test:kbo-t45-personnel`
- `npm run test:kbo-t45-admin-api`
- `npm run verify:kbo-t45-historical`
- `npm run test:kbo-t30-cli`
- `npx tsc --noEmit`

### 운영 2026-08-01 다음 단계

1. (선택) T45 Dry-run 재확인 — TypeError 없어야 함
2. 활성 3경기 Lineup/Starter 스크린샷 Intake
3. 명시 승인 후에만 T45 실제 Run
4. T30 Lock / Prediction은 별도

### 필수 주의

- null starter/lineup 추정 생성 금지
- cancelled 경기는 Pregame 입력 요구 대상 아님
- 실제 T45 Run / T30 Lock은 명시 요청 전 금지
- git add/commit/push는 명시 요청 후만

---

# 세션 시작 체크리스트

- [ ] `YANG_EDGE_INDEX_v1.0.md` 순서대로 문서 확인
- [ ] `PROJECT_STATUS_v1.0.md` — Mission / Block / Engine
- [ ] `KNOWN_ISSUES_v1.0.md`
- [ ] `npm run test:kbo-t45-readiness` (해당 미션 시)
- [ ] `/internal/kbo/personnel?date=…` Dry-run (해당 시)
- [ ] Active Mission 범위 재확인 후 구현

---

# 전달사항 (구 TRANSFER_NOTES)

## 프로젝트 방향

- 설명 가능한 스포츠 연구 플랫폼
- Engine보다 연구 우선
- 문서 중심 운영
- Git + Documentation + Artifact 기반 기억

## 개발 원칙

- Producer / Consumer 분리
- Source of Truth 하나
- Prediction에서 Builder·Provider 직접 호출 금지
- 데이터 누수 방지 최우선

## 현재 우선순위 (문서)

1. Active Mission 완수
2. 데이터 품질 · Dataset 확장
3. Backtest
4. Engine 검증
5. UI 고도화

## 주의사항

- Engine 자동 변경 금지
- 범위 외·중복 구현 금지
- 공식 API 우선 (`PROVIDER_POLICY_v1.0.md`)
- 문서 갱신 누락 금지

---

# 신규 전달사항 기록 형식

날짜:  
작성자:  
배경:  
전달 내용:  
영향:  
다음 작업:

---

# 세션 종료 체크

- 주요 변경점
- 남은 TODO
- Known Issue / Blocker
- `PROJECT_STATUS` · `CHANGELOG` · 본 문서 갱신 여부
- git은 명시 요청 시에만

---

# Documentation Refactoring 메모 (2026-08-04)

- `PROJECT_PROGRESS` + `PROJECT_STATE` → `PROJECT_STATUS_v1.0.md`
- `TRANSFER_NOTES` → 본 문서로 통합
- 진입점: `YANG_EDGE_INDEX_v1.0.md`
- Provider 정책: `PROVIDER_POLICY_v1.0.md`
