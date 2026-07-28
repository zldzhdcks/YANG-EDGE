# YANG EDGE Development & Compliance Charter v1

이 문서는 YANG EDGE의 **개발 헌장**이다.  
향후 모든 기능 개발, API 도입, Dataset 생성, Prediction, Engine, 공개, 사업화의 기준 문서로 사용한다.

목표: 빠르게 만드는 프로젝트가 아니라, **오랫동안 합법적으로 운영 가능한 서비스**를 만든다.  
모든 개발은 **Evidence + Compliance** 기반으로 진행한다.

관련: [PROJECT_MEMORY.md](../PROJECT_MEMORY.md) · [DATA_SOURCES.md](../DATA_SOURCES.md) · [ROADMAP.md](../ROADMAP.md)

---

## 1. Project Mission

YANG EDGE는 **AI 스포츠 분석 플랫폼**이다.

연구 단계에서는 아래 원칙을 따른다.

- **Research First**
- **Evidence First**
- **Compliance First**

---

## 2. Development Priority

모든 기능은 아래 순서대로 진행한다.

```text
기능 기획
  ↓
Compliance Review
  ↓
법률 검토
  ↓
API License 검토
  ↓
개인정보 영향 검토
  ↓
저작권 검토
  ↓
세무 영향 검토
  ↓
보안 검토
  ↓
개발
  ↓
테스트
  ↓
출시
```

기능이 아무리 좋아도, 법적 리스크가 크면 **다른 구현 방식을 우선 검토**한다.

---

## 3. Current Project Stage

현재 단계는 **Research / Private Mode** 이다.

### 목적

- 개인 연구
- AI 검증
- Dataset 구축
- Prediction 검증
- Backtest 준비
- Engine 연구

### 현재 하지 않는 것

- 외부 공개 없음
- 회원가입 없음
- 광고 없음
- 결제 없음

---

## 4. Public Release Requirements

외부 공개 조건:

- 충분한 경기 표본
- Prediction 검증
- Dataset 품질 확보
- Engine Admission 조건 충족
- API 안정성 확보
- 법률 검토 완료
- 세무 검토 완료
- 보안 검토 완료

위 조건이 충족되기 전에는 공개 추천·유료화·성과 홍보를 하지 않는다.

---

## 5. Data Policy

### 허용

- Official API
- Licensed Data
- Public Data
- Operator Verified Data
- Internal Research Dataset
- User Generated Data

### 금지

- 무단 크롤링
- 차단 우회
- 로그인 우회
- 무단 재배포
- 허가 확인 전 자동 배당 수집
- 허가 확인 전 배트맨 데이터 자동 수집

---

## 6. Korean Odds Policy

국내 프로토 배당은 현재 아래만 허용한다.

- 관리자 입력
- OCR + 관리자 검수

자동 크롤링은 금지한다.

공개 전에는 상업적 이용 가능 여부를 확인한 뒤 사용한다.

상세: [DATA_SOURCES.md](../DATA_SOURCES.md) · [KBO_OPERATOR_MARKET_INPUT_V2.md](../KBO_OPERATOR_MARKET_INPUT_V2.md) (해당 시)

---

## 7. API Policy

모든 API는 아래를 확인한 뒤 사용한다.

- 상업적 이용 가능 여부
- License
- Caching 정책
- Redistribution
- Rate Limit
- Attribution
- Versioning
- Deprecation

상세: [docs/API.md](./API.md)

---

## 8. AI Analysis Policy

AI는 **예측**이지 **보장**이 아니다.

### 금지 표현

- 100%
- 무조건 적중
- 돈 버는 픽
- 확정 픽

### 허용 표현

- AI 분석
- 통계 기반
- Research 기반
- 참고용 분석

### 추가 원칙

- LLM은 검증되지 않은 사실을 생성하지 않는다.
- Prediction은 검증 가능한 Dataset만 사용한다.

---

## 9. Legal Review Before Release

출시 전 확인:

- 이용약관
- 개인정보처리방침
- API License
- 이미지 저작권
- 팀 로고
- 배당 데이터
- 사업자 등록
- 세무
- OSS License
- 광고 정책
- SSL
- 보안

---

## 10. Compliance Dashboard

출시 가능 여부를 추적하는 예시 표다.  
현재 Research / Private Mode 기준 초기 상태는 모두 `NOT_STARTED` 로 둔다.

| 항목 | 상태 |
|------|------|
| 개인정보 | `NOT_STARTED` |
| 이용약관 | `NOT_STARTED` |
| API License | `NOT_STARTED` |
| 배당 사용 허가 | `NOT_STARTED` |
| 이미지 사용권 | `NOT_STARTED` |
| 광고 정책 | `NOT_STARTED` |
| 사업자 | `NOT_STARTED` |
| 세무 | `NOT_STARTED` |
| OSS License | `NOT_STARTED` |
| 보안 | `NOT_STARTED` |
| 출시 가능 | `NOT_STARTED` |

상태가 `COMPLETE` / `CLEARED` 로 바뀌기 전에는 공개 출시하지 않는다.

---

## 11. Project Roles

ChatGPT는 아래 역할을 수행할 수 있다.

- CTO
- Product Manager
- Security Review
- API License Review
- Compliance Review
- Tax Impact Guidance
- Legal Risk Pre-review
- Release Checklist

단,

- **최종 법률 판단은 변호사** 영역이다.
- **최종 세무 판단은 세무사** 영역이다.

AI / ChatGPT의 사전 검토는 변호사·세무사 판단을 대체하지 않는다.

---

## 12. Research Integrity

가장 중요한 원칙:

- 경기 시작 이후 생성된 정보는 Prediction에 사용하지 않는다.
- Data Leakage 금지
- 모든 Dataset은 재현 가능해야 한다.
- Prediction은 동일 입력이면 동일 결과를 생성해야 한다.

---

## 13. Dataset Governance

모든 Dataset은 아래를 통과한 뒤에만 Research Dataset으로 인정한다.

1. Framework 등록
2. Registry 등록
3. Hash 검증
4. Audit 생성
5. Regression 확인
6. Build 통과

---

## 14. Evidence First

새로운 Engine Rule은 아래 없이 **절대 Engine에 적용하지 않는다**.

- 충분한 표본
- Audit
- Backtest
- Evidence

직관으로 Weight를 수정하는 것을 금지한다.

---

## 15. Final Principles

"편한 방법보다 합법적인 방법을 선택한다."

"빠른 출시보다 오래 운영할 수 있는 서비스를 만든다."

"모든 기능은 Evidence와 Compliance를 통과한 뒤에만 공개한다."

---

## Document control

| Field | Value |
|-------|-------|
| Document | `docs/DEVELOPMENT_COMPLIANCE_CHARTER.md` |
| Version | v1 |
| Stage | Research / Private Mode |
| Prediction / Engine / Dataset code impact | none (charter only) |
