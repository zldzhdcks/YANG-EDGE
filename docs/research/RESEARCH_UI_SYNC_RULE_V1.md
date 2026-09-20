# Research UI Sync Rule V1

Research backend → product data contract → user UI must be reviewed together
when a research capability has user-facing value. This is an information
architecture rule, not authority to change a model, admit features or promote
research candidates.

## Dashboard contract

- Existing owner-only homepage branch and loader remain unchanged. No public
  access gate is widened. Active batch/date come from the existing explicit
  product selection, not an inferred latest slate or wall-clock date.
- `loadResearchExplorer` retains authority over locked targets, canonical
  probability, evidence timestamps and research tiers.
- `dashboard-view.ts` is presentation only. It counts admitted lines, translates
  tier/sport labels and selects up to eight preview rows by existing tier,
  latest analysis timestamp, kickoff and deterministic target ID. It never
  ranks by probability, changes a tier or changes its input objects.
- Homepage coverage numerator is rendered research lines; denominator is the
  authoritative scope count. No automatic assumption of complete coverage.
- Featured policy explicitly selects current product targets 91 (Atlético / Real)
  and 86 (City / Sunderland). Missing target, probability, timestamp or team
  context stays missing. No synthetic fallback values.
- Model time and latest analysis time are different clocks. Updating the
  preview does not update a sealed model prediction.
- Engine cards are explanatory copy of the repository-verified status:
  V1 official; V3/V3.1 closed and unpromoted; V4 evidence foundation ready,
  prediction engine unimplemented and no admitted features. They are not an
  engine registry mutation. Reconcile this copy whenever an authorized status
  artifact changes; infrastructure alone must never change its meaning.
- Main dashboard uses readable labels. Detailed research/audit contracts retain
  their original technical values. Pick remains a separate secondary output.
- Any future Pick publication needs its own product contract. The current
  ResearchLine contract has `pick: null`; do not fabricate picks in the renderer.

## Verification — 2026-09-20 dashboard mission

Base: `3c690540a95a7b4137c9347e82ae8ba95a9080e3`.
Batch: `round-111-odds-new-v1`; date: `2026-09-20`.
50 / 50 lines; soccer 31, baseball 11, basketball 3, volleyball 5.
Football FULL 0, STANDARD 17, BASIC 14. No tier promotions in this UI mission.
Canonical featured probabilities: 42.20/25.79/32.01 and 72.36/18.07/9.57 percent.

Homepage sections: Hero → today's research → featured research → eight-row
Explorer preview → engine research → coverage → optional Pick → disclosure.
Navigation: homepage, explicit-batch Explorer, homepage engine anchor, ledger.

Validation: 102/102 tests across dashboard, Explorer, identity, research depth,
recency, showcase, rich preview and season split. Full TypeScript check passed.
Tests cover missing data, a different date/denominator, canonical identity,
unchanged presentation input and target outcome getter rejection.

Real browser QA:

- 1280px: stats five columns, featured two, engines three. Document client and
  scroll widths both 1265px (15px vertical scrollbar); horizontal overflow 0.
- 390px: cards one column; compact three-column probability within featured
  cards. Document client and scroll widths both 375px; horizontal overflow 0.
- Mobile menu opens/closes; Engine Research anchor lands below sticky header.
- Homepage CTA opens explicit-batch `/research`, rendering all 50 lines.
- Featured detail CTA works; existing Atlético and City `/analysis` routes
  retain canonical probabilities; `/ledger` renders its existing page.
- Full mobile visual review includes featured, preview, engine, coverage and
  disclosure. No storage/ledger interaction or external data refresh performed.

No provider calls, new predictions, target result/live/postgame access, model
recalculation, data artifact edits, engine/weight/threshold/feature changes.
Existing unrelated untracked work remains excluded from the UI commit.

## Future change review

For each user-facing backend addition, record its authoritative source, product
fields, missing-data behavior, screen/route, freshness label and regression
coverage. Make verified information usable without replacing provenance with
marketing claims. Preserve local-only restrictions until separately authorized.
