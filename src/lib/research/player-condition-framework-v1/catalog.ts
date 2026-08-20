/**
 * Player-condition feature catalog — repository evidence only.
 * No Engine weights. Market rows are excluded from player strength.
 */
import type {
  FeatureAvailabilityStage,
  FeatureCatalogRow,
} from "./types";

function row(
  sport: FeatureCatalogRow["sport"],
  category: string,
  feature: string,
  provider: string,
  stage: FeatureAvailabilityStage,
  stored: boolean,
  pregameSafe: boolean | "UNKNOWN",
  sampleConcern: string,
  futureResearch: string,
  evidence: string,
): FeatureCatalogRow {
  return {
    sport,
    category,
    feature,
    provider,
    stage,
    stored,
    pregameSafe,
    sampleConcern,
    futureResearch,
    evidence,
  };
}

export const PLAYER_CONDITION_FEATURE_CATALOG: FeatureCatalogRow[] = [
  // --- MLB batter base ---
  row("MLB", "B. BATTER_BASE", "PA / AB / H / HR / BB / SO counts", "mlb-stats-api boxscore stats.batting (raw cache)", "AVAILABLE_PROVIDER", false, "UNKNOWN", "Game batting in a pregame boxscore may be empty or today's unfinished line; do not treat as season PA.", "Persist season/gameLog hitting with cutoff.", "Observed keys include plateAppearances, atBats, hits, homeRuns, baseOnBalls, strikeOuts. Lineup dataset stores identity only."),
  row("MLB", "B. BATTER_BASE", "AVG", "mlb-stats-api hitting gameLog/season — not fetched", "UNKNOWN", false, "UNKNOWN", "Season AVG hides recent form; still need sample PA.", "Fetch group=hitting gameLog if legal; never invent AVG from 1 game.", "Not in observed boxscore stats.batting. Hitting gameLog never called. seasonStats.hitting empty in sampled pregame boxscore."),
  row("MLB", "B. BATTER_BASE", "OBP / SLG / OPS", "mlb-stats-api hitting — not fetched", "UNKNOWN", false, "UNKNOWN", "OPS from tiny PA is noise.", "Same as AVG. ISO can be derived only after SLG/AVG exist.", "Not in observed game batting keys. No batter dataset."),
  row("MLB", "B. BATTER_BASE", "ISO", "derived from SLG-AVG if those exist", "UNKNOWN", false, "UNKNOWN", "Inherits SLG sample risk.", "Do not store ISO without parent counting stats.", "No stored SLG/AVG."),
  row("MLB", "B. BATTER_BASE", "wOBA / wRC+", "not in observed Stats API gameLog/box batting", "NOT_AVAILABLE", false, "UNKNOWN", "Requires linear weights; not in current payloads.", "Needs a documented advanced-stat source — do not approximate as OPS.", "Pitching gameLog and box batting keys contain no wOBA/wRC+."),
  row("MLB", "B. BATTER_BASE", "K% / BB% / HR% / BABIP", "rates from counts if PA/AB/SO/BB/HR/H exist", "UNKNOWN", false, "UNKNOWN", "BABIP especially unstable in small PA.", "Store counts + sampleSize first; rates later.", "Counts exist in raw box batting; rates not stored. Hitting gameLog not fetched."),
  row("MLB", "B. BATTER_BASE", "batSide / bats", "mlb-stats-api /people/{id} batSide; expected-lineup observation bats", "AVAILABLE_PROVIDER", false, true, "Handedness is identity, not a split.", "Join people.batSide onto confirmed lineup slots. Operator bats is observation-only.", "Person cache has batSide.code. Lineup dataset battingSideCollected=0, peopleApiCalls=0. Expected lineup v0 allows bats nullable."),

  // --- MLB batter matchup ---
  row("MLB", "B. BATTER_MATCHUP", "vs LHP / vs RHP / platoon", "Stats API statSplits not called", "UNKNOWN", false, "UNKNOWN", "Classic small-sample trap. Shrink toward player baseline required.", "Do not label platoon specialist from <~50 PA.", "No sitCodes/statSplits fetch in repository."),
  row("MLB", "B. BATTER_MATCHUP", "pitch-type BA/OPS/wOBA/whiff (FF/SL/CU/CH/FC/FS/SI)", "not in Stats API gameLog observed keys", "NOT_AVAILABLE", false, "UNKNOWN", "Pitch-type splits are extremely sparse.", "Requires pitch-level source (not currently fetched).", "Observed pitching gameLog has no pitch mix / pitch type."),

  // --- MLB batter recent ---
  row("MLB", "B. BATTER_RECENT", "last 7/14/30 day hitting", "hitting gameLog not fetched", "UNKNOWN", false, true, "7-day windows often <20 PA.", "Always store window + sampleSize + playerBaseline.", "Starter pipeline fetches pitching gameLog only."),
  row("MLB", "B. BATTER_RECENT", "hard hit% / barrel%", "not in observed Stats API keys", "NOT_AVAILABLE", false, "UNKNOWN", "Statcast-style; high variance.", "Do not proxy with batting average.", "No Statcast client in repository."),

  // --- MLB lineup context ---
  row("MLB", "C. LINEUP", "confirmed 1-9 identity", "mlb-stats-api boxscore / schedule hydrate=lineups", "STORED", true, true, "Identity is not strength.", "Join player strength onto slots. Weight undefined.", "lineup-dataset-v1 battingOrder: slot, playerId, playerName, defensivePosition. Completeness used in prediction v0 with weight 0."),
  row("MLB", "C. LINEUP", "expected 1-9 (operator)", "manual expected-lineup-observation-v0", "STORED", true, true, "Expected ≠ confirmed.", "Never auto-promote to CONFIRMED. Replacement delta needs both lists.", "schema lineupStatus=EXPECTED. Engine input forbidden."),
  row("MLB", "C. LINEUP", "weighted lineup wOBA/OPS/wRC+ / top3 / middle / bottom / replacementDelta / platoon counts", "requires batter strength + bats + vs L/R", "NOT_AVAILABLE", false, true, "Do not average 9 noisy splits into a fake lineup score yet.", "Design slots first; weights UNDEFINED.", "No batter strength dataset. No bats on confirmed lineup rows."),

  // --- MLB starter base ---
  row("MLB", "A. STARTER_BASE", "ERA", "mlb-stats-api pitching gameLog aggregate", "PREDICTION_USED", true, true, "ERA needs IP shrink (v0 already shrinks by IP).", "Keep as base counting rate, not the whole pitcher.", "starter-dataset-v1 + prediction-v0 starterScore."),
  row("MLB", "A. STARTER_BASE", "WHIP", "same", "PREDICTION_USED", true, true, "Same IP sample issue.", "Same.", "Used in v0 and legacy pitcherQuality."),
  row("MLB", "A. STARTER_BASE", "IP / GS / W / L / SO / BB / HR", "pitching gameLog", "STORED", true, true, "W/L are noisy outcomes.", "Derive K/9 BB/9 HR/9 from stored counts + IP.", "seasonStats stores these. v0 score ignores K/BB/HR."),
  row("MLB", "A. STARTER_BASE", "throws", "people.pitchHand", "FEATURE_READY", true, true, "Identity, not quality.", "Required for platoon matrix.", "Stored on starter rows; unused in v0 logit."),
  row("MLB", "A. STARTER_BASE", "battersFaced / K/9 / BB/9 / HR/9 / GO-AO / strike% / pitchesPerInning", "observed in raw pitching gameLog.stat", "AVAILABLE_PROVIDER", false, true, "Per-start rates need outing sample.", "Parse additional gameLog keys already sitting in raw cache.", "Keys observed: battersFaced, strikeoutsPer9Inn, walksPer9Inn, homeRunsPer9, groundOutsToAirouts, strikePercentage, pitchesPerInning, numberOfPitches. Not copied into starter-dataset."),
  row("MLB", "A. STARTER_BASE", "FIP / xFIP / xERA / SIERA", "not in observed gameLog.stat keys", "NOT_AVAILABLE", false, "UNKNOWN", "Do not back into FIP from HR/BB/K without documenting constants.", "Needs provider-doc review before any derived FIP.", "Absent from cached pitching gameLog keys."),
  row("MLB", "A. STARTER_BASE", "BABIP / LOB% / GB% / FB%", "partial proxies only (GO/AO, not GB%)", "UNKNOWN", false, "UNKNOWN", "GO/AO ≠ GB%.", "Do not rename groundOutsToAirouts as GB%.", "groundOuts/airOuts/flyOuts present; named GB%/BABIP/LOB% not present."),
  row("MLB", "A. STARTER_BASE", "velocity / pitch mix / pitch value / whiff% / CSW% / called strike% / swinging strike%", "not in observed gameLog keys", "NOT_AVAILABLE", false, "UNKNOWN", "Pitch-level; another source required.", "Do not infer velo from ERA.", "strikes/strikePercentage exist; CSW/whiff/pitch type do not."),

  // --- MLB starter condition ---
  row("MLB", "A. STARTER_CONDITION", "recent 3/5 starts (IP/ER/SO/BB/H/HR/pitches)", "starter-dataset-v1 recentStarts[]", "STORED", true, true, "3 starts is a tiny sample. Shrink toward season.", "Windows last-3 / last-5 with sampleSize. No condition score yet.", "Up to 5 recent starts stored. prediction-v0 does not read the array."),
  row("MLB", "A. STARTER_CONDITION", "rest days / season workload / velocity decline / command deterioration", "rest not player-level; velo absent", "UNKNOWN", false, true, "Rest from team travel dataset is not pitcher rest.", "Compute pitcher rest from lastOutingDate vs commence. Velo needs new source.", "lastOutingDate stored. Team travel-rest exists. No velocity series."),

  // --- MLB pitcher vs lineup ---
  row("MLB", "E. PITCHER_VS_LINEUP", "handedness matrix (throws × bats for slots 1-9)", "throws stored; bats not on confirmed lineup", "UNKNOWN", false, true, "9 platoon flags are not 9 independent edges.", "Join people.batSide; count adv/disadv only after reliability policy.", "Matchup matrix not implemented. No probability this mission."),
  row("MLB", "E. PITCHER_VS_LINEUP", "repertoire × batter pitch-type", "pitch-type not available", "NOT_AVAILABLE", false, "UNKNOWN", "Cell sample often <10 PA.", "Blocked until pitch-level data exists.", "No pitch mix in current fetches."),

  // --- MLB bullpen ---
  row("MLB", "D. BULLPEN", "reliever identity + inferred role + fatigue snapshot", "mlb-stats-api appearances → bullpen-role-dataset-v1_1", "STORED", true, true, "Classifier already has INSUFFICIENT_SAMPLE / PROVISIONAL. Do not treat UNKNOWN role as closer.", "Today availability = role × fatigue × last appearance. Weight UNDEFINED.", "July sample dates. engineEligible false. prediction-v0 disabled weight 0. Fatigue: daysSinceLastAppearance, pitches last 2/3 days, back-to-back."),
  row("MLB", "D. BULLPEN", "FIP/xFIP / platoon split for relievers", "not stored on classified pitcher rows", "NOT_AVAILABLE", false, "UNKNOWN", "Reliever platoon samples are tiny.", "Keep role+workload first.", "RoleEvidence has save/hold/outs rates, not FIP or vs L/R."),

  // --- MLB environment ---
  row("MLB", "F. ENVIRONMENT", "day / night", "schedule hydrate dayNight in raw cache", "AVAILABLE_PROVIDER", false, true, "Day/night batter splits need large PA.", "Store on schedule artifact; interaction not main effect.", "Observed on schedule games. mlb-schedule-v1 does not persist dayNight."),
  row("MLB", "F. ENVIRONMENT", "temperature / humidity / wind / precip", "weather-dataset-v1 forecast NOT_COLLECTED; provider NOT_SELECTED", "NOT_AVAILABLE", false, "UNKNOWN", "Weather×player splits are tiny.", "Select a forecast provider later. Interaction only.", "Candidates listed: noaa-nws-api, open-meteo, openweathermap-one-call. Schedule weather null in sampled hydrate."),
  row("MLB", "F. ENVIRONMENT", "roof type", "venues?hydrate=fieldInfo roofType", "STORED", true, true, "Roof type ≠ roof open/closed.", "roofStatus remains UNKNOWN until observed.", "weather-dataset-v1 venue.roofType OPEN/DOME/RETRACTABLE. roofStatus=UNKNOWN."),
  row("MLB", "F. ENVIRONMENT", "turfType / outfield dimensions", "fieldInfo in venue cache", "AVAILABLE_PROVIDER", false, true, "Park factors need multi-year samples.", "Do not invent park factor from one dimension.", "fieldInfoKeys include turfType, left/center/right distances. Not stored."),
  row("MLB", "F. ENVIRONMENT", "altitude / elevation", "venue location.elevation in cache", "AVAILABLE_PROVIDER", false, true, "Coors-style effects are park-specific, not a global weather weight.", "Store elevation; do not score.", "locationKeys include elevation. travel-rest stores lat/long not elevation."),
  row("MLB", "F. ENVIRONMENT", "park factor", "none", "NOT_AVAILABLE", false, "UNKNOWN", "External park factors must be sourced and dated.", "Not in Stats API observed payloads.", "No park-factor type in repo."),
  row("MLB", "F. ENVIRONMENT", "team travel / rest", "travel-rest-dataset-v1", "STORED", true, true, "Team rest ≠ player rest.", "Player rest from appearances; team rest as context.", "July sample dates. engineAdmission PROHIBITED. No route inference."),
  row("MLB", "C. AVAILABILITY", "IL / 40-man injured listed", "40Man roster D* codes + transactions", "STORED", true, true, "Listed ≠ severity or return-to-play.", "Map to INJURED vs LIMITED. No MRI/expectedReturn (forbidden).", "injury-dataset-v1 injuryListed from roster status. Sample July dates. Not used in prediction."),

  // --- Football ---
  row("FOOTBALL", "A. PLAYER_BASE", "minutes / goals / xG / npxG / shots / SoT / box touches", "API-Football — /players not wired", "NEEDS_PROVIDER_DOC_REVIEW", false, "UNKNOWN", "xG needs documented field names before storage.", "Add typed player-stats dataset after endpoint+schema evidence.", "FootballProvider has no getPlayers. getTeamStatistics returns raw unknown and is unused by prediction."),
  row("FOOTBALL", "A. PLAYER_BASE", "assists / xA / key passes / progressive passes / carries", "same", "NEEDS_PROVIDER_DOC_REVIEW", false, "UNKNOWN", "Creative stats often sparse.", "Same.", "No football player research dataset."),
  row("FOOTBALL", "A. PLAYER_BASE", "tackles / interceptions / blocks / aerial% / errors", "same", "NEEDS_PROVIDER_DOC_REVIEW", false, "UNKNOWN", "Defensive counting stats are role-dependent.", "Same.", "No stored rows."),
  row("FOOTBALL", "A. PLAYER_BASE", "GK save% / PSxG-GA / goals prevented / crosses claimed", "same", "NEEDS_PROVIDER_DOC_REVIEW", false, "UNKNOWN", "PSxG is advanced; may be absent from plan.", "Do not invent PSxG from save%.", "No GK dataset. Dummy UI copy is not evidence."),
  row("FOOTBALL", "B. CONDITION", "minutes last 3/5 / consecutive starts / full-90 / injury return", "lineups+injuries+player stats unused", "UNKNOWN", false, true, "Available ≠ 100% fit.", "Separate availabilityStatus from minutes-load.", "getLineups/getInjuries exist; no research artifacts."),
  row("FOOTBALL", "C. XI", "confirmed starting XI identity", "API-Football GET /fixtures/lineups", "AVAILABLE_PROVIDER", false, true, "Identity without replacement level is incomplete.", "Typed lineup dataset with CONFIRMED/NOT_RELEASED/AFTER_CUTOFF. Weight UNDEFINED.", "Method wired. Schedule builder uses fixtures only. Snapshot has no XI."),
  row("FOOTBALL", "C. XI", "XI strength + replacementDelta", "requires player base + XI", "NOT_AVAILABLE", false, true, "Do not average 11 unknown xG into a fake XI score.", "Slot design first.", "No player strength."),
  row("FOOTBALL", "E. MATCHUP", "winger vs FB / striker vs CB / press / aerial / set piece / formation", "lineups raw schema unknown", "UNKNOWN", false, "UNKNOWN", "Tactical labels without event data overfit.", "Formation from lineups if present; matchup later.", "getLineups raw untyped. No event stream."),
  row("FOOTBALL", "F. ENVIRONMENT", "rest days / matches last 7/14 / home-away", "schedule-v1 kickoff only", "STORED", true, true, "Rest from schedule is team-level until XI minutes exist.", "Derive team rest from schedule; player rest from minutes.", "Kickoff/venue/competition stored. No rest feature."),
  row("FOOTBALL", "F. ENVIRONMENT", "travel / timezone / weather / surface / altitude", "not collected", "NOT_AVAILABLE", false, "UNKNOWN", "Weather as a lone football weight is forbidden.", "Reuse travel/weather pattern after identity is stable.", "Football reuse matrix: travel/weather = LATER."),
  row("FOOTBALL", "C. AVAILABILITY", "injuries", "API-Football GET /injuries", "AVAILABLE_PROVIDER", false, true, "Provider injury ≠ minutes restriction.", "Typed injury dataset; no silent ΔP.", "Method wired, unused."),

  // --- other sports principle ---
  row("BASKETBALL", "COMMON", "minutes / usage / on-off / B2B / travel / injury / restriction", "no basketball research provider wired", "UNKNOWN", false, "UNKNOWN", "B2B and minute restriction are first-class later.", "Reuse availability + workload + environment shells.", "Out of this implementation scope."),
  row("VOLLEYBALL", "COMMON", "setter/attacker/receive/serve/block/rotation/lineup combo/fatigue", "no volleyball research provider wired", "UNKNOWN", false, "UNKNOWN", "Rotation/lineup combination is the analog of baseball batting order.", "Reuse slot + replacementDelta design.", "Out of this implementation scope."),
];

export function countStages(
  rows: FeatureCatalogRow[],
): Record<FeatureAvailabilityStage, number> {
  const counts: Record<FeatureAvailabilityStage, number> = {
    PREDICTION_USED: 0,
    FEATURE_READY: 0,
    STORED: 0,
    AVAILABLE_PROVIDER: 0,
    NOT_AVAILABLE: 0,
    UNKNOWN: 0,
    NEEDS_PROVIDER_DOC_REVIEW: 0,
  };
  for (const r of rows) counts[r.stage] += 1;
  return counts;
}
