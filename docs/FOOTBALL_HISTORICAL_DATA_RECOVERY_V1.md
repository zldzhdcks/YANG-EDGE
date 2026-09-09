# Football historical data recovery v1

MISSION_ID: FOOTBALL_BASELINE_FREEZE_HISTORICAL_RECOVERY_V1
BASE_SHA: 979f883136ea9e5763dd0082b7ec0105de412636
FOOTBALL_POISSON_BASELINE_COMMIT_SHA: 0b9eacd08208dd1e93d544be5e2997fa89e41265

Inventory SHA256: 4b2f8908e24e9a01718af26ddbdb21766c61b4d1339732cf52b03b4451a6a6c0

## Outcome

FOOTBALL_DATA_READINESS=INSUFFICIENT
BACKTEST=BACKTEST_BLOCKED_INSUFFICIENT_SAMPLE
Scanned 6814 JSON files and 9 CSV files; discovered 321 football-relevant JSON sources. Parse/read errors=0.
Raw recognized fixture/reference rows=3295; raw completed rows=291; duplicate completed occurrences=77; canonical completed-status matches=214.
Of these, regulation-score matches=172; status-only/no score=42; eligible past training candidates=170; exact result/identity conflicts=0.
Unknown season matches=2; excluded operational result rows have no verified team/league/kickoff bridge and are not admitted by fixture ID alone.

Completed kickoff range (UTC-equivalent instants): 2026-08-11T15:00:00.000Z through 2026-09-05T19:00:00.000Z.
Eligible past-result kickoff range: 2026-08-14T10:00:00.000Z through 2026-08-30T13:00:00.000Z.
Temporal evaluable targets=0; maximum prior same-competition matches=2, prior home-venue matches=0, prior away-venue matches=0.
No accuracy/log loss/Brier/calibration result was computed. The existing model requires 30 competition / 5 home venue / 5 away venue prior matches; zero targets pass. No threshold or weight was changed.

## Interpretation

The original two-match count covered only standard official-result artifacts. Extra completed matches exist in the August 26 fixture capture and September 5 prior-fixture artifact. Operational checkouts contain duplicates, not additional independent samples.
BACKTEST_ELIGIBLE_MATCHES counts rows usable as historical input only after their recorded result observation. It does NOT count predictions that can be evaluated today. The temporal gate audit checks each available completed target at kickoff minus 1 millisecond without running probability calculations.
Result finish timestamps are absent; no finish time is synthesized. A terminal result captured/observed after kickoff is used as conservative availability evidence. A historical result fetched September 5 is not admitted to an August prediction. Source hashes preserve inspected evidence; this audit does not independently verify provider payload truth.
Season values are provider values (including 2027), not guessed from kickoff year. Canonical fixture IDs drive deduplication. No team-name fuzzy matching, nearest kickoff matching, or manual score reconstruction.
Protected OCR, human truth, Validation-2, Fresh Validation and holdout paths were excluded before reading. No provider calls, production changes or UI work.

## By season

- 2026: completed=211, eligible=169
- 2027: completed=1, eligible=1
- UNKNOWN: 2

## By league

- fb-comp-api-football-10 (Friendlies): completed=1, eligible-after-observation=1
- fb-comp-api-football-1086 (Paulista - U20): completed=1, eligible-after-observation=1
- fb-comp-api-football-1126 (Esiliiga B): completed=1, eligible-after-observation=1
- fb-comp-api-football-1128 (Brasileiro U17): completed=8, eligible-after-observation=8
- fb-comp-api-football-114 (Superettan): completed=2, eligible-after-observation=2
- fb-comp-api-football-115 (Svenska Cupen): completed=2, eligible-after-observation=2
- fb-comp-api-football-121 (DBU Pokalen): completed=15, eligible-after-observation=15
- fb-comp-api-football-1232 (Copa De La Liga): completed=1, eligible-after-observation=1
- fb-comp-api-football-129 (Primera Nacional): completed=1, eligible-after-observation=1
- fb-comp-api-football-13 (CONMEBOL Libertadores): completed=1, eligible-after-observation=1
- fb-comp-api-football-131 (Primera B Metropolitana): completed=8, eligible-after-observation=8
- fb-comp-api-football-132 (Primera C): completed=2, eligible-after-observation=2
- fb-comp-api-football-135 (Serie A): completed=5, eligible-after-observation=2
- fb-comp-api-football-140 (La Liga): completed=9, eligible-after-observation=4
- fb-comp-api-football-165 (1. Deild): completed=1, eligible-after-observation=1
- fb-comp-api-football-173 (Second League): completed=2, eligible-after-observation=2
- fb-comp-api-football-182 (Challenge Cup): completed=19, eligible-after-observation=19
- fb-comp-api-football-2 (UEFA Champions League): completed=13, eligible-after-observation=3
- fb-comp-api-football-239 (Primera A): completed=1, eligible-after-observation=1
- fb-comp-api-football-240 (Primera B): completed=1, eligible-after-observation=1
- fb-comp-api-football-252 (Division Profesional - Clausura): completed=1, eligible-after-observation=1
- fb-comp-api-football-253 (name unavailable): completed=11, eligible-after-observation=0
- fb-comp-api-football-284 (Liga II): completed=1, eligible-after-observation=1
- fb-comp-api-football-288 (Premier Soccer League): completed=4, eligible-after-observation=4
- fb-comp-api-football-292 (name unavailable): completed=3, eligible-after-observation=0
- fb-comp-api-football-3 (name unavailable): completed=1, eligible-after-observation=0
- fb-comp-api-football-306 (Second Division): completed=1, eligible-after-observation=1
- fb-comp-api-football-307 (Pro League): completed=4, eligible-after-observation=4
- fb-comp-api-football-330 (Premier League): completed=2, eligible-after-observation=2
- fb-comp-api-football-344 (Primera División): completed=2, eligible-after-observation=2
- fb-comp-api-football-347 (Cup): completed=6, eligible-after-observation=6
- fb-comp-api-football-361 (1 Lyga): completed=1, eligible-after-observation=1
- fb-comp-api-football-365 (Virsliga): completed=1, eligible-after-observation=1
- fb-comp-api-football-369 (Super League): completed=1, eligible-after-observation=1
- fb-comp-api-football-39 (Premier League): completed=6, eligible-after-observation=4
- fb-comp-api-football-46 (EFL Trophy): completed=1, eligible-after-observation=1
- fb-comp-api-football-48 (League Cup): completed=17, eligible-after-observation=17
- fb-comp-api-football-501 (Copa Paraguay): completed=2, eligible-after-observation=2
- fb-comp-api-football-525 (UEFA Champions League Women): completed=1, eligible-after-observation=1
- fb-comp-api-football-542 (Iraqi League): completed=5, eligible-after-observation=5
- fb-comp-api-football-567 (Ligi kuu Bara): completed=2, eligible-after-observation=2
- fb-comp-api-football-59 (Non League Premier - Northern): completed=10, eligible-after-observation=10
- fb-comp-api-football-597 (Division 2 - Södra Götaland): completed=1, eligible-after-observation=1
- fb-comp-api-football-61 (name unavailable): completed=5, eligible-after-observation=0
- fb-comp-api-football-701 (Liga Revelação U23): completed=5, eligible-after-observation=5
- fb-comp-api-football-712 (Liga Femenina): completed=1, eligible-after-observation=1
- fb-comp-api-football-72 (Serie B): completed=2, eligible-after-observation=2
- fb-comp-api-football-73 (Copa Do Brasil): completed=1, eligible-after-observation=1
- fb-comp-api-football-759 (Liga Mayor): completed=2, eligible-after-observation=2
- fb-comp-api-football-772 (Leagues Cup): completed=1, eligible-after-observation=1
- fb-comp-api-football-78 (name unavailable): completed=2, eligible-after-observation=0
- fb-comp-api-football-83 (Regionalliga - Bayern): completed=1, eligible-after-observation=1
- fb-comp-api-football-85 (Regionalliga - Nordost): completed=4, eligible-after-observation=4
- fb-comp-api-football-871 (Premier League Cup): completed=1, eligible-after-observation=1
- fb-comp-api-football-906 (Reserve League): completed=6, eligible-after-observation=6
- fb-comp-api-football-930 (Copa Uruguay): completed=1, eligible-after-observation=1
- fb-comp-api-football-939 (Oberliga - Bayern Süd): completed=1, eligible-after-observation=1
- fb-comp-api-football-98 (name unavailable): completed=1, eligible-after-observation=1

## Governance / contract

- marketUsed=false; ODDS_USED_AS_MODEL_INPUT=NO; PROVIDER_PREDICTION_USED=NO.
- postgameUsed=false means TARGET postgame information; past final results are intentionally the training input.
- POSTGAME_LEAKAGE=NO and FUTURE_RESULT_LEAKAGE=NO in executed work: inventory only, no backtest predictions or live picks generated.
- cutoffGuard=true for declared input timestamps; observation authenticity belongs to source recovery/admission.
- drawProbability=YES; probabilitySum=1 within tested tolerance; PASS=INSUFFICIENT_DATA with null probabilities and reason codes.
- ENGINE_WEIGHT_TUNING=NO; PUBLIC_RECOMMENDATION=NO; VALIDATED_MODEL=NO; PRODUCTION_ENGINE=NO.

## Next exact action

Choose one competition with verifiable historical fixture IDs, regulation scores, teams and temporal provenance. Audit the existing provider collection capability and access rights before any new download. Build a prepared-input producer and retain actual retrieval times. Freeze a temporal evaluation design before looking at performance. Do not lower the baseline sample gates to make this inventory run.
Future prediction artifacts must retain fixture ID, cutoff, home/draw/away probabilities, model version, training count, latest used observation, PASS reasons, marketUsed=false and targetPostgameUsed=false; require a hashed pregame input snapshot. This mission only seals the pure baseline and inventory; no production adapter is claimed.

Reproduce: node scripts/audit-football-historical-data-inventory-v1.mjs
Audit tests: node scripts/test-football-historical-data-inventory-v1.mjs
Baseline tests: node_modules/.bin/tsx.cmd scripts/test-football-poisson-research-v1.ts
Full-project typecheck previously failed in existing MLB/OCR/audit files; baseline scoped typecheck passed. Do not interpret this as a clean whole-project build.
