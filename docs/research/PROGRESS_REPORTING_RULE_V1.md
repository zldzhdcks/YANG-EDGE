# YANG EDGE — PROGRESS REPORTING RULE V1

Owner instruction, recorded 2026-09-20 KST. Applies to every major development
and research report. Append this block LAST, after ENGINE STATUS:

```text
PROGRESS

TODAY_PROGRESS=
OVERALL_PROGRESS=
TODAY_DELTA=

CURRENT_PHASE=
CURRENT_ENGINE=
NEXT_ENGINE=
NEXT_MILESTONE=

COMPLETED_TODAY=
BLOCKED_BY=
WAITING_FOR=
```

TODAY_PROGRESS is completion of today's planned executable work. State the
relevant plan/day and completed work; do not count external-input waits as
failed or unfinished executable work. Missing future slate, provider evidence,
or human confirmation belongs in WAITING_FOR. Do not exclude internal unresolved
implementation/test failures to inflate this percentage.

OVERALL_PROGRESS covers the YANG EDGE prediction engine, research and operations
system only. Never combine website/UI design progress. TODAY_DELTA is today's
change in that overall assessment in percentage points, not relative percent.
Do not double-count a same-day increment on each report. Carry forward an
unchanged baseline when no supported reassessment exists. New days require a
new daily plan and delta; do not perpetually copy today's 100%/+8%p.

The following is an OWNER_SET_BASELINE, not a repository-derived statistical
measurement or a new automatically calculated percentage. Future changes must
identify completed milestones and their assessment basis; do not invent a
quantitative roadmap denominator. The current rule-only update adds no separate
progress increment beyond the owner's supplied daily total.

```text
TODAY_PROGRESS=100%
OVERALL_PROGRESS=72%
TODAY_DELTA=+8%p
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=FIRST_REAL_V4_PROSPECTIVE_EVIDENCE
COMPLETED_TODAY=V3/V3.1 closure; V4 protocol/admission audit;
 sample-policy ratification; prospective evidence foundation; focused validation
BLOCKED_BY=NO_FUTURE_AUTHORITATIVE_SLATE
WAITING_FOR=NEXT_HUMAN_VERIFIED_FUTURE_SLATE
```

The waiting labels above are owner-supplied current status; this rule update
does not independently scan or create a new slate. Revalidate dependencies
before a future collection attempt.

V3=RESEARCH_CLOSED_UNPROMOTED; V3_1=RESEARCH_CLOSED_UNPROMOTED.
V4_FEATURE_SET=NONE_ADMITTED; V4_ENGINE_IMPLEMENTED=false;
V4_SHADOW_SAMPLE_N=0. V4_PHASE_0.5 is the owner's progress phase label for
prospective evidence readiness; it does not rewrite the sealed Phase 0 artifacts
or imply a V4 engine, admitted features, or permission to run shadow predictions.
NEXT_ENGINE=V4 describes direction, not an approved Official promotion.
