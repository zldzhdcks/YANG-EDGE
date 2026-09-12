# FOOTBALL POISSON V2 EXPOSED EVALUATION V1

All three hypotheses: SCREEN_NO. This is EXPOSED_RETROSPECTIVE_COMPARISON on 2024/25, not an untouched holdout. No model promotion, validated-model claim, Forward replacement, combination, tuning or rerun was performed.

## Provenance

- BASE_SHA: 351db25ddacdfbe34f8c6400cbe56c2f6ad77acd
- Source/tests Commit A: ee80455 (full identity available in Git history).
- Source freeze Commit B: c817851f73509381e7cab042f39240b054aed82e
- Evaluation source seal: a4752de618dfa550a167df715aaf47b064f3769bc897566054528a59ad1b0a32
- Result audit SHA256 (canonical payload): 333740887d62db09bee0057c4c2f2bb7ee0ff51de2b17b010357a1b6e8cc7231
- Final parameters seal: a27c62dba74203651ad124a285973786c87299cb407ab71e38b0d6568aac5617
- Local full report SHA256: 65185d50ed0ebf56917c0dcc90e6922582e9f178d9da9f2638c4835e2fc52af3
- Run started: 2026-09-12T05:38:03.221Z
- Run completed: 2026-09-12T05:39:42.532Z
- Protocol hash: 0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f
- Design hash: 03ad74710019082428fce6dbd2dd234aa4f0d21c009e715ae27ecb027b490945

The first launch request was rejected before process creation because approval review had exhausted usage. After the owner reset usage, HEAD/origin and empty Git diff were verified; execution marker and result audit were absent. Existing commits were reused. The successful run above is the only execution. Git ownership was scoped through process-local safe.directory configuration; no source or global setting changed.

## Pre-execution report

See FOOTBALL_POISSON_V2_EVALUATION_EXECUTION_PATH_V1.md for the committed pre-execution state and all evaluation source hashes. At that freeze: FINAL_FITTING_EXECUTED=NO and EVALUATION_EXECUTED=NO. Development source/common-runner hashes unchanged; H1/H2/H3 normalized source and synthetic outputs exact. Season 2023 accepted for development, 2024 for evaluation/causal history, 2025 rejected. No season identity relabeling.

103 tests passed before freeze (88 existing + 15 evaluation-specific). Strict TypeScript and ESLint passed; only the existing React package-detection warning. The existing ESM protocol suite used the previously verified byte-identical test-support copies, without source edits. No additional fitting/test rerun was used to modify results.

## Population and execution

EVALUATION_TARGETS=1446; PRIMARY_PAIRED_TARGETS=1342; V1_PASS=104. Paired counts in EPL/La Liga/Serie A/Bundesliga order: 353/352/351/286. All candidates retain all primary IDs and all original 104 PASS records (H2 uses its frozen PASS reason vocabulary). Each hypothesis has 1342 predictions, 104 PASS, zero FAIL and zero INVALID. No denominator shrinkage or expansion. No pooled performance metric is reported.

Final fits used only allowed 2023 inputs, and all twelve parameter/input hashes were sealed before evaluation. H1/H3 final parameters stay fixed; H2 has 1342 causal fits on eligible per-target histories, each from the prescribed initialization. Earlier 2024 scores enter only after the strict 48-hour research lag within 365 days and the same league. This lag is retrospective research availability, not fabricated observed completion time.

Evaluation order: FROZEN_V1_REFERENCE → H1_ALONE → H2_ALONE → H3_ALONE. The comparator probabilities/statuses come from the original sealed v1 results; unchanged v1 calls recover causal rates and verify agreement, without replacing the baseline or rerunning the prior backtest pipeline. No target score appears in candidate pregame input.

## H1 — SCREEN_NO

### Premier League

- Paired N: 353; full coverage: 353/380; PASS 27.
- LL 1.006340011; v1 1.007317562; delta -0.000977551.
- Brier 0.602063381; v1 0.602727435; delta -0.000664054.
- Accuracy 0.518413598; v1 0.518413598.
- HOME: predictions 228, share 0.645892351, recall 0.797202797, precision 0.500000000, one-vs-rest Brier 0.218924750, ECE 0.026877018.
- DRAW: predictions 0, share 0.000000000, recall 0.000000000, precision null, one-vs-rest Brier 0.181704118, ECE 0.006413489.
- AWAY: predictions 125, share 0.354107649, recall 0.552000000, precision 0.552000000, one-vs-rest Brier 0.201434512, ECE 0.045718183.
- Local league gate: NO; unmet guards: AWAY one-vs-rest Brier.
- Final fit: FITTED, N=275; parameters {"rho":-0.09999999899999999}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 3c04c4ed25e13bf3df53dcd5a6b9bec04021fcf038e9fa8c429f5cfec3ea7e1e
- Cohort hash: 7f7c6b1e63e5fdb118f2ef50826032e6f02b52c1fa9dbe02adbb6dca67153842
- Paired IDs hash: f331b0dcb5a33aa22fa444e72c7d2a39a6ce8f5737666693a2b2fd9116272c45
- Prediction hash: 8936080e497d7074329fbc1beee57955dd80a210380447908fc9085459671b3b

### La Liga

- Paired N: 352; full coverage: 352/380; PASS 28.
- LL 0.999960221; v1 1.000107050; delta -0.000146828.
- Brier 0.596176366; v1 0.596235242; delta -0.000058876.
- Accuracy 0.508522727; v1 0.511363636.
- HOME: predictions 235, share 0.667613636, recall 0.800000000, precision 0.527659574, one-vs-rest Brier 0.216643906, ECE 0.036490799.
- DRAW: predictions 3, share 0.008522727, recall 0.000000000, precision 0.000000000, one-vs-rest Brier 0.189017343, ECE 0.042440979.
- AWAY: predictions 114, share 0.323863636, recall 0.514018692, precision 0.482456140, one-vs-rest Brier 0.190515117, ECE 0.034017690.
- Local league gate: PASS; unmet guards: none.
- Final fit: FITTED, N=274; parameters {"rho":-0.02707364010559301}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 10e588d84b45f0496830849901be3beff222c11a6888e2e652753f4bee7b8da8
- Cohort hash: 6cc4ce888702696251c145a8da0e4f4056d4aa2cbe989b3adb3e07f0e5e9dc2c
- Paired IDs hash: 521219886b1c809950c003947cef92f4c767cd4f83f345037ac1be278a402c29
- Prediction hash: a2008360e81b1650e3e64598bd41096c399776e2ab2ceeb0849408710b2434b3

### Serie A

- Paired N: 351; full coverage: 351/380; PASS 29.
- LL 0.988178371; v1 0.991504928; delta -0.003326557.
- Brier 0.591932475; v1 0.593165966; delta -0.001233492.
- Accuracy 0.535612536; v1 0.535612536.
- HOME: predictions 207, share 0.589743590, recall 0.798561151, precision 0.536231884, one-vs-rest Brier 0.206159175, ECE 0.056066656.
- DRAW: predictions 7, share 0.019943020, recall 0.030303030, precision 0.428571429, one-vs-rest Brier 0.201712966, ECE 0.013064691.
- AWAY: predictions 137, share 0.390313390, recall 0.654867257, precision 0.540145985, one-vs-rest Brier 0.184060334, ECE 0.055451276.
- Local league gate: PASS; unmet guards: none.
- Final fit: FITTED, N=274; parameters {"rho":-0.08988841868455563}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 4a82741c4a5f23270b1b98677f9fc4635276da75b8cb6f5a9753e9060460b0c2
- Cohort hash: 385c508acfdd7115d88bfeeaddc8544d398e9446c019f25528104db5e56093cd
- Paired IDs hash: 46fe23276fd9ef34872d281bd33fa93eb9de3d4fd6adc5d552307a00fab9fa61
- Prediction hash: 904174206b1412457383e786601f0600ee2aa73bdd5cec9cbb29bca776f18ce8

### Bundesliga

- Paired N: 286; full coverage: 286/306; PASS 20.
- LL 1.042554792; v1 1.044689659; delta -0.002134867.
- Brier 0.626704825; v1 0.627999019; delta -0.001294194.
- Accuracy 0.475524476; v1 0.475524476.
- HOME: predictions 180, share 0.629370629, recall 0.756756757, precision 0.466666667, one-vs-rest Brier 0.218746246, ECE 0.077535572.
- DRAW: predictions 1, share 0.003496503, recall 0.000000000, precision 0.000000000, one-vs-rest Brier 0.193630196, ECE 0.036953028.
- AWAY: predictions 105, share 0.367132867, recall 0.514851485, precision 0.495238095, one-vs-rest Brier 0.214328382, ECE 0.052705730.
- Local league gate: NO; unmet guards: AWAY one-vs-rest Brier; AWAY ECE delta +0.010698253.
- Final fit: FITTED, N=214; parameters {"rho":-0.09999999899999999}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 3c04c4ed25e13bf3df53dcd5a6b9bec04021fcf038e9fa8c429f5cfec3ea7e1e
- Cohort hash: 8e1d854c11f8995fda1ee75565baa4f3d37df89c942f7f8e07db52e520fc08ec
- Paired IDs hash: 0849c92a920ae32bb2a420d3b67829c46f732c1378c080d12fd4e743af4acad4
- Prediction hash: db125f394847497d258455e70fb2055e69408adb7ba91166dc27f577ead67483

## H2 — SCREEN_NO

### Premier League

- Paired N: 353; full coverage: 353/380; PASS 27.
- LL 0.987476315; v1 1.007317562; delta -0.019841248.
- Brier 0.590828747; v1 0.602727435; delta -0.011898688.
- Accuracy 0.518413598; v1 0.518413598.
- HOME: predictions 213, share 0.603399433, recall 0.762237762, precision 0.511737089, one-vs-rest Brier 0.211042621, ECE 0.044612988.
- DRAW: predictions 0, share 0.000000000, recall 0.000000000, precision null, one-vs-rest Brier 0.181685783, ECE 0.024301878.
- AWAY: predictions 140, share 0.396600567, recall 0.592000000, precision 0.528571429, one-vs-rest Brier 0.198100343, ECE 0.042777324.
- Local league gate: NO; unmet guards: HOME recall; HOME ECE delta +0.011626855.
- Final fit: FITTED, N=370; parameters {"b":0.341151791355461,"h":0.19003208205898975,"teamCount":20,"parameterVectorHash":"4c64c41a7a93b2f8ff3c1823d967949f0d925c83a1cfa403e996861fca357b26","teamUniverseHash":"948d8a41ffcd928b43725a41798701189b82185dd8ea16b9089e4e947451b6f1"}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 1f8fb77b3b56ef03a4e84565c07d4d02537dc7bb881562887617811c1a28be8b
- Cohort hash: 7f7c6b1e63e5fdb118f2ef50826032e6f02b52c1fa9dbe02adbb6dca67153842
- Paired IDs hash: f331b0dcb5a33aa22fa444e72c7d2a39a6ce8f5737666693a2b2fd9116272c45
- Prediction hash: 8519be8d6fd0c71c340d72cb37d1363841489488f89481675e6bd8419dfa3239

### La Liga

- Paired N: 352; full coverage: 352/380; PASS 28.
- LL 0.985286403; v1 1.000107050; delta -0.014820647.
- Brier 0.586029570; v1 0.596235242; delta -0.010205672.
- Accuracy 0.522727273; v1 0.511363636.
- HOME: predictions 246, share 0.698863636, recall 0.845161290, precision 0.532520325, one-vs-rest Brier 0.210456589, ECE 0.039689432.
- DRAW: predictions 1, share 0.002840909, recall 0.000000000, precision 0.000000000, one-vs-rest Brier 0.187857379, ECE 0.060476519.
- AWAY: predictions 105, share 0.298295455, recall 0.495327103, precision 0.504761905, one-vs-rest Brier 0.187715601, ECE 0.032338629.
- Local league gate: NO; unmet guards: DRAW ECE delta +0.022445408.
- Final fit: FITTED, N=370; parameters {"b":0.08307920598206954,"h":0.2536533734758236,"teamCount":20,"parameterVectorHash":"21e42c82fafbb2082957bfca939e0b1faac1917053de3844012b4304c683768f","teamUniverseHash":"167b9d0dc293cca4b2421fdd6fb3af64bfd20c9db152e5b921408b5a2386ddd4"}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 3db5a29535870b0605ab4cfef6775c01a1b98f13b03b5429500b80c82ccdcda6
- Cohort hash: 6cc4ce888702696251c145a8da0e4f4056d4aa2cbe989b3adb3e07f0e5e9dc2c
- Paired IDs hash: 521219886b1c809950c003947cef92f4c767cd4f83f345037ac1be278a402c29
- Prediction hash: 0eee1ee07733afc32b4a46374492b26329fa7afca2c11e6d8f822991d9dcbf09

### Serie A

- Paired N: 351; full coverage: 351/380; PASS 29.
- LL 0.983282564; v1 0.991504928; delta -0.008222364.
- Brier 0.587478796; v1 0.593165966; delta -0.005687170.
- Accuracy 0.532763533; v1 0.535612536.
- HOME: predictions 205, share 0.584045584, recall 0.798561151, precision 0.541463415, one-vs-rest Brier 0.203755407, ECE 0.048619775.
- DRAW: predictions 1, share 0.002849003, recall 0.000000000, precision 0.000000000, one-vs-rest Brier 0.201107099, ECE 0.033314540.
- AWAY: predictions 145, share 0.413105413, recall 0.672566372, precision 0.524137931, one-vs-rest Brier 0.182616290, ECE 0.051276128.
- Local league gate: PASS; unmet guards: none.
- Final fit: FITTED, N=380; parameters {"b":0.09734444193745333,"h":0.19387991402393856,"teamCount":20,"parameterVectorHash":"57d8a82e5c86eb89c7d5921f6761deabac055196b1013623d89a53f12c8fafe7","teamUniverseHash":"37d29a8ce816ea6a3fe0cc97cbcf9da8aa95d22b735ac67a3dd1c28d04f33154"}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 9366b356066a87f28edeccdfb50569fc9e0ca4cc24665d5579ee9ade16a8350f
- Cohort hash: 385c508acfdd7115d88bfeeaddc8544d398e9446c019f25528104db5e56093cd
- Paired IDs hash: 46fe23276fd9ef34872d281bd33fa93eb9de3d4fd6adc5d552307a00fab9fa61
- Prediction hash: 4068a3e1a761d0579053f074426a0c7aa0bc059fd8d8f1d88f1f89455ff1e395

### Bundesliga

- Paired N: 286; full coverage: 286/306; PASS 20.
- LL 1.031712993; v1 1.044689659; delta -0.012976666.
- Brier 0.618806292; v1 0.627999019; delta -0.009192727.
- Accuracy 0.503496503; v1 0.475524476.
- HOME: predictions 173, share 0.604895105, recall 0.783783784, precision 0.502890173, one-vs-rest Brier 0.214408207, ECE 0.067377726.
- DRAW: predictions 0, share 0.000000000, recall 0.000000000, precision null, one-vs-rest Brier 0.194035733, ECE 0.048876790.
- AWAY: predictions 113, share 0.395104895, recall 0.564356436, precision 0.504424779, one-vs-rest Brier 0.210362352, ECE 0.072035127.
- Local league gate: NO; unmet guards: AWAY ECE delta +0.030027650.
- Final fit: FITTED, N=297; parameters {"b":0.26512798555111633,"h":0.2444850746040922,"teamCount":18,"parameterVectorHash":"7026c339eb110e2b4b4335353a241ffb641f1b8b1fc99c66f71a0894af047c22","teamUniverseHash":"6fd3944dfed76b59fa3c7a52357391af7f5cbfd2807705a3705731f7a423b0ce"}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 40c96804132db580f72aeda773556f260af46120784abba38cc060f2a803b75a
- Cohort hash: 8e1d854c11f8995fda1ee75565baa4f3d37df89c942f7f8e07db52e520fc08ec
- Paired IDs hash: 0849c92a920ae32bb2a420d3b67829c46f732c1378c080d12fd4e743af4acad4
- Prediction hash: 828f14029858a2471ce7a903c3a08b2be7dcd3716530a7ba423ddcdcc0ecedf3

## H3 — SCREEN_NO

### Premier League

- Paired N: 353; full coverage: 353/380; PASS 27.
- LL 1.007670477; v1 1.007317562; delta +0.000352915.
- Brier 0.602963260; v1 0.602727435; delta +0.000235825.
- Accuracy 0.518413598; v1 0.518413598.
- HOME: predictions 228, share 0.645892351, recall 0.797202797, precision 0.500000000, one-vs-rest Brier 0.219567686, ECE 0.034633125.
- DRAW: predictions 0, share 0.000000000, recall 0.000000000, precision null, one-vs-rest Brier 0.182222851, ECE 0.022392044.
- AWAY: predictions 125, share 0.354107649, recall 0.552000000, precision 0.552000000, one-vs-rest Brier 0.201172723, ECE 0.041845748.
- Local league gate: NO; unmet guards: primary LL/Brier; HOME one-vs-rest Brier.
- Final fit: FITTED, N=275; parameters {"beta":1.014600206632167,"T":0.9856098919192707}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 7ce62b5f756b150ad5e90c5596a022ae2bce2539fae979c4f89ee5962098f31e
- Cohort hash: 7f7c6b1e63e5fdb118f2ef50826032e6f02b52c1fa9dbe02adbb6dca67153842
- Paired IDs hash: f331b0dcb5a33aa22fa444e72c7d2a39a6ce8f5737666693a2b2fd9116272c45
- Prediction hash: 2ef990553eb2f9f6e0c3c8a9cda9efe8a76d54da12f894c20c9595909cfcf0c0

### La Liga

- Paired N: 352; full coverage: 352/380; PASS 28.
- LL 1.000724270; v1 1.000107050; delta +0.000617220.
- Brier 0.596611350; v1 0.596235242; delta +0.000376108.
- Accuracy 0.511363636; v1 0.511363636.
- HOME: predictions 236, share 0.670454545, recall 0.806451613, precision 0.529661017, one-vs-rest Brier 0.216772689, ECE 0.035090603.
- DRAW: predictions 1, share 0.002840909, recall 0.000000000, precision 0.000000000, one-vs-rest Brier 0.189256374, ECE 0.051726710.
- AWAY: predictions 115, share 0.326704545, recall 0.514018692, precision 0.478260870, one-vs-rest Brier 0.190582287, ECE 0.044957038.
- Local league gate: NO; unmet guards: primary LL/Brier; HOME one-vs-rest Brier; AWAY one-vs-rest Brier; DRAW ECE delta +0.013695599.
- Final fit: FITTED, N=274; parameters {"beta":1.0683942755567841,"T":0.9359840490336387}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 462b05dff6022d526d267f88541fa2746644875b9a8c274a4601e39bd65e3b3a
- Cohort hash: 6cc4ce888702696251c145a8da0e4f4056d4aa2cbe989b3adb3e07f0e5e9dc2c
- Paired IDs hash: 521219886b1c809950c003947cef92f4c767cd4f83f345037ac1be278a402c29
- Prediction hash: 67dbe72fdfd3348edc7134be9f7255754dd71ef3ea5e9b49bebf5aebc03bdea0

### Serie A

- Paired N: 351; full coverage: 351/380; PASS 29.
- LL 0.992759296; v1 0.991504928; delta +0.001254368.
- Brier 0.593849074; v1 0.593165966; delta +0.000683107.
- Accuracy 0.535612536; v1 0.535612536.
- HOME: predictions 208, share 0.592592593, recall 0.798561151, precision 0.533653846, one-vs-rest Brier 0.206839505, ECE 0.065663031.
- DRAW: predictions 3, share 0.008547009, recall 0.020202020, precision 0.666666667, one-vs-rest Brier 0.202113379, ECE 0.027106314.
- AWAY: predictions 140, share 0.398860399, recall 0.663716814, precision 0.535714286, one-vs-rest Brier 0.184896190, ECE 0.058729071.
- Local league gate: NO; unmet guards: primary LL/Brier; HOME one-vs-rest Brier; AWAY one-vs-rest Brier; HOME ECE delta +0.012591833.
- Final fit: FITTED, N=274; parameters {"beta":0.9309412389528007,"T":1.0741816541771019}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: ece5ea225f48f4c3ef99d2a1a843b2395b4a5a20d0d59bd1a8f455fe27c4b7fc
- Cohort hash: 385c508acfdd7115d88bfeeaddc8544d398e9446c019f25528104db5e56093cd
- Paired IDs hash: 46fe23276fd9ef34872d281bd33fa93eb9de3d4fd6adc5d552307a00fab9fa61
- Prediction hash: 812623d896930423a73ced763f1c837e278fd6a592c97d9232032abf80f61539

### Bundesliga

- Paired N: 286; full coverage: 286/306; PASS 20.
- LL 1.036734651; v1 1.044689659; delta -0.007955007.
- Brier 0.623010499; v1 0.627999019; delta -0.004988520.
- Accuracy 0.475524476; v1 0.475524476.
- HOME: predictions 180, share 0.629370629, recall 0.756756757, precision 0.466666667, one-vs-rest Brier 0.217385635, ECE 0.083713653.
- DRAW: predictions 1, share 0.003496503, recall 0.000000000, precision 0.000000000, one-vs-rest Brier 0.192820897, ECE 0.036687662.
- AWAY: predictions 105, share 0.367132867, recall 0.514851485, precision 0.495238095, one-vs-rest Brier 0.212803967, ECE 0.048392311.
- Local league gate: PASS; unmet guards: none.
- Final fit: FITTED, N=214; parameters {"beta":0.8168213623110203,"T":1.2242578930241432}. H2 values denote final development state only, not constant evaluation coefficients.
- Final parameter hash: 1d1d67c26940356b81c3204f3f2b6c4a594189d40149f91dca2300172005b6e0
- Cohort hash: 8e1d854c11f8995fda1ee75565baa4f3d37df89c942f7f8e07db52e520fc08ec
- Paired IDs hash: 0849c92a920ae32bb2a420d3b67829c46f732c1378c080d12fd4e743af4acad4
- Prediction hash: f3870cdeb082848cbfff7c918985e3dbe2519ae81fc8e0bbaff40a37e8e685d2

## Screen interpretation

H1 improves both primary metrics in every league, but fails EPL AWAY Brier and Bundesliga AWAY Brier/ECE guards. H2 also improves both primary metrics in every league, but fails EPL HOME recall/ECE, La Liga DRAW ECE, and Bundesliga AWAY ECE guards. H3 fails primary improvement in EPL/La Liga/Serie A and associated guards. Each hypothesis therefore fails the mandatory all-four-league screen. Individual league pass labels in the machine audit do not establish hypothesis eligibility.

BEST_DESCRIPTIVE_CANDIDATE = H2, strictly for lower LL and Brier separately in each of the four leagues among these three candidates. This is not a pooled winner score or a selection for deployment, and it does not override any failed guard. No candidate is eligible under the complete screen. No combinations were evaluated or chosen.

## Post-run integrity and storage

Read-only verification checked 5735 local sealed JSON envelopes and 4338 candidate history snapshots; all hashes and referenced fit/prediction/report hashes matched. All final-fit input rows were season 2023. All candidate targets/history obeyed real-season, league, target exclusion, strict 48-hour and 365-day constraints. No prediction or fitting was repeated.

Protected files: 622; before/after hash: 1d215cc320ecf6d5145c7e2d5027d53750775f8409ea4c1b6a40bc5ab6ed978f. Existing Development sources/results, v1 model, historical archives, prior backtests, and Forward artifacts remain byte-identical. Full precision metrics, 10-bin calibration for all classes, guard booleans/deltas, coverage and mechanism diagnostics are in football-poisson-v2-exposed-evaluation-v1.json.

Raw archives, fixture-level predictions/results, input histories and full optimizer/parameter vectors remain LOCAL_ONLY in ignored data/cache/research/football/poisson-v2-draw-research/evaluation-execution-v1/2026-09-12T05-38-03-221Z/. Only the sanitized audit and report are committed. No API call, key, market, owner or external-shadow data was used.

## Cursor handoff and governance

Preserve EVALUATION_V1_EXECUTION_STARTED.json. Do not rerun --run, modify any sealed source or overwrite results. Next action is CTO review only. An independent uninspected cohort and separately approved protocol are required before any promotion. Existing untracked access-gate document is preserved. No main merge.

FINAL_FITTING_EXECUTED = YES
EVALUATION_EXECUTED = YES (one run)
DEVELOPMENT_SOURCE_CHANGED = NO
DEVELOPMENT_RESULT_CHANGED = NO
ALGORITHM_CHANGED = NO
HYPERPARAMETERS_CHANGED = NO
PROMOTION_RULE_CHANGED = NO
EVALUATION_EXECUTION_INFRA_CHANGED = YES
INDEPENDENT_CONFIRMATION_REQUIRED = YES
FORWARD_MODEL_CHANGED = NO
MODEL_PROMOTED = NO
ODDS_USED = NO
MARKET_USED = NO
PROVIDER_PREDICTION_USED = NO

FOOTBALL_POISSON_V2_EXPOSED_EVALUATION_V1_READY_FOR_CTO_REVIEW

STOP.
