/** Read-only product projection. Never generates or changes a prediction/tier. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalForFixture, digest, type SealCandidate } from '../football/official-canonical-v1';
import { committedBytes } from '../research/terminal-decision/batch-selection';
import type { ResearchLine } from './research-explorer-contract';

export const IDENTITY_AUDIT = 'data/audits/2026-09-20-football-provider-identity-resolution-v1.json';
export function loadProbabilityIdentities(cwd: string, scopeHash: string) {
  const bytes = readFileSync(join(cwd, IDENTITY_AUDIT));
  assert(bytes.equals(committedBytes(cwd, IDENTITY_AUDIT)), 'UNCOMMITTED_IDENTITY_AUDIT');
  const audit = JSON.parse(bytes.toString());
  assert.equal(audit.scopeHash, scopeHash, 'IDENTITY_SCOPE_MISMATCH');
  const scheduleBytes = readFileSync(resolve(cwd, '../YANG-EDGE-INBOX/football-provider-identity-v1/2026-09-20/schedule.json'));
  assert.equal(digest(scheduleBytes), audit.scheduleSha256, 'SCHEDULE_HASH_MISMATCH');
  const schedule = JSON.parse(scheduleBytes.toString());
  assert.equal(schedule.identityOnly, true);
  assert.equal(schedule.observedAt, audit.scheduleObservedAt);
  assert.equal(new Set(audit.rows.map((r: any) => r.targetId)).size, audit.rows.length);
  return { audit, schedule };
}

export function exactProbabilityIdentity(line: ResearchLine, evidence: ReturnType<typeof loadProbabilityIdentities>) {
  const row = evidence.audit.rows.find((r: any) => r.targetId === line.targetId);
  assert(row, 'MISSING_IDENTITY_AUDIT_ROW');
  assert.equal(row.sourceHome, line.home); assert.equal(row.sourceAway, line.away);
  assert.equal(row.competition, line.competition); assert.equal(Date.parse(row.kickoff), Date.parse(line.kickoff));
  if (row.identityStatus !== 'EXACT') return { row, identity: null };
  const matches = evidence.schedule.fixtures.filter((f: any) => f.fixtureId === row.providerFixtureId);
  assert.equal(matches.length, 1, 'AMBIGUOUS_FIXTURE');
  const identity = matches[0];
  assert.equal(identity.homeId, row.providerHomeTeamId); assert.equal(identity.awayId, row.providerAwayTeamId);
  assert.equal(identity.leagueId, row.providerCompetitionId); assert.equal(identity.season, row.identity.season);
  assert.equal(Date.parse(identity.kickoff), Date.parse(line.kickoff));
  return { row, identity };
}

export function canonicalProbability(identity: any, selected: SealCandidate) {
  assert.equal(selected.classification, 'CANONICAL'); assert(selected.eligible);
  assert.equal(selected.fixtureId, identity.fixtureId);
  assert.deepEqual(selected.identity, { leagueId: identity.leagueId, season: identity.season, homeTeamId: identity.homeId, awayTeamId: identity.awayId });
  assert.equal(Date.parse(selected.scheduledStart!), Date.parse(identity.kickoff));
  const p = selected.snapshot.payload;
  const probabilities = [p.pHome, p.pDraw, p.pAway];
  assert(probabilities.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1), 'INVALID_PROBABILITY');
  assert(Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-10, 'INVALID_PROBABILITY_MASS');
  return { home: p.pHome as number, draw: p.pDraw as number, away: p.pAway as number };
}

export function applyCanonicalProbabilities(lines: ResearchLine[], cwd: string, scopeHash: string) {
  let evidence: ReturnType<typeof loadProbabilityIdentities>;
  try { evidence = loadProbabilityIdentities(cwd, scopeHash); }
  catch { for (const l of lines) if (l.sport === 'SOCCER') l.quality.push('CANONICAL_LINK_EVIDENCE_UNAVAILABLE'); return; }
  for (const line of lines.filter(l => l.sport === 'SOCCER')) {
    try {
      const { identity } = exactProbabilityIdentity(line, evidence);
      if (!identity || ![39, 140, 135, 78].includes(identity.leagueId)) continue;
      assert(Date.parse(evidence.schedule.observedAt) < Date.parse(line.kickoff), 'LATE_IDENTITY_OBSERVATION');
      const selected = canonicalForFixture(cwd, identity.fixtureId);
      if (!selected) continue;
      const probability = canonicalProbability(identity, selected);
      if (line.probability) assert.deepEqual(line.probability, probability, 'EXISTING_PRODUCT_CANONICAL_CONFLICT');
      line.probability = probability;
      line.engineAsOf = selected.createdAt;
      line.modelStatus = 'OFFICIAL_V1_SEALED';
      line.dataAvailable = [...new Set([...line.dataAvailable, 'CANONICAL_V1'])];
      line.dataMissing = line.dataMissing.filter(k => k !== 'MODEL_PROBABILITY');
      line.quality = line.quality.filter(k => k !== 'MODEL_PROBABILITY 미확보');
    } catch { line.probability = null; line.engineAsOf = null; line.modelStatus = 'CANONICAL_LINK_REJECTED'; line.quality.push('CANONICAL_LINK_REJECTED'); }
  }
}
