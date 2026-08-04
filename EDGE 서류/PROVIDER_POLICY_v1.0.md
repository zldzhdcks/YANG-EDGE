# PROVIDER_POLICY

Version: 1.0.0  
Status: OFFICIAL (Documentation)

## 목적

YANG EDGE의 **Provider 사용·승인·법적 경계·Engine 분리**를 한곳에 정리한다.  
코드/Artifact를 변경하지 않는 정책 문서이다. 구현 세부 SoT는 코드·Artifact이며, 본 문서는 운영·승인 규칙이다.

관련: `PROJECT_CONSTITUTION_v1.0.md` (준법) · `CURRENT_ARCHITECTURE_v1.0.md` · `RESEARCH_POLICY_v1.0.md` · `DECISION_LOG_v1.0.md`

---

# 1. 핵심 원칙

1. **공식 API / 승인된 Provider 우선** — 무단 크롤링·숨은 API 금지  
2. **Prediction은 Consumer** — Prediction 단계에서 Provider 직접 호출 금지  
3. **Builder / Adapter와 Engine 분리** — Provider 응답을 Engine이 직접 해석하지 않음  
4. **Source of Truth는 Artifact** — raw 응답은 cache/audit, 운영 SoT는 정규화 Artifact  
5. **공개·상업 이용 전 Legal Review** — 라이선스·재배포·표시 조건 확인  
6. **Quota / Rate limit 존중** — 불필요 Provider call 금지  

---

# 2. Approved Provider Registry (문서 레지스트리)

상태값:

| Status | 의미 |
|--------|------|
| `APPROVED` | 연구/내부 사용 승인 (범위 명시) |
| `REVIEW_REQUIRED` | 사용 전 대표·법적 검토 필요 |
| `BLOCKED` | 사용 금지 |
| `COMMERCIAL_USE` | 상업/공개 제품에 별도 계약 필요 |
| `REDISTRIBUTION_RESTRICTED` | 원문·대량 재배포 제한 |

### Registry 행 (문서 기준 — 코드 변경 없음)

| Provider / 역할 | 용도 | Status | 비고 |
|-----------------|------|--------|------|
| StatsAPI / MLB 공식 계열 | Schedule·Boxscore·결과 등 | `APPROVED` (연구) | 공개 제품·이용약관 준수 |
| The Odds API | Odds reference | `REVIEW_REQUIRED` / 키·플랜 의존 | Historical·유료는 별도 비즈니스 판단 |
| API-Football / API-SPORTS | Football fixtures 등 | `REVIEW_REQUIRED` | 리그 coverage·legal 확인 |
| TheSportsDB | 일부 일정 | `REVIEW_REQUIRED` | 무료 한도·표시 조건 |
| Dummy Provider | 테스트 전용 | `APPROVED` (test only) | 실서비스 SoT 금지 |
| Betman / 국내 화면 | **Scope only** | `BLOCKED` as Provider | 편성 범위 기준일 뿐. HTML crawl·login 자동화 금지 |
| Admin / Screenshot / Paste | 운영자 입력 | `APPROVED` (internal) | Provider Confirmed ≠ ADMIN_VERIFIED |

신규 Provider 추가 시: 본 Registry에 행 추가 → Status=`REVIEW_REQUIRED` → 승인 후 `APPROVED` 또는 `BLOCKED`.

---

# 3. Provider Adapter

- Adapter는 **외부 응답 → 내부 타입/Artifact**만 담당한다.  
- Prediction / Review / Engine은 Adapter를 직접 호출하지 않고 **완성된 Artifact**를 읽는다.  
- Adapter 실패는 `PROVIDER_ERROR` 등으로 명시하고 가짜 데이터로 채우지 않는다.  
- Cache 사용 시 TTL·키에 비밀값 포함 금지.

---

# 4. Legal Policy

- 이용약관·라이선스·개인정보·재배포 조건을 Provider별로 확인한다.  
- **공개 AI 스포츠 분석 전환 전** 법률·약관 검토 (`PROJECT_CONSTITUTION` 제10조).  
- 무단 스크래핑, ToS 위반 자동화, 숨은 엔드포인트 사용 금지.  
- 관리자 스크린샷·수기 입력은 **내부 연구용**이며 공식 리그 데이터와 동일시하지 않는다.

---

# 5. Approval Gate

Provider 신규 도입 또는 상업 전환 시:

1. Registry 등록 (`REVIEW_REQUIRED`)  
2. 용도·종목·시장·보존 기간 명시  
3. Legal / Commercial 검토  
4. 대표 승인 → `APPROVED` 또는 `BLOCKED` / `COMMERCIAL_USE`  
5. `DECISION_LOG`에 결정 기록  

**자동 승인 금지.**

---

# 6. Provider Status 운영

| 상황 | 조치 |
|------|------|
| Quota 초과 | call 중단 · 문서/이슈 기록 · 추정 데이터 생성 금지 |
| Format mismatch | Artifact usable=false · Prediction 입력 금지 |
| Identity unresolved | Join 실패 · 자동 보정 금지 |
| Legal unclear | `REVIEW_REQUIRED` 유지 · 공개 사용 금지 |

---

# 7. Review Required / Blocked / Commercial Use / Redistribution

- **Review Required:** 키·플랜·약관 미확정, 신규 Provider  
- **Blocked:** Betman crawl, 미승인 소스, ToS 위반 경로  
- **Commercial Use:** 공개 제품·유료 재배포 전 별도 계약  
- **Redistribution:** Provider 원문 bulk 재배포·미허가 미러링 금지; 내부 Artifact·집계만 정책 범위 내 사용  

---

# 8. Engine 분리 원칙

```
External Provider
    → Provider Adapter
    → Dataset / Research Artifact
    → Prediction Consumer (읽기 전용)
    → Review / Scorecard (관찰)
    → (충분 표본·승인 후) Approved Engine
```

금지:

- Provider 응답을 Engine weight에 직결  
- Prediction 중 Provider 재호출로 입력 보강  
- 단일 날짜 관찰로 Engine 자동 변경  

---

# 9. Registry 구조 (문서 스키마)

각 Provider 행 권장 필드:

- `providerId`
- `displayName`
- `purpose` (schedule / odds / result / …)
- `status` (`APPROVED` | `REVIEW_REQUIRED` | `BLOCKED` | `COMMERCIAL_USE`)
- `redistribution` (`ALLOWED_INTERNAL` | `RESTRICTED` | `FORBIDDEN`)
- `legalNote`
- `engineCoupling` (`NONE` — 기본)
- `lastReviewedAt`
- `decisionLogRef`

코드 Registry가 생기면 본 문서와 **동기화**하되, 문서 Refactoring만으로 코드 Registry를 만들지 않는다.

---

# 10. 갱신 규칙

- Provider 승인·차단·플랜 변경 시 본 문서 + `DECISION_LOG` + 필요 시 `KNOWN_ISSUES` 갱신  
- 구현 변경이 필요하면 별도 개발 미션 (본 문서는 정책만)
