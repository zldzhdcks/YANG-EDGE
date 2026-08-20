/**
 * Provider capability gap matrix — repository + official docs + public MLB probe.
 * Market odds are inventory-only; they are not Independent player features.
 */
import type { GapMatrixRow } from "./types";

function row(
  sport: GapMatrixRow["sport"],
  category: string,
  feature: string,
  provider: string,
  availability: GapMatrixRow["availability"],
  currentPlanKnown: GapMatrixRow["currentPlanKnown"],
  stored: boolean,
  pregameDataset: boolean,
  featureReady: boolean,
  predictionUsed: boolean,
  evidenceGrade: GapMatrixRow["evidenceGrade"],
  evidence: string,
  gap: string,
  buildVsBuy: GapMatrixRow["buildVsBuy"],
  intakePriority: GapMatrixRow["intakePriority"],
  sampleConcern: string,
  leakageNote: string,
): GapMatrixRow {
  return {
    sport,
    category,
    feature,
    provider,
    availability,
    currentPlanKnown,
    stored,
    pregameDataset,
    featureReady,
    predictionUsed,
    evidenceGrade,
    evidence,
    gap,
    buildVsBuy,
    intakePriority,
    sampleConcern,
    leakageNote,
  };
}

const YES = true;
const NO = false;
const PLAN_UNK = "CURRENT_PLAN_UNKNOWN" as const;

export const PROVIDER_GAP_MATRIX: GapMatrixRow[] = [
  // --- MLB batter base ---
  row("MLB", "BATTER_BASE", "PA / AB / H / HR / RBI / BB / SO", "mlb-stats-api people stats gameLog group=hitting", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "Hitting gameLog keys observed 2026-08-20 for person 660271 season 2025. Boxscore stats.batting also has counts (prior cache). Lineup dataset stores identity only.", "Endpoint unused by starter/lineup builders. Need cutoff-safe season+gameLog persist.", "BUILD_FROM_EXISTING_RAW", "P0", "Game box batting is not season PA.", "Use only completed games before commence cutoff, same as pitcher gameLog."),
  row("MLB", "BATTER_BASE", "AVG / OBP / SLG / OPS", "mlb-stats-api hitting gameLog / season", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "gameLog.stat includes avg, obp, slg, ops. Prior pregame box sample lacked these rate fields.", "Not stored. Reconstruct from cutoff gameLog rather than live seasonStats.", "BUILD_FROM_EXISTING_RAW", "P0", "One-game AVG is noise; store sampleSize=PA.", "Do not use in-progress game rates as pregame."),
  row("MLB", "BATTER_BASE", "ISO", "mlb-stats-api stats=seasonAdvanced group=hitting", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "seasonAdvanced.stat.iso observed. Also DERIVE as SLG-AVG once those exist.", "Not stored.", "DERIVE_FROM_EXISTING_HISTORY", "P1", "Inherits SLG sample.", "Cutoff required."),
  row("MLB", "BATTER_BASE", "BABIP / K% / BB% / HR%", "mlb-stats-api gameLog counts + seasonAdvanced rates", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "babip, strikeOuts, baseOnBalls, plateAppearances, strikeoutsPerPlateAppearance, walksPerPlateAppearance, homeRunsPerPlateAppearance observed.", "Rates should be stored with PA. Not in batter dataset.", "DERIVE_FROM_EXISTING_HISTORY", "P1", "BABIP unstable in small PA.", "Cutoff required."),
  row("MLB", "BATTER_BASE", "wOBA / wRC / wRC+", "mlb-stats-api stats=sabermetrics group=hitting", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "sabermetrics keys include woba, wRc, wRcPlus. Not in gameLog keys.", "Not fetched by current builders. SportsDataIO dictionary also has WeightedOnBasePercentage but is not research SoT.", "BUILD_FROM_EXISTING_RAW", "P1", "Do not treat one-week wRC+ as destiny.", "As-of season saber must exclude today's game."),
  row("MLB", "BATTER_BASE", "OPS+", "mlb-stats-api / sportsdataio", "UNKNOWN", PLAN_UNK, NO, NO, NO, NO, "D", "Not in observed hitting gameLog or sabermetrics hitting keys. SportsDataIO dictionary page did not show OPS+ in the fetched MLB dictionary excerpt.", "Do not invent park-adjusted OPS+.", "NOT_CURRENTLY_FEASIBLE", "P3", "Park adjustment needs dated park factors.", "n/a"),
  row("MLB", "BATTER_BASE", "HardHit% / Barrel% / EV / LA", "mlb-stats-api tracking / metricAverages", "NOT_AVAILABLE", YES, NO, NO, NO, NO, "B", "tracking hitting returned empty splits. metricAverages HTTP 500. SportsDataIO official dictionary had no Barrel/HardHit/ExitVelocity fields in the fetched page.", "Statcast-class source not wired. Do not scrape Baseball Savant. No purchase this mission.", "BUY_PROVIDER", "P3", "Even if bought, tiny PA splits are noise.", "n/a"),
  row("MLB", "BATTER_BASE", "xBA / xSLG / xwOBA", "mlb-stats-api stats=expectedStatistics", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "expectedStatistics.stat keys: avg, slg, woba, wobaCon. Field names are not prefixed with x. Treat as expected-stat payload, not proven xwOBA glossary until MLB names are documented.", "Unused. Do not rename to FanGraphs xwOBA without glossary check.", "BUILD_FROM_EXISTING_RAW", "P2", "Expected stats still need PA/BIP sample.", "Cutoff required."),
  row("MLB", "BATTER_BASE", "batSide", "mlb-stats-api /people batSide", "AVAILABLE_CURRENT_PROVIDER", YES, NO, NO, NO, NO, "B", "Person cache has batSide. Confirmed lineup battingSideCollected=0.", "Join onto lineup slots. Same playerId as Stats API stats.", "BUILD_FROM_EXISTING_RAW", "P0", "Identity, not a split.", "Safe identity."),

  // --- splits / pitch type ---
  row("MLB", "BATTER_SPLITS", "vs LHP / vs RHP / home / away / day / night", "mlb-stats-api stats=statSplits sitCodes=vl,vr,h,a,d,n", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "Probe returned six splits with PA/AVG/OBP/SLG/OPS. 602 situationCodes exist including d7/d30/l10.", "Unused. Always persist plateAppearances as sampleSize.", "BUILD_FROM_EXISTING_RAW", "P1", "Classic small-sample trap. Shrink toward player baseline later; coefficient UNDEFINED.", "Season-to-date splits must stop before first pitch."),
  row("MLB", "BATTER_SPLITS", "recent 7/14/30 day / last 10", "mlb-stats-api sitCodes d7,d30,l10 or stats=lastXGames / byDateRange", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "A", "situationCodes include d7, d30, l10. statTypes include lastXGames, byDateRange. lastXGames payload not fetched this mission (Grade C for body).", "Need cutoff-bounded window, not rolling including today.", "BUILD_FROM_EXISTING_RAW", "P1", "7-day windows often <20 PA.", "byDateRange endDate must be yesterday relative to commence."),
  row("MLB", "BATTER_PITCH_TYPE", "vs FF/SL/CU/CH/FC/SI/ST BA/SLG/whiff/run value", "mlb-stats-api pitchLog/playLog (unverified body)", "UNKNOWN", YES, NO, NO, NO, NO, "C", "statTypes list pitchLog and playLog. Pitch-type batter performance not in hitting gameLog or statSplits keys. pitchArsenal is pitcher usage/speed, not batter vs pitch.", "Do not infer batter pitch-type skill from pitcher arsenal. Optional later probe of playLog; no bulk.", "NOT_CURRENTLY_FEASIBLE", "P2", "Cell n often <10.", "Play-level logs can leak if current game included."),

  // --- starter ---
  row("MLB", "STARTER_BASE", "ERA / WHIP / IP / K / BB / HR", "mlb-stats-api pitching gameLog", "STORED_ALREADY", YES, YES, YES, YES, YES, "B", "starter-dataset-v1. prediction-v0 uses ERA/WHIP only.", "K/BB/HR stored unused.", "BUILD_FROM_EXISTING_RAW", "P0", "ERA needs IP shrink (already in v0).", "Existing cutoff aggregate."),
  row("MLB", "STARTER_BASE", "K/9 BB/9 HR/9 BF GO/AO strike% P/Inn", "mlb-stats-api pitching gameLog.stat (raw cache)", "AVAILABLE_CURRENT_PROVIDER", YES, NO, NO, NO, NO, "B", "Keys already in cached pitching gameLog (prior player-condition probe).", "Copy into starter dataset with sample IP.", "BUILD_FROM_EXISTING_RAW", "P0", "Per-start rates noisy.", "Existing cutoff."),
  row("MLB", "STARTER_BASE", "K% / BB% / K-BB%", "derived from K, BB, BF", "AVAILABLE_CURRENT_PROVIDER", YES, NO, NO, NO, NO, "B", "BF and K/BB exist in raw pitching gameLog. Not stored as rates.", "Derive after persisting BF.", "DERIVE_FROM_EXISTING_HISTORY", "P0", "Needs BF not just IP.", "Cutoff."),
  row("MLB", "STARTER_BASE", "FIP / xFIP / ERA-", "mlb-stats-api sabermetrics group=pitching", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "Keys fip, xfip, eraMinus, fipMinus observed for pitcher 656876 season 2025. SIERA / xERA names not present.", "Unused endpoint. SportsDataIO dictionary also has FieldingIndependentPitching — other provider, not SoT.", "BUILD_FROM_EXISTING_RAW", "P1", "Do not back into FIP with unofficial constants if saber FIP is already returned.", "As-of only."),
  row("MLB", "STARTER_BASE", "SIERA / named xERA", "mlb-stats-api observed saber keys", "NOT_AVAILABLE", YES, NO, NO, NO, NO, "B", "Not in sabermetrics pitching keys. expectedStatistics has avg/slg/woba allowed, not SIERA.", "Do not alias xfip as SIERA.", "NOT_CURRENTLY_FEASIBLE", "NONE", "n/a", "n/a"),
  row("MLB", "STARTER_ARSENAL", "pitch mix % + average velocity by type", "mlb-stats-api stats=pitchArsenal", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "Observed types FF,SI,FC,SL,ST,CU,CH with percentage, averageSpeed, count, totalPitches.", "Unused. No spin, extension, movement, CSW, run value in this payload.", "BUILD_FROM_EXISTING_RAW", "P1", "Slider n=5 in the sample pitcher is not a repertoire conclusion.", "Season-to-date must exclude today's pitches."),
  row("MLB", "STARTER_ARSENAL", "spin / extension / movement / CSW / pitch RV", "mlb-stats-api pitchArsenal observed keys", "NOT_AVAILABLE", YES, NO, NO, NO, NO, "B", "pitchArsenal keys are type/percentage/averageSpeed/count/totalPitches only. tracking empty. No Statcast client.", "Needs pitch-quality feed beyond pitchArsenal. No purchase this mission.", "BUY_PROVIDER", "P2", "Pitch-level.", "n/a"),
  row("MLB", "STARTER_CONDITION", "recent 3/5 starts + pitch count", "starter-dataset-v1 recentStarts[]", "STORED_ALREADY", YES, YES, YES, NO, NO, "B", "Up to 5 starts stored. prediction-v0 does not read the array.", "Use as condition window with sampleSize. Weight UNDEFINED.", "BUILD_FROM_EXISTING_RAW", "P0", "3 starts is tiny.", "Postgame log of prior start is legal pregame for the next game if as-of cutoff holds."),
  row("MLB", "STARTER_CONDITION", "velocity / mix / K-BB trend", "pitchArsenal + recentStarts + BF", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "B", "Components exist separately. No trend dataset.", "Derive later after P0 persist.", "DERIVE_FROM_EXISTING_HISTORY", "P1", "Need start-level arsenal, not season blob only.", "Each start must be dated before cutoff."),

  // --- bullpen / lineup / env ---
  row("MLB", "BULLPEN", "identity + inferred role + pitches 1/2/3d + B2B", "mlb-stats-api appearances → bullpen-role-dataset-v1_1", "STORED_ALREADY", YES, YES, YES, NO, NO, "B", "July sample dates. engineEligible false. v0 weight 0. Separates season role vs today fatigue snapshots.", "Expand dates. Do not Engine-admit.", "BUILD_FROM_EXISTING_RAW", "P0", "Classifier already has INSUFFICIENT_SAMPLE.", "Appearances after cutoff forbidden."),
  row("MLB", "BULLPEN", "reliever FIP / platoon", "sabermetrics + statSplits unused for relievers", "AVAILABLE_DIFFERENT_ENDPOINT", YES, NO, NO, NO, NO, "C", "Same saber/split endpoints could apply to reliever IDs. Not built.", "Role+workload first. Platoon n is tiny.", "BUILD_FROM_EXISTING_RAW", "P2", "Reliever splits collapse fast.", "Cutoff."),
  row("MLB", "LINEUP", "confirmed 1-9 playerId + order + position", "mlb-stats-api boxscore / hydrate=lineups", "STORED_ALREADY", YES, YES, YES, YES, NO, "B", "lineup-dataset-v1. Completeness used in v0 with weight 0.", "Join stats on playerId (same Stats API id). SportsDataIO PlayerID would need a map.", "BUILD_FROM_EXISTING_RAW", "P0", "Identity ≠ strength.", "Confirmed vs expected stay separate."),
  row("MLB", "LINEUP", "expected lineup (operator)", "expected-lineup-observation-v0", "STORED_ALREADY", YES, YES, YES, NO, NO, "B", "Manual observation. Engine input forbidden.", "Never auto-promote.", "BUILD_FROM_EXISTING_RAW", "P1", "Expected ≠ confirmed.", "Observation time vs cutoff."),
  row("MLB", "LINEUP", "SportsDataIO projected/confirmed lineups", "sportsdataio StartingLineupsByDate", "AVAILABLE_CURRENT_PROVIDER", PLAN_UNK, NO, NO, NO, NO, "C", "Method wired. Research datasets do not use it (sportsDataIoUsed=false). Trial scrambled blocked.", "Not needed if Stats API confirmed lineup is SoT. Mapping cost if dual-sourced.", "NOT_CURRENTLY_FEASIBLE", "NONE", "ID mismatch vs MLB person id.", "Do not mix scrambled trial."),
  row("MLB", "AVAILABILITY", "IL listed (40-man D* + transactions)", "mlb-stats-api injury-dataset-v1", "STORED_ALREADY", YES, YES, YES, NO, NO, "B", "July samples. Listed ≠ limited minutes.", "Map to availabilityStatus. No MRI.", "BUILD_FROM_EXISTING_RAW", "P1", "Listed ≠ severity.", "Roster as-of freeze."),
  row("MLB", "ENVIRONMENT", "dayNight", "mlb-stats-api schedule hydrate", "AVAILABLE_CURRENT_PROVIDER", YES, NO, NO, NO, NO, "B", "Observed on schedule games. mlb-schedule-v1 does not persist it.", "Store on schedule artifact. Interaction later.", "BUILD_FROM_EXISTING_RAW", "P3", "Day/night batter splits need large PA.", "Pregame schedule field."),
  row("MLB", "ENVIRONMENT", "roof type / turf / dimensions / elevation", "mlb-stats-api venues fieldInfo+location", "STORED_ALREADY", YES, YES, YES, NO, NO, "B", "roofType stored on weather-dataset (July). turf/elevation in raw cache unused. roofStatus always UNKNOWN.", "roof open/closed not observed.", "BUILD_FROM_EXISTING_RAW", "P3", "Park effects are park-specific.", "Venue identity is pregame-safe."),
  row("MLB", "ENVIRONMENT", "pregame forecast temp/wind/rain", "weather candidates not selected", "NOT_AVAILABLE", PLAN_UNK, NO, NO, NO, NO, "B", "weather-dataset forecast NOT_COLLECTED. SportsDataIO marketing lists Weather Forecasts; endpoint not wired and plan unknown.", "Do not use postgame observed weather as pregame. No purchase this mission.", "NOT_CURRENTLY_FEASIBLE", "P3", "Weather×player splits tiny.", "PRE_GAME FORECAST only if a provider is later selected."),
  row("MLB", "ENVIRONMENT", "park factor", "none in observed Stats API payloads", "NOT_AVAILABLE", YES, NO, NO, NO, NO, "B", "No park-factor type in repo or observed saber hitting keys.", "Do not invent from dimensions.", "NOT_CURRENTLY_FEASIBLE", "P3", "Needs multi-year sample.", "Dated factor table required."),
  row("MLB", "ID_MAP", "MLB personId vs SportsDataIO PlayerID vs API-Baseball id", "multiple", "AVAILABLE_OTHER_PROVIDER", PLAN_UNK, NO, NO, NO, NO, "C", "Research lineup/starter use MLB person ids. SportsDataIO and API-Baseball games use their own ids. No crosswalk dataset for MLB players.", "Prefer single-SoT Stats API join. Mapping is a project if dual provider.", "NOT_CURRENTLY_FEASIBLE", "P1", "Wrong joins silently destroy matchup research.", "n/a"),

  // --- Football ---
  row("FOOTBALL", "XI", "confirmed starting XI + formation + bench", "API-Football GET /fixtures/lineups", "AVAILABLE_CURRENT_PROVIDER", PLAN_UNK, NO, NO, NO, NO, "A", "Official beginner guide: formation, startXI, substitutes, coach. Code getLineups wired, returns raw unknown, unused by schedule/prediction.", "Typed lineup dataset with CONFIRMED vs NOT_RELEASED vs AFTER_CUTOFF. Expected XI is not a separate official feed — treat missing pre-release as NOT_RELEASED.", "BUILD_FROM_EXISTING_RAW", "P0", "Identity without replacement level is incomplete.", "Lineups often appear 20–40 min pre-kick; after cutoff is late."),
  row("FOOTBALL", "AVAILABILITY", "injuries / absences", "API-Football GET /injuries", "AVAILABLE_CURRENT_PROVIDER", PLAN_UNK, NO, NO, NO, NO, "A", "Official guide + code method. Unused. injured boolean also mentioned on /players profile.", "Typed injury dataset. Provider injury ≠ minutes restriction.", "BUILD_FROM_EXISTING_RAW", "P0", "Questionable vs out not always granular.", "As-of freeze."),
  row("FOOTBALL", "PLAYER_BASE", "minutes / appearances / starts / goals / assists / shots / SoT / penalties", "API-Football GET /players and /fixtures/players", "AVAILABLE_DIFFERENT_ENDPOINT", PLAN_UNK, NO, NO, NO, NO, "A", "Official beginner guide lists these fields. FootballProvider has no getPlayers. Dummy UI copy is not evidence.", "First player performance dataset. Paginated 20/page — quota design required, no bulk this mission.", "BUILD_FROM_EXISTING_RAW", "P0", "Minutes last-3 derived only after fixture player stats exist.", "Use completed fixtures before kickoff cutoff."),
  row("FOOTBALL", "PLAYER_BASE", "xG / npxG / xA / xG+xA / per90 xG", "API-Football documented player fields", "NOT_AVAILABLE", PLAN_UNK, NO, NO, NO, NO, "A", "Official getting-started field list for /players and /fixtures/players does not include expected goals. Full OpenAPI was Cloudflare-blocked this mission; residual undocumented fields remain possible but unconfirmed.", "Independent xG would need another provider after legal review. Do not buy in this mission.", "BUY_PROVIDER", "P2", "Even bought xG needs sample minutes.", "n/a"),
  row("FOOTBALL", "CREATION", "key passes / pass accuracy / dribbles / fouls", "API-Football /players + /fixtures/players", "AVAILABLE_DIFFERENT_ENDPOINT", PLAN_UNK, NO, NO, NO, NO, "A", "Official guide lists key passes, pass accuracy, dribbles, fouls.", "Unused endpoints.", "BUILD_FROM_EXISTING_RAW", "P1", "Role-dependent.", "Cutoff."),
  row("FOOTBALL", "CREATION", "progressive passes / carries / final-third / xA", "API-Football documented fields", "NOT_AVAILABLE", PLAN_UNK, NO, NO, NO, NO, "A", "Not in official beginner field list.", "Do not derive 'progressive' from key passes.", "NOT_CURRENTLY_FEASIBLE", "P2", "Eventing required.", "n/a"),
  row("FOOTBALL", "DEFENSE", "tackles / interceptions / duels", "API-Football /players + /fixtures/players", "AVAILABLE_DIFFERENT_ENDPOINT", PLAN_UNK, NO, NO, NO, NO, "A", "Official guide lists tackles, interceptions, duels won/total.", "Unused.", "BUILD_FROM_EXISTING_RAW", "P1", "Counting stats track role/opponent.", "Cutoff."),
  row("FOOTBALL", "DEFENSE", "blocks / clearances / aerial% / errors / pressures", "API-Football documented fields", "NEEDS_PROVIDER_DOC_REVIEW", PLAN_UNK, NO, NO, NO, NO, "C", "Beginner guide lists duels not aerial win% or errors leading to shots. Full schema blocked.", "Do not invent pressures.", "NOT_CURRENTLY_FEASIBLE", "P2", "Defensive stats are noisy.", "n/a"),
  row("FOOTBALL", "GK", "saves / goals conceded / clean sheets / penalty saved", "API-Football player penalty/games stats", "AVAILABLE_DIFFERENT_ENDPOINT", PLAN_UNK, NO, NO, NO, NO, "A", "Guide lists penalty saved and goals conceded context for keepers; team clean sheets on /teams/statistics.", "No GK dataset.", "BUILD_FROM_EXISTING_RAW", "P1", "Save% needs shots faced — confirm field before storing a rate.", "Cutoff."),
  row("FOOTBALL", "GK", "PSxG / PSxG-GA / goals prevented / sweeping", "API-Football documented fields", "NOT_AVAILABLE", PLAN_UNK, NO, NO, NO, NO, "A", "Not in official player field list.", "Other provider later. No purchase this mission.", "BUY_PROVIDER", "P2", "Advanced GK.", "n/a"),
  row("FOOTBALL", "TEAM_ADV", "W/D/L / goals / clean sheets / form / possession / shots", "API-Football /teams/statistics + /fixtures/statistics", "AVAILABLE_CURRENT_PROVIDER", PLAN_UNK, NO, NO, NO, NO, "A", "getTeamStatistics wired raw unused. Official guide: season W/D/L, goals, clean sheets, form. fixtures/statistics: shots, possession, corners, passes.", "Typed team-stats dataset. This is not xGD.", "BUILD_FROM_EXISTING_RAW", "P0", "Form string is recent W/L, not player quality.", "Season stats include games after freeze if mis-dated."),
  row("FOOTBALL", "TEAM_ADV", "xG / xGA / npxG / xGD / PPDA / field tilt / set-piece xG", "API-Football documented team stats", "NOT_AVAILABLE", PLAN_UNK, NO, NO, NO, NO, "A", "Official /teams/statistics description is results and goals, not expected goals or PPDA.", "Mark as other-provider research later. No purchase now.", "BUY_PROVIDER", "P2", "Team xG still not Independent without player layer.", "n/a"),
  row("FOOTBALL", "CONDITION", "minutes last 3/5, consecutive starts, matches in 7/14d", "derived from /fixtures/players history", "AVAILABLE_DIFFERENT_ENDPOINT", PLAN_UNK, NO, NO, NO, NO, "A", "Not a native 'form' endpoint. Derivable once per-match minutes exist.", "Do not use availability as 100% fitness.", "DERIVE_FROM_EXISTING_HISTORY", "P1", "Return from injury ≠ full minutes.", "Only completed matches before cutoff."),
  row("FOOTBALL", "CONDITION", "team rest / congestion / home-away sequence", "schedule-v1 kickoff", "STORED_ALREADY", PLAN_UNK, YES, YES, NO, NO, "B", "Kickoff/venue stored. Rest not derived. Continental competition flag not stored as a feature.", "Derive rest days from schedule without new Provider.", "DERIVE_FROM_EXISTING_HISTORY", "P1", "Team rest ≠ player minutes.", "Schedule identity only."),
  row("FOOTBALL", "MATCHUP", "positional / formation interaction", "lineups + player stats derived", "AVAILABLE_DIFFERENT_ENDPOINT", PLAN_UNK, NO, NO, NO, NO, "C", "Formation comes with lineups (official). Winger-vs-FB is not a provider feature.", "Derived research after XI+player datasets. No Engine score.", "DERIVE_FROM_EXISTING_HISTORY", "P2", "Tactical labels overfit.", "Use confirmed XI only."),
  row("FOOTBALL", "ENVIRONMENT", "venue from fixtures", "API-Football fixtures.venue", "STORED_ALREADY", PLAN_UNK, YES, YES, NO, NO, "B", "schedule-v1 stores venue name/city.", "Surface/altitude/weather not in current fixture typing.", "BUILD_FROM_EXISTING_RAW", "P3", "No lone weather weight.", "Pregame venue is identity."),
  row("FOOTBALL", "ENVIRONMENT", "weather / travel / timezone / altitude", "not collected", "NOT_AVAILABLE", PLAN_UNK, NO, NO, NO, NO, "B", "Weather candidates listed for MLB only. Football reuse = later. No new purchase.", "External weather if ever selected must be forecast as-of.", "NOT_CURRENTLY_FEASIBLE", "P3", "Interaction only.", "Forecast vs observed."),
  row("FOOTBALL", "MARKET", "1x2 implied probability", "The Odds API", "STORED_ALREADY", PLAN_UNK, YES, YES, YES, YES, "A", "Used in football market-baseline and MLB v0 marketPrior. Forbidden as Independent player-strength input.", "Keep as benchmark after Independent P. Do not intake into player datasets.", "NOT_CURRENTLY_FEASIBLE", "NONE", "Market is not player condition.", "Never a pregame sports feature for Independent P."),

  // --- other sports preview ---
  row("BASKETBALL", "PREVIEW", "minutes / injury / B2B / travel", "API-Basketball / API-NBA not wired", "NEEDS_PROVIDER_DOC_REVIEW", PLAN_UNK, NO, NO, NO, NO, "C", "api-sports.io documents NBA API. Repository ApiSportsProvider is a stub. Dummy home-feed is not coverage.", "Preview only. No implementation.", "NOT_CURRENTLY_FEASIBLE", "NONE", "B2B first-class later.", "n/a"),
  row("VOLLEYBALL", "PREVIEW", "lineup / rotation / attack-serve-receive-block", "API-Volleyball not wired", "NEEDS_PROVIDER_DOC_REVIEW", PLAN_UNK, NO, NO, NO, NO, "D", "Family marketed. Full volleyball doc Cloudflare-blocked this mission. Odds API lacks volleyball per prior odds audit.", "Preview only.", "NOT_CURRENTLY_FEASIBLE", "NONE", "Rotation analog of batting order.", "n/a"),
];

export function countAvailability(
  rows: GapMatrixRow[],
): Record<GapMatrixRow["availability"], number> {
  const counts: Record<GapMatrixRow["availability"], number> = {
    AVAILABLE_CURRENT_PROVIDER: 0,
    AVAILABLE_DIFFERENT_ENDPOINT: 0,
    AVAILABLE_HIGHER_PLAN: 0,
    AVAILABLE_OTHER_PROVIDER: 0,
    STORED_ALREADY: 0,
    NOT_STORED: 0,
    NOT_AVAILABLE: 0,
    UNKNOWN: 0,
    NEEDS_PROVIDER_DOC_REVIEW: 0,
  };
  for (const r of rows) counts[r.availability] += 1;
  return counts;
}

export function countBuildVsBuy(
  rows: GapMatrixRow[],
): Record<GapMatrixRow["buildVsBuy"], number> {
  const counts: Record<GapMatrixRow["buildVsBuy"], number> = {
    BUILD_FROM_EXISTING_RAW: 0,
    BUY_PROVIDER: 0,
    DERIVE_FROM_EXISTING_HISTORY: 0,
    NOT_CURRENTLY_FEASIBLE: 0,
  };
  for (const r of rows) counts[r.buildVsBuy] += 1;
  return counts;
}

export function countIntake(
  rows: GapMatrixRow[],
): Record<GapMatrixRow["intakePriority"], number> {
  const counts: Record<GapMatrixRow["intakePriority"], number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
    NONE: 0,
  };
  for (const r of rows) counts[r.intakePriority] += 1;
  return counts;
}
