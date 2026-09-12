# FOOTBALL V3 PHASE-1 DIAGNOSTIC REVIEW V1

BASE_SHA: c57cc044213e61e5d79ffd440cfdb1cdc75d836e

판정: **PHASE1_DIAGNOSTIC_REDESIGN_JUSTIFIED**. 기존 결과의 이질성과 feature 중복 표현을 추가 연구할 근거는 있지만, 원인 하나를 확정하거나 F2를 winner로 선언할 근거는 부족하다. 2025 independent confirmation은 실행하지 않는다. 이 판정은 새로운 정량 promotion gate가 아닌 기술적 연구 판단이다.

## Scope and evidence

2023 Development internal check와 2024 EXPOSED의 기존 봉인 결과만 사용했다. metric은 봉인 집계값의 차이를 계산했으며 모델 실행, 재적합, 새 prediction, 결과 재채점은 없다. 2024 contribution/probability 통계는 기존 fixed paired U만 사용한다: EPL 353, La Liga 352, Serie A 351, Bundesliga 286. PASS 104건은 기존 full coverage에 보존되며 정상 gate 때문에 paired 분석에 포함되지 않는다. 결과를 보고 fixture를 제거하지 않았다.

2025는 committed seal metadata/hash만 검증했다. 그 안의 local raw 경로를 따라가지 않았으며 feature value·score·prediction·metric을 열지 않았다. 기존 untracked access-gate 문서도 보존했다.

12개 V3 source, 21개 dependency, 644개 protected file 및 아래 사용한 seal을 검증했다. 2023/2024 raw API response 2,892개는 기존 census sourceHash와 일치한다. 그 중 2,891개 fixture에서 세 feature가 완전하며 Serie A 2024 fixture 1223728의 기존 결측은 유지했다. 원본 및 경기별 feature 값은 LOCAL_ONLY다.

Machine-readable audit의 matrix는 24행(2 stages × 4 leagues × 3 candidates)이며 각 행에 v1/H2 대비 LL, Brier, accuracy, HOME/DRAW/AWAY recall, OVR Brier, ECE delta를 모두 포함한다. 확률·accuracy·recall·ECE는 0–1 단위이며 delta는 candidate−comparator다. 아래도 같은 단위로 표시한다. LL/Brier/ECE는 낮을수록 좋지만 ECE와 proper score는 서로 대체할 수 없다.

## Candidate diagnosis

- F1: MIXED: EPL improves H2 slightly; other three leagues worsen. xG coefficient signs differ across leagues; no DRAW correction established.
- F2: MIXED: EPL/La Liga improve H2, Serie A/Bundesliga worsen. Strong Shots/SOT covariate correlation and conditional coefficient movement; signal instability versus representation cannot be causally separated.
- F3: MIXED: more features do not deliver consistent H2 improvement. Similar exposed behavior to F2, with correlated covariates and additional sign changes; no incremental feature selection conclusion.

모든 exposed league/candidate가 v1 LL/Brier는 개선했다. 그러나 H2를 기준으로 하면 EPL 전부, La Liga F2/F3만 개선한다. v1 개선을 feature 자체의 추가 효과로 해석하면 이미 H2가 제공한 개선을 잘못 귀속하게 된다. pooled winner score는 만들지 않았다.

## Complete delta matrix

### 2023_INTERNAL_CHECK

- **EPL F1**, paired N=184
  - vs v1: ΔLL 0.059944; ΔBrier 0.044177; Δaccuracy -0.092391.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.074074/0.026696/-0.008640; DRAW 0.000000/0.000250/-0.005069; AWAY -0.192982/0.017231/-0.000740.
  - vs H2: ΔLL 0.088678; ΔBrier 0.062659; Δaccuracy -0.086957.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/0.033020/-0.012565; DRAW 0.000000/0.002560/-0.010625; AWAY -0.280702/0.027079/-0.031776.
- **EPL F2**, paired N=184
  - vs v1: ΔLL 0.056854; ΔBrier 0.042043; Δaccuracy -0.048913.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.074074/0.027881/0.005298; DRAW 0.000000/0.000649/-0.012019; AWAY -0.052632/0.013513/0.053161.
  - vs H2: ΔLL 0.085588; ΔBrier 0.060525; Δaccuracy -0.043478.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/0.034205/0.001372; DRAW 0.000000/0.002958/-0.017575; AWAY -0.140351/0.023362/0.022124.
- **EPL F3**, paired N=184
  - vs v1: ΔLL 0.059226; ΔBrier 0.043571; Δaccuracy -0.076087.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.061728/0.026738/-0.010194; DRAW 0.000000/0.000112/0.006203; AWAY -0.157895/0.016720/0.005669.
  - vs H2: ΔLL 0.087960; ΔBrier 0.062053; Δaccuracy -0.070652.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.012346/0.033062/-0.014120; DRAW 0.000000/0.002422/0.000647; AWAY -0.245614/0.026569/-0.025367.
- **La Liga F1**, paired N=200
  - vs v1: ΔLL -0.010484; ΔBrier -0.006315; Δaccuracy 0.050000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.034091/-0.002664/-0.018184; DRAW 0.040000/-0.001889/0.018900; AWAY 0.080645/-0.001763/0.052133.
  - vs H2: ΔLL 0.001506; ΔBrier 0.001289; Δaccuracy 0.000000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.011364/0.001007/-0.022455; DRAW 0.000000/-0.000826/0.013127; AWAY -0.016129/0.001108/0.015234.
- **La Liga F2**, paired N=200
  - vs v1: ΔLL -0.012618; ΔBrier -0.007682; Δaccuracy 0.045000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.034091/-0.003244/0.016218; DRAW 0.020000/-0.001623/0.012612; AWAY 0.080645/-0.002816/0.033328.
  - vs H2: ΔLL -0.000629; ΔBrier -0.000077; Δaccuracy -0.005000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.011364/0.000428/0.011948; DRAW -0.020000/-0.000560/0.006840; AWAY -0.016129/0.000054/-0.003571.
- **La Liga F3**, paired N=200
  - vs v1: ΔLL -0.012805; ΔBrier -0.007725; Δaccuracy 0.050000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.034091/-0.002948/0.019225; DRAW 0.040000/-0.001826/0.020794; AWAY 0.080645/-0.002951/0.039307.
  - vs H2: ΔLL -0.000816; ΔBrier -0.000120; Δaccuracy 0.000000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.011364/0.000724/0.014955; DRAW 0.000000/-0.000763/0.015022; AWAY -0.016129/-0.000080/0.002408.
- **Serie A F1**, paired N=200
  - vs v1: ΔLL -0.022946; ΔBrier -0.016551; Δaccuracy 0.040000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.013158/-0.007643/-0.025782; DRAW 0.015873/-0.000068/-0.005425; AWAY 0.098361/-0.008841/0.015168.
  - vs H2: ΔLL -0.002102; ΔBrier -0.001199; Δaccuracy 0.015000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.026316/-0.001338/-0.024072; DRAW 0.031746/-0.001203/-0.004207; AWAY -0.016393/0.001341/0.013356.
- **Serie A F2**, paired N=200
  - vs v1: ΔLL -0.026846; ΔBrier -0.018573; Δaccuracy 0.040000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.013158/-0.007749/-0.030930; DRAW 0.015873/-0.000267/-0.001637; AWAY 0.098361/-0.010557/0.022461.
  - vs H2: ΔLL -0.006002; ΔBrier -0.003221; Δaccuracy 0.015000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.026316/-0.001444/-0.029221; DRAW 0.031746/-0.001402/-0.000419; AWAY -0.016393/-0.000375/0.020650.
- **Serie A F3**, paired N=200
  - vs v1: ΔLL -0.023947; ΔBrier -0.016462; Δaccuracy 0.035000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.013158/-0.007128/-0.014380; DRAW 0.015873/-0.000251/0.000554; AWAY 0.081967/-0.009083/0.007465.
  - vs H2: ΔLL -0.003102; ΔBrier -0.001110; Δaccuracy 0.010000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.026316/-0.000823/-0.012671; DRAW 0.031746/-0.001386/0.001772; AWAY -0.032787/0.001099/0.005654.
- **Bundesliga F1**, paired N=163
  - vs v1: ΔLL -0.005177; ΔBrier -0.003118; Δaccuracy 0.018405.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.015385/-0.002606/-0.035537; DRAW 0.000000/-0.003846/-0.010433; AWAY 0.078431/0.003334/-0.009252.
  - vs H2: ΔLL -0.000539; ΔBrier 0.000311; Δaccuracy -0.006135.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.015385/-0.002198/-0.020891; DRAW 0.000000/-0.000810/-0.008581; AWAY 0.000000/0.003319/0.014716.
- **Bundesliga F2**, paired N=163
  - vs v1: ΔLL -0.003271; ΔBrier -0.001966; Δaccuracy 0.024540.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/-0.001495/-0.025358; DRAW 0.000000/-0.002518/-0.007762; AWAY 0.078431/0.002047/0.005891.
  - vs H2: ΔLL 0.001366; ΔBrier 0.001464; Δaccuracy 0.000000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/-0.001088/-0.010712; DRAW 0.000000/0.000518/-0.005909; AWAY 0.000000/0.002033/0.029859.
- **Bundesliga F3**, paired N=163
  - vs v1: ΔLL -0.004197; ΔBrier -0.002625; Δaccuracy 0.024540.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/-0.002043/-0.026520; DRAW 0.000000/-0.002795/-0.008050; AWAY 0.078431/0.002213/0.027810.
  - vs H2: ΔLL 0.000441; ΔBrier 0.000804; Δaccuracy 0.000000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/-0.001635/-0.011874; DRAW 0.000000/0.000241/-0.006197; AWAY 0.000000/0.002199/0.051778.

### 2024_EXPOSED

- **EPL F1**, paired N=353
  - vs v1: ΔLL -0.020527; ΔBrier -0.012693; Δaccuracy 0.011331.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.006993/-0.008175/-0.000884; DRAW 0.000000/-0.000906/0.000939; AWAY 0.040000/-0.003611/-0.000655.
  - vs H2: ΔLL -0.000686; ΔBrier -0.000794; Δaccuracy 0.011331.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.027972/0.000176/-0.012511; DRAW 0.000000/-0.000445/-0.002578; AWAY 0.000000/-0.000524/0.001314.
- **EPL F2**, paired N=353
  - vs v1: ΔLL -0.020887; ΔBrier -0.012706; Δaccuracy 0.014164.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/-0.007971/-0.004046; DRAW 0.000000/-0.000362/0.001024; AWAY 0.040000/-0.004373/-0.014647.
  - vs H2: ΔLL -0.001046; ΔBrier -0.000808; Δaccuracy 0.014164.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.034965/0.000379/-0.015673; DRAW 0.000000/0.000099/-0.002492; AWAY 0.000000/-0.001286/-0.012678.
- **EPL F3**, paired N=353
  - vs v1: ΔLL -0.020576; ΔBrier -0.012528; Δaccuracy 0.014164.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.013986/-0.007870/0.001410; DRAW 0.000000/-0.000438/0.000627; AWAY 0.056000/-0.004220/-0.017022.
  - vs H2: ΔLL -0.000735; ΔBrier -0.000629; Δaccuracy 0.014164.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.020979/0.000480/-0.010217; DRAW 0.000000/0.000023/-0.002890; AWAY 0.016000/-0.001132/-0.015053.
- **La Liga F1**, paired N=352
  - vs v1: ΔLL -0.013954; ΔBrier -0.009661; Δaccuracy 0.014205.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.019355/-0.005780/-0.012186; DRAW 0.000000/-0.001194/0.021073; AWAY 0.018692/-0.002686/0.005478.
  - vs H2: ΔLL 0.000867; ΔBrier 0.000545; Δaccuracy 0.002841.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.019355/0.000414/-0.020977; DRAW 0.000000/0.000005/-0.001373; AWAY 0.037383/0.000126/0.011263.
- **La Liga F2**, paired N=352
  - vs v1: ΔLL -0.017123; ΔBrier -0.011711; Δaccuracy 0.014205.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.019355/-0.005785/0.011743; DRAW 0.000000/-0.001356/0.025274; AWAY 0.018692/-0.004571/0.011455.
  - vs H2: ΔLL -0.002303; ΔBrier -0.001506; Δaccuracy 0.002841.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.019355/0.000409/0.002952; DRAW 0.000000/-0.000157/0.002829; AWAY 0.037383/-0.001758/0.017240.
- **La Liga F3**, paired N=352
  - vs v1: ΔLL -0.015550; ΔBrier -0.010736; Δaccuracy 0.022727.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.032258/-0.005508/0.003286; DRAW 0.000000/-0.001193/0.018222; AWAY 0.028037/-0.004035/0.004644.
  - vs H2: ΔLL -0.000729; ΔBrier -0.000530; Δaccuracy 0.011364.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.006452/0.000686/-0.005504; DRAW 0.000000/0.000006/-0.004224; AWAY 0.046729/-0.001223/0.010429.
- **Serie A F1**, paired N=351
  - vs v1: ΔLL -0.003509; ΔBrier -0.002730; Δaccuracy -0.002849.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.007194/-0.001529/-0.010204; DRAW -0.020202/-0.001300/-0.002110; AWAY 0.000000/0.000100/-0.002772.
  - vs H2: ΔLL 0.004713; ΔBrier 0.002958; Δaccuracy 0.000000.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.007194/0.001154/-0.005753; DRAW 0.000000/0.000128/-0.002093; AWAY -0.008850/0.001676/0.002994.
- **Serie A F2**, paired N=351
  - vs v1: ΔLL -0.000126; ΔBrier -0.000445; Δaccuracy 0.000000.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/-0.000183/-0.007342; DRAW -0.020202/-0.000983/-0.002341; AWAY 0.017699/0.000721/0.001017.
  - vs H2: ΔLL 0.008096; ΔBrier 0.005243; Δaccuracy 0.002849.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/0.002499/-0.002890; DRAW 0.000000/0.000446/-0.002323; AWAY 0.008850/0.002298/0.006783.
- **Serie A F3**, paired N=351
  - vs v1: ΔLL -0.000372; ΔBrier -0.000614; Δaccuracy 0.002849.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.007194/-0.000296/-0.010139; DRAW -0.020202/-0.000998/-0.002416; AWAY 0.017699/0.000680/0.001064.
  - vs H2: ΔLL 0.007851; ΔBrier 0.005073; Δaccuracy 0.005698.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.007194/0.002386/-0.005687; DRAW 0.000000/0.000430/-0.002399; AWAY 0.008850/0.002257/0.006829.
- **Bundesliga F1**, paired N=286
  - vs v1: ΔLL -0.009547; ΔBrier -0.006734; Δaccuracy 0.017483.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.027027/-0.003470/-0.024480; DRAW 0.000000/-0.000625/-0.006079; AWAY 0.019802/-0.002639/0.017496.
  - vs H2: ΔLL 0.003430; ΔBrier 0.002459; Δaccuracy -0.010490.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.000000/0.001895/-0.008668; DRAW 0.000000/-0.000167/-0.004648; AWAY -0.029703/0.000731/-0.012531.
- **Bundesliga F2**, paired N=286
  - vs v1: ΔLL -0.011046; ΔBrier -0.008004; Δaccuracy 0.010490.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.018018/-0.004669/-0.022335; DRAW 0.000000/-0.000800/-0.006791; AWAY 0.009901/-0.002535/0.015153.
  - vs H2: ΔLL 0.001930; ΔBrier 0.001189; Δaccuracy -0.017483.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.009009/0.000697/-0.006523; DRAW 0.000000/-0.000343/-0.005359; AWAY -0.039604/0.000835/-0.014875.
- **Bundesliga F3**, paired N=286
  - vs v1: ΔLL -0.011225; ΔBrier -0.008140; Δaccuracy 0.010490.
  - vs v1, class (Δrecall / ΔOVR Brier / ΔECE): HOME 0.018018/-0.004730/-0.022216; DRAW 0.000000/-0.000792/-0.006706; AWAY 0.009901/-0.002618/0.015009.
  - vs H2: ΔLL 0.001752; ΔBrier 0.001053; Δaccuracy -0.017483.
  - vs H2, class (Δrecall / ΔOVR Brier / ΔECE): HOME -0.009009/0.000636/-0.006404; DRAW 0.000000/-0.000335/-0.005274; AWAY -0.039604/0.000752/-0.015019.

## Beta stability

Initial와 final fit은 서로 다른 크기의 nested 2023 training set이다. 이 비교는 uncertainty estimate 또는 같은 표본에서의 재현성 실험이 아니다. relative change=|final−initial|/|initial|, initial=0이면 null이다. 작은 초기값에서는 비율이 커지므로 절대변화와 함께 해석한다. 모든 부호 반전은 strict opposite sign 기준이고 임의 tolerance gate를 추가하지 않았다.

- F1 xG_For final positive only La Liga; xG_Against positive EPL/Serie A and negative La Liga/Bundesliga.
- F2 Shots_For final negative Serie A, positive other leagues (Bundesliga near zero); Shots_Against negative only La Liga; SOT_For and SOT_Against negative in all four.
- F3 xG_For positive La Liga/Bundesliga, negative EPL/Serie A; xG_Against negative EPL/La Liga, positive Serie A/Bundesliga; Shots_For negative only Serie A; Shots_Against negative only La Liga; both SOT coefficients negative in all four. These are conditional associations, not causal football effects.

### EPL F1: initial N=83 → final N=275

- xG_For: -0.608248 → -0.185052; |β| 0.608248 → 0.185052; Δ 0.423196; |Δ| 0.423196; relative |Δ| 0.695762; sign reversal=false.
- xG_Against: -0.646669 → 0.073977; |β| 0.646669 → 0.073977; Δ 0.720646; |Δ| 0.720646; relative |Δ| 1.114397; sign reversal=true.

### EPL F2: initial N=83 → final N=275

- Shots_For: -0.342076 → 0.268608; |β| 0.342076 → 0.268608; Δ 0.610683; |Δ| 0.610683; relative |Δ| 1.785228; sign reversal=true.
- Shots_Against: -0.070991 → 0.333287; |β| 0.070991 → 0.333287; Δ 0.404278; |Δ| 0.404278; relative |Δ| 5.694809; sign reversal=true.
- SOT_For: -0.332351 → -0.390589; |β| 0.332351 → 0.390589; Δ -0.058238; |Δ| 0.058238; relative |Δ| 0.175232; sign reversal=false.
- SOT_Against: -0.576151 → -0.177466; |β| 0.576151 → 0.177466; Δ 0.398686; |Δ| 0.398686; relative |Δ| 0.691981; sign reversal=false.

### EPL F3: initial N=83 → final N=275

- xG_For: -0.682790 → -0.143712; |β| 0.682790 → 0.143712; Δ 0.539079; |Δ| 0.539079; relative |Δ| 0.789523; sign reversal=false.
- xG_Against: -0.400815 → -0.013646; |β| 0.400815 → 0.013646; Δ 0.387170; |Δ| 0.387170; relative |Δ| 0.965955; sign reversal=false.
- Shots_For: 0.038684 → 0.334603; |β| 0.038684 → 0.334603; Δ 0.295919; |Δ| 0.295919; relative |Δ| 7.649733; sign reversal=false.
- Shots_Against: 0.081777 → 0.338223; |β| 0.081777 → 0.338223; Δ 0.256447; |Δ| 0.256447; relative |Δ| 3.135943; sign reversal=false.
- SOT_For: 0.065504 → -0.308253; |β| 0.065504 → 0.308253; Δ -0.373757; |Δ| 0.373757; relative |Δ| 5.705855; sign reversal=true.
- SOT_Against: -0.335166 → -0.168927; |β| 0.335166 → 0.168927; Δ 0.166238; |Δ| 0.166238; relative |Δ| 0.495988; sign reversal=false.

### La Liga F1: initial N=74 → final N=274

- xG_For: 0.017062 → 0.167704; |β| 0.017062 → 0.167704; Δ 0.150642; |Δ| 0.150642; relative |Δ| 8.829264; sign reversal=false.
- xG_Against: -0.318525 → -0.169628; |β| 0.318525 → 0.169628; Δ 0.148897; |Δ| 0.148897; relative |Δ| 0.467457; sign reversal=false.

### La Liga F2: initial N=74 → final N=274

- Shots_For: 0.375031 → 0.448968; |β| 0.375031 → 0.448968; Δ 0.073937; |Δ| 0.073937; relative |Δ| 0.197148; sign reversal=false.
- Shots_Against: -0.223967 → -0.083103; |β| 0.223967 → 0.083103; Δ 0.140864; |Δ| 0.140864; relative |Δ| 0.628950; sign reversal=false.
- SOT_For: -0.298796 → -0.121231; |β| 0.298796 → 0.121231; Δ 0.177565; |Δ| 0.177565; relative |Δ| 0.594269; sign reversal=false.
- SOT_Against: -0.088281 → -0.127463; |β| 0.088281 → 0.127463; Δ -0.039182; |Δ| 0.039182; relative |Δ| 0.443829; sign reversal=false.

### La Liga F3: initial N=74 → final N=274

- xG_For: 0.153715 → 0.201519; |β| 0.153715 → 0.201519; Δ 0.047804; |Δ| 0.047804; relative |Δ| 0.310990; sign reversal=false.
- xG_Against: -0.317745 → -0.104876; |β| 0.317745 → 0.104876; Δ 0.212869; |Δ| 0.212869; relative |Δ| 0.669935; sign reversal=false.
- Shots_For: 0.356544 → 0.407935; |β| 0.356544 → 0.407935; Δ 0.051391; |Δ| 0.051391; relative |Δ| 0.144136; sign reversal=false.
- Shots_Against: -0.079555 → -0.046198; |β| 0.079555 → 0.046198; Δ 0.033357; |Δ| 0.033357; relative |Δ| 0.419293; sign reversal=false.
- SOT_For: -0.420566 → -0.288208; |β| 0.420566 → 0.288208; Δ 0.132359; |Δ| 0.132359; relative |Δ| 0.314715; sign reversal=false.
- SOT_Against: 0.057179 → -0.072142; |β| 0.057179 → 0.072142; Δ -0.129322; |Δ| 0.129322; relative |Δ| 2.261694; sign reversal=true.

### Serie A F1: initial N=68 → final N=274

- xG_For: -0.472217 → -0.156168; |β| 0.472217 → 0.156168; Δ 0.316049; |Δ| 0.316049; relative |Δ| 0.669287; sign reversal=false.
- xG_Against: 0.185570 → 0.036392; |β| 0.185570 → 0.036392; Δ -0.149178; |Δ| 0.149178; relative |Δ| 0.803888; sign reversal=false.

### Serie A F2: initial N=68 → final N=274

- Shots_For: -0.477469 → -0.234848; |β| 0.477469 → 0.234848; Δ 0.242621; |Δ| 0.242621; relative |Δ| 0.508140; sign reversal=false.
- Shots_Against: 0.777477 → 0.259287; |β| 0.777477 → 0.259287; Δ -0.518191; |Δ| 0.518191; relative |Δ| 0.666503; sign reversal=false.
- SOT_For: -0.199791 → -0.079736; |β| 0.199791 → 0.079736; Δ 0.120055; |Δ| 0.120055; relative |Δ| 0.600902; sign reversal=false.
- SOT_Against: -0.244497 → -0.131701; |β| 0.244497 → 0.131701; Δ 0.112795; |Δ| 0.112795; relative |Δ| 0.461337; sign reversal=false.

### Serie A F3: initial N=68 → final N=274

- xG_For: -0.317768 → -0.036540; |β| 0.317768 → 0.036540; Δ 0.281227; |Δ| 0.281227; relative |Δ| 0.885009; sign reversal=false.
- xG_Against: 0.031833 → 0.022149; |β| 0.031833 → 0.022149; Δ -0.009684; |Δ| 0.009684; relative |Δ| 0.304207; sign reversal=false.
- Shots_For: -0.233707 → -0.210471; |β| 0.233707 → 0.210471; Δ 0.023236; |Δ| 0.023236; relative |Δ| 0.099425; sign reversal=false.
- Shots_Against: 0.762563 → 0.251927; |β| 0.762563 → 0.251927; Δ -0.510636; |Δ| 0.510636; relative |Δ| 0.669631; sign reversal=false.
- SOT_For: -0.069270 → -0.059111; |β| 0.069270 → 0.059111; Δ 0.010159; |Δ| 0.010159; relative |Δ| 0.146656; sign reversal=false.
- SOT_Against: -0.267767 → -0.149176; |β| 0.267767 → 0.149176; Δ 0.118591; |Δ| 0.118591; relative |Δ| 0.442888; sign reversal=false.

### Bundesliga F1: initial N=51 → final N=214

- xG_For: -0.120958 → -0.055110; |β| 0.120958 → 0.055110; Δ 0.065848; |Δ| 0.065848; relative |Δ| 0.544386; sign reversal=false.
- xG_Against: -0.337465 → -0.152157; |β| 0.337465 → 0.152157; Δ 0.185308; |Δ| 0.185308; relative |Δ| 0.549118; sign reversal=false.

### Bundesliga F2: initial N=51 → final N=214

- Shots_For: -0.252762 → 0.017238; |β| 0.252762 → 0.017238; Δ 0.270000; |Δ| 0.270000; relative |Δ| 1.068197; sign reversal=true.
- Shots_Against: 0.239085 → 0.262170; |β| 0.239085 → 0.262170; Δ 0.023085; |Δ| 0.023085; relative |Δ| 0.096555; sign reversal=false.
- SOT_For: -0.044738 → -0.092582; |β| 0.044738 → 0.092582; Δ -0.047843; |Δ| 0.047843; relative |Δ| 1.069396; sign reversal=false.
- SOT_Against: -0.564792 → -0.449422; |β| 0.564792 → 0.449422; Δ 0.115370; |Δ| 0.115370; relative |Δ| 0.204270; sign reversal=false.

### Bundesliga F3: initial N=51 → final N=214

- xG_For: -0.013460 → 0.025195; |β| 0.013460 → 0.025195; Δ 0.038656; |Δ| 0.038656; relative |Δ| 2.871805; sign reversal=true.
- xG_Against: -0.091630 → 0.017992; |β| 0.091630 → 0.017992; Δ 0.109622; |Δ| 0.109622; relative |Δ| 1.196355; sign reversal=true.
- Shots_For: -0.236753 → 0.007004; |β| 0.236753 → 0.007004; Δ 0.243757; |Δ| 0.243757; relative |Δ| 1.029582; sign reversal=true.
- Shots_Against: 0.292267 → 0.250729; |β| 0.292267 → 0.250729; Δ -0.041539; |Δ| 0.041539; relative |Δ| 0.142125; sign reversal=false.
- SOT_For: -0.034596 → -0.110297; |β| 0.034596 → 0.110297; Δ -0.075701; |Δ| 0.075701; relative |Δ| 2.188130; sign reversal=false.
- SOT_Against: -0.519247 → -0.457375; |β| 0.519247 → 0.457375; Δ 0.061872; |Δ| 0.061872; relative |Δ| 0.119158; sign reversal=false.

EPL은 4개, La Liga는 1개, Serie A는 0개, Bundesliga는 4개의 coefficient sign reversal이 있다(F1/F2/F3 전체 12개 계수 기준). 개선된 EPL에서도 반전이 있고 악화된 Serie A에서는 없으므로 부호 불안정 하나로 성능 차이를 설명할 수 없다.

## Frozen 2024 contribution

저장된 beta·X와 저장된 lambda 비율을 사용했다. dot product와 log(lambdaV3/lambdaH2)가 각각 저장 contribution과 1e−12 이내에서 일치함을 확인했다. 이는 기존 출력의 algebraic integrity 확인이며 새 확률을 생성하지 않는다. home/away rate를 동일 가중하여 집계하며 quantile은 sorted index (n−1)q 선형보간이다.

- **EPL F1** (706 team-rates):
  - beta·X: p10 -0.058887, p25 -0.036663, median 0.001393, p75 0.034923, p90 0.072385, max |value| 0.134749, min/max -0.121220/0.134749.
  - lambda ratio: p10 0.942813, p25 0.964001, median 1.001394, p75 1.035540, p90 1.075069, max |value| 1.144249, min/max 0.885839/1.144249.
- **EPL F2** (706 team-rates):
  - beta·X: p10 -0.067373, p25 -0.035183, median 0.001366, p75 0.037821, p90 0.071380, max |value| 0.175640, min/max -0.175640/0.167532.
  - lambda ratio: p10 0.934846, p25 0.965428, median 1.001367, p75 1.038545, p90 1.073990, max |value| 1.182383, min/max 0.838920/1.182383.
- **EPL F3** (706 team-rates):
  - beta·X: p10 -0.071403, p25 -0.039108, median 0.004158, p75 0.040874, p90 0.076620, max |value| 0.174330, min/max -0.174330/0.170463.
  - lambda ratio: p10 0.931086, p25 0.961647, median 1.004167, p75 1.041721, p90 1.079631, max |value| 1.185854, min/max 0.840020/1.185854.
- **La Liga F1** (704 team-rates):
  - beta·X: p10 -0.073450, p25 -0.040635, median -0.006173, p75 0.033693, p90 0.069789, max |value| 0.150852, min/max -0.146359/0.150852.
  - lambda ratio: p10 0.929183, p25 0.960179, median 0.993846, p75 1.034267, p90 1.072282, max |value| 1.162824, min/max 0.863847/1.162824.
- **La Liga F2** (704 team-rates):
  - beta·X: p10 -0.076821, p25 -0.037921, median -0.000553, p75 0.034976, p90 0.076707, max |value| 0.183850, min/max -0.183318/0.183850.
  - lambda ratio: p10 0.926055, p25 0.962789, median 0.999447, p75 1.035595, p90 1.079726, max |value| 1.201835, min/max 0.832504/1.201835.
- **La Liga F3** (704 team-rates):
  - beta·X: p10 -0.081002, p25 -0.041711, median 0.000267, p75 0.039107, p90 0.082534, max |value| 0.219794, min/max -0.219794/0.204960.
  - lambda ratio: p10 0.922192, p25 0.959147, median 1.000267, p75 1.039882, p90 1.086036, max |value| 1.227476, min/max 0.802684/1.227476.
- **Serie A F1** (702 team-rates):
  - beta·X: p10 -0.055694, p25 -0.023148, median 0.002887, p75 0.030556, p90 0.047695, max |value| 0.090219, min/max -0.090219/0.075909.
  - lambda ratio: p10 0.945829, p25 0.977117, median 1.002891, p75 1.031027, p90 1.048850, max |value| 1.078865, min/max 0.913731/1.078865.
- **Serie A F2** (702 team-rates):
  - beta·X: p10 -0.069985, p25 -0.044004, median -0.002810, p75 0.040410, p90 0.075170, max |value| 0.150863, min/max -0.150863/0.144588.
  - lambda ratio: p10 0.932408, p25 0.956950, median 0.997194, p75 1.041238, p90 1.078067, max |value| 1.155564, min/max 0.859966/1.155564.
- **Serie A F3** (702 team-rates):
  - beta·X: p10 -0.071516, p25 -0.044329, median -0.001475, p75 0.041369, p90 0.075667, max |value| 0.155022, min/max -0.155022/0.145381.
  - lambda ratio: p10 0.930981, p25 0.956640, median 0.998526, p75 1.042237, p90 1.078604, max |value| 1.156480, min/max 0.856396/1.156480.
- **Bundesliga F1** (572 team-rates):
  - beta·X: p10 -0.031183, p25 -0.015551, median 0.002561, p75 0.020862, p90 0.057896, max |value| 0.116895, min/max -0.066181/0.116895.
  - lambda ratio: p10 0.969299, p25 0.984570, median 1.002564, p75 1.021081, p90 1.059605, max |value| 1.124001, min/max 0.935962/1.124001.
- **Bundesliga F2** (572 team-rates):
  - beta·X: p10 -0.048901, p25 -0.023379, median 0.003695, p75 0.028761, p90 0.059266, max |value| 0.122693, min/max -0.100290/0.122693.
  - lambda ratio: p10 0.952276, p25 0.976892, median 1.003702, p75 1.029179, p90 1.061057, max |value| 1.130537, min/max 0.904575/1.130537.
- **Bundesliga F3** (572 team-rates):
  - beta·X: p10 -0.050275, p25 -0.023433, median 0.003064, p75 0.027782, p90 0.058895, max |value| 0.122693, min/max -0.098987/0.122693.
  - lambda ratio: p10 0.950968, p25 0.976840, median 1.003069, p75 1.028171, p90 1.060664, max |value| 1.130538, min/max 0.905754/1.130538.

F2 중앙 80% rate ratio는 EPL 0.934846–1.073990, La Liga 0.926055–1.079726, Serie A 0.932408–1.078067, Bundesliga 0.952276–1.061057이다. 실패 리그가 더 큰 amplitude를 보이지 않는다. “과도하다”는 최적값 대비 판단은 현재 자료로 식별할 수 없다. clipping/threshold는 채택하거나 구체화하지 않았다.

## Feature redundancy and H2 overlap

Raw feature correlation은 match당 두 team 관측치, pairwise complete로 계산했다. Spearman은 동률 평균 rank다. 동일 경기 양 팀·반복 팀·overlapping history 때문에 독립 관측치가 아니며 p-value나 causal significance로 해석하지 않는다. 2023/2024 season별 상세값과 모든 For/Against covariate pair는 JSON에 보존한다.

- EPL 2023: Shots/SOT Pearson 0.718945, Spearman 0.690426 (team rows 760, matches 380); xG/SOT Pearson 0.714794, Spearman 0.689689 (team rows 760, matches 380); xG/Shots Pearson 0.723074, Spearman 0.720911 (team rows 760, matches 380).
- EPL 2024: Shots/SOT Pearson 0.697490, Spearman 0.681126 (team rows 760, matches 380); xG/SOT Pearson 0.668895, Spearman 0.638997 (team rows 760, matches 380); xG/Shots Pearson 0.677574, Spearman 0.698401 (team rows 760, matches 380).
- EPL 2023+2024: Shots/SOT Pearson 0.710899, Spearman 0.685914 (team rows 1520, matches 760); xG/SOT Pearson 0.695692, Spearman 0.665733 (team rows 1520, matches 760); xG/Shots Pearson 0.703850, Spearman 0.710098 (team rows 1520, matches 760).
- La Liga 2023: Shots/SOT Pearson 0.682486, Spearman 0.643615 (team rows 760, matches 380); xG/SOT Pearson 0.684576, Spearman 0.657010 (team rows 760, matches 380); xG/Shots Pearson 0.665776, Spearman 0.665065 (team rows 760, matches 380).
- La Liga 2024: Shots/SOT Pearson 0.700787, Spearman 0.683260 (team rows 760, matches 380); xG/SOT Pearson 0.668122, Spearman 0.617557 (team rows 760, matches 380); xG/Shots Pearson 0.656983, Spearman 0.664540 (team rows 760, matches 380).
- La Liga 2023+2024: Shots/SOT Pearson 0.691268, Spearman 0.664044 (team rows 1520, matches 760); xG/SOT Pearson 0.675181, Spearman 0.638640 (team rows 1520, matches 760); xG/Shots Pearson 0.661075, Spearman 0.666319 (team rows 1520, matches 760).
- Serie A 2023: Shots/SOT Pearson 0.630973, Spearman 0.621203 (team rows 760, matches 380); xG/SOT Pearson 0.639267, Spearman 0.612288 (team rows 760, matches 380); xG/Shots Pearson 0.649407, Spearman 0.646788 (team rows 760, matches 380).
- Serie A 2024: Shots/SOT Pearson 0.676440, Spearman 0.678411 (team rows 758, matches 379); xG/SOT Pearson 0.639099, Spearman 0.634870 (team rows 758, matches 379); xG/Shots Pearson 0.664700, Spearman 0.693100 (team rows 758, matches 379).
- Serie A 2023+2024: Shots/SOT Pearson 0.654058, Spearman 0.649388 (team rows 1518, matches 759); xG/SOT Pearson 0.639377, Spearman 0.623055 (team rows 1518, matches 759); xG/Shots Pearson 0.656847, Spearman 0.670942 (team rows 1518, matches 759).
- Bundesliga 2023: Shots/SOT Pearson 0.722240, Spearman 0.687253 (team rows 612, matches 306); xG/SOT Pearson 0.707910, Spearman 0.679275 (team rows 612, matches 306); xG/Shots Pearson 0.702032, Spearman 0.694314 (team rows 612, matches 306).
- Bundesliga 2024: Shots/SOT Pearson 0.706361, Spearman 0.647501 (team rows 612, matches 306); xG/SOT Pearson 0.746594, Spearman 0.721286 (team rows 612, matches 306); xG/Shots Pearson 0.713010, Spearman 0.701269 (team rows 612, matches 306).
- Bundesliga 2023+2024: Shots/SOT Pearson 0.715497, Spearman 0.670350 (team rows 1224, matches 612); xG/SOT Pearson 0.726295, Spearman 0.700985 (team rows 1224, matches 612); xG/Shots Pearson 0.707480, Spearman 0.698186 (team rows 1224, matches 612).

Raw feature pair Pearson은 합친 두 시즌에서 약 0.64–0.73인 반면 모델의 rolling normalized For covariates는 더 강하게 상관된다:

- EPL 2024_EXPOSED_STORED_X: xG_For/Shots_For r=0.923529, rho=0.888889; xG_For/SOT_For r=0.935230, rho=0.925120; Shots_For/SOT_For r=0.937923, rho=0.919076.
- EPL 2023_FINAL_FIT_STORED_X: xG_For/Shots_For r=0.899886, rho=0.891537; xG_For/SOT_For r=0.908416, rho=0.905725; Shots_For/SOT_For r=0.927684, rho=0.943276.
- La Liga 2024_EXPOSED_STORED_X: xG_For/Shots_For r=0.861095, rho=0.811610; xG_For/SOT_For r=0.911980, rho=0.921965; Shots_For/SOT_For r=0.916695, rho=0.891877.
- La Liga 2023_FINAL_FIT_STORED_X: xG_For/Shots_For r=0.756314, rho=0.712082; xG_For/SOT_For r=0.896880, rho=0.841432; Shots_For/SOT_For r=0.852863, rho=0.795894.
- Serie A 2024_EXPOSED_STORED_X: xG_For/Shots_For r=0.911648, rho=0.916537; xG_For/SOT_For r=0.938106, rho=0.936840; Shots_For/SOT_For r=0.932790, rho=0.933078.
- Serie A 2023_FINAL_FIT_STORED_X: xG_For/Shots_For r=0.841849, rho=0.812705; xG_For/SOT_For r=0.805231, rho=0.802210; Shots_For/SOT_For r=0.857369, rho=0.851521.
- Bundesliga 2024_EXPOSED_STORED_X: xG_For/Shots_For r=0.874151, rho=0.800424; xG_For/SOT_For r=0.949999, rho=0.925866; Shots_For/SOT_For r=0.869437, rho=0.798849.
- Bundesliga 2023_FINAL_FIT_STORED_X: xG_For/Shots_For r=0.814481, rho=0.674418; xG_For/SOT_For r=0.891182, rho=0.807615; Shots_For/SOT_For r=0.888847, rho=0.817266.

이는 representation 단계에서 중복되는 predictor의 존재를 뒷받침한다. 하지만 pairwise correlation만으로 full design의 condition number, 불안정한 추정의 인과관계, 정보가 완전히 동일하다는 결론을 낼 수 없다. MULTICOLLINEARITY failure cause는 PARTIALLY_SUPPORTED다.

H2_INFORMATION_OVERLAP = PARTIALLY_SUPPORTED. F2에서 각 feature와 log(H2 rate)의 Pearson은 다음과 같다:

- EPL: Shots_For 0.587674, Shots_Against 0.526179, SOT_For 0.657609, SOT_Against 0.584146; contribution/log-H2 r=-0.249352, rho=-0.257426.
- La Liga: Shots_For 0.552861, Shots_Against 0.367402, SOT_For 0.633272, SOT_Against 0.442188; contribution/log-H2 r=0.137094, rho=0.104624.
- Serie A: Shots_For 0.576307, Shots_Against 0.343107, SOT_For 0.671183, SOT_Against 0.418033; contribution/log-H2 r=-0.496247, rho=-0.516101.
- Bundesliga: Shots_For 0.568672, Shots_Against 0.430864, SOT_For 0.705160, SOT_Against 0.472030; contribution/log-H2 r=-0.685872, rho=-0.691162.

특히 Serie A/Bundesliga에서 contribution이 높은 H2 rate를 낮추는 방향으로 연관된다. 이는 실제 저장된 예측의 방향적 특성이지 원인이 증명된 double counting은 아니다. beta는 H2 offset 및 다른 feature에 조건부다. 모든 리그에서 F2 SOT 계수가 음수라는 이유로 “유효 슈팅은 득점에 나쁘다”고 해석해서는 안 된다. residual information 또는 counterfactual fit은 이번 범위에서 검사하지 않았다.

## DRAW behavior

아래 수치는 2024 fixed paired U 기준이다. 후보 전체의 DRAW recall은 모든 리그에서 0이다. Mean pDraw는 대략 0.2195–0.2511이지만 argmax DRAW 문제는 해결되지 않았다. 이 구조는 rate만 수정하며 draw dependence를 직접 모형화하지 않는다. 따라서 DRAW 연구와 구분해야 하며 draw-specific 원인이나 개선안을 새로 확정하지 않는다.

- EPL F1: DRAW predicted v1/H2/V3=0/0/0; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.220008/0.218746/0.221356; V3 p10/median/p90=0.175677/0.225624/0.260955; mean paired ΔpDraw=0.002610.
- EPL F2: DRAW predicted v1/H2/V3=0/0/0; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.220008/0.218746/0.219507; V3 p10/median/p90=0.167301/0.224989/0.259895; mean paired ΔpDraw=0.000761.
- EPL F3: DRAW predicted v1/H2/V3=0/0/0; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.220008/0.218746/0.219919; V3 p10/median/p90=0.169974/0.224618/0.260078; mean paired ΔpDraw=0.001173.
- La Liga F1: DRAW predicted v1/H2/V3=1/1/2; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.250692/0.248692/0.247567; V3 p10/median/p90=0.163526/0.253564/0.317838; mean paired ΔpDraw=-0.001126.
- La Liga F2: DRAW predicted v1/H2/V3=1/1/1; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.250692/0.248692/0.247922; V3 p10/median/p90=0.167803/0.255307/0.314411; mean paired ΔpDraw=-0.000771.
- La Liga F3: DRAW predicted v1/H2/V3=1/1/1; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.250692/0.248692/0.247758; V3 p10/median/p90=0.163180/0.255090/0.316743; mean paired ΔpDraw=-0.000934.
- Serie A F1: DRAW predicted v1/H2/V3=3/1/1; recall v1/H2/V3=0.020202/0.000000/0.000000; mean pDraw v1/H2/V3=0.248719/0.248737/0.250829; V3 p10/median/p90=0.204761/0.253084/0.292406; mean paired ΔpDraw=0.002093.
- Serie A F2: DRAW predicted v1/H2/V3=3/1/0; recall v1/H2/V3=0.020202/0.000000/0.000000; mean pDraw v1/H2/V3=0.248719/0.248737/0.251060; V3 p10/median/p90=0.206455/0.252753/0.289799; mean paired ΔpDraw=0.002323.
- Serie A F3: DRAW predicted v1/H2/V3=3/1/0; recall v1/H2/V3=0.020202/0.000000/0.000000; mean pDraw v1/H2/V3=0.248719/0.248737/0.251135; V3 p10/median/p90=0.206448/0.252670/0.289903; mean paired ΔpDraw=0.002399.
- Bundesliga F1: DRAW predicted v1/H2/V3=1/0/0; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.218707/0.217521/0.220188; V3 p10/median/p90=0.167232/0.223099/0.269161; mean paired ΔpDraw=0.002667.
- Bundesliga F2: DRAW predicted v1/H2/V3=1/0/0; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.218707/0.217521/0.220875; V3 p10/median/p90=0.170408/0.222433/0.265609; mean paired ΔpDraw=0.003354.
- Bundesliga F3: DRAW predicted v1/H2/V3=1/0/0; recall v1/H2/V3=0.000000/0.000000/0.000000; mean pDraw v1/H2/V3=0.218707/0.217521/0.220784; V3 p10/median/p90=0.170356/0.222371/0.265605; mean paired ΔpDraw=0.003263.

## League-specific drivers and failure modes

SUPPORTED는 아래 명시한 관측 사실에 대한 지지이며 실험적 인과 증명이 아니다. NOT_SUPPORTED도 영구 기각을 뜻하지 않는다. 이번 자료에서 식별되지 않은 원인은 증거 부족을 명시한다.

### EPL

Small exposed improvements largely include AWAY OVR Brier gains, despite HOME Brier deterioration. Initial development LL deterioration becomes small exposed improvement after the already-frozen final fit; these are different cohorts/parameters, not a causal refit comparison. Four coefficient sign reversals across candidates coexist with success, so reversal alone does not explain failure elsewhere.

- FEATURE_OVER_CORRECTION: **NOT_SUPPORTED** — No evidence of general excessive magnitude: small net improvements (La Liga F1 exception); no counterfactual amplitude experiment.
- FEATURE_REDUNDANCY_WITH_H2: **PARTIALLY_SUPPORTED** — Positive stored covariate/log-H2 associations support shared information. H2 conditional residual information, causal duplication and redundancy as failure cause are not identified.
- COEFFICIENT_INSTABILITY: **SUPPORTED** — Observed initial/final sign reversals and magnitude changes; descriptive parameter instability only, not causal attribution. Nested training cohorts have different sizes.
- MULTICOLLINEARITY: **PARTIALLY_SUPPORTED** — Stored fitted-X cross-feature correlations are high, supporting correlated predictors. No condition-number, VIF, resampling or counterfactual fit: ill-conditioning and causal coefficient inflation are not established.
- LEAGUE_SPECIFIC_RELATIONSHIP: **SUPPORTED** — Observed final coefficients and exposed delta directions differ by league. Descriptive heterogeneity, not a demonstrated stable population-level league effect.
- CALIBRATION_DEGRADATION: **PARTIALLY_SUPPORTED** — F1 AWAY ECE worsens; other ECE deltas improve. No generalized calibration failure.
- NO_MEANINGFUL_INCREMENTAL_SIGNAL: **NOT_SUPPORTED** — Observed net improvements contradict a categorical no-signal claim, but their practical/statistical significance remains unestablished.

### La Liga

F2/F3 gain principally in AWAY OVR Brier; F1 worsens all class Briers. F2 signs persist from initial to final, but all three F2 ECE deltas worsen despite LL/Brier improvement. No general calibration-success explanation.

- FEATURE_OVER_CORRECTION: **NOT_SUPPORTED** — No evidence of general excessive magnitude: small net improvements (La Liga F1 exception); no counterfactual amplitude experiment.
- FEATURE_REDUNDANCY_WITH_H2: **PARTIALLY_SUPPORTED** — Positive stored covariate/log-H2 associations support shared information. H2 conditional residual information, causal duplication and redundancy as failure cause are not identified.
- COEFFICIENT_INSTABILITY: **PARTIALLY_SUPPORTED** — F1/F2 no reversal, F3 SOT_Against reverses; magnitude movement exists but generalized sign instability is not established.
- MULTICOLLINEARITY: **PARTIALLY_SUPPORTED** — Stored fitted-X cross-feature correlations are high, supporting correlated predictors. No condition-number, VIF, resampling or counterfactual fit: ill-conditioning and causal coefficient inflation are not established.
- LEAGUE_SPECIFIC_RELATIONSHIP: **SUPPORTED** — Observed final coefficients and exposed delta directions differ by league. Descriptive heterogeneity, not a demonstrated stable population-level league effect.
- CALIBRATION_DEGRADATION: **PARTIALLY_SUPPORTED** — F2 all class ECE worsen despite better LL/Brier; F1/F3 AWAY ECE worsen but HOME/DRAW improve.
- NO_MEANINGFUL_INCREMENTAL_SIGNAL: **NOT_SUPPORTED** — Observed net improvements contradict a categorical no-signal claim, but their practical/statistical significance remains unestablished.

### Serie A

All candidates worsen every class Brier versus H2; F2 LL delta +0.008096 is accompanied by contribution-versus-log-H2 correlation -0.496247. Directional compression is consistent with an unhelpful overlay here, but not causal proof of over-correction. No sign reversals: stable signs coexist with failure. Initial 2023 gains do not transfer to exposed 2024.

- FEATURE_OVER_CORRECTION: **PARTIALLY_SUPPORTED** — Negative contribution/log-H2 association and worse sealed LL/Brier are consistent with directionally unhelpful correction. Rate amplitude is not larger than successful leagues; optimal correction magnitude and causal mechanism NOT_TESTED.
- FEATURE_REDUNDANCY_WITH_H2: **PARTIALLY_SUPPORTED** — Positive stored covariate/log-H2 associations support shared information. H2 conditional residual information, causal duplication and redundancy as failure cause are not identified.
- COEFFICIENT_INSTABILITY: **PARTIALLY_SUPPORTED** — No sign reversal; magnitudes change substantially with the larger final cohort. Sign-instability explanation NOT_SUPPORTED; causal failure attribution untested.
- MULTICOLLINEARITY: **PARTIALLY_SUPPORTED** — Stored fitted-X cross-feature correlations are high, supporting correlated predictors. No condition-number, VIF, resampling or counterfactual fit: ill-conditioning and causal coefficient inflation are not established.
- LEAGUE_SPECIFIC_RELATIONSHIP: **SUPPORTED** — Observed final coefficients and exposed delta directions differ by league. Descriptive heterogeneity, not a demonstrated stable population-level league effect.
- CALIBRATION_DEGRADATION: **PARTIALLY_SUPPORTED** — AWAY ECE worsens for every candidate; HOME/DRAW ECE improve. All class Brier deterioration does not identify calibration alone.
- NO_MEANINGFUL_INCREMENTAL_SIGNAL: **PARTIALLY_SUPPORTED** — No net exposed LL/Brier gain from any candidate here. Does not prove absence of population signal or that every representation fails; no significance/equivalence claim.

### Bundesliga

HOME/AWAY Brier and AWAY recall worsen while DRAW Brier and all class ECE improve. F2 contribution-versus-log-H2 correlation -0.685872 describes compression; its p10/p90 rate ratios 0.952276/1.061057 are smaller movements than EPL/La Liga. Failure is not explained by larger amplitude or generally worse calibration.

- FEATURE_OVER_CORRECTION: **PARTIALLY_SUPPORTED** — Negative contribution/log-H2 association and worse sealed LL/Brier are consistent with directionally unhelpful correction. Rate amplitude is not larger than successful leagues; optimal correction magnitude and causal mechanism NOT_TESTED.
- FEATURE_REDUNDANCY_WITH_H2: **PARTIALLY_SUPPORTED** — Positive stored covariate/log-H2 associations support shared information. H2 conditional residual information, causal duplication and redundancy as failure cause are not identified.
- COEFFICIENT_INSTABILITY: **SUPPORTED** — Observed initial/final sign reversals and magnitude changes; descriptive parameter instability only, not causal attribution. Nested training cohorts have different sizes.
- MULTICOLLINEARITY: **PARTIALLY_SUPPORTED** — Stored fitted-X cross-feature correlations are high, supporting correlated predictors. No condition-number, VIF, resampling or counterfactual fit: ill-conditioning and causal coefficient inflation are not established.
- LEAGUE_SPECIFIC_RELATIONSHIP: **SUPPORTED** — Observed final coefficients and exposed delta directions differ by league. Descriptive heterogeneity, not a demonstrated stable population-level league effect.
- CALIBRATION_DEGRADATION: **NOT_SUPPORTED** — All HOME/DRAW/AWAY ECE deltas improve; LL/Brier deterioration cannot be relabeled generic calibration degradation.
- NO_MEANINGFUL_INCREMENTAL_SIGNAL: **PARTIALLY_SUPPORTED** — No net exposed LL/Brier gain from any candidate here. Does not prove absence of population signal or that every representation fails; no significance/equivalence claim.

## F2 priority review

Not identified for the raw signal itself. Raw correlations remain positive in both seasons; parameters conditional on correlated X and H2 vary.

Plausible unresolved contributor: fitted Shots/SOT signals are more correlated than raw match statistics, opposite conditional coefficient signs can cancel. No alternative representation was fitted, so superiority of redesign is untested.

Existing evidence cannot isolate raw signal instability from offset specification, sampling variation, changing teams/cohort or season effects.

F2는 4개 계수인 반면 F1은 2개, F3은 6개다. 우선 진단 대상이라는 이유로 가장 단순하거나 최종 winner로 간주하지 않는다. Serie A의 2023 LL 개선 −0.006002는 2024 +0.008096 악화로 바뀌었고, Bundesliga는 두 stage에서 모두 양의 ΔLL이다. 그러나 두 stage는 동일 파라미터·동일 cohort 비교가 아니므로 신호 drift의 직접 검정은 아니다.

## Phase-1 decision and next research questions

Descriptive research judgment, not a new promotion threshold: small heterogeneous exposed improvements do not establish transferable incremental signal; correlated covariates and coefficient movement justify investigating representation. Existing evidence also does not establish universal absence of signal. No winner or holdout authorization.

V3_PHASE1_CLASSIFICATION = PHASE1_DIAGNOSTIC_REDESIGN_JUSTIFIED

다음은 IDEA_ONLY 질문이다. 새로운 candidate, 알고리즘, hyperparameter, feature selection 또는 holdout 실행 승인이 아니다. 다음 작업은 새 Protocol + Design Freeze가 필요하다.

- V3.1-Q1 — Does the historical feature representation preserve information incremental to the existing H2 attack/defence rates, or mostly re-express team strength? New protocol and design freeze; no feature removal or algorithm selected.
- V3.1-Q2 — Why do similarly sized rate corrections associate with different directional effects across leagues and seasons? New protocol and design freeze; no clipping, league rule, parameter or window chosen.
- V3.1-Q3 — How much of the observed coefficient movement comes from correlated covariates and changed training composition rather than stable incremental predictive information? New protocol and design freeze; no refit or feature selection authorized.

## Verification and preservation

- Consumed sealed artifacts: 52; frozen sources 12; dependencies 21; protected files 644; raw 2023/2024 source hashes 2892. All PASS.
- Local initial/final fit parameters agree exactly with committed development artifacts; 24 fit seals validated. Existing final beta seal remains unchanged.
- Diagnostic checks: interpolated quantile, perfect negative Pearson, tied ranks, zero-variance handling; existing contribution/dot/rate identities and fixture identity checks PASS. Class-Brier delta decomposition, stored pDraw means versus sealed metrics, paired counts and beta reversal counts also PASS.
- No model test suite or backtest rerun: this is docs/audit-only descriptive work. No model imports in the local helper.
- V1_CHANGED = NO; V2_H2_CHANGED = NO; V3_SOURCE_CHANGED = NO; V3_BETA_CHANGED = NO.
- 2025_HOLDOUT_METRICS_VIEWED = NO; 2025_HOLDOUT_METRICS_COMPUTED = NO; HOLDOUT_RAW_ACCESSED = NO.
- REFIT = NO; HYPERPARAMETER_CHANGED = NO; THRESHOLD_CHANGED = NO; MODEL_PROMOTED = NO; FORWARD_MODEL_CHANGED = NO.
- Existing access-gate untracked document preserved; main not merged. Only this document and the aggregate diagnostic audit are committed.

Audit evidence includes canonical SHA256 plus byte hashes for every consumed seal. The local diagnostic helper path/hash and deterministic statistical definitions are recorded for reproduction. Original parameters, per-fixture predictions and raw values stay in their original sealed local locations.

FOOTBALL_V3_PHASE1_DIAGNOSTIC_REVIEW_V1_READY_FOR_CTO_REVIEW
