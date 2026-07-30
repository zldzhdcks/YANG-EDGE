# KBO Research Readiness & Betting Line Integrity v1

## 목적

KBO 경기 시작 전 운영자가 Research Lab 하나만 보고 "분석 시작 가능" 여부를 30초 안에 판단.

## Domestic Odds Audit 결과

### Root Cause

Research Lab Reader(`research-lab-reader.ts`)에 KBO Artifact 로드 로직이 없었음.
KBO odds comparison artifact(`data/research/kbo/YYYY-MM-DD-odds-comparison-v1.json`)는 별도 pipeline으로 생성되지만 Research Lab에서 읽지 않았음.

### Pipeline 검증 결과 (2026-07-28 기준)

| Stage | Count | Status |
|-------|-------|--------|
| OCR/Operator Input | 5경기 | PASS |
| Parser | 5경기 | PASS |
| Artifact | 5경기 (domestic: 5, overseas: 5) | PASS |
| Reader | 0 (미연결) | **FAIL** ← Root cause |
| Presenter | 0 | FAIL |
| UI | 0 | FAIL |

### 수정

Reader에 KBO Odds Comparison, Schedule Identity, Starter Confirmation artifact 로드 추가.

## Research Ready 체크리스트

| 항목 | 상태 후보 |
|------|----------|
| 국내 배당 | READY / PARTIAL / MISSING |
| 해외 배당 | READY / PARTIAL / MISSING |
| 선발 | READY / PARTIAL / MISSING |
| 라인업 | READY / UNKNOWN |
| 불펜 | READY / UNKNOWN |
| Prediction | READY / UNKNOWN |

### Overall Status

- **READY**: 모든 필수 항목 확보
- **PARTIAL**: 일부 항목 누락
- **BLOCKED**: 필수 데이터 없음
- **UNKNOWN**: 확인 불가

## Prediction Lock

다음 조건이면 Prediction 시작 불가:
- Domestic Odds Missing
- Starter Missing
- Game Identity Missing
- Reader Error

UI에 `Prediction Waiting` + Reason 표시.

## Doubleheader Lifecycle

상태 흐름: `POSTPONED` → `RESCHEDULED` → `ARCHIVED`

v1에서는 POSTPONED 상태 표시. 자동 RESCHEDULED 감지는 향후 구현 (다음 날짜 identity 비교 필요).

## Bug Board

운영 화면에 현재 이슈 상태를 색상으로 표시:
- 🔴 RED — 심각 (Domestic Odds Missing 등)
- 🟡 YELLOW — 주의 (Doubleheader Lifecycle 등)
- 🟢 GREEN — 정상

Resolved되면 자동 완료 표시.

## System Detail

KBO Betting Line Pipeline 섹션 추가:
OCR → Parser → Artifact → Reader → Presenter → UI
각 단계 PASS / WARN / FAIL 표시.

## Assistant 변경

국내 배당이 없으면 "분석 준비 완료"라고 절대 말하지 않음.
실제 Artifact 상태 기반으로 KBO readiness 답변.

## 파일

| 파일 | 변경 |
|------|------|
| `src/lib/internal/research-lab-reader.ts` | KBO artifact 로드, kboReadiness 타입/데이터 추가 |
| `src/lib/internal/research-lab-presenter.ts` | kboReadiness 프레젠테이션 |
| `src/lib/internal/edge-assistant-presenter.ts` | KBO readiness 답변 개선 |
| `src/components/internal/research/OperatorHome.tsx` | KBO Ready, Bug Board, Prediction Lock UI |
| `src/components/internal/research/SystemDetail.tsx` | KBO Betting Line Pipeline 섹션 |
