# KBO Identity Provider Migration

## Decision

2026-07-28 KBO full-slate identity migration은 **A. 새 API-BASEBALL Identity Artifact를 별도 생성**으로 고정한다.

## Why

- 기존 TheSportsDB artifact와 resultHash를 조용히 덮어쓰지 않기 위해
- 기존 `kbo-2400384`, `kbo-2400385`, `kbo-2400386` ID 기록을 보존하기 위해
- API-BASEBALL primary ID `kbo-181902` ~ `kbo-181906`를 명시적으로 도입하기 위해
- migration 전후 provenance를 audit 가능하게 유지하기 위해

## Policy

- preserve:
  - `data/research/kbo/2026-07-28-schedule-result-identity-v1.json`
  - legacy hash `945d57556859c96679c8793303373851e39e8b8b75df6b7978b87c716f8bf09e`
- create:
  - `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json`
- do not:
  - 기존 artifact 몰래 수정
  - 기존 provider ids를 새 provider ids로 조용히 치환
  - operator-only ids를 primary identity로 승격

## Consumer policy

- `KBO_IDENTITY_PROVIDER=API_BASEBALL` 기본값에서 validator/readiness는 새 artifact를 읽는다
- `KBO_IDENTITY_PROVIDER=THESPORTSDB`를 명시하면 legacy artifact를 읽는다
- automatic fallback 금지

## Registry impact

- dataset id는 계속 `kbo-schedule-result-identity`
- provider 차이는 artifact path / row `provider` / `providerRefs` metadata에서 구분
- framework 필드 추가 없음
- engine admission 계속 `PROHIBITED`
