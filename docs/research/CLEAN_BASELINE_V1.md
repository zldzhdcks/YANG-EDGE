# YANG EDGE — CLEAN BASELINE V1

Start HEAD: 4bf84c7e64d427b4e43033ea85349248b9f7a792. Reporting-rule commit: 213c873f2dd987b64c0cd6688666ead4ee0ce13a.

No package.json typecheck script exists. Full existing tsconfig was checked with
`node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`.
Before: 100 diagnostics / 32 files. After: PASS / 0 diagnostics. No files excluded,
no strictness relaxed, no ts-ignore, no new any annotations.

See CLEAN_BASELINE_V1.json for all diagnostic locations/messages/categories and
preserved unrelated untracked paths. Category counts: {"A":30,"C":20,"E":1,"B":11,"D":38}.
A=trivial typing; B=stale schema/test fixture; C=audit script typing;
D=MLB research typing; E=nullable kickoff access in historical discovery script.

## Minimal changes

Explicit optional audit fields survive union/spread inference; negative test
fixtures retain deliberately invalid values with localized type assertions;
aliased numeric predicate checks retain their existing runtime guards and only
cast inside already guarded arithmetic. isRate now exposes its actual predicate.
The identity validator returns literal 0 because every nonzero count throws.
No predictor, manifest, exact-byte input, network boundary, engine configuration,
weight, threshold, feature, Preview policy or registry was changed.

Normalized emitted JavaScript (type erasure and redundant parentheses removed)
is identical for 29/32 files, including both MLB source modules. Three exceptions:
- Nullable kickoff comparison uses optional chaining instead of throwing on null.
- A test import drops the .ts extension under existing bundler resolution.
- A synthetic recommendation test supplies the required eventId field.

## Tests

PASS: MLB independent training dataset contract; next-slate production 19/19;
terminal decisions 18/18; Mandatory Preview 7/7; Quick Preview regression 34/34;
MLB daily operations window; MLB recommendation probability semantics;
football odds-bridge candidate intake. Production tests use synthetic temp input.
No real prediction or provider collection run was executed.

MLB 2023 multiseason safe-A: local CRLF checkout failed the existing raw-byte
research-direction SHA pin after passing synthetic calculation checks. The
unchanged local SHA is 334dbb40245f1724787a68111cf74bd9906e544a803533e7f2893666bcf2bd88.
Git LF blob/expected SHA is 707c7ab7dae1ba9435f5cbc693ea392737e621fc5c021f9fdcf03c7382d2c242.
Reran from isolated `git -c core.autocrlf=false archive HEAD` with the same
modified sources and shared dependencies: complete PASS. No original sealed
file, pin, Git EOL setting or checksum validator was changed. Raw-byte tests
remain EOL-sensitive in the original Windows checkout; LF testing is required.
Historical audit scripts that rewrite evidence were not rerun in the repository.

## Evidence / integrity

2432 existing data/docs files were SHA-256 checked before/after: all unchanged.
The odds-bridge test emitted its legacy audit file; its exact pre-test bytes were
restored and verified against the before hash. No such generated file is staged.
Unrelated untracked files remain preserved. Only specified reporting files were
sealed in the docs commit; type fixes and this diagnostic report are separate.

OFFICIAL_ENGINE=V1; OFFICIAL_MODEL=football-poisson-research-v1;
MLB_OFFICIAL_PICK_ENABLED=false; V4_ENGINE_IMPLEMENTED=false;
V4_ADMISSION_ALLOWED=false; ENGINE/WEIGHTS/THRESHOLDS/FEATURE_SET_CHANGED=false.
Preview changes=false. No feature work, promotion, refit or evidence rewrite.

FINAL=CLEAN_BASELINE_READY (full typecheck PASS; raw-hash regression tested in LF isolation).
