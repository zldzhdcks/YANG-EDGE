/** Outcome-blind eligibility audit. Does not import any provider or generation runner. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadResearchExplorer } from '../src/lib/public-analysis/load-research-explorer';
import { loadProbabilityIdentities, exactProbabilityIdentity, canonicalProbability } from '../src/lib/public-analysis/canonical-research-probability';
import { canonicalForFixture, officialContext, officialInventory, digest, OFFICIAL_HASH } from '../src/lib/football/official-canonical-v1';
import { readSealed, MODEL_HASH } from './football-forward-shadow-v1';
import { POLICY } from '../src/lib/football/poisson-research-v1';

process.env.YANG_EDGE_OWNER_PREVIEW = '1';
const cwd = process.cwd(), date = '2026-09-20', batch = 'round-111-odds-new-v1';
const out = 'data/audits/2026-09-20-v1-pregame-probability-coverage-v1.json';
assert(!existsSync(out), 'AUDIT_ALREADY_SEALED');
assert.equal(digest(readFileSync('src/lib/football/poisson-research-v1/index.ts', 'utf8').replace(/\r\n/g, '\n')), OFFICIAL_HASH);
assert.equal(MODEL_HASH, OFFICIAL_HASH);
const data = loadResearchExplorer(batch, date), lines = data.lines.filter(l => l.sport === 'SOCCER');
assert.equal(lines.length, 31);
const evidence = loadProbabilityIdentities(cwd, data.scopeHash), runAt = new Date().toISOString();
const roots = officialContext(cwd).roots;
const protectedFiles: Record<string, string> = {};
function pin(file: string) { protectedFiles[relative(cwd, file).replaceAll('\\', '/')] = digest(readFileSync(file)); }
// Snapshot/input/receipt hashes only. Never open grades or outcomes.
for (const root of roots) {
  const dir = join(root, 'MODEL_FORWARD/fixtures'); if (!existsSync(dir)) continue;
  for (const id of readdirSync(dir)) for (const name of ['snapshot.json', 'input.json', 'seal-receipt.json']) {
    const file = join(dir, id, name); if (existsSync(file)) pin(file);
  }
}
const batchRoot = join(cwd, 'data/research/slate-batches', batch);
const v4Dir = join(batchRoot, 'priority-readiness-v1');
for (const name of readdirSync(v4Dir).filter(n => n.startsWith('poll-') || n === 'player-registry.json')) pin(join(v4Dir, name));
pin(join(batchRoot, 'production-bridge-v1/rights-manifest.json'));
const rows = lines.map(line => {
  const now = new Date().toISOString();
  const r: any = { targetId: line.targetId, providerFixtureId: null, competition: line.competition, home: line.home, away: line.away, kickoff: line.kickoff, checkedAt: now, identityStatus: 'UNRESOLVED', eligibilityStatus: '', eligibilityReason: '', existingCanonicalPredictionId: null, newPredictionCreated: false, canonicalPredictionId: null, homeProbability: null, drawProbability: null, awayProbability: null };
  const { row, identity } = exactProbabilityIdentity(line, evidence);
  r.providerFixtureId = row.providerFixtureId; r.identityStatus = row.identityStatus;
  const existing = identity ? canonicalForFixture(cwd, identity.fixtureId) : null;
  if (existing) {
    const p = canonicalProbability(identity, existing);
    Object.assign(r, { eligibilityStatus: 'EXISTING_CANONICAL', eligibilityReason: 'GLOBAL_CANONICAL_REUSED_NO_REGENERATION', existingCanonicalPredictionId: existing.predictionId, canonicalPredictionId: existing.predictionId, homeProbability: p.home, drawProbability: p.draw, awayProbability: p.away, modelCreatedAt: existing.createdAt });
  } else if (Date.parse(now) >= Date.parse(line.kickoff)) {
    r.eligibilityStatus = 'KICKOFF_ALREADY_PASSED'; r.eligibilityReason = 'CURRENT_TIME_AT_OR_AFTER_KICKOFF';
  } else if (!identity) {
    r.eligibilityStatus = 'IDENTITY_UNRESOLVED'; r.eligibilityReason = row.failureReason ?? row.identityStatus;
  } else if (![39, 140, 135, 78].includes(identity.leagueId)) {
    r.eligibilityStatus = 'UNSUPPORTED_COMPETITION'; r.eligibilityReason = 'OFFICIAL_V1_SUPPORTS_ONLY_39_140_135_78';
  } else {
    const prior = roots.flatMap(root => {
      const file = join(root, 'MODEL_FORWARD/fixtures', String(identity.fixtureId), 'snapshot.json');
      return existsSync(file) ? [{ root, snapshot: readSealed(file) }] : [];
    });
    if (prior.length) {
      for (const old of prior) {
        const p = old.snapshot.payload; assert.equal(p.status, 'PASS', 'UNCLASSIFIED_EXISTING_SEAL');
        const input = readSealed(join(old.root, 'MODEL_FORWARD/fixtures', String(identity.fixtureId), 'input.json'));
        const receipt = readSealed(join(old.root, 'MODEL_FORWARD/fixtures', String(identity.fixtureId), 'seal-receipt.json'));
        assert.equal(p.inputSnapshotHash, input.sha256); assert.equal(receipt.payload.snapshotHash, old.snapshot.sha256);
        assert(receipt.payload.validPregame && Date.parse(receipt.payload.sealedAt) < Date.parse(p.kickoffUtc));
        assert.equal(p.homeTeam.id, identity.homeId); assert.equal(p.awayTeam.id, identity.awayId); assert.equal(p.leagueId, identity.leagueId);
        r.existingPass = { hash: old.snapshot.sha256, createdAt: p.predictionCreatedAt, reasons: p.passReason, competitionSample: p.trainingMatchCount, homeVenueSample: p.homeRelevantSampleCount, awayVenueSample: p.awayRelevantSampleCount };
      }
      r.eligibilityStatus = 'OTHER_EXPLICIT_BLOCKER';
      r.eligibilityReason = 'EXISTING_IMMUTABLE_PASS_PRESERVED_NO_OVERWRITE_OR_UNAPPROVED_REVISION';
      r.inputNote = 'Prior sealed fit failed frozen sample gate. Counts are as-of that snapshot, not a fresh history census.';
    } else {
      r.eligibilityStatus = 'TEMPORAL_EVIDENCE_INCOMPLETE';
      r.eligibilityReason = 'IDENTITY_ONLY_SCHEDULE_HAS_NO_OBSERVED_NS_STATUS_OR_TARGET_BOUND_V1_INPUT_REFERENCE';
    }
  }
  return r;
});
const counts = Object.fromEntries(['EXISTING_CANONICAL', 'ELIGIBLE_TO_GENERATE', 'KICKOFF_ALREADY_PASSED', 'IDENTITY_UNRESOLVED', 'V1_INPUT_INSUFFICIENT', 'UNSUPPORTED_COMPETITION', 'TEMPORAL_EVIDENCE_INCOMPLETE', 'OTHER_EXPLICIT_BLOCKER'].map(s => [s, rows.filter(r => r.eligibilityStatus === s).length]));
assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 31);
const jobs = JSON.parse(readFileSync(join(v4Dir, 'poll-job-index.json'), 'utf8')).jobs;
const windows = Object.fromEntries(['BETMAN-20260920-86', 'BETMAN-20260920-91'].map(id => [id, [...new Set(jobs.filter((j: any) => j.targetId === id).map((j: any) => j.pollAt))]]));
for (const [file, hash] of Object.entries(protectedFiles)) assert.equal(digest(readFileSync(join(cwd, file))), hash, 'PROTECTED_FILE_CHANGED');
const payload = { schemaVersion: 'V1_PREGAME_PROBABILITY_COVERAGE_V1', runAt, baseSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), batch, date, scopeHash: data.scopeHash, footballTargets: 31, precedence: 'EXISTING_CANONICAL > KICKOFF > IDENTITY > SUPPORTED_LEAGUE > IMMUTABLE_PRIOR_SEAL > TEMPORAL_INPUT', counts, generated: 0, newCanonical: 0, newDuplicateArtifacts: 0, generationScope: 'No eligible unsealed targets; no generation call made', probabilityCoverageBefore: lines.filter(l => l.probability).length, canonicalCoverage: counts.EXISTING_CANONICAL, rows, globalCanonicalCounts: officialInventory(cwd).counts, frozenPolicy: POLICY, modelHash: OFFICIAL_HASH, protectedFiles, v4: { reservedBudgetUsed: 0, windows, manifestsUnchanged: true, collectionExecuted: false, readiness: 'EXISTING_MANIFESTS_PRESERVED; SERVICE_NOT_STARTED_BY_THIS_MISSION' }, providerCalls: 0, targetResultAccessed: false, liveDataAccessed: false, postgameDataAccessed: false, engineChanged: false, weightsChanged: false, thresholdsChanged: false, featureSetChanged: false };
writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ runAt, counts, before: payload.probabilityCoverageBefore, canonicalCoverage: payload.canonicalCoverage, generated: 0 }, null, 2));
