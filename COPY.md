# YANG EDGE Copy

YANG EDGE에서 사용하는 **모든 UI 문구**의 기준 문서입니다.

관련 문서: [BRAND.md](./BRAND.md)

---

## KBO Odds Comparison

페이지: `/kbo/odds-preview` (내부 연구 preview 전용 · robots noindex)

| Key | Copy |
|-----|------|
| Page Title | `KBO 시장 배당 비교` |
| Page Subtitle | `운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다.` |
| Disclaimer | `추천·구매 지시가 아닙니다.` |
| Domestic Label | `국내 프로토` |
| Overseas Label | `해외 시장` |
| Domestic Draft | `국내 배당 검수 전` |
| Domestic Verified | `국내 배당 검수 완료` |
| Overseas Missing | `해외 배당 미수집` |
| Domestic Missing | `국내 배당 미수집` |
| Rule Unverified | `시장 규칙 확인 전 단순 병렬 표시` |

### /games KBO Card

| Key | Copy |
|-----|------|
| Domestic Label | `국내 프로토` |
| Overseas Label | `해외 시장` |
| Domestic Draft | `국내 배당 검수 전` |
| Domestic Verified | `국내 배당 검수 완료` |
| Domestic Rejected | `국내 배당 사용 제외` |
| Domestic Missing | `국내 배당 미수집` |
| Overseas Missing | `해외 배당 미수집` |
| Rule Unverified | `시장 규칙 확인 전 단순 병렬 표시` |

---

## 이 문서를 어떻게 쓰는가

1. **새 문구를 쓰기 전에** 이 문서에 먼저 추가한다.
2. **코드에 문구를 넣을 때** 이 문서의 표현을 그대로 사용한다.
3. **문구를 바꿀 때** 코드와 이 문서를 **함께** 수정한다.
4. 일반 용어(`Prediction`, `AI Score`, `Win Rate`)보다  
   **EDGE 용어**(`EDGE`, `EDGE Score`, `EDGE Pick`, `EDGE Combo`, `EDGE Ranking`, `EDGE Engine`)를 우선한다.
5. 한 화면에서 같은 의미의 문구가 여러 개면, **하나만 표준**으로 남긴다.

---

## HOME

현재 홈(`/`)에 사용 중인 문구.

### Navigation

| Key | Copy |
|-----|------|
| Logo | `YANG EDGE` |
| Nav · Games | `오늘 경기` |
| Nav · Ranking | `EDGE Ranking` | ※ 공개 내비 HIDDEN (`/picks` 직접 URL만) |
| Nav · Combo | `EDGE Combo` | ※ 공개 내비 HIDDEN (`/toto` 직접 URL만) |
| Nav · Ledger | `내 가계부` |
| Nav · Login | `로그인` |  ※ 현재 `/#login` placeholder. 기능 미구현 |


### Hero

| Key | Copy |
|-----|------|
| Eyebrow | `EDGE Analytics` |
| Headline L1 | `우리는 승자를 찾지 않습니다.` |
| Headline L2 | `가치를 찾습니다.` |
| Description L1 | `축구 · 야구 · 농구` |
| Description L2 | `일정은 Provider 실데이터를 사용하고,` |
| Description L3 | `TODAY EDGE PICK은 연구 스냅샷 기준으로 선정합니다.` |
| CTA Primary | `오늘 경기 보기` |
| CTA Secondary | `내 가계부` |

### TODAY EDGE PICK (홈 섹션 · v1.2)

| Key | Copy |
|-----|------|
| Section Label | `TODAY EDGE PICK` |
| Target Date | `대상 경기일 {YYYY-MM-DD} KST` |
| Updated At | `업데이트 {HH:mm} KST` |
| Guidance · Mixed | `현재 연구 기준을 충족한 EDGE PICK과 추가 연구 후보를 함께 표시합니다.` |
| Guidance · Research Only | `엄격한 EDGE PICK 기준을 충족한 경기는 없습니다. 대신 현재 예정 경기 중 분석 우선순위가 높은 연구 후보를 표시합니다.` |
| Empty · Preparing | `다음 경기 분석을 준비 중입니다.` |
| Empty · No Picks | `선정된 EDGE PICK이 없습니다.` |
| Empty · Explanation | `현재 시각 이후 사용할 수 있는 연구 스냅샷이 없습니다. 과거 종료 경기는 EDGE PICK으로 다시 표시하지 않습니다.` |
| Empty · Next Date | `다음 분석 예정: {YYYY-MM-DD}` |
| Footnote | `TODAY EDGE PICK은 현재 시각 이후 예정 경기 중 연구 스냅샷·Dataset completeness 기준으로 최대 3경기만 선정합니다. 연구 후보는 정식 EDGE PICK이 아닙니다. 실추천·베팅 조언이 아닙니다.` |
| EDGE PICK Badge | `EDGE PICK ①` · `EDGE PICK ②` · `EDGE PICK ③` |
| Research Badge | `연구 후보 ①` · `연구 후보 ②` · `연구 후보 ③` |
| EDGE PICK Description | `현재 연구 기준을 충족한 EDGE PICK입니다.` |
| Research Description | `현재 예정 경기 중 분석 우선순위가 높은 연구 후보입니다. 일부 핵심 데이터가 부족하여 정식 EDGE PICK은 아닙니다.` |
| CTA | `연구 분석 보기 →` |

#### 연구 후보 부족 사유 (한국어 표시)

| Code | Copy |
|------|------|
| BASELINE_NOT_MET | `Baseline 후보 기준 미충족` |
| RESEARCH_PARTIAL | `연구 데이터 일부 부족` |
| BULLPEN_PENDING | `불펜 데이터 연구 대기 중` |
| LINEUP_PARTIAL | `경기 전 라인업 일부 미수집` |
| WEATHER_PARTIAL | `날씨 예보 미수집` |
| ODDS_PARTIAL | `개장·최신 배당 일부 미수집` |
| INJURY_PARTIAL | `부상 정보 일부 미수집` |

#### EDGE Score 표시

| Code | Copy |
|------|------|
| EDGE positive | `Baseline 대비 우위` |
| EDGE zero / negative | `Baseline 기준 우위 없음` |
| General UI policy | `일반 화면에는 예측 팀 기준 EDGE만 표시하고 원본 홈 기준 EDGE는 노출하지 않는다.` |
| Technical UI policy | `연구 기술 정보에서만 원본 홈 기준 EDGE와 예측 팀 기준 EDGE를 함께 표시한다.` |
| EDGE Reference Side | `EDGE 기준 방향` |
| Raw Home-side EDGE | `원본 홈 기준 EDGE` |
| Predicted-side EDGE | `예측 팀 기준 EDGE` |
| Display Reference | `화면 표시 기준` |
| MARKET_CONFLICT | `시장 방향과 모델 판단이 충돌` |
| Research EDGE_NO_POSITIVE | `Baseline 기준 우위 없음` |

#### 다음 경기 (Research Snapshot)

| Key | Copy |
|-----|------|
| Section Title | `다음 경기` |
| Target Date | `대상 경기일 {YYYY-MM-DD} KST` |
| CTA | `연구 보기 →` |

### TODAY EDGE PICK (홈 섹션 · v1.1 — superseded by v1.2)

| Key | Copy |
|-----|------|
| Section Label | `TODAY EDGE PICK` |
| Target Date | `대상 경기일 {YYYY-MM-DD} KST` |
| Updated At | `업데이트 {HH:mm} KST` |
| Empty · Preparing | `다음 경기 분석을 준비 중입니다.` |
| Empty · Explanation | `현재 시각 이후 사용할 수 있는 연구 스냅샷이 없습니다. 과거 종료 경기는 EDGE PICK으로 다시 표시하지 않습니다.` |
| Empty · Next Date | `다음 분석 예정: {YYYY-MM-DD}` |
| Empty · No Eligible | `선정 기준을 충족한 TODAY EDGE PICK 후보가 없습니다.` |
| Footnote | `TODAY EDGE PICK은 현재 시각 이후 예정 경기 중 연구 스냅샷·Dataset completeness 기준으로 최대 3경기만 선정합니다. 실추천·베팅 조언이 아닙니다.` |
| Rank Badge | `EDGE PICK ①` · `EDGE PICK ②` · `EDGE PICK ③` |
| CTA | `연구 분석 보기 →` |

#### 선정 이유 (한국어 표시)

| Code | Copy |
|------|------|
| STARTER_COMPLETE | `선발 데이터 확보` |
| BULLPEN_COMPLETE | `불펜 데이터 확보` |
| TRAVEL_COMPLETE | `이동·휴식 데이터 확보` |
| ODDS_COMPLETE | `시장 배당 확보` |
| HIGH_CONFIDENCE | `상대적으로 높은 신뢰도` |
| VALUE_EDGE_POSITIVE | `AI 확률이 시장 확률보다 높음` |
| PREDICTION_SNAPSHOT_VERIFIED | `예측 스냅샷 확인` |
| BASELINE_CANDIDATE | `Baseline 후보 조건 충족` |

#### 데이터 부족 (한국어 표시)

| Code | Copy |
|------|------|
| LINEUP_PARTIAL | `경기 전 라인업 일부 미수집` |
| WEATHER_PARTIAL | `날씨 예보 미수집` |
| INJURY_PARTIAL | `부상 정보 일부 미수집` |
| ODDS_PARTIAL | `개장·최신 배당 일부 미수집` |

### Today AI Pick (홈 섹션 · Dummy · 공개 홈 미노출)

| Key | Copy |
|-----|------|
| Section Label | `EDGE Pick` |
| Sample Banner | `연구용 샘플 분석 (실추천 아님)` |
| Stats Note | `승리 확률 · Confidence · EDGE Score는 샘플 Engine 출력입니다 (실추천 아님).` |
| Stat · Score | `EDGE Score` |
| Stat · Confidence | `EDGE Confidence` |
| Stat · Win | `승리 확률` |
| Reasons Label | `분석 이유` |
| CTA | `샘플 분석 보기 →` |

### Today Games (홈 섹션)

| Key | Copy |
|-----|------|
| Section Title | `오늘 경기` |
| Card · Games Label | `오늘 경기` |
| Card · Analyzed Label | `샘플 분석` |
| Card · Games Unit | `{n}경기` |

### Featured (홈 섹션 · 구 Why YANG EDGE)

| Key | Copy |
|-----|------|
| Section Title | `Featured` |
| Section Subtitle | `Dummy Engine 샘플 기준 관심 경기 (실추천 아님)` |
| Sample Banner | `연구용 샘플 분석 (실추천 아님)` |
| Card · Stats Note | `등급·EDGE·Confidence는 샘플 Engine 출력 (실추천 아님)` |

### Footer

| Key | Copy |
|-----|------|
| Brand | `YANG EDGE` |
| Copyright | `© {year} YANG EDGE. All rights reserved.` |
| Terms | `이용약관` |
| Privacy | `개인정보처리방침` |

### Metadata (홈)

| Key | Copy |
|-----|------|
| Title | `YANG EDGE \| AI 스포츠 분석 플랫폼` |
| Description | `개인용 스포츠 일정·가계부·분석 프로토타입. 홈 일정은 Provider 데이터, 홈 분석 수치는 현재 Dummy Engine 샘플입니다.` |

---

## AI PICK

홈·네비의 공개 Ranking 진입은 **비노출(HIDDEN)**.  
`/picks`는 직접 URL 전용 고정 샘플이며, 상세는 **EDGE Ranking** 섹션을 본다.

| Key | Copy | Status |
|-----|------|--------|
| Nav / CTA | `EDGE Ranking` | 공개 내비 비노출 |
| CTA · View | `EDGE Ranking 보기` | 홈 Hero에서 제거 (보조 CTA → `내 가계부`) |
| Label · Badge | `EDGE Pick` | 사용 중 (샘플·홈 Feature 등) |
| Alias | `EDGE Pick` | 사용 중 |

---

## EDGE Ranking

페이지: `/picks` (공개 UI HIDDEN · robots noindex · 샘플 고지 배너)

| Key | Copy | Status |
|-----|------|--------|
| Eyebrow | `EDGE` | 사용 중 |
| Title | `EDGE Ranking` | 사용 중 |
| Subtitle | `고정 샘플 순위 (실데이터·실추천 아님)` | 사용 중 |
| Banner · Title | `고정 샘플 · 개발용 (실제 Pick 아님)` | 사용 중 |
| Badge · Top | `EDGE Pick` | 사용 중 |
| Stat · Confidence | `Confidence` | 사용 중 |
| Stat · EDGE | `EDGE` | 사용 중 |
| Reason Label | `추천 이유` | 사용 중 |
| Empty | `오늘의 EDGE Ranking이 없습니다.` | 사용 중 |
| Rank Unit | `{n}위` | 사용 중 |

---

## EDGE Detail / 경기 연구 보기

페이지: `/analysis/[gameId]` (robots noindex)  
읽기 전용 연구 뷰어. Engine 재계산·추측 없음. artifact에 있는 값만 표시.

| Key | Copy | Status |
|-----|------|--------|
| Eyebrow | `연구` | 사용 중 |
| Title | `경기 연구 보기` | 사용 중 |
| Notice | `경기 연구 보기 — 읽기 전용입니다…` | 사용 중 |
| Empty field | `미수집` / `연구 대기 중` | 사용 중 |
| Outcome (finished) | `예측 적중` / `예측 실패` (SIGNAL_*·hit= 일반 화면 비표시) | 사용 중 |
| 연구 상태 | `COLLECTED` / `PARTIAL` / `AWAITING_RESEARCH` (값은 영문 코드 유지) | 사용 중 |
| Game phase | `종료 경기` / `시작 전` | 사용 중 |
| Summary title | `경기 요약 · 경기 종료` | 사용 중 (종료 경기) |
| Labels KO | 예측 · 승리 확률 · 신뢰도 · EDGE 점수 · 가치 차이 · 예상 선발 · 선발 상태 · 선발 신원 · 선발 세부 지표 · 불펜 상태 · 데이터 수집 상태 · 시장 배당 · 주요 요인 · 보조 요인 · 학습 요약 · 예측 팀 · 상대 팀 | 사용 중 |
| Pitching section | `투수진 현황` | 사용 중 |
| Review labels | `성공 복기` · `실패 복기` | 사용 중 |
| Completeness KO | `수집됨` / `일부 부족` / `연구 대기 중` / `미수집` | 사용 중 |
| MIXED | `선발 ERA·WHIP가 Baseline과 혼합 판정` + `MIXED` 보조 | 사용 중 |
| Status code KO | STARTER_MATCHED · PROBABLE_ONLY · ROLE_STRUCTURE_* · SIGNAL_* · BASELINE_SIGNAL_CONFIRMED · BULLPEN_PROTECTED_SIGNAL · MULTIPLE_FACTORS · ADVERSE_MOVE · MIXED | 사용 중 |
| Starter metrics warning | `예측 당시 선발 세부 지표 부족` | 사용 중 |
| Prediction-time note | `예측 당시 기준` | 사용 중 |
| Sections (finished) | 경기 요약·경기 종료 · 경기 전 예측(+예측 지표) · 투수진 현황 · 시장 배당 · 경기 후 복기 · 연구 기술 정보 | 사용 중 |
| Sections (pre-game) | 경기 정보 · 경기 전 예측(+예측 지표) · 투수진 현황 · 시장 배당 · 연구 기술 정보 | 사용 중 |
| 연구 기술 정보 | feedbackClassification · predictionHit · Completeness raw · Prediction Hash · paths (영문 유지) | 사용 중 |
| Binding | Prediction snapshot + Starter/Bullpen datasets + Review artifacts (read-only) | 사용 중 |
| Analysis URL | `mlb-{api-baseball externalId}` via `getResearchAnalysisGameId` | 사용 중 |
| Sample banner | `연구용 샘플 분석 (실추천 아님)` | 사용 중 (SampleAnalysisNotice) |
| Back to Games | `← 경기 목록으로` | 사용 중 (`/games?date=` 복귀) |
| Games CTA | `연구 보기` | 사용 중 (`GameCard`) |
| Finished card score | `{홈팀} {홈스코어}–{원정스코어} {원정팀}` | 사용 중 (graded만) |
| Finished card result | `예측 적중`(초록 Badge) / `예측 실패`(빨강 Badge) | 사용 중 |
| Finished card pick | `예측 팀: …` | 사용 중 |
| Failure empty | `분류된 주요 원인 없음` | 사용 중 |

---

## EDGE Combo

페이지: `/toto` (축구토토 승무패)

| Key | Copy | Status |
|-----|------|--------|
| Eyebrow | `Football Toto` | 사용 중 |
| Title | `EDGE Combo` | 사용 중 |
| Round Format | `{n}회차 · {count}경기` | 사용 중 |
| Deadline Label | `마감까지` | 사용 중 |
| Budget Label | `예산 입력` | 사용 중 |
| Budget · 5k | `5천원` | 사용 중 |
| Budget · 10k | `1만원` | 사용 중 |
| Budget · 20k | `2만원` | 사용 중 |
| CTA · Generate | `EDGE Combo 생성` | 사용 중 |
| CTA · Regenerate | `EDGE Combo 다시 생성` | 사용 중 |
| Generated Notice | `{budget} 기준 조합이 생성되었습니다` | 사용 중 |
| Generated Detail | `단식 {n}경기 · 복식 {n}경기 · EDGE Pick 기준` | 사용 중 |
| List Title | `경기 리스트` | 사용 중 |
| Match Unit | `{n}경기` | 사용 중 |
| AI Pick Label | `EDGE Pick` | 사용 중 |
| Stat · Confidence | `Confidence` | 사용 중 |
| Stat · EDGE | `EDGE` | 사용 중 |
| Single Label | `단식` / `복식 추천 여부` | 사용 중 |
| Double Label | `복식 추천` | 사용 중 |
| Outcomes | `승` · `무` · `패` | 사용 중 |

---

## Buttons

공통·화면별 CTA.

| Key | Copy | Where |
|-----|------|-------|
| View Today Games | `오늘 경기 보기` | Home Hero |
| View Ledger | `내 가계부` | Home Hero (보조 CTA) |
| View Ranking | `EDGE Ranking 보기` | 홈에서 제거 · `/picks` 공개 비노출 |
| Detail Analysis | `샘플 분석 보기 →` | Home EDGE Pick |
| Analyze | `연구 보기` | Games card |
| Back | `← 뒤로가기` | EDGE Detail |
| Back to Games list | `← 경기 목록으로` | Research Analysis Viewer |
| View Odds | `배당 보기` | EDGE Detail |
| Detail Data | `상세 데이터` | EDGE Detail |
| Favorite | `즐겨찾기` | EDGE Detail |
| Favorited | `즐겨찾기됨` | EDGE Detail |
| Generate Combo | `EDGE Combo 생성` | EDGE Combo |
| Regenerate Combo | `EDGE Combo 다시 생성` | EDGE Combo |
| Login | `로그인` | Header |

---

## Login

아직 전용 페이지 없음. 네비 진입만 존재.

| Key | Copy | Status |
|-----|------|--------|
| Nav | `로그인` | 사용 중 |
| Page Title | `로그인` | 예정 |
| Email Label | `이메일` | 예정 |
| Password Label | `비밀번호` | 예정 |
| Submit | `로그인` | 예정 |
| Signup Link | `계정이 없으신가요? 가입하기` | 예정 |
| Guest Continue | `둘러보기` | 예정 |

---

## Analysis

경기 목록(`/games`)과 분석 흐름에서 쓰는 문구.

| Key | Copy | Status |
|-----|------|--------|
| Page Title | `오늘 경기` | 사용 중 |
| Page Subtitle | `경기를 선택하면 EDGE Detail로 이동합니다.` | 사용 중 |
| Search Placeholder | `팀명, 리그 검색` | 사용 중 |
| Filter · All | `전체` | 사용 중 |
| Filter · Football | `축구` | 사용 중 |
| Filter · Baseball | `야구` | 사용 중 |
| Filter · Basketball | `농구` | 사용 중 |
| Count Unit | `{n}경기` | 사용 중 |
| Badge · Available | `EDGE 분석 가능` | 사용 중 |
| CTA | `분석` | 사용 중 |
| Empty | `조건에 맞는 경기가 없습니다.` | 사용 중 |
| Empty Hint | `검색어나 종목, 날짜를 변경해 보세요.` | 사용 중 |
| Date · Previous | `‹` (aria: 이전 날) | 사용 중 |
| Date · Next | `›` (aria: 다음 날) | 사용 중 |
| Date · Today | `오늘` (aria: 오늘) | 사용 중 |

---

## Ledger (`/ledger`)

개인 베팅 가계부. 종목 필드는 **개인 기록 분류**이며 YANG EDGE 분석 지원 종목과 동일하지 않다.

| Key | Copy | Status |
|-----|------|--------|
| Sport Label | `종목 (개인 기록 분류)` | 사용 중 |
| Sport Group · EDGE | `EDGE 지원 종목` | 사용 중 |
| Sport Group · Personal | `기타 개인 기록` | 사용 중 |
| Sport Group · Legacy | `이전 기록 (신규 선택 불가)` | 사용 중 |
| Sport · Baseball | `야구` | 사용 중 |
| Sport · Football | `축구` | 사용 중 |
| Sport · Basketball | `농구` | 사용 중 |
| Sport · Volleyball | `배구` | 사용 중 |
| Sport · Other | `기타` | 사용 중 |
| Sport · Ice Hockey (legacy) | `아이스하키 (기록용·분석 미지원)` | 사용 중 |
| Sport Hint | `가계부 종목은 개인 베팅 기록용입니다. 기타·이전 기록 종목은 YANG EDGE AI 분석 대상이 아닙니다.` | 사용 중 |
| Disclaimer · Sport Scope | `종목 선택은 개인 베팅 기록 분류이며, YANG EDGE 분석 지원 범위(야구·축구·농구·배구)와 동일하지 않습니다. 「기타」및 이전 기록 종목은 AI 분석 대상이 아닙니다.` | 사용 중 |

---

## 용어 매핑 (빠른 참조)

| 지양 | 우선 |
|------|------|
| Prediction | EDGE Pick |
| AI Score | EDGE Score |
| Win Rate를 EDGE와 혼용 | **승리 확률**과 **EDGE Score**를 분리 표시 |
| Confidence (모호) | EDGE Confidence |
| 추천 등급 | EDGE Grade |
| 자동 조합 | EDGE Combo |
| AI PICK (화면 제목) | EDGE Ranking / EDGE Pick |
| 분석 엔진 | EDGE Engine |

---

## 변경 규칙

1. 문구 변경 PR에는 `COPY.md` 업데이트를 포함한다.
2. 새 화면을 만들면 해당 섹션에 Key / Copy / Status를 추가한다.
3. `Status`는 `사용 중` · `예정` · `점진 전환` 중 하나를 쓴다.
4. 브랜드 철학과 충돌하면 [BRAND.md](./BRAND.md)를 우선한다.

---

## 미래 제품 문구 후보 (FUTURE_GATED · 현재 UI 미적용)

> **이 섹션은 미래 Public Product용 후보 문구입니다.**  
> 위 HOME·EDGE Detail 등 **현재 공개 UI 문구는 변경하지 않습니다.**  
> 게이트(DATA_VALIDATION · LEGAL_CLEARANCE · COMMERCIAL_READINESS) 통과 전 코드에 반영하지 않습니다.

### Product positioning (후보)

| Key | Copy (후보) | Status |
|-----|-------------|--------|
| Vision | `AI가 왜 그렇게 판단했는지 보여주는 스포츠 분석` | 후보 |
| Sub | `검증된 데이터 기반 · 참고용 분석 (수익·적중 보장 없음)` | 후보 |
| Explanation | `근거 · 신뢰도 · 위험 · 시장 차이를 한눈에` | 후보 |

### Public card / detail (후보 — 검증 후에만)

| Key | Copy (후보) | 전제 |
|-----|-------------|------|
| AI Probability | `AI 확률` | Engine·Backtest 게이트 |
| Confidence | `신뢰도` | 정의·감사 완료 |
| Risk | `위험` | Risk taxonomy 승인 |
| Value Edge | `가치 차이` | 시장 유형별 검증 |
| TODAY EDGE PICK | `오늘의 EDGE Pick` | Pick 정책·법적 검토 |
| Post-game | `경기 후 복기` | 사전 저장 예측만 |

### Accuracy dashboard (후보)

| Key | Copy (후보) | Status |
|-----|-------------|--------|
| Title | `예측 기록` | 후보 |
| Disclosure | `사전 저장된 예측만 포함 · 표본 {n} · 기간 {period} · {league} · {market}` | 후보 |
| Pending | `미정산·무효 기준: …` | 후보 |

---

## 금지 문구 (제품·마케팅·미래 카피 공통)

아래 표현은 **사용 금지**입니다. 검증되지 않은 적중률을 실제 성과처럼 쓰지 않습니다.

| 금지 | 이유 |
|------|------|
| `수익 보장` · `수익률 보장` | 분석은 참고 정보 |
| `필승` · `확정` · `100%` · `무조건` | 과장·오해 유발 |
| `적중률 XX%` (미검증·소표본) | 공개 성과 홍보 금지 |
| `베트맨`·`스포츠토토`와 혼동되는 공식 표현 | Public Safety Boundary |
| `자동 구매` · `대신 베팅` | 중개·알선 미제공 |
| 검증 전 시장(핸디·OU·스코어)을 제공하는 것처럼 표현 | 시장별 별도 검증 필요 |

허용되는 정직한 표현 예: `참고용 분석`, `정확도·수익을 보장하지 않습니다`, `연구용 샘플 (실추천 아님)`, `미수집` / `연구 대기 중`.
