# WORKFLOW_RULES

Version: 1.0.0

## 목적

이 문서는 YANG EDGE 프로젝트의 공식 개발 워크플로와 AI, Cursor, Git, QA 운영 규칙을 정의한다.

---

# 1. 공식 개발 순서

아이디어
→ 요구사항 정의
→ 현재 구조 감사
→ 기존 코드 조사
→ Source of Truth 확인
→ Devil's Advocate
→ 범위 확정
→ Cursor Prompt 작성
→ 구현
→ 테스트
→ Build
→ QA
→ 문서 갱신
→ Git

---

# 2. Cursor Prompt 규칙

모든 개발은 하나의 Prompt로 진행한다.

반드시 포함

- 미션명
- 목적
- 현재 구조
- 구현 범위
- 범위 밖
- 변경 금지
- 테스트
- Build
- 완료 보고
- 문서 갱신

---

# 3. 미션 관리

한 채팅 = 한 Active Mission

발견된 문제는

- BLOCKER
- KNOWN ISSUE
- FUTURE CANDIDATE

로 분리한다.

---

# 4. 코드 작성 규칙

- 기존 코드 우선
- 중복 구현 금지
- 작은 수정 우선
- 공통 모듈 재사용
- 함수 책임 분리

---

# 5. QA 규칙

완료 전 확인

□ Build PASS
□ Runtime PASS
□ Type 오류 없음
□ 기존 기능 영향 없음
□ 문서 갱신 완료

---

# 6. Devil's Advocate

항상 질문한다.

- 다른 원인은 없는가?
- 더 작은 해결책은 없는가?
- 데이터 누수는 없는가?
- 기존 구조를 깨는가?

---

# 7. Git Workflow

git status

↓

git diff

↓

git add (명시적 파일)

↓

git commit

↓

git push

git add . 사용은 지양한다.

---

# 7.1 Pregame Scheduler 운영

1. 먼저 dry-run으로 단계 판정만 확인한다.
   `npm run scheduler:pregame -- --date YYYY-MM-DD --league MLB --dry-run`
2. Hard Cutoff / Pregame Lock이 있으면 실행하지 않는다.
3. 실제 실행은 Provider quota와 schedule artifact를 확인한 뒤에만 한다.
4. Postgame은 `--include-postgame`이 있을 때만 호출한다.
5. Scheduler는 기존 Runner만 호출한다. Engine/Prediction 로직을 넣지 않는다.

---

# 8. 완료 보고

항상 포함

- 수정 파일
- 신규 파일
- 삭제 파일
- 테스트
- Build
- 영향 범위
- 문서 수정
- 남은 TODO

---

# 9. 문서 동기화

기능 완료 후 필요 시

- PROJECT_STATUS
- PROVIDER_POLICY (Provider 관련 시)
- CHANGELOG
- NEXT_SESSION
- KNOWN_ISSUES
- YANG_EDGE_INDEX (읽기 순서 변경 시)

를 갱신한다.

(구 PROJECT_STATE / PROJECT_PROGRESS는 PROJECT_STATUS로 통합)
---

# 10. 운영 원칙

검증되지 않은 내용은 VERIFIED로 기록하지 않는다.

추측으로 구현하지 않는다.

현재 미션 범위를 임의로 확대하지 않는다.

Engine 변경은 연구 완료 후만 가능하다.

---

# 11. KBO Admin Verified (T45)

- 관리자 입력은 공식 Provider 데이터와 동일하지 않다.
- 표시: 관리자 확인 완료 / 예상 구성. 금지: 공식 라인업·선발·배당.
- T45 input 없음 → Scheduler `MANUAL_INPUT_REQUIRED` (추정 생성 금지).
- T45 실패/미입력이어도 T30은 PASS Snapshot 저장 가능.
- Prediction Engine / 공식 Pick 생성은 T45 범위 밖.
- Admin UI: `/internal/kbo/personnel` — Validate와 Save 분리, Save와 Run 분리.
- Domestic Proto OCR assist: OCR/붙여넣기는 Draft만 생성. 관리자 명시 승인 후에만 operator input 병합.
- Clipboard Intake: Win+Shift+S → 영역 클릭 → Ctrl+V. 파일 저장 불필요. paste 이벤트 기반(권한 API 불필요).
- OCR confidence로 자동 승인 금지. Approve는 T45/T30을 자동 실행하지 않음.
- 원본 스크린샷은 ephemeral 처리(기본 영구 저장 금지). Object URL은 remove/unmount 시 revoke.
- 스크린샷은 Schedule primary를 대체·생성하지 않음. 취소 의심은 Draft 후 별도 Schedule Status Revision.
- MONEYLINE_2WAY만 저장 지원. INTERNAL_ONLY.
- PARTIAL operator input(null starter/lineup)은 정상. T45 Dry-run은 TypeError 없이 PARTIAL 결과를 반환한다.
- CANCELLED/POSTPONED 경기는 personnel/proto 요구 NOT_APPLICABLE. missing 분모에서 제외한다.
- Historical 07-31 read-only. production 공개 전 `INTERNAL_ADMIN_TOKEN` 필수.
