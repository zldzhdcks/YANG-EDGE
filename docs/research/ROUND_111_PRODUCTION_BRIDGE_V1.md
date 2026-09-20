# Round 111 production bridge

The separately committed `round-111-odds-new-v1` scope now has explicit production selection. September 20 has 50 targets and September 21 has 11. The original September 19 and earlier September 20 scopes were not changed.

Use `npm run research:daily-pregame-production -- --date 2026-09-20 --batch round-111-odds-new-v1 --plan <explicit-local-plan.json>`. The batch manifest, operator input, frozen source and scope lock must match committed bytes. Date-only selection fails when a named scope exists. Internal source paths resolve relative to the selected batch; Git evidence resolves relative to the actual repository prefix. Targets and operational records carry the batch/scope binding. Terminal decisions retain the frozen format and bind the exact scope SHA; their batch identity is also recorded in the terminal evidence manifest.

The V4 runner accepts the same `--batch` argument. It retains its separate committed manifest, identity, registry, rights and poll-window checks. No V4 prediction or feature admission is enabled.

## Actual execution

- Manchester City vs Sunderland: target BETMAN-20260920-86, fixture 1557413, kickoff September 20 22:00 KST. Exact provider team IDs 50/746. V1 sealed at 13:00:30.848 KST.
- Atletico Madrid vs Real Madrid: target BETMAN-20260920-91, fixture 1570394, kickoff September 20 23:15 KST. Exact provider team IDs 530/541. V1 sealed at 13:00:31.811 KST.
- Total: 2 Prediction, 1 legitimate missed-window PASS, 58 unresolved/PENDING. This is partial coverage, not full production readiness.
- The PASS is BETMAN-20260920-43 at 13:00:46.192 KST, after its scheduled start. No outcome was used to choose the reason.

Identity acquisition made two `/fixtures` requests restricted to NS. Historical input acquisition made four FT-only requests with end date September 19. Past completed scores were explicitly authorized by the owner. Target IDs were rejected from history. Prediction execution disabled global fetch and consumed only explicit hash-pinned local inputs. No target result/live/postgame/grade data was accessed. An unrelated existing historical-grade regression suite was executed during testing; its historical evidence was not a prediction input.

Raw provider payloads remain local and ignored by Git. The explicit Prediction evidence pack contains the original sealed derived input, prediction and receipt bytes, not raw API payloads. Existing caches and all earlier frozen scopes remain intact.

## Preview and V4

`mandatory-previews-v3.json` contains both mandatory limited previews and their sealed V1 probabilities. XI, injuries, suspension and tactics remain unconfirmed/unknown. Domestic odds are displayed as separate market evidence and never used by the model.

The rights manifest records CONDITIONAL private internal use supported by owner-reported provider Chat AI guidance. Human support confirmation and formal written license are absent; public and commercial rights remain UNCONFIRMED. This is not a new legal clearance.

V4 collection is still blocked: no verified player/team membership registry exists for these targets. No fabricated or empty registry was promoted to ready. XI/injury/player-stat observations: zero. No collector was launched outside the frozen T-60/40/30/20 window.

A one-time task follow-up is scheduled at 20:50 KST on September 20 (automation `round-111-v4-gate`) to check the registry gate before the first 21:00 poll window. This is a gate check, not a scheduled collection job or a guarantee that evidence will be obtained.

## Validation and handoff

Final focused suite: 86/86 passed. Full repository TypeScript check: zero errors. Frozen V1 model hash remains `6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf`.

The production binding originally included display metadata in the input hash; the first attempt failed before prediction. The hash projection was corrected to the exact contracted fields and regression-tested with the full real selection object. Two successful immutable predictions followed. Never rerun or overwrite their snapshot payloads.

Next work: acquire and verify player membership provenance under the admitted collector rules; then construct committed V4 manifests. Other targets need their own exact identity/input proof and stay PENDING before cutoff. Never carry the two priority bindings over to another target or batch. Do not change the Official V1 model, weights, thresholds or feature set.

FINAL=ROUND_111_PARTIAL_UNBLOCK
