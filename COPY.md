# YANG EDGE Copy

YANG EDGE에서 사용하는 **모든 UI 문구**의 기준 문서입니다.

관련 문서: [BRAND.md](./BRAND.md)

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
| Description L2 | `배트맨 기준 경기를 분석하여` |
| Description L3 | `EDGE Score + Confidence + EDGE + 분석 근거를 제공합니다.` |
| CTA Primary | `오늘 경기 보기` |
| CTA Secondary | `내 가계부` |

### Today AI Pick (홈 섹션)

| Key | Copy |
|-----|------|
| Section Label | `EDGE Pick` |
| Stat · Score | `EDGE Score` |
| Stat · Confidence | `Confidence` |
| Stat · EDGE | `EDGE` |
| Reasons Label | `분석 이유` |
| CTA | `상세 분석 →` |

### Today Games (홈 섹션)

| Key | Copy |
|-----|------|
| Section Title | `오늘 경기` |
| Card · Games Label | `오늘 경기` |
| Card · Analyzed Label | `EDGE 분석 완료` |
| Card · Games Unit | `{n}경기` |

### Why YANG EDGE

| Key | Copy |
|-----|------|
| Section Title | `Why YANG EDGE` |
| Feature 1 Title | `하나의 화면에서 모든 데이터` |
| Feature 1 Body | `축구, 야구, 농구 경기를 한곳에서 확인합니다.` |
| Feature 2 Title | `EDGE 근거 제공` |
| Feature 2 Body | `EDGE Score 뒤에 숨은 분석 근거를 함께 제공합니다.` |
| Feature 3 Title | `자동 업데이트` |
| Feature 3 Body | `경기 일정과 분석 결과가 실시간으로 반영됩니다.` |
| Feature 4 Title | `매일 학습하는 EDGE Engine` |
| Feature 4 Body | `경기 결과를 학습해 분석 정확도를 높입니다.` |

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
| Description | `EDGE가 오늘 가장 가치 있는 경기를 찾아드립니다. EDGE Score, Confidence, EDGE와 분석 근거를 제공합니다.` |

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

## EDGE Detail

페이지: `/analysis/[gameId]`  
경기 하나를 선택했을 때 보는 핵심 분석 화면.

| Key | Copy | Status |
|-----|------|--------|
| Back | `← 뒤로가기` | 사용 중 |
| Hero Label | `EDGE Pick` | 사용 중 |
| Pick Format | `{team} 승` | 사용 중 |
| Stat · Win Probability | `승리 확률` | 사용 중 |
| Stat · Confidence | `EDGE Confidence` | 사용 중 |
| Stat · Confidence Hint | `매우 높음` / `높음` / `보통` / `낮음` | 사용 중 |
| Stat · EDGE Score | `EDGE Score` | 사용 중 |
| Stat · EDGE Score Hint | `Strong Edge` / `Solid Edge` / `Slight Edge` / `Marginal Edge` | 사용 중 |
| Stat · Grade | `EDGE Grade` | 사용 중 |
| Summary Label | `EDGE 한줄 요약` | 사용 중 |
| Reasons Title | `추천 이유` | 사용 중 |
| Risks Title | `주의 요소` | 사용 중 |
| Score Title | `예상 점수` | 사용 중 |
| Disclaimer | `현재 시제품은 예시 데이터를 사용합니다.` | 사용 중 (`constants/prototype.ts`) |
| Not Found | `경기를 찾을 수 없습니다.` | 사용 중 |
| No Analysis | `이 경기의 EDGE 데이터가 아직 준비되지 않았습니다.` | 사용 중 |
| Back to Games | `← 오늘 경기로 돌아가기` | 사용 중 |

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
| Detail Analysis | `상세 분석 →` | Home EDGE Pick |
| Analyze | `분석` | Games card |
| Back | `← 뒤로가기` | EDGE Detail |
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
