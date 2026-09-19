# YANG EDGE — MANDATORY PREVIEW PRIORITY POLICY V1

## Authority and separation

Owner-approved presentation policy. Mandatory Preview is NOT mandatory Prediction.
Official Engine remains V1 / football-poisson-research-v1. No engine, weight,
threshold, admitted feature, Forward snapshot or terminal decision changes.
V4_ENGINE_IMPLEMENTED=false. Preview never feeds any model.

All Manchester City FC men's first-team official matches require Preview,
regardless of competition: Premier League, UEFA Champions League, FA Cup,
EFL/Carabao Cup, Community Shield, FIFA/UEFA club competitions, and other
explicitly identified official first-team competitions. Friendlies are separately
classified, optional when on the schedule with sufficient evidence. Youth,
women's and reserve teams are not implicitly included.

Atlético de Madrid (home) vs Real Madrid (away) is mandatory. This is a matchup
priority, not an assertion about a particular date or provider fixture. No fixture
is created. The reverse fixture is not silently added; operators may add it.

## Implementation delivered

- `src/lib/public-analysis/preview-priority.ts`: exact display-label registry,
  team/match/target extension points, manual `previewPriority=MANDATORY`, and
  minimum Preview contract. No network, filesystem writes or model imports.
- Existing `finalizePublicAnalysisView` attaches this contract under
  `quickPreview.priority`, after the independent Quick Preview body projection.
  Official PASS/unavailable does not suppress that body.
- Optional third argument supplies operator presentation context:
  `{previewPriority: "MANDATORY", matchKind: "OFFICIAL_FIRST_TEAM"}`.
  This is NOT an extension of the frozen Operator Slate schema.
- Exact label recognition is presentation-only. It never supplies provider IDs
  or satisfies model identity gates. Unrecognized labels remain normal policy;
  operators must explicitly register additional labels/targets. No fuzzy matching.
- Known FRIENDLY/OTHER_SQUAD are excluded from automatic permanent priority;
  manual priority may still request their Preview. Unknown squad/competition
  yields PREVIEW_AWAITING_UPDATE and IDENTITY_REVIEW_REQUIRED, never an invented
  official-first-team assertion.

This release implements the policy registry and minimal existing read-model
integration, not the complete daily publishing/content production system.
The daily production runner, immutable Preview revision store, operator registry
editor and enriched FULL_PREVIEW renderer are not implemented by this change.
Existing user-facing Quick Preview text remains rendered; priority metadata is
not a new rendered Engine panel. Do not report these pending components as live.

## Status and content contract

Mandatory Preview permits only FULL_PREVIEW, LIMITED_PREVIEW or
PREVIEW_AWAITING_UPDATE. PASS, NO_PREVIEW and SKIPPED are forbidden for Preview.
Official Prediction may retain its existing PASS status.

Minimum fields: TARGET_ID, TEAM_PRIORITY, MATCH_PRIORITY, PREVIEW_REQUIRED=true,
PREVIEW_STATUS, OFFICIAL_ENGINE, PREDICTION_STATUS, PREDICTION_REASON,
LINEUP_STATUS, INJURY_STATUS, DATA_QUALITY, LAST_UPDATED_AT.

Minimal implementation emits LIMITED_PREVIEW for identified matches or
PREVIEW_AWAITING_UPDATE when identity/context is incomplete. It reports lineup
NOT_CONFIRMED, injury UNKNOWN, quality MATCH_METADATA_ONLY. LAST_UPDATED_AT
inherits the existing evidence/view timestamp or null (unknown), never a forged
capture/update timestamp. These are minimal-body labels, not claims about all
other evidence in the application. Official availability is inherited from the
existing public projection; this module cannot create probabilities or picks.

FULL_PREVIEW may include evidenced competition/kickoff/venue/home-away, recent
form, goals/conceded/official statistics, injuries/suspensions/availability,
confirmed XI or explicitly provisional/expected XI, and evidenced tactical
discussion (formation, matchups, build-up, transition, pressing, defensive block,
set pieces and roles). Unavailable items remain UNKNOWN, NOT_CONFIRMED or
NOT_AVAILABLE_YET. No fake injury, XI, stats, xG, probability or pick.

LIMITED_PREVIEW must preserve confirmed match/team facts, known absences,
lineup status, available and missing information, and unavailable-Prediction
reason. Provider gaps and unadmitted V4 features never justify hiding its body.

## Required next integration contract

Daily discovery -> priority lookup -> independent Official Prediction pipeline
-> Preview pipeline. Every discovered mandatory target must receive a Preview
coverage record, including Official PASS, pending, unsupported and provider
failure cases. Use a separate finally/independent stage: an Official PASS must
not return before Preview. Missing schedule is a discovery gap, not permission
to invent fixtures. Preview coverage and Prediction/PASS denominators differ.

Existing official gates remain mandatory: authoritative scope, pregame window,
exact identity, supported engine, as-of safety, valid inputs and terminal
contract. Never use presentation aliases as an official identity bridge.

The eventual Engine panel may display AVAILABLE with HOME/DRAW/AWAY and
MODEL_PICK only from an existing validated sealed official prediction, with
exact target binding and pre-kickoff provenance. Never reconstruct the missing
two probabilities from the current single-probability public view. Otherwise
show UNAVAILABLE and the precise reason; continue the Preview body.

Preview versions must be append-only, separate from terminal/model snapshots:
initial -> availability update -> confirmed-XI update. Each revision requires
target identity, version, actual createdAt, evidence references, previous hash,
content hash and revision reason. Validate evidence time <= creation time <
kickoff for new pregame revisions. Never silently overwrite or backdate.
After kickoff retain the old pregame version; any retrospective material must
be explicitly separate. Rendering a view is not itself sealing a new revision.
An immutable store and daily runner must be implemented/tested before claiming
automated versioned Preview production is operational.

## Verification and governance

`node --import tsx scripts/test-mandatory-preview-priority-v1.ts`: 7/7 PASS.
`node --import tsx scripts/test-public-game-quick-preview-v1.ts`: 34/34 PASS.
Repository-wide `tsc --noEmit --incremental false` fails in unrelated existing
audit/MLB modules; it is not reported PASS. See focused check in final report.
No production run, new prediction, provider call, refit or fabricated fixture.
No change to Engine/weights/thresholds/features or official promotion status.

Base: c6a11ce527742dc5305d158eb4a08373ed280fce.
Existing unrelated working-tree evidence and progress-report rules preserved.
