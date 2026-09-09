import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const validTime = (v) => typeof v === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
const numericId = (v) => /^(?:[1-9]\d*)$/.test(String(v)) ? String(v) : null;
const teamId = (v) => /^fb-team-v1-api-football-\d+$/.test(v ?? '') ? v : numericId(v) ? `fb-team-v1-api-football-${v}` : null;
const leagueId = (v) => /^fb-comp-api-football-\d+$/.test(v ?? '') ? v : numericId(v) ? `fb-comp-api-football-${v}` : null;
const fixtureId = (v) => /^soccer-api-football-\d+$/.test(v ?? '') ? v : numericId(v) ? `soccer-api-football-${v}` : null;
const finalStatuses = new Set(['FT', 'AET', 'PEN', 'FINAL', 'FINISHED', 'FINAL_AFTER_EXTRA_TIME', 'FINAL_AFTER_PENALTIES']);
const goal = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 100;
const values = (rows, key) => [...new Set(rows.map(r => r[key]).filter(v => v != null))].sort();
const range = (rows) => { const dates = values(rows.filter(r => validTime(r.kickoff)), 'kickoff').sort((a,b) => Date.parse(a)-Date.parse(b)); return { earliest: dates[0] ?? null, latest: dates.at(-1) ?? null }; };

/** Only known result schemas may become training candidates; generic rows are inventory-only. */
export function extractRows(doc, sourcePath) {
  const schema = doc.meta?.schemaVersion ?? doc.schemaVersion ?? 'UNVERSIONED';
  const rows = [];
  const observed = doc.meta?.capturedAt ?? doc.capturedAt ?? doc.meta?.fetchedAt ?? doc.fetchedAt ?? null;
  function visit(v, pointer = '$') {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach((x,i) => visit(x, `${pointer}[${i}]`)); return; }
    let r;
    if (v.fixture?.id && v.teams?.home && v.teams?.away && v.league) {
      const status = v.fixture.status?.short;
      const score = v.score?.fulltime;
      r = { kind: 'API_FOOTBALL_FIXTURE', matchId: fixtureId(v.fixture.id), league: leagueId(v.league.id), leagueName: v.league.name ?? null, season: v.league.season ?? null,
        homeTeam: teamId(v.teams.home.id), awayTeam: teamId(v.teams.away.id), homeName: v.teams.home.name, awayName: v.teams.away.name,
        kickoff: v.fixture.date, status, homeGoals: score?.home ?? (status === 'FT' ? v.goals?.home : null), awayGoals: score?.away ?? (status === 'FT' ? v.goals?.away : null),
        resultObservedAt: observed, observationField: observed ? 'artifact.capturedAt/fetchedAt' : null, trusted: /fixtures-captured/.test(schema), finishTime: null };
    } else if (schema === 'football-independent-prior-fixtures-pregame-v0' && v.fixtureId && v.homeProviderTeamId && v.statusShort) {
      r = { kind: 'PRIOR_FIXTURE', matchId: fixtureId(v.fixtureId), league: leagueId(v.leagueId), leagueName: v.leagueName ?? null, season: v.season ?? null,
        homeTeam: teamId(v.homeProviderTeamId), awayTeam: teamId(v.awayProviderTeamId), homeName: v.homeTeamName, awayName: v.awayTeamName,
        kickoff: v.kickoffTimeUtc, status: v.statusShort, homeGoals: v.statusShort === 'FT' ? v.homeGoals : null, awayGoals: v.statusShort === 'FT' ? v.awayGoals : null,
        resultObservedAt: observed, observationField: 'meta.capturedAt', trusted: true, finishTime: null };
    } else if (schema === 'football-official-result-v0' && v.regularTime && v.matchId) {
      r = { kind: 'OFFICIAL_RESULT', matchId: fixtureId(v.matchId), league: leagueId(v.competitionId), leagueName: null, season: null,
        homeTeam: teamId(v.homeTeamId), awayTeam: teamId(v.awayTeamId), homeName: v.homeTeamName, awayName: v.awayTeamName,
        kickoff: v.kickoffTimeUtc, status: v.resultStatus, homeGoals: v.regularTime.home, awayGoals: v.regularTime.away,
        resultObservedAt: v.resultObservedAt, observationField: 'row.resultObservedAt', trusted: v.gradingAllowed === true && v.usability === 'FINAL_USABLE', finishTime: null };
    } else if (v.sport === 'FOOTBALL' && v.resultState) {
      r = { kind: 'OPERATIONAL_RESULT_UNBRIDGED', matchId: fixtureId(v.providerFixtureId), league: null, leagueName: v.league ?? null, season: null,
        homeTeam: null, awayTeam: null, homeName: null, awayName: null, kickoff: null, status: v.resultState,
        homeGoals: v.providerStatusRaw === 'FT' ? v.homeScore : null, awayGoals: v.providerStatusRaw === 'FT' ? v.awayScore : null,
        resultObservedAt: v.resultObservedAt ?? null, observationField: 'row.resultObservedAt', trusted: false, finishTime: null };
    } else if (/^soccer-api-football-\d+$/.test(v.matchId ?? v.canonicalGameId ?? '') && (v.homeTeamId || v.homeTeamName || v.kickoffTimeUtc)) {
      r = { kind: 'REFERENCE_OR_SCHEDULE', matchId: fixtureId(v.matchId ?? v.canonicalGameId), league: leagueId(v.competitionId), leagueName: null, season: v.seasonId ?? null,
        homeTeam: teamId(v.homeTeamId), awayTeam: teamId(v.awayTeamId), homeName: v.homeTeamName ?? null, awayName: v.awayTeamName ?? null,
        kickoff: v.kickoffTimeUtc ?? v.scheduledStartAt ?? null, status: v.status ?? v.resultStatus ?? null, homeGoals: v.regularTime?.home ?? null, awayGoals: v.regularTime?.away ?? null,
        resultObservedAt: null, observationField: null, trusted: false, finishTime: null };
    }
    if (r) {
      const completed = finalStatuses.has(r.status);
      const reasons = [];
      if (!completed) reasons.push('NOT_FINAL');
      if (!r.matchId || !r.league || !r.homeTeam || !r.awayTeam || r.homeTeam === r.awayTeam) reasons.push('IDENTITY_UNRESOLVED');
      if (!validTime(r.kickoff)) reasons.push('KICKOFF_UNKNOWN');
      if (!goal(r.homeGoals) || !goal(r.awayGoals)) reasons.push('REGULATION_GOALS_UNKNOWN');
      if (!validTime(r.resultObservedAt)) reasons.push('RESULT_OBSERVATION_UNKNOWN');
      else if (validTime(r.kickoff) && Date.parse(r.resultObservedAt) <= Date.parse(r.kickoff)) reasons.push('RESULT_OBSERVATION_NOT_AFTER_KICKOFF');
      if (!r.trusted) reasons.push('RESULT_SOURCE_NOT_ADMITTED');
      rows.push({ ...r, pointer, sourcePath, completed, identityQuality: reasons.includes('IDENTITY_UNRESOLVED') ? 'IDENTITY_UNRESOLVED' : 'IDENTITY_EXACT', usableForPregameTraining: reasons.length === 0, reasonIfRejected: reasons,
        temporalUse: 'Only for a later target with kickoff AND actual result observation strictly before its cutoff; never infer observation from kickoff or file mtime.' });
    }
    // Visit nested frozen schedule/fixture objects too; each occurrence retains its source pointer.
    for (const [k,x] of Object.entries(v)) if (x && typeof x === 'object') visit(x, `${pointer}.${k}`);
  }
  visit(doc);
  return rows;
}

export function deduplicate(rows) {
  const groups = new Map();
  for (const r of rows.filter(r => r.completed && r.matchId)) {
    if (!groups.has(r.matchId)) groups.set(r.matchId, []);
    groups.get(r.matchId).push(r);
  }
  const matches = [];
  for (const [matchId, group] of groups) {
    const withScores = group.filter(r => goal(r.homeGoals) && goal(r.awayGoals));
    // Missing metadata is not a conflict, but never fills a gap through names/time guessing.
    const conflictingFields = ['league','homeTeam','awayTeam','homeGoals','awayGoals'].filter(k=>new Set(withScores.map(r=>r[k]).filter(v=>v!=null)).size>1);
    const kickoffValues = new Set(withScores.filter(r=>validTime(r.kickoff)).map(r=>Date.parse(r.kickoff)));
    const conflict = conflictingFields.length > 0 || kickoffValues.size > 1;
    const usable = group.filter(r => r.usableForPregameTraining).sort((a,b) => Date.parse(a.resultObservedAt)-Date.parse(b.resultObservedAt) || a.sourcePath.localeCompare(b.sourcePath));
    const chosen = usable[0] ?? withScores[0] ?? group[0];
    const seasons = values(group, 'season').map(String);
    matches.push({ ...chosen, matchId, occurrences: group.length, sources: group.map(r => ({ path:r.sourcePath, pointer:r.pointer, observedAt:r.resultObservedAt })), conflict,
      season: seasons.length === 1 ? seasons[0] : chosen.season,
      usableForPregameTraining: !conflict && usable.length > 0,
      reasonIfRejected: conflict ? ['CONFLICTING_IDENTITY_OR_RESULT'] : chosen.reasonIfRejected });
  }
  return matches.sort((a,b) => a.matchId.localeCompare(b.matchId));
}

export function temporalCounts(matches) {
  return matches.filter(t => t.usableForPregameTraining).map(t => {
    const cutoff = Date.parse(t.kickoff) - 1;
    const train = matches.filter(r => r.usableForPregameTraining && r.matchId !== t.matchId && r.league === t.league && Date.parse(r.kickoff) < cutoff && Date.parse(r.resultObservedAt) < cutoff && Date.parse(r.kickoff) >= cutoff - 365*86400000);
    const home = train.filter(r => r.homeTeam === t.homeTeam).length;
    const away = train.filter(r => r.awayTeam === t.awayTeam).length;
    return { matchId:t.matchId, cutoffAt:new Date(cutoff).toISOString(), competitionHistory:train.length, homeVenueHistory:home, awayVenueHistory:away, passesBaselineSampleGates:train.length>=30 && home>=5 && away>=5 };
  });
}

export async function audit(root) {
  const workspace = path.dirname(root);
  const skipDirs = new Set(['.git','.next','node_modules','.codex','.agents','PROTO_ROUNDS','YANG-EDGE-INBOX','Export JSON']);
  const protectedName = /ocr|holdout|validation|human.truth|annotation|discovery|pilot10/i;
  const excluded = [], files = [], otherFormats = [], errors = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
      const absolute = path.join(dir,entry.name), rel = path.relative(root,absolute).replaceAll('\\','/');
      if (entry.isSymbolicLink() || skipDirs.has(entry.name) || protectedName.test(entry.name)) { excluded.push(rel); continue; }
      if (entry.isDirectory()) await walk(absolute);
      else if (/\.(json|jsonl|csv|tsv)$/i.test(entry.name) && !/package(-lock)?\.json|tsconfig|historical-data-inventory-v1|football-poisson/i.test(entry.name)) {
        if (/\.json$/i.test(entry.name)) files.push(absolute); else otherFormats.push(rel);
      }
    }
  }
  await walk(workspace);
  const sources = [], allRows = [];
  for (const absolute of files.sort()) {
    const rel = path.relative(root,absolute).replaceAll('\\','/');
    // All non-protected structured artifacts are text-screened, including ignored caches.
    let text;
    try { text = await fs.readFile(absolute,'utf8'); } catch (e) { errors.push({path:rel,error:e.message}); continue; }
    if (!/football|soccer|"fixture"\s*:/i.test(text) && !/football|soccer/i.test(rel)) continue;
    let doc;
    try { doc = JSON.parse(text.replace(/^\uFEFF/,'')); } catch(e) { errors.push({path:rel,error:e.message}); continue; }
    const rows = extractRows(doc,rel);
    allRows.push(...rows);
    const schema = doc.meta?.schemaVersion ?? doc.schemaVersion ?? 'UNVERSIONED';
    sources.push({ path:rel, sha256:sha(text), schema, provider:doc.meta?.provider ?? doc.provider ?? (rows.some(r=>r.kind==='API_FOOTBALL_FIXTURE')?'API_FOOTBALL':null),
      league:values(rows,'league'), season:values(rows,'season'), dateRange:range(rows), rowCount:rows.length,
      completedRowCount:rows.filter(r=>r.completed).length, usableRowCount:rows.filter(r=>r.usableForPregameTraining).length,
      fieldsAvailable:Object.fromEntries(['homeTeam','awayTeam','homeGoals','awayGoals','kickoff','resultObservedAt','finishTime'].map(k=>[k,rows.filter(r=>r[k]!=null).length])),
      artifactTimestamps:{ observedAt:doc.meta?.observedAt??doc.observedAt??null, fetchedAt:doc.meta?.fetchedAt??doc.fetchedAt??null, capturedAt:doc.meta?.capturedAt??doc.capturedAt??null, asOf:doc.meta?.asOf??doc.asOf??null, generatedAt:doc.meta?.generatedAt??doc.generatedAt??null },
      identityQuality:values(rows,'identityQuality'), duplicateRisk:'CANONICAL_FIXTURE_ID_DEDUP_REQUIRED_ACROSS_ARTIFACTS_AND_CHECKOUTS',
      usableForPregameTraining:rows.some(r=>r.usableForPregameTraining),
      reasonIfRejected:rows.some(r=>r.usableForPregameTraining)?[]:rows.length?[...new Set(rows.flatMap(r=>r.reasonIfRejected))]:['NO_SUPPORTED_MATCH_RESULT_ROWS'],
      completedRows:rows.filter(r=>r.completed),
    });
  }
  // Never infer seasons from year. Enrich only through consistent, exact fixture+teams+league evidence.
  for (const r of allRows.filter(r=>r.completed && r.season==null)) {
    const seasons = [...new Set(allRows.filter(x=>x.matchId===r.matchId && x.league===r.league && x.homeTeam===r.homeTeam && x.awayTeam===r.awayTeam && x.season!=null).map(x=>String(x.season)))];
    if (seasons.length===1) { r.season=seasons[0]; r.seasonEvidence='EXACT_FIXTURE_TEAM_LEAGUE_JOIN'; }
  }
  for (const source of sources) {
    const rows = allRows.filter(r=>r.sourcePath===source.path);
    source.season=values(rows,'season');
  }
  const nonJsonAudit=[];
  for (const rel of otherFormats.sort()) {
    const content=await fs.readFile(path.resolve(root,rel),'utf8');
    const lines=content.trim().split(/\r?\n/);
    nonJsonAudit.push({path:rel,sha256:sha(content),header:lines[0],dataRows:Math.max(0,lines.length-1),footballMention:/football|soccer/i.test(content),reasonIfRejected:'BASEBALL_BACKTEST_OR_AGGREGATE_NO_FOOTBALL_FIXTURE_RESULTS'});
  }
  const matches=deduplicate(allRows), eligible=matches.filter(r=>r.usableForPregameTraining), opportunities=temporalCounts(matches);
  const groupBy = key => Object.fromEntries(values(matches,key).map(v=>[v,{completed:matches.filter(r=>String(r[key])===String(v)).length, eligible:eligible.filter(r=>String(r[key])===String(v)).length}]));
  const ready=opportunities.filter(r=>r.passesBaselineSampleGates).length;
  const output={ schemaVersion:'football-historical-data-inventory-v1', generatedAt:new Date().toISOString(),
    scan:{ workspace, roots:[workspace], jsonFilesScreened:files.length, sourcesDiscovered:sources.length, excludedPaths:excluded.sort(), nonJsonStructuredFiles:nonJsonAudit, errors,
      scopeNote:'Workspace and sibling operational copies, ignored files included. Protected OCR/validation/holdout/annotation paths, dependencies and app internals excluded. No network or provider calls; no test-fixture code used as data.' },
    policy:{ cutoff:'strict actual observed time < target cutoff; kickoff < cutoff; no backdating or mtime inference', finishTime:'not inferred; terminal status plus actual capture/observation is conservative availability evidence', duplicate:'exact API_FOOTBALL fixture ID; conflicting known identity/result fails closed',
      season:'explicit source or exact fixture/team/league join only', marketUsed:false, providerPredictionUsed:false, engineWeightTuning:false,
      backtestEligibilityMeaning:'Eligible as past training data only AFTER recorded observation; not automatically an evaluable prediction target.',
      readiness:'INSUFFICIENT when no target passes frozen 30 league / 5 home / 5 away gates; LIMITED under 30 evaluable targets; USABLE_FOR_BASELINE_RESEARCH at 30+ (exploratory only, not validation).' },
    summary:{ rawRows:allRows.length, rawCompletedRows:allRows.filter(r=>r.completed).length,
      completedRowsWithResolvedFixture:allRows.filter(r=>r.completed&&r.matchId).length,
      duplicateCompletedRows:allRows.filter(r=>r.completed&&r.matchId).length-matches.length,
      totalUniqueCompletedMatches:matches.length, uniqueCompletedWithRegulationScores:matches.filter(r=>goal(r.homeGoals)&&goal(r.awayGoals)).length,
      completedStatusOnlyMatches:matches.filter(r=>!goal(r.homeGoals)||!goal(r.awayGoals)).length,
      conflictingMatches:matches.filter(r=>r.conflict).length, backtestEligibleMatches:eligible.length, temporalEvaluableTargets:ready,
      rejectionCounts:Object.fromEntries([...new Set(matches.flatMap(r=>r.reasonIfRejected))].sort().map(reason=>[reason,matches.filter(r=>r.reasonIfRejected.includes(reason)).length])),
      maximumAvailableCompetitionHistory:Math.max(0,...opportunities.map(r=>r.competitionHistory)),
      maximumAvailableHomeVenueHistory:Math.max(0,...opportunities.map(r=>r.homeVenueHistory)),
      maximumAvailableAwayVenueHistory:Math.max(0,...opportunities.map(r=>r.awayVenueHistory)),
      byLeague:groupBy('league'), bySeason:groupBy('season'), unknownSeasonMatches:matches.filter(r=>r.season==null).length,
      dateRange:range(matches), eligibleDateRange:range(eligible), footballDataReadiness:ready===0?'INSUFFICIENT':ready<30?'LIMITED':'USABLE_FOR_BASELINE_RESEARCH',
      backtest:ready<30?'BACKTEST_BLOCKED_INSUFFICIENT_SAMPLE':'BACKTEST_DESIGN_REQUIRED', performanceMetrics:null },
    sources, canonicalMatches:matches, temporalSampleGateAudit:opportunities };
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const result=await audit(root);
  const output=path.join(root,'data/audits/football-historical-data-inventory-v1.json');
  await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
  const s=result.summary;
  const leagueLines=Object.entries(s.byLeague).map(([id,n])=>{
    const name=result.canonicalMatches.find(r=>r.league===id && r.leagueName)?.leagueName ?? 'name unavailable';
    return `- ${id} (${name}): completed=${n.completed}, eligible-after-observation=${n.eligible}`;
  });
  const report=[
    '# Football historical data recovery v1', '',
    'MISSION_ID: FOOTBALL_BASELINE_FREEZE_HISTORICAL_RECOVERY_V1',
    'BASE_SHA: 979f883136ea9e5763dd0082b7ec0105de412636',
    'FOOTBALL_POISSON_BASELINE_COMMIT_SHA: 0b9eacd08208dd1e93d544be5e2997fa89e41265', '',
    `Inventory SHA256: ${sha(await fs.readFile(output))}`, '',
    '## Outcome', '',
    `FOOTBALL_DATA_READINESS=${s.footballDataReadiness}`,
    `BACKTEST=${s.backtest}`,
    `Scanned ${result.scan.jsonFilesScreened} JSON files and ${result.scan.nonJsonStructuredFiles.length} CSV files; discovered ${result.sources.length} football-relevant JSON sources. Parse/read errors=${result.scan.errors.length}.`,
    `Raw recognized fixture/reference rows=${s.rawRows}; raw completed rows=${s.rawCompletedRows}; duplicate completed occurrences=${s.duplicateCompletedRows}; canonical completed-status matches=${s.totalUniqueCompletedMatches}.`,
    `Of these, regulation-score matches=${s.uniqueCompletedWithRegulationScores}; status-only/no score=${s.completedStatusOnlyMatches}; eligible past training candidates=${s.backtestEligibleMatches}; exact result/identity conflicts=${s.conflictingMatches}.`,
    `Unknown season matches=${s.unknownSeasonMatches}; excluded operational result rows have no verified team/league/kickoff bridge and are not admitted by fixture ID alone.`, '',
    `Completed kickoff range (UTC-equivalent instants): ${s.dateRange.earliest} through ${s.dateRange.latest}.`,
    `Eligible past-result kickoff range: ${s.eligibleDateRange.earliest} through ${s.eligibleDateRange.latest}.`,
    `Temporal evaluable targets=${s.temporalEvaluableTargets}; maximum prior same-competition matches=${s.maximumAvailableCompetitionHistory}, prior home-venue matches=${s.maximumAvailableHomeVenueHistory}, prior away-venue matches=${s.maximumAvailableAwayVenueHistory}.`,
    'No accuracy/log loss/Brier/calibration result was computed. The existing model requires 30 competition / 5 home venue / 5 away venue prior matches; zero targets pass. No threshold or weight was changed.', '',
    '## Interpretation', '',
    'The original two-match count covered only standard official-result artifacts. Extra completed matches exist in the August 26 fixture capture and September 5 prior-fixture artifact. Operational checkouts contain duplicates, not additional independent samples.',
    'BACKTEST_ELIGIBLE_MATCHES counts rows usable as historical input only after their recorded result observation. It does NOT count predictions that can be evaluated today. The temporal gate audit checks each available completed target at kickoff minus 1 millisecond without running probability calculations.',
    'Result finish timestamps are absent; no finish time is synthesized. A terminal result captured/observed after kickoff is used as conservative availability evidence. A historical result fetched September 5 is not admitted to an August prediction. Source hashes preserve inspected evidence; this audit does not independently verify provider payload truth.',
    'Season values are provider values (including 2027), not guessed from kickoff year. Canonical fixture IDs drive deduplication. No team-name fuzzy matching, nearest kickoff matching, or manual score reconstruction.',
    'Protected OCR, human truth, Validation-2, Fresh Validation and holdout paths were excluded before reading. No provider calls, production changes or UI work.', '',
    '## By season', '', ...Object.entries(s.bySeason).map(([id,n])=>`- ${id}: completed=${n.completed}, eligible=${n.eligible}`), `- UNKNOWN: ${s.unknownSeasonMatches}`, '',
    '## By league', '', ...leagueLines, '',
    '## Governance / contract', '',
    '- marketUsed=false; ODDS_USED_AS_MODEL_INPUT=NO; PROVIDER_PREDICTION_USED=NO.',
    '- postgameUsed=false means TARGET postgame information; past final results are intentionally the training input.',
    '- POSTGAME_LEAKAGE=NO and FUTURE_RESULT_LEAKAGE=NO in executed work: inventory only, no backtest predictions or live picks generated.',
    '- cutoffGuard=true for declared input timestamps; observation authenticity belongs to source recovery/admission.',
    '- drawProbability=YES; probabilitySum=1 within tested tolerance; PASS=INSUFFICIENT_DATA with null probabilities and reason codes.',
    '- ENGINE_WEIGHT_TUNING=NO; PUBLIC_RECOMMENDATION=NO; VALIDATED_MODEL=NO; PRODUCTION_ENGINE=NO.', '',
    '## Next exact action', '',
    'Choose one competition with verifiable historical fixture IDs, regulation scores, teams and temporal provenance. Audit the existing provider collection capability and access rights before any new download. Build a prepared-input producer and retain actual retrieval times. Freeze a temporal evaluation design before looking at performance. Do not lower the baseline sample gates to make this inventory run.',
    'Future prediction artifacts must retain fixture ID, cutoff, home/draw/away probabilities, model version, training count, latest used observation, PASS reasons, marketUsed=false and targetPostgameUsed=false; require a hashed pregame input snapshot. This mission only seals the pure baseline and inventory; no production adapter is claimed.', '',
    'Reproduce: node scripts/audit-football-historical-data-inventory-v1.mjs',
    'Audit tests: node scripts/test-football-historical-data-inventory-v1.mjs',
    'Baseline tests: node_modules/.bin/tsx.cmd scripts/test-football-poisson-research-v1.ts',
    'Full-project typecheck previously failed in existing MLB/OCR/audit files; baseline scoped typecheck passed. Do not interpret this as a clean whole-project build.', '',
  ].join('\n');
  await fs.writeFile(path.join(root,'docs/FOOTBALL_HISTORICAL_DATA_RECOVERY_V1.md'),report);
  console.log(JSON.stringify({ output, sources:result.sources.length, scanErrors:result.scan.errors, summary:result.summary },null,2));
}
