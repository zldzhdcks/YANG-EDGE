# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## KBO Lineup Screenshot Intake v1

상태: T45 Partial/Cancelled readiness blockers 수정 완료(미커밋). 다음으로 라인업 스크린샷 Intake.

선행 완료(origin/main):
- Proto OCR + Clipboard Intake (HEAD `12ead3f`)

로컬 미커밋:
- T45 null starter guard + cancelled NOT_APPLICABLE

### Verified

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
- cancelled 2경기는 Pregame 입력 요구 대상 아님
- 실제 T45 Run / T30 Lock은 명시 요청 전 금지
- git add/commit/push는 명시 요청 후만

---

# 세션 시작 체크리스트

- [ ] `npm run test:kbo-t45-readiness`
- [ ] `/internal/kbo/personnel?date=2026-08-01` Dry-run
- [ ] 활성 3경기 라인업 스크린샷 준비
