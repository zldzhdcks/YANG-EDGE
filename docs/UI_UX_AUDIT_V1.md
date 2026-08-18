# YANG EDGE — UI/UX Audit & Design System Plan v1

Status: AUDIT / DESIGN PLAN ONLY  
Date: 2026-08-19  
Scope: `src/app`, `src/components`, `src/constants`, `src/app/globals.css`  
Non-goals: no UI refactor in this mission, no `data/` / Engine / Prediction mutation

This document is a foundation for later `UI_FOUNDATION_IMPLEMENTATION_V1`.  
It does **not** authorize deleting routes, rewriting engines, or rebuilding the entire UI.

Related product source of truth: `docs/PRODUCT_PHILOSOPHY.md`  
(first user = operator; 30-second understanding; read frozen artifacts, do not recompute)

---

## 1. Executive Summary

YANG EDGE already has a usable dark, data-first visual base: zinc/black surfaces, `max-w-5xl` public shell, shared `Button` / `Card` / `Badge` / `StatBox`, and a Header/Footer layout. The product identity in copy is closer to **sports research** than a betting shop.

The main problem is not “no design.” The main problem is **three UI languages living in one product**:

1. **Public marketing/research home** (`HeroSection`, `TodayEdgePicks`, `ResearchSlateGames`)
2. **Public games/ledger/feedback** (shared Card + list patterns)
3. **Internal YANG EDGE OS + MLB research consoles** (amber INTERNAL badge, `StatusPill`, dense tables, hash/path dumps)

On top of that:

- Public Header still exposes **Learning** and **Feedback** next to “오늘 경기” and “내 가계부”.
- **Login** is a dead `#login` hash. There is no login route.
- `/analysis/[gameId]` loads **real research artifacts**, then shows a **Dummy sample** banner.
- Game/pick cards exist in at least **six implementations**.
- Status words (`GOOD`, `PASS`, `BLOCKED`, `LIMITED_INPUT`) are engine language; UI shows them inconsistently, often color-only.

Direction: extract and unify, do not rebuild. Keep routes. Hide internal/dev surfaces from public nav. Make Home a 30-second research status board. Share one Game Card shell with three densities.

---

## 2. Current Route Map

Counted from `src/app/**/page.tsx`: **29 page routes**.  
API `route.ts` files are backends, not product pages. They are listed only as non-UI.

Header source: `src/constants/navigation.ts`  
Internal OS nav: `src/constants/yang-edge-os-nav.ts`  
There is **no `middleware.ts`**. Internal pages are reachable by URL with `robots: noindex` only.

| Route | Purpose (code) | Audience | In public Header | Duplicate | Use frequency (expected) | Home expose | Hide from public nav | Delete/merge candidate |
|---|---|---|---|---|---|---|---|---|
| `/` | Home: hero + TODAY EDGE PICK + research slate or today games | PUBLIC | Logo | Overlaps `/games` slate | Daily | Yes | No | Keep |
| `/games` | Date/league/search list → analysis | PUBLIC | Yes (“오늘 경기”) | Overlaps home slate | Daily | Link only | No | Keep |
| `/analysis/[gameId]` | Research artifact viewer | RESEARCH_PUBLIC | No (via cards) | Overlaps internal MLB game detail | Daily | No | No | Keep; fix sample banner |
| `/ledger` | Personal bet ledger (localStorage) | PRIVATE_USER | Yes | Unique | Daily for operator | Secondary CTA today | No | Keep |
| `/feedback` | Graded prediction review center | RESEARCH_PUBLIC | Yes | Overlaps `/internal/feedback/mlb` | After games | No | **Yes (proposed)** | Keep; move out of public header |
| `/learning` | Post-game learning dashboard | RESEARCH_PUBLIC | Yes | Overlaps internal tracker | Weekly | No | **Yes (proposed)** | Keep; move out of public header |
| `/picks` | Hardcoded sample EDGE Ranking | DEV_ONLY | No (`HIDDEN`) | Overlaps home picks + `/internal/daily` | Rare | No | Already hidden | Keep URL; do not promote |
| `/toto` | EDGE Combo / proto toto | DEV_ONLY | No (`HIDDEN`) | Unique combo UI | Rare | No | Already hidden | Keep URL; do not promote |
| `/kbo/odds-preview` | KBO domestic vs overseas odds preview | INTERNAL_ADMIN | No | Overlaps GameCard KBO comparison | Operator | No | Yes | Keep under internal later |
| `/internal` | Redirect → `/internal/dashboard` | INTERNAL_ADMIN | No | — | Daily operator | No | Yes | Keep redirect |
| `/internal/dashboard` | OS Dashboard | INTERNAL_ADMIN | No (OS nav) | — | Daily | No | Yes | Keep |
| `/internal/mission` | Mission Control | INTERNAL_ADMIN | No | — | Daily | No | Yes | Keep |
| `/internal/cto` | Weekly CTO room | INTERNAL_ADMIN | No | — | Weekly | No | Yes | Keep |
| `/internal/data` | Data Center | INTERNAL_ADMIN | No | — | Daily | No | Yes | Keep |
| `/internal/research` | Research Lab | INTERNAL_ADMIN | No | Overlaps public analysis | Daily | No | Yes | Keep |
| `/internal/engine` | Engine Center (read-only UI) | INTERNAL_ADMIN | No | — | As needed | No | Yes | Keep |
| `/internal/developer` | Hash / artifact / runtime | DEV_ONLY | No | — | Debug | No | Yes | Keep |
| `/internal/settings` | Owner display settings | INTERNAL_ADMIN | No | — | Rare | No | Yes | Keep |
| `/internal/daily` | MLB Daily Picks view | INTERNAL_ADMIN | No | Overlaps home EDGE PICK | Daily | No | Yes | Keep; later share card shell |
| `/internal/research/mlb` | MLB research UX dashboard | INTERNAL_ADMIN | No | — | Daily | No | Yes | Keep |
| `/internal/research/mlb/[gamePk]` | MLB game detail UX | INTERNAL_ADMIN | No | Overlaps `/analysis/[gameId]` | Daily | No | Yes | Keep; later share status/header |
| `/internal/research/mlb/korean-odds` | Korean odds intake | INTERNAL_ADMIN | No | — | Pregame | No | Yes | Keep |
| `/internal/research/mlb/expected-lineup` | Expected lineup intake | INTERNAL_ADMIN | No | — | Pregame | No | Yes | Keep |
| `/internal/research/npb/odds` | NPB odds intake | INTERNAL_ADMIN | No | — | Pregame | No | Yes | Keep |
| `/internal/research/npb/starter` | NPB starter intake | INTERNAL_ADMIN | No | — | Pregame | No | Yes | Keep |
| `/internal/research/kbo/input` | KBO operator input | INTERNAL_ADMIN | No | Overlaps `/kbo/odds-preview` | Pregame | No | Yes | Keep |
| `/internal/feedback/mlb` | MLB good-pick feedback | INTERNAL_ADMIN | No | Overlaps `/feedback` | Postgame | No | Yes | Keep |
| `/internal/feedback/mlb/tracker` | Learning tracker | INTERNAL_ADMIN | No | Overlaps `/learning` | Postgame | No | Yes | Keep |
| `/internal/kbo/personnel` | KBO T45 personnel admin | INTERNAL_ADMIN | No | Unique | As needed | No | Yes | Keep |

**Non-page APIs (not in UI inventory as pages):**  
`/api/games`, `/api/today-games`, `/api/today-edge-picks`, `/api/today-pick`, `/api/featured`, `/api/odds`, `/api/analysis/[gameId]`, `/api/research/daily-slate`, `/api/football/fixtures`, `/api/toto/current`, plus internal KBO OCR/personnel and intake `save` routes.

**Dead public CTA:** Header “로그인” → `/#login`. No `/login` page exists.

---

## 3. Current Component Map

### 3.1 Folders under `src/components`

| Folder | Role | Notes |
|---|---|---|
| `layout/` | Header, Footer | Public shell only. Internal uses `OsShell`. |
| `ui/` | Button, Card, Badge, StatBox, EdgeEngineLoader, PrototypeDisclaimer | Canonical primitives. Underused in OS/MLB views. |
| `home/` | Hero, TodayEdgePicks, TodayGames, ResearchSlateGames, SportCard, plus unused TodayPick stack | Two home game sections; unused Dummy-era cards remain |
| `games/` | DatePicker, filters, GameList, GameCard | Production public list |
| `analysis/` | ResearchAnalysisViewer (live) + unused AnalysisContent stack | Split brain |
| `picks/` | Sample ranking cards | Hidden route |
| `research/` | PredictionResultBadge | Shared hit/fail |
| `kbo/` | KboOddsComparisonCard | Preview page |
| `mlb/` | DailyPicksView, research UX, game detail, good-pick views | Internal |
| `ledger/` | Personal ledger | Private |
| `learning/` | Bucket tables | Public nav today |
| `feedback/` | Feedback cards/summary | Public nav today |
| `toto/` | Combo UI | Hidden |
| `internal/` | OS shell + research intake + operator home | Separate visual language |
| `clipboard-intake/` | Image drop | Operator intake |

### 3.2 Shared primitive coverage

| Primitive | Canonical | Also implemented as | Verdict |
|---|---|---|---|
| Card | `ui/Card` (`rounded-2xl`, `bg-zinc-900`) | Home PickCard wraps Card but `rounded-xl`; OS cards are raw `border-zinc-*`; DailyPicks / MlbGameDetail use custom bordered boxes | Extract variants, keep one component |
| Badge | `ui/Badge` (default/accent/success/warning/danger/muted) | `StatusPill`; inline `rounded-full` / `rounded border` pills; research score status spans; DailyPicks `RESEARCH ONLY` | Add status variant map on Badge |
| Button | `ui/Button` (primary/secondary/outline/ghost + `href`) | `AnalysisNavLink` text links; GameCard CTA is a **span** with `buttonClasses`; many raw `<a>` in OsShell | Keep Button; stop span-as-button |
| Status | None shared for GOOD/PASS/BLOCKED | Badge colors, StatusPill READY/WARNING/BLOCKED/OFF, research `OK`/`BLOCKED` chips, PredictionResultBadge | New `StatusBadge` wrapper |
| Tabs | None | LeagueFilter / RecommendationFilter chip rows | Chip filter, not tabs |
| Table | None | Learning, ledger, OS SystemDetail, MLB summary | Shared `DataTable` later (P2) |
| Odds display | Inline in GameCard + KboOddsComparisonCard + ResearchAnalysisViewer | Three formats (row / labeled pair / 2-col grid) | Shared `OddsPair` |
| Probability | StatBox + ad-hoc `%` | DailyPicks, TodayEdgePicks, analysis | Shared numeric text style |
| Game header | GameCard title vs analysis matchLabel vs MLB headline | Three headers | Shared `GameHeader` |
| Section title | Mix of `uppercase tracking-widest text-blue-500` and `text-lg font-semibold` | Home vs games vs analysis | Tokenize |
| Empty | Card copy vs one-line `compactEmpty` vs OS waiting boxes | Inconsistent | Shared EmptyState (P1) |
| Loading/error | Games Suspense Card; home compactEmpty; OS error red box | No shared ErrorState | P1 |

### 3.3 Unused / leftover UI (do not delete in this mission)

Home Dummy-era stack not mounted on `/`:

- `TodayPick.tsx`, `TodayPickStats.tsx`, `TodayPickReasons.tsx`
- `WhyYangEdge.tsx`, `FeatureCard.tsx`

Analysis Dummy-era stack not mounted on `/analysis/[gameId]`:

- `AnalysisContent.tsx`, `PredictionHero.tsx`, `ScoreCard.tsx`, `EdgeDna.tsx`, `ReasonList.tsx`, `RiskList.tsx`, `BottomButtons.tsx`

These are **reuse/archive candidates**, not automatic deletes.

---

## 4. UX Problems

### Top 10 (severity for public/operator product)

1. **Public nav mixes consumer tasks with research labs.** Header: 오늘 경기 / 가계부 / 피드백 / Learning / 로그인. Learning and Feedback are post-game research consoles.
2. **Login is fake.** `/#login` has no target. Damages trust.
3. **Home does not answer “today’s research status” in 30 seconds.** Hero is slogan-first. Snapshot presence, pick eligibility, and slate completeness are buried in EDGE PICK metadata.
4. **Home primary CTA includes 가계부.** Ledger is a private tracker. It reads more like a betting product than research.
5. **Analysis page authenticity conflict.** `loadResearchAnalysisView` reads frozen artifacts, but the page always renders `SampleAnalysisNotice` (DummyEngine copy).
6. **Too many game/pick cards.** Users learn a different card on Home, Games, Picks sample, Daily Picks, Feedback, KBO preview.
7. **Status language is raw engine codes** on analysis (`BLOCKED`, `NOT_ELIGIBLE`, `LIMITED_INPUT` via warnings) while Home uses EDGE PICK / 연구 후보.
8. **Hit/fail is color-heavy.** `PredictionResultBadge` is green/red only. Learning tables use emerald/rose for hits/fails.
9. **Internal OS is a second product** (`max-w-6xl`, amber INTERNAL, emoji medals, hash snippets) with no auth gate.
10. **Information density on analysis** dumps artifact filenames, dual KO+code lines, and many equal-weight sections. Operator needs this; public users should see a shorter default.

Additional (not top 10): `/picks` star-rating + rank trophy feel; Toto 승/무/패 badges; SportCard “샘플 분석” counts if TodayGames fallback shows.

---

## 5. Inconsistency Inventory

### Visual tokens

| Token | globals.css / layout | Actual usage |
|---|---|---|
| Page bg | `--background: #09090b` | Also hardcoded `bg-[#09090b]` on body, Header, OsShell |
| Surface | `--surface: #18181b` | Rarely used; cards use `bg-zinc-900` / `bg-white/[0.02]` |
| Border | `--border: rgba(255,255,255,0.06)` | Mix `white/[0.06]`, `white/[0.08]`, `zinc-800` |
| Accent | `--accent: #3b82f6` | Buttons use `blue-600`; labels use `text-blue-500` |
| Radius | none in tokens | Card `rounded-2xl`; most overrides `rounded-xl`; StatusPill `rounded-full` |
| Shadow | none | Primary button `shadow-lg shadow-blue-500/20` |
| Container | none | Public `max-w-5xl`; OS `max-w-6xl` |
| Type | Noto Sans KR + Geist + Geist Mono | Display not applied as a scale; sizes ad hoc (`text-3xl` hero vs `text-2xl` page titles) |

### Copy / identity

- Hero: “가치를 찾습니다” + 축구·야구·농구 (research tone — good).
- Metadata title: “AI 스포츠 분석 플랫폼” (product).
- Ledger metadata: “개인 베팅 가계부” (betting-tool tone).
- Sample banners vs Footer legal vs EDGE PICK footnote vs Ledger aside — four disclaimer channels.

### Interaction

- Public Header uses Next `Link`.
- OsShell nav uses raw `<a href>`.
- GameCard whole row is a link; inner CTA is a non-interactive span styled as a button.

---

## 6. Proposed Information Architecture

Do **not** rename existing routes in the next implementation. Change **what is linked**, not URLs.

### CURRENT IA

```text
Public Header
  YANG EDGE (/)
  오늘 경기 (/games)
  내 가계부 (/ledger)
  피드백 (/feedback)
  Learning (/learning)
  로그인 (/#login)     ← dead

Hidden but live
  /analysis/[gameId]
  /picks
  /toto
  /kbo/odds-preview

Internal OS (separate chrome)
  /internal/*  (dashboard, mission, cto, data, research, engine, developer, settings)
  nested research/intake/feedback/kbo admin
```

### PROBLEM

- Public IA looks like a mini research lab + wallet + fake auth.
- Analysis, the actual research detail route, is not named in nav (OK) but Home does not explain the relationship.
- Internal and public both show “picks / feedback / learning” with different chrome.
- No public “how we research” surface; philosophy lives in `docs/` only.

### PROPOSED IA (link map only)

```text
PUBLIC
  HOME          /
  GAMES         /games
    → ANALYSIS  /analysis/[gameId]   (from cards, not a header item)
  MY            /ledger

RESEARCH_PUBLIC (not in Header; footer or /research later)
  Feedback      /feedback
  Learning      /learning
  Method/notes  docs-backed page later (new route needs approval)

HIDDEN / DIRECT URL
  /picks
  /toto
  /kbo/odds-preview

INTERNAL_ADMIN (keep OsShell; never in public Header)
  /internal/*

DEV_ONLY
  /internal/developer
  /picks (sample)
```

Header proposal (labels, same hrefs):

| Label | href |
|---|---|
| YANG EDGE | `/` |
| 오늘 경기 | `/games` |
| 내 가계부 | `/ledger` |

Remove from Header: 피드백, Learning, 로그인.  
Optional later (approval): “연구 기록” grouping Feedback+Learning in Footer, not Header.

Internal stays on `/internal/*`. No public “Admin” item.

---

## 7. Design System Proposal

Implementation belongs to a later mission. Tokens should map onto existing Tailwind, not a new CSS framework.

### 7.1 Surface

| Token | Candidate | Maps today |
|---|---|---|
| `surface.page` | `#09090b` | `--background` |
| `surface.section` | transparent | home sections |
| `surface.card` | `zinc-900` + `white/8` border | `ui/Card` |
| `surface.card-muted` | `white/[0.02]` | Footer legal, ledger aside |

Avoid extra neon gradients. PickCard top-rank blue gradient should be optional, not default.

### 7.2 Text

| Token | Candidate |
|---|---|
| `text.primary` | `zinc-100` / white |
| `text.secondary` | `zinc-400` |
| `text.muted` | `zinc-500`–`zinc-600` (prefer 500 for body captions; 600 only on legal) |

### 7.3 Border

| Token | Candidate |
|---|---|
| `border.default` | `white/[0.06]` |
| `border.strong` | `white/[0.10]`–`[0.14]` (hover) |

Deprecate mixed `zinc-800` on public pages; keep OS on zinc if needed, then converge.

### 7.4 Semantic (never color-only)

| Token | Color direction | Must pair with |
|---|---|---|
| `success` | emerald, low saturation | text “적중” / icon |
| `warning` | amber | text “주의” |
| `blocked` | zinc or muted red, not casino red | text “보류/차단” |
| `neutral` | zinc | default |
| `research` | blue / sky | “연구” not “베팅” |

### 7.5 Spacing

| Token | Candidate |
|---|---|
| `space.section` | `pb-16` + `px-4 sm:px-6` (already home) |
| `space.card` | Card padding sm/md/lg (already) |
| `space.inline` | `gap-2` / `gap-3` |

### 7.6 Radius

| Token | Candidate |
|---|---|
| `radius.small` | `rounded-md` badges |
| `radius.medium` | `rounded-xl` cards (converge here) |
| `radius.large` | `rounded-2xl` hero/feature only |

### 7.7 Typography

| Role | Candidate |
|---|---|
| display | Hero only, `text-3xl sm:text-4xl md:text-5xl` |
| page title | `text-2xl font-bold` |
| section title | `text-lg font-semibold` **or** `text-xs tracking-widest uppercase` for kicker — pick one kicker style |
| card title | `text-base sm:text-lg font-semibold` |
| body | `text-sm leading-relaxed` |
| caption | `text-xs` / `text-[11px]` muted |
| numeric | `tabular-nums` (already used in GameCard, StatBox, analysis times) — **make required** for odds, probability, scores |

Fonts stay Noto Sans KR + Geist. Geist Mono only for hashes/codes on internal/technical folds.

### 7.8 Button

Keep `ui/Button`. Reduce primary shadow on research pages (outline/secondary for ledger). Do not add neon glow.

---

## 8. Core Status Language

Unify labels. Engine codes may remain in a technical fold, not as the only badge text.

| Engine / data status | User-facing name | Meaning | Badge direction | Emphasis | Public? |
|---|---|---|---|---|---|
| GOOD | 연구 후보 · 양호 | Meets current research bar (not a bet tip) | research/blue + text | Medium | Yes, if pick exists |
| PASS | 보류 | Not an official pick; research still recorded | muted zinc + text | Low | Yes |
| BLOCKED | 연구 불가 | Integrity/cutoff/insufficient — do not treat as pick | blocked + text | Medium | Yes, short |
| ELIGIBLE | 입력 충족 | Inputs complete enough for official path | muted | Low | Prefer hide; show “입력 충족” in detail |
| LIMITED_INPUT | 입력 제한 | Missing lineup/starter etc. | warning + text | Medium | Yes on detail; optional on compact card |
| NOT_RELEASED | 라인업 미발표 | Official lineup not out | muted | Low | Yes |
| NOT_COLLECTED | 미수집 | Dataset row absent | muted | Low | Detail / operator |
| FINAL | 경기 종료 | Game finished | muted | Low | Yes |
| PENDING | 결과 대기 | Snapshot exists, result not graded | muted | Low | Yes |
| EDGE_PICK (home) | TODAY EDGE PICK | Strict selection from snapshot | research | High, max 3 | Yes |
| RESEARCH_CANDIDATE | 연구 후보 | Not strict EDGE PICK | muted | Low | Yes, labeled as not official |

**Rule:** icon + short Korean label + optional code in `<span class="font-mono">` on internal/detail only.

Do not use 빨강/초록 as the only difference between 적중/실패. Keep `PredictionResultBadge` text; add a non-color mark (✓ / ·).

---

## 9. Game Card Architecture

### Current cards (do not delete; wrap later)

| Component | Used on | Density today |
|---|---|---|
| `games/GameCard` | `/games` | STANDARD+ (odds, grade, research outcome) |
| `home/TodayEdgePicks` inner PickCard | `/` | DETAIL |
| `home/ResearchSlateGames` | `/` | COMPACT |
| `home/SportCard` | `/` fallback | Not a game card (sport summary) |
| `picks/PickCard` | `/picks` | DETAIL + rank/stars |
| `mlb/daily-picks/DailyPicksView` PickCard | `/internal/daily` | DETAIL + hash |
| `kbo/KboOddsComparisonCard` | `/kbo/odds-preview` | DETAIL odds |
| `feedback/FeedbackGameCard` | `/feedback` | DETAIL postgame |
| `toto/TotoMatchCard` | `/toto` | Combo-specific |

### Proposed shell (reuse GameCard first)

```text
GameCardShell
  Header:  league · status · start time
  Teams:   away / home (match label via existing getMatchDisplayLabel)
  Market:  optional odds pair
  Research: optional probability / confidence / research status
  Action:  연구 보기 → /analysis/[gameId]
```

| Density | Where | Include | Exclude |
|---|---|---|---|
| COMPACT | Home slate | league, time, match, status, link | odds, factors, hash, dual market |
| STANDARD | `/games` | COMPACT + one odds row + one status badge | starter names, artifact paths |
| DETAIL | analysis header / internal daily | STANDARD + probability/confidence + missing-input | full factor dump (that stays on analysis body) |

KBO dual odds stay a **slot** in STANDARD when `oddsComparison` exists (already in GameCard). Do not put dual odds on Home compact.

---

## 10. Analysis Detail Architecture

**Live page:** `/analysis/[gameId]` → `ResearchAnalysisViewer`  
**Dead page stack:** `AnalysisContent` (Dummy engine VM)

### Current section order (code)

1. Back link + optional sample banner (page wrapper)
2. Game header (종료 시 점수 + 적중 배지)
3. Research Score checklist
4. 경기 전 예측
5. 투수진 현황
6. 라인업 확인
7. 시장 배당
8. 배당 비교 (KBO)
9. 데이터 최신성
10. 오늘 변경
11. 경기 후 복기
12. Source paths / operational filenames (top and scattered)

### Proposed default order (public + operator)

1. **Game Header** — match, league, start, FINAL/PENDING  
2. **Research Status** — PASS / BLOCKED / LIMITED_INPUT / EDGE eligibility (short)  
3. **Prediction Summary** — pick/probability/confidence/research-only  
4. **Market Comparison** — domestic vs overseas when present  
5. **Starter / Lineup**  
6. **Key Factors** — only if already in viewer; do not invent  
7. **Evidence / Data Availability** — Research Score list  
8. **Model Explanation** — folded by default for public  
9. **Research Disclaimer** — one calm line, not a second dummy banner  
10. **Postgame / Review** — only if finished  

**Fold by default (public):** artifact paths, raw status codes, dual English labels, hash.  
**Open by default (internal MLB detail can stay dense).**

Fix in implementation later: remove Dummy `SampleAnalysisNotice` from this page, or show it only when the view is actually dummy-sample.

---

## 11. Mobile Risks

Code-inspected. No live browser pass in this mission (no running app assumed). Widths: 375 / 430 / 768 / 1024 / 1440.

| Risk | Where | Breakpoints | P0? |
|---|---|---|---|
| Long match labels + CTA column | `GameCard` flex row | 375–430 | P0 |
| TODAY EDGE PICK `grid-cols-2` stats; `sm:grid-cols-4` | Home PickCard | 375 cramped; 640+ better | P0 |
| Header 5 items on desktop; hamburger OK | Header | 1024+ crowding of 5 links | P1 (after nav cut = P0 fix) |
| Learning `lg:grid-cols-6` summary + `min-w-[28rem]`/`[32rem]` tables | `/learning` | 375 overflow-x (handled) | P1 |
| Feedback `lg:grid-cols-6` | FeedbackSummary / FeedbackGameCard | 375 | P1 |
| Ledger table `min-w-[720px]` hidden until `md` | LedgerBetList | OK pattern | P2 |
| OS nav `overflow-x-auto min-w-max` | OsShell | 375 — acceptable | P2 |
| Chip filters `overflow-x-auto` | LeagueFilter, RecommendationFilter | 375 | P1 if chips wrap poorly |
| Analysis dense KO+mono code blocks | ResearchAnalysisViewer | all mobile | P0 for public readability |
| KBO odds `grid-cols-[72px_1fr_1fr]` | KboOddsComparisonCard | 375 OK | — |
| DatePicker `min-w-[9.5rem]` | Games toolbar | 375 + search + filters | P1 |
| `whitespace-nowrap` CTA | unused TodayPick | n/a until remounted | — |

1440px+: `max-w-5xl` leaves side margin — good, keep. Do not stretch cards to full 1440.

---

## 12. Accessibility Risks

| Issue | Where | Severity |
|---|---|---|
| Fake login control | Header Button `href="/#login"` | P0 trust + a11y (control goes nowhere) |
| Color-only 적중/실패 | PredictionResultBadge success/danger | P0 |
| Color-only hit/fail numbers | LearningBucketTable emerald vs rose | P1 |
| Span styled as button inside link | GameCard | P0 (confusing; redundant control) |
| Focus ring only on `ui/Button` | Most Links have hover only | P1 |
| Contrast `text-zinc-600` on `#09090b` | Footer legal, captions | P1 (legal too faint) |
| OsShell `<a>` without visible focus styles | Internal nav | P2 |
| StarRating uses characters, has aria-label | PickCard | OK |
| Header hamburger has aria-label/expanded | Header | OK |
| Sample / legal banners use `role="status"` | SampleAnalysisNotice, hidden picks/toto | OK pattern |
| Keyboard: mobile menu is button + links | Header | OK |
| Status by color in research score chips | Analysis | P1 |

No skip-to-content link. Add in foundation (P1).

---

## 13. Public / Internal Separation

| Class | Routes | Auth today | Recommendation |
|---|---|---|---|
| PUBLIC | `/`, `/games` | None | Keep in Header |
| RESEARCH_PUBLIC | `/analysis/[gameId]`, `/feedback`, `/learning` | None, some `noindex` | Analysis OK via games; Feedback/Learning out of Header; keep URLs |
| PRIVATE_USER | `/ledger` | None (localStorage) | Keep; not a betting lobby |
| INTERNAL_ADMIN | `/internal/*` except developer | **None** | Keep noindex; auth is a later approved mission, not this one |
| DEV_ONLY | `/internal/developer`, `/picks`, `/toto` | None | Stay unlinked |

**Do not delete.**  
**Do not add auth in the design-plan mission.**  
Record: internal research intake and engine center are world-readable by URL. That is an ops/security follow-up, not a visual refactor.

`/kbo/odds-preview` is INTERNAL-shaped (noindex, operator copy) sitting in the public `src/app/kbo` tree.

---

## 14. Priority Roadmap

Adjusted after inventory. Prefer extraction over new pages.

### P0 — Foundation (next implementation mission)

1. **Design tokens** in `globals.css` / Tailwind theme (surface, text, border, radius). No page redesign yet.
2. **Header IA:** drop Learning, Feedback, Login from `NAV_ITEMS`.
3. **Home hierarchy:** kicker = research status; one compact slate; EDGE PICK remains but calmer; ledger CTA demoted.
4. **Shared GameCardShell** starting from `games/GameCard` (COMPACT + STANDARD). Wire Home slate to COMPACT.
5. **Mobile:** GameCard stacking; EDGE PICK stats wrap; analysis default fold for paths/codes.
6. **Honesty:** analysis Dummy banner only when dummy; otherwise research-only line.

### P1

- `/games` toolbar + empty/error unification  
- Analysis detail section order + fold  
- StatusBadge for GOOD/PASS/BLOCKED/LIMITED_INPUT/NOT_RELEASED  
- OddsPair for GameCard + KBO comparison  
- Focus states on links  
- Footer link group for Feedback/Learning (no Header)

### P2

- Ledger visual polish (already structurally fine)  
- Feedback/Learning table chrome  
- Align DailyPicks / MlbGameDetail chips with StatusBadge  
- Archive or quarantine unused Dummy home/analysis components (approval)  
- Internal OS token alignment (not a rewrite)  
- Auth wall for `/internal` (separate security mission)

---

## 15. Explicit Non-Goals

- Do not rebuild the entire UI.
- Do not delete `/picks`, `/toto`, `/internal/*`, leftover Dummy components without approval.
- Do not rename `/games`, `/ledger`, `/analysis/[gameId]`.
- Do not restyle to casino/neon “sportsbook”.
- Do not put every research field on Home or on STANDARD cards.
- Do not change Engine weights, Prediction snapshots, Grades, Results, Providers, or `data/`.
- Do not implement this plan in the same change set as the audit.
- Do not add modal legal walls.
- Do not auto-run `UI_FOUNDATION_IMPLEMENTATION_V1`.

---

## Appendix A — Global design facts (as of audit)

**Typography:** Noto Sans KR 400–700, Geist, Geist Mono. `lang="ko"`. `antialiased`.  
**Header:** sticky, `h-14`, `max-w-5xl`, blur, hamburger `< md`.  
**Footer:** legal list from `LEGAL_NOTICE_ITEMS` + copyright + “준비 중” terms/privacy (spans, not links).  
**Breakpoints used:** `sm`, `md`, `lg`, `xl` (OS release grid). No `2xl` container.  
**Numeric:** `tabular-nums` present on odds/times/StatBox; not universal.

## Appendix B — Legal / trust UI locations

| Location | Content |
|---|---|
| Footer | 참고용 / 정확도 비보장 / 수익 비보장 / 이용자 책임 / 데이터 권리 / API 원칙 |
| `PrototypeDisclaimer` | Same idea; **only referenced from unused AnalysisContent** |
| Home EDGE PICK footnote | 실추천·베팅 조언 아님 |
| Analysis `SampleAnalysisNotice` | Dummy sample — **wrong if artifact is live research** |
| Ledger `LedgerDisclaimer` | Personal record, localStorage, no profit pitch |
| `/picks` `/toto` amber banners | Hidden feature warnings |
| KBO preview | 추천·구매 지시 아님 |
| Learning / Feedback intros | 재학습 결과 아님 |

**Proposal:** one short research-only line near prediction summary; keep Footer as the full legal list; do not add blocking modals.

## Appendix C — Header / Home current structure

Home (`src/app/page.tsx`):

1. Header  
2. HeroSection (slogan + 오늘 경기 / 내 가계부)  
3. TodayEdgePicks (up to 3 cards, primary+compact)  
4. ResearchSlateGames **or** TodayGames (sport summary cards)  
5. Footer  

First 5 seconds: slogan is clear; research status is not. Pick vs game vs sample is only clear after reading footnotes. Mobile length is high if 3 EDGE cards + full slate.

Proposed Home:

1. Header (short nav)  
2. Hero (one sentence research identity, single CTA to `/games`)  
3. Research status strip (date KST, snapshot yes/no, pick count, first pitch)  
4. EDGE PICK compact (0–3)  
5. Today slate COMPACT  
6. Footer legal  

Empty EDGE PICK already has a decent calm card — keep that pattern.
