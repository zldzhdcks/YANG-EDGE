# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## KBO Lineup Screenshot Intake v1

상태: Clipboard foundation + Proto 연결 완료(미커밋). 다음으로 라인업 스크린샷 Intake.

선행 완료(미푸시 가능):
- Proto OCR 5커밋 (local ahead)
- Clipboard Intake 변경(워킹트리, 미커밋)

### Clipboard Verified (temp / unit)

- `npm run test:kbo-clipboard-intake`
- `npm run test:kbo-clipboard-proto-integration`
- `npm run verify:kbo-clipboard-runtime`
- `npm run verify:kbo-clipboard-historical`

### 수동 브라우저 QA (운영자)

1. Win + Shift + S
2. 붙여넣기 영역 클릭
3. Ctrl + V
4. preview / 제거 / 여러 장
5. OCR 미연결 안내 + Paste Text fallback

### 필수 주의

- Clipboard 이미지는 SoT 아님; Schedule이 경기 identity SoT
- 자동 승인·T45/T30 자동 실행 금지
- git add/commit/push는 명시 요청 후만
- 기존 Proto OCR 5커밋 amend/squash/rebase 금지

---

# 세션 시작 체크리스트

- [ ] `npm run test:kbo-clipboard-intake`
- [ ] `npm run test:kbo-proto-ocr`
- [ ] `npm run verify:kbo-clipboard-historical`
- [ ] `/internal/kbo/personnel` Ctrl+V preview 확인
