# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## KBO Domestic Proto OCR-Assisted Admin Workflow v1 — implemented (uncommitted)

상태: Fixture adapter + paste fallback + Admin review/approve 완료. OCR 엔진 미연결.
git add/commit/push 금지(미션).

### Verified

- `npm run test:kbo-proto-ocr`
- `npm run test:kbo-proto-ocr-admin`
- `npm run verify:kbo-proto-ocr-historical`
- `npm run verify:kbo-proto-ocr-runtime`
- `npm run test:kbo-t45-admin-api`
- `npm run test:kbo-t45-personnel`
- `npm run test:scheduler-integration`
- `npx tsc --noEmit`

### 다음 실행 후보

1. KBO Lineup Bulk Paste v1
2. 운영 표본으로 Proto OCR Accuracy Scorecard 측정
3. 승인 후 Local/External OCR 엔진 연결 (별도 약관·비용 승인)
4. Proto OCR 커밋 분리 (contract → API → UI → tests → docs)

### 필수 주의

- OCR은 Draft Generator; SoT = 관리자 승인 Operator Input
- 원본 이미지 영구 저장 금지 (ephemeral)
- 2026-07-31 read-only
- T45/T30 자동 실행 없음
- git push는 명시 승인 후만

---

# 세션 시작 체크리스트

- [ ] `npm run test:kbo-proto-ocr`
- [ ] `npm run verify:kbo-proto-ocr-historical`
- [ ] `/internal/kbo/personnel` paste-text 확인
