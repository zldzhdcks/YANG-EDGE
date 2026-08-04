# PROJECT_CONSTITUTION

Version: 1.0.0

## 목적
이 문서는 YANG EDGE 프로젝트의 헌법이다.
구현보다 우선하며, 명시적 사용자 승인 없이 변경하지 않는다.

# 제1조. 프로젝트 목적
- 설명 가능한 스포츠 연구 플랫폼 구축
- 재현 가능한 예측 시스템 구축
- 적중률보다 검증 가능한 연구 우선

# 제2조. 핵심 원칙
1. Prediction은 Consumer이다.
2. Builder는 Prediction 단계에서 호출하지 않는다.
3. 결과 데이터는 예측 입력으로 사용하지 않는다.
4. Source of Truth는 하나를 유지한다.
5. 모든 연구는 재현 가능해야 한다.

# 제3조. 연구 헌법
공식 연구 사이클:
Prediction → Save → Grade → Success Review → Failure Review → Input Audit → Leakage Audit → Hypothesis → Sample → Backtest → Engine

Engine은 마지막 단계에서만 변경한다.

# 제4조. 데이터 누수
금지:
- 사후 데이터 사용
- Target 경기 포함 통계
- 라이브 결과 반영
- cutoff 이후 데이터 사용

# 제5조. Engine 정책
변경 조건:
- Leakage 0
- Input Audit 통과
- 충분한 표본
- Backtest 통과
- 사용자 승인

# 제6조. 개발 원칙
- 기존 코드 우선
- 중복 구현 금지
- 작은 변경 우선
- 범위 외 작업 금지

# 제7조. QA 원칙
완료는 다음을 의미한다.
- Build PASS
- Runtime 검증
- 재현성 확인
- 문서 갱신

# 제8조. Git 원칙
- git add . 지양
- 명시적 add
- 비밀키 커밋 금지

# 제9조. 문서 원칙
모든 장기 기억은 문서와 Git이 담당한다.

# 제10조. 준법 원칙
- 공식 API 우선
- 무단 크롤링 금지
- 라이선스 준수
- 공개 전 법률 검토

# 부칙
이 문서는 프로젝트 최상위 정책 문서이며 변경 시 사용자 승인이 필요하다.
