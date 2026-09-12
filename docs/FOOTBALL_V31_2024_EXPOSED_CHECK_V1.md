# FOOTBALL V31 2024 EXPOSED CHECK V1

DESCRIPTIVE_ONLY. 2024 is exposed, not independent validation. No promotion or post-result tuning. Raw state/maps/traces remain LOCAL_ONLY.

## 39 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: af9684a3efe6f9f27bbb1bc39e5956898bcb61600b51e9c26d9ac9f52c58bba7; map parameter hash: e89654b6bc1ff73a8d49eed83c1913ee1fe1ad6fcdf3f96fc20b8f05b0932c7e; beta hash: 3aed022b7c0a1914a621ad06fb6dd92dcb1600a3a2816e3a9bcc695aff79e594.

Fit census: {"total":380,"used":270,"pass":110,"fail":0,"invalid":0}; beta: [0.220918986630824,0.4891322523270494]; map: [[-0.08626864334360011,0.26658092226805075,-0.11281301151520609],[-0.07701098774040788,0.2358329959402388,-0.10303813825743395]].

Full: {"targets":380,"predicted":353,"pass":27,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_HOME_HISTORY":12,"PASS_INSUFFICIENT_AWAY_HISTORY":12,"PASS_INSUFFICIENT_HOME_HISTORY|PASS_INSUFFICIENT_AWAY_HISTORY":3},"coverage":0.9289473684210526}; paired N=353; COMPLETE.

V1: LL=1.0073175622022543; Brier=0.6027274350952274; accuracy=0.5184135977337111.

- HOME: recall=0.7972027972027972; precision=0.5; share=0.6458923512747875; OVR Brier=0.21939309363959508; ECE=0.032986132784736735.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18214682126379908; ECE=0.020785068066727672.
- AWAY: recall=0.552; precision=0.552; share=0.35410764872521244; OVR Brier=0.20118752019183236; ECE=0.04474615103967714.

H2: LL=0.987476314625704; Brier=0.5908287472602876; accuracy=0.5184135977337111.

- HOME: recall=0.7622377622377622; precision=0.5117370892018779; share=0.603399433427762; OVR Brier=0.21104262126524165; ECE=0.04461298779344368.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1816857826697606; ECE=0.024301878379453495.
- AWAY: recall=0.592; precision=0.5285714285714286; share=0.39660056657223797; OVR Brier=0.1981003433252854; ECE=0.042777323535781016.

candidate: LL=0.9781155420907918; Brier=0.5845374113451411; accuracy=0.5297450424929179.

- HOME: recall=0.7622377622377622; precision=0.5215311004784688; share=0.5920679886685553; OVR Brier=0.20873267408541077; ECE=0.04825443686559109.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1812230304739285; ECE=0.027042620676084376.
- AWAY: recall=0.624; precision=0.5416666666666666; share=0.40793201133144474; OVR Brier=0.1945817067858014; ECE=0.043531324244655466.

Delta: {"v1":{"logLoss":-0.029202020111462557,"brier":-0.01819002375008627},"h2":{"logLoss":-0.009360772534912187,"brier":-0.006291335915146412}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":353,"predicted":353,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9867414534644274,"brier":0.590199260990422,"accuracy":0.5325779036827195,"floorHits":0,"classes":[{"name":"HOME","predicted":213,"actual":143,"correct":112,"recall":0.7832167832167832,"precision":0.5258215962441315,"share":0.603399433427762,"brier":0.2115227772480148,"meanProbability":0.4271672263156216,"meanProbabilityMinusFrequency":0.02206807617397854,"ece":0.03439596168320261,"calibration":[{"lower":0,"upper":0.1,"count":6,"meanProbability":0.07782995666037949,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":30,"meanProbability":0.15835518279055685,"observedFrequency":0.13333333333333333,"lowSample":false},{"lower":0.2,"upper":0.3,"count":49,"meanProbability":0.2471712999729455,"observedFrequency":0.22448979591836735,"lowSample":false},{"lower":0.3,"upper":0.4,"count":73,"meanProbability":0.35387596502626467,"observedFrequency":0.3287671232876712,"lowSample":false},{"lower":0.4,"upper":0.5,"count":85,"meanProbability":0.44946076351857206,"observedFrequency":0.4588235294117647,"lowSample":false},{"lower":0.5,"upper":0.6,"count":43,"meanProbability":0.5417580868878322,"observedFrequency":0.5581395348837209,"lowSample":false},{"lower":0.6,"upper":0.7,"count":42,"meanProbability":0.6466739568570679,"observedFrequency":0.5476190476190477,"lowSample":false},{"lower":0.7,"upper":0.8,"count":21,"meanProbability":0.7449343868821416,"observedFrequency":0.6666666666666666,"lowSample":false},{"lower":0.8,"upper":0.9,"count":4,"meanProbability":0.8310913930916302,"observedFrequency":1,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":85,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.1817084657256535,"meanProbability":0.21991925627507508,"meanProbabilityMinusFrequency":-0.020873944858069395,"ece":0.021412368673048254,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.09503180334375091,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":79,"meanProbability":0.17044286193881017,"observedFrequency":0.17721518987341772,"lowSample":false},{"lower":0.2,"upper":0.3,"count":273,"meanProbability":0.2346940643538158,"observedFrequency":0.2600732600732601,"lowSample":false},{"lower":0.3,"upper":0.4,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":140,"actual":125,"correct":76,"recall":0.608,"precision":0.5428571428571428,"share":0.39660056657223797,"brier":0.19696801801675393,"meanProbability":0.3529135174093037,"meanProbabilityMinusFrequency":-0.001194131315908742,"ece":0.027724464828858996,"calibration":[{"lower":0,"upper":0.1,"count":13,"meanProbability":0.0770981126755191,"observedFrequency":0.07692307692307693,"lowSample":true},{"lower":0.1,"upper":0.2,"count":57,"meanProbability":0.1506463806367143,"observedFrequency":0.14035087719298245,"lowSample":false},{"lower":0.2,"upper":0.3,"count":77,"meanProbability":0.2589367984915611,"observedFrequency":0.2727272727272727,"lowSample":false},{"lower":0.3,"upper":0.4,"count":84,"meanProbability":0.34731206599982667,"observedFrequency":0.32142857142857145,"lowSample":false},{"lower":0.4,"upper":0.5,"count":52,"meanProbability":0.44929850225509543,"observedFrequency":0.5,"lowSample":false},{"lower":0.5,"upper":0.6,"count":43,"meanProbability":0.5536821266246565,"observedFrequency":0.5116279069767442,"lowSample":false},{"lower":0.6,"upper":0.7,"count":17,"meanProbability":0.6535846891244451,"observedFrequency":0.6470588235294118,"lowSample":true},{"lower":0.7,"upper":0.8,"count":10,"meanProbability":0.7594212179333306,"observedFrequency":0.9,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[112,0,31],[52,0,33],[49,0,76]],"reasonCounts":{}},"delta":{"logLoss":-0.008625911373635664,"brier":-0.005661849645280825}}.

Diagnostics: {"availablePredictions":353,"inputPredictions":353,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":706,"pearson":0.1801662217751242,"spearman":0.1900615839759751},"unresidualizedComposite":{"n":706,"pearson":0.6591300330598939,"spearman":0.6508858904006936}},{"h2Column":2,"representation":{"n":706,"pearson":-0.0827161262418847,"spearman":-0.0773568976278187},"unresidualizedComposite":{"n":706,"pearson":-0.4988887497700607,"spearman":-0.4760880308907958}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":706,"pearson":0.12987718046208876,"spearman":0.08432732696967571},"unresidualizedComposite":{"n":706,"pearson":0.5899689608185883,"spearman":0.5303906098609895}},{"h2Column":2,"representation":{"n":706,"pearson":-0.10662129595499681,"spearman":-0.069268294180047},"unresidualizedComposite":{"n":706,"pearson":-0.4934706732600884,"spearman":-0.41821588825147354}}]}],"crossRepresentation":{"n":706,"pearson":-0.626763258394634,"spearman":-0.609156580777721},"crossComposite":{"n":706,"pearson":0.011184514808103686,"spearman":0.0037304354698194015},"contribution":{"n":706,"mean":-0.002752187398869183,"p10":-0.08912984519084713,"p25":-0.042879606896324134,"median":0.0022969337331838306,"p75":0.04598800575249017,"p90":0.07855149270357706,"maxAbsolute":0.23703157012852993},"rateRatio":{"n":706,"mean":0.9993154570177255,"p10":0.9147270193659109,"p25":0.9580267606666731,"median":1.0022995744981271,"p75":1.047061871314943,"p90":1.081719054542725,"maxAbsolute":1.1524704176781375}}.

## 39 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: 567f42ceddb00138a20a4428770d8f0090931fc2ede7bec689f73c9f211706ef.

Fit census: {"total":380,"used":275,"pass":105,"fail":0,"invalid":0}; beta: [-0.19595167272292183,0.09194169829181151]; map: null.

Full: {"targets":380,"predicted":353,"pass":27,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_HOME_HISTORY":12,"PASS_INSUFFICIENT_AWAY_HISTORY":12,"PASS_INSUFFICIENT_HOME_HISTORY|PASS_INSUFFICIENT_AWAY_HISTORY":3},"coverage":0.9289473684210526}; paired N=353; COMPLETE.

V1: LL=1.0073175622022543; Brier=0.6027274350952274; accuracy=0.5184135977337111.

- HOME: recall=0.7972027972027972; precision=0.5; share=0.6458923512747875; OVR Brier=0.21939309363959508; ECE=0.032986132784736735.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18214682126379908; ECE=0.020785068066727672.
- AWAY: recall=0.552; precision=0.552; share=0.35410764872521244; OVR Brier=0.20118752019183236; ECE=0.04474615103967714.

H2: LL=0.987476314625704; Brier=0.5908287472602876; accuracy=0.5184135977337111.

- HOME: recall=0.7622377622377622; precision=0.5117370892018779; share=0.603399433427762; OVR Brier=0.21104262126524165; ECE=0.04461298779344368.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1816857826697606; ECE=0.024301878379453495.
- AWAY: recall=0.592; precision=0.5285714285714286; share=0.39660056657223797; OVR Brier=0.1981003433252854; ECE=0.042777323535781016.

candidate: LL=0.9871266052006652; Brier=0.5903340784688753; accuracy=0.5240793201133145.

- HOME: recall=0.7832167832167832; precision=0.5209302325581395; share=0.6090651558073654; OVR Brier=0.21143396756562294; ECE=0.032060148386391846.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18132639379246834; ECE=0.022217608355313233.
- AWAY: recall=0.584; precision=0.5289855072463768; share=0.3909348441926346; OVR Brier=0.19757371711078442; ECE=0.037613980641356036.

Delta: {"v1":{"logLoss":-0.020190957001589127,"brier":-0.012393356626352103},"h2":{"logLoss":-0.0003497094250387578,"brier":-0.000494668791412245}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":353,"predicted":353,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9867414534644274,"brier":0.590199260990422,"accuracy":0.5325779036827195,"floorHits":0,"classes":[{"name":"HOME","predicted":213,"actual":143,"correct":112,"recall":0.7832167832167832,"precision":0.5258215962441315,"share":0.603399433427762,"brier":0.2115227772480148,"meanProbability":0.4271672263156216,"meanProbabilityMinusFrequency":0.02206807617397854,"ece":0.03439596168320261,"calibration":[{"lower":0,"upper":0.1,"count":6,"meanProbability":0.07782995666037949,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":30,"meanProbability":0.15835518279055685,"observedFrequency":0.13333333333333333,"lowSample":false},{"lower":0.2,"upper":0.3,"count":49,"meanProbability":0.2471712999729455,"observedFrequency":0.22448979591836735,"lowSample":false},{"lower":0.3,"upper":0.4,"count":73,"meanProbability":0.35387596502626467,"observedFrequency":0.3287671232876712,"lowSample":false},{"lower":0.4,"upper":0.5,"count":85,"meanProbability":0.44946076351857206,"observedFrequency":0.4588235294117647,"lowSample":false},{"lower":0.5,"upper":0.6,"count":43,"meanProbability":0.5417580868878322,"observedFrequency":0.5581395348837209,"lowSample":false},{"lower":0.6,"upper":0.7,"count":42,"meanProbability":0.6466739568570679,"observedFrequency":0.5476190476190477,"lowSample":false},{"lower":0.7,"upper":0.8,"count":21,"meanProbability":0.7449343868821416,"observedFrequency":0.6666666666666666,"lowSample":false},{"lower":0.8,"upper":0.9,"count":4,"meanProbability":0.8310913930916302,"observedFrequency":1,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":85,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.1817084657256535,"meanProbability":0.21991925627507508,"meanProbabilityMinusFrequency":-0.020873944858069395,"ece":0.021412368673048254,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.09503180334375091,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":79,"meanProbability":0.17044286193881017,"observedFrequency":0.17721518987341772,"lowSample":false},{"lower":0.2,"upper":0.3,"count":273,"meanProbability":0.2346940643538158,"observedFrequency":0.2600732600732601,"lowSample":false},{"lower":0.3,"upper":0.4,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":140,"actual":125,"correct":76,"recall":0.608,"precision":0.5428571428571428,"share":0.39660056657223797,"brier":0.19696801801675393,"meanProbability":0.3529135174093037,"meanProbabilityMinusFrequency":-0.001194131315908742,"ece":0.027724464828858996,"calibration":[{"lower":0,"upper":0.1,"count":13,"meanProbability":0.0770981126755191,"observedFrequency":0.07692307692307693,"lowSample":true},{"lower":0.1,"upper":0.2,"count":57,"meanProbability":0.1506463806367143,"observedFrequency":0.14035087719298245,"lowSample":false},{"lower":0.2,"upper":0.3,"count":77,"meanProbability":0.2589367984915611,"observedFrequency":0.2727272727272727,"lowSample":false},{"lower":0.3,"upper":0.4,"count":84,"meanProbability":0.34731206599982667,"observedFrequency":0.32142857142857145,"lowSample":false},{"lower":0.4,"upper":0.5,"count":52,"meanProbability":0.44929850225509543,"observedFrequency":0.5,"lowSample":false},{"lower":0.5,"upper":0.6,"count":43,"meanProbability":0.5536821266246565,"observedFrequency":0.5116279069767442,"lowSample":false},{"lower":0.6,"upper":0.7,"count":17,"meanProbability":0.6535846891244451,"observedFrequency":0.6470588235294118,"lowSample":true},{"lower":0.7,"upper":0.8,"count":10,"meanProbability":0.7594212179333306,"observedFrequency":0.9,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[112,0,31],[52,0,33],[49,0,76]],"reasonCounts":{}},"delta":{"logLoss":0.00038515173623776544,"brier":0.0001348174784533418}}.

Diagnostics: {"availablePredictions":353,"inputPredictions":353,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":706,"pearson":0.6591300330598939,"spearman":0.6508858904006936},"unresidualizedComposite":{"n":706,"pearson":0.6591300330598939,"spearman":0.6508858904006936}},{"h2Column":2,"representation":{"n":706,"pearson":-0.4988887497700607,"spearman":-0.4760880308907958},"unresidualizedComposite":{"n":706,"pearson":-0.4988887497700607,"spearman":-0.4760880308907958}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":706,"pearson":0.5899689608185883,"spearman":0.5303906098609895},"unresidualizedComposite":{"n":706,"pearson":0.5899689608185883,"spearman":0.5303906098609895}},{"h2Column":2,"representation":{"n":706,"pearson":-0.4934706732600884,"spearman":-0.41821588825147354},"unresidualizedComposite":{"n":706,"pearson":-0.4934706732600884,"spearman":-0.41821588825147354}}]}],"crossRepresentation":{"n":706,"pearson":0.011184514808103686,"spearman":0.0037304354698194015},"crossComposite":{"n":706,"pearson":0.011184514808103686,"spearman":0.0037304354698194015},"contribution":{"n":706,"mean":0.0011393611926540316,"p10":-0.058585999283465334,"p25":-0.030012364617937225,"median":0.0002104671842472572,"p75":0.0317821232863849,"p90":0.06714263322532207,"maxAbsolute":0.12849873935873882},"rateRatio":{"n":706,"mean":1.0022058738318718,"p10":0.9430971351021318,"p25":0.9704335345105112,"median":1.0002104920014425,"p75":1.0322925687978355,"p90":1.0694480084299074,"maxAbsolute":1.1371199877899363}}.

## 140 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: 04897f029112b0e01a80963d1659ce9b4b146c32f10f7a60aa5d5eaa52be5805; map parameter hash: c3c4b3c23b7295b1a803dab94ab7001fa23251414c945581cc8ceec06906e5f4; beta hash: 595d198f403788e466afedf80a7db5adaf982302b8d245e060e71fdc47fb1701.

Fit census: {"total":380,"used":269,"pass":111,"fail":0,"invalid":0}; beta: [0.4911264973584418,0.044130577996238804]; map: [[-0.08568559832805549,0.2787824870463673,0.026309697472273404],[-0.034336771492608865,0.1459898274779809,-0.04971118395646566]].

Full: {"targets":380,"predicted":352,"pass":28,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_AWAY_HISTORY":13,"PASS_INSUFFICIENT_HOME_HISTORY|PASS_INSUFFICIENT_AWAY_HISTORY":2,"PASS_INSUFFICIENT_HOME_HISTORY":13},"coverage":0.9263157894736842}; paired N=352; COMPLETE.

V1: LL=1.0001070498512572; Brier=0.5962352418750473; accuracy=0.5113636363636364.

- HOME: recall=0.8064516129032258; precision=0.5296610169491526; share=0.6704545454545454; OVR Brier=0.21665045080761908; ECE=0.03089877304584847.
- DRAW: recall=0; precision=0; share=0.002840909090909091; OVR Brier=0.18905659335584335; ECE=0.03803111090839163.
- AWAY: recall=0.514018691588785; precision=0.4782608695652174; share=0.32670454545454547; OVR Brier=0.19052819771158472; ECE=0.03812358640988438.

H2: LL=0.9852864031756393; Brier=0.5860295695898544; accuracy=0.5227272727272727.

- HOME: recall=0.8451612903225807; precision=0.532520325203252; share=0.6988636363636364; OVR Brier=0.2104565894721022; ECE=0.03968943170455473.
- DRAW: recall=0; precision=0; share=0.002840909090909091; OVR Brier=0.18785737942580402; ECE=0.060476519315953964.
- AWAY: recall=0.4953271028037383; precision=0.5047619047619047; share=0.29829545454545453; OVR Brier=0.18771560069194948; ECE=0.0323386286691093.

candidate: LL=0.9802219746153221; Brier=0.5820707480198419; accuracy=0.53125.

- HOME: recall=0.8; precision=0.5610859728506787; share=0.6278409090909091; OVR Brier=0.20887782253748452; ECE=0.0371152895288026.
- DRAW: recall=0; precision=0; share=0.002840909090909091; OVR Brier=0.1872769701770893; ECE=0.04783330017840918.
- AWAY: recall=0.5887850467289719; precision=0.4846153846153846; share=0.3693181818181818; OVR Brier=0.1859159553052673; ECE=0.028518516580740016.

Delta: {"v1":{"logLoss":-0.01988507523593508,"brier":-0.014164493855205351},"h2":{"logLoss":-0.005064428560317191,"brier":-0.003958821570012483}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":352,"predicted":352,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9845573289642249,"brier":0.5854993993002678,"accuracy":0.5340909090909091,"floorHits":0,"classes":[{"name":"HOME","predicted":238,"actual":155,"correct":130,"recall":0.8387096774193549,"precision":0.5462184873949579,"share":0.6761363636363636,"brier":0.2111429052890938,"meanProbability":0.44350626161742307,"meanProbabilityMinusFrequency":0.003165352526514004,"ece":0.03418518569424301,"calibration":[{"lower":0,"upper":0.1,"count":3,"meanProbability":0.06915722642258743,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":22,"meanProbability":0.16727582298833013,"observedFrequency":0.18181818181818182,"lowSample":false},{"lower":0.2,"upper":0.3,"count":52,"meanProbability":0.24762552339656402,"observedFrequency":0.23076923076923078,"lowSample":false},{"lower":0.3,"upper":0.4,"count":82,"meanProbability":0.357001480878032,"observedFrequency":0.35365853658536583,"lowSample":false},{"lower":0.4,"upper":0.5,"count":74,"meanProbability":0.4455096174870162,"observedFrequency":0.4594594594594595,"lowSample":false},{"lower":0.5,"upper":0.6,"count":43,"meanProbability":0.5436488364343308,"observedFrequency":0.4418604651162791,"lowSample":false},{"lower":0.6,"upper":0.7,"count":39,"meanProbability":0.6361406263207436,"observedFrequency":0.6923076923076923,"lowSample":false},{"lower":0.7,"upper":0.8,"count":24,"meanProbability":0.7534685473411747,"observedFrequency":0.8333333333333334,"lowSample":false},{"lower":0.8,"upper":0.9,"count":13,"meanProbability":0.833744187099173,"observedFrequency":0.7692307692307693,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":1,"actual":90,"correct":0,"recall":0,"precision":0,"share":0.002840909090909091,"brier":0.18786361270917193,"meanProbability":0.24775847168315776,"meanProbabilityMinusFrequency":-0.007923346498660415,"ece":0.05625293965620454,"calibration":[{"lower":0,"upper":0.1,"count":6,"meanProbability":0.0908394147296571,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":55,"meanProbability":0.15826495830001291,"observedFrequency":0.12727272727272726,"lowSample":false},{"lower":0.2,"upper":0.3,"count":225,"meanProbability":0.25202210505219463,"observedFrequency":0.3022222222222222,"lowSample":false},{"lower":0.3,"upper":0.4,"count":66,"meanProbability":0.3220666545583203,"observedFrequency":0.22727272727272727,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":113,"actual":107,"correct":58,"recall":0.5420560747663551,"precision":0.5132743362831859,"share":0.3210227272727273,"brier":0.1864928813020018,"meanProbability":0.3087352666994194,"meanProbabilityMinusFrequency":0.004757993972146692,"ece":0.04276722705097956,"calibration":[{"lower":0,"upper":0.1,"count":27,"meanProbability":0.07200280751442546,"observedFrequency":0.1111111111111111,"lowSample":false},{"lower":0.1,"upper":0.2,"count":65,"meanProbability":0.15241379750026296,"observedFrequency":0.15384615384615385,"lowSample":false},{"lower":0.2,"upper":0.3,"count":100,"meanProbability":0.25265548635063445,"observedFrequency":0.22,"lowSample":false},{"lower":0.3,"upper":0.4,"count":67,"meanProbability":0.3426252927110297,"observedFrequency":0.31343283582089554,"lowSample":false},{"lower":0.4,"upper":0.5,"count":44,"meanProbability":0.4443820144581943,"observedFrequency":0.5454545454545454,"lowSample":false},{"lower":0.5,"upper":0.6,"count":32,"meanProbability":0.5477154848714524,"observedFrequency":0.53125,"lowSample":false},{"lower":0.6,"upper":0.7,"count":12,"meanProbability":0.6346750114567736,"observedFrequency":0.4166666666666667,"lowSample":true},{"lower":0.7,"upper":0.8,"count":4,"meanProbability":0.7483702606879805,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":1,"meanProbability":0.9131126588063375,"observedFrequency":1,"lowSample":true}]}],"confusion":[[130,1,24],[59,0,31],[49,0,58]],"reasonCounts":{}},"delta":{"logLoss":-0.0043353543489027535,"brier":-0.0034286512804259095}}.

Diagnostics: {"availablePredictions":352,"inputPredictions":352,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":704,"pearson":0.26301068589663296,"spearman":0.2285830827264198},"unresidualizedComposite":{"n":704,"pearson":0.664245333329548,"spearman":0.643875309188859}},{"h2Column":2,"representation":{"n":704,"pearson":-0.17787202261849291,"spearman":-0.1614070397385067},"unresidualizedComposite":{"n":704,"pearson":-0.28198713457566543,"spearman":-0.25399084058098614}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":704,"pearson":0.041498678487308184,"spearman":0.04887952571323232},"unresidualizedComposite":{"n":704,"pearson":0.4374636879095021,"spearman":0.4324680630951628}},{"h2Column":2,"representation":{"n":704,"pearson":-0.06339472298155631,"spearman":-0.04362273043684018},"unresidualizedComposite":{"n":704,"pearson":-0.3160872598017257,"spearman":-0.2780416754940831}}]}],"crossRepresentation":{"n":704,"pearson":-0.4196109014313922,"spearman":-0.4227405826369992},"crossComposite":{"n":704,"pearson":-0.005940708820113153,"spearman":-0.0051197066454625245},"contribution":{"n":704,"mean":-0.002265062771921219,"p10":-0.11761036991760383,"p25":-0.04518707825593554,"median":0.005472797540528358,"p75":0.045657971066883844,"p90":0.10051072978224113,"maxAbsolute":0.24439159925016354},"rateRatio":{"n":704,"mean":1.0009640694307977,"p10":0.8890432236961711,"p25":0.9558186650688534,"median":1.005487807496366,"p75":1.0467163435896187,"p90":1.1057355069521793,"maxAbsolute":1.2479538824492553}}.

## 140 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: 10e03eca9029676f9cec502b19ed7e1e62ee20d0ee0d2848d0ae6d18ba005f1d.

Fit census: {"total":380,"used":274,"pass":106,"fail":0,"invalid":0}; beta: [0.20574872878529857,-0.1909397480823042]; map: null.

Full: {"targets":380,"predicted":352,"pass":28,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_AWAY_HISTORY":13,"PASS_INSUFFICIENT_HOME_HISTORY|PASS_INSUFFICIENT_AWAY_HISTORY":2,"PASS_INSUFFICIENT_HOME_HISTORY":13},"coverage":0.9263157894736842}; paired N=352; COMPLETE.

V1: LL=1.0001070498512572; Brier=0.5962352418750473; accuracy=0.5113636363636364.

- HOME: recall=0.8064516129032258; precision=0.5296610169491526; share=0.6704545454545454; OVR Brier=0.21665045080761908; ECE=0.03089877304584847.
- DRAW: recall=0; precision=0; share=0.002840909090909091; OVR Brier=0.18905659335584335; ECE=0.03803111090839163.
- AWAY: recall=0.514018691588785; precision=0.4782608695652174; share=0.32670454545454547; OVR Brier=0.19052819771158472; ECE=0.03812358640988438.

H2: LL=0.9852864031756393; Brier=0.5860295695898544; accuracy=0.5227272727272727.

- HOME: recall=0.8451612903225807; precision=0.532520325203252; share=0.6988636363636364; OVR Brier=0.2104565894721022; ECE=0.03968943170455473.
- DRAW: recall=0; precision=0; share=0.002840909090909091; OVR Brier=0.18785737942580402; ECE=0.060476519315953964.
- AWAY: recall=0.4953271028037383; precision=0.5047619047619047; share=0.29829545454545453; OVR Brier=0.18771560069194948; ECE=0.0323386286691093.

candidate: LL=0.984805965668555; Brier=0.5857018735812831; accuracy=0.5255681818181818.

- HOME: recall=0.8258064516129032; precision=0.5423728813559322; share=0.6704545454545454; OVR Brier=0.21066986554780226; ECE=0.03658427115051521.
- DRAW: recall=0; precision=0; share=0.005681818181818182; OVR Brier=0.1877260859791667; ECE=0.055412067482484444.
- AWAY: recall=0.5327102803738317; precision=0.5; share=0.32386363636363635; OVR Brier=0.1873059220543135; ECE=0.033780062626548105.

Delta: {"v1":{"logLoss":-0.015301084182702152,"brier":-0.010533368293764167},"h2":{"logLoss":-0.0004804375070842637,"brier":-0.00032769600857129877}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":352,"predicted":352,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9845573289642249,"brier":0.5854993993002678,"accuracy":0.5340909090909091,"floorHits":0,"classes":[{"name":"HOME","predicted":238,"actual":155,"correct":130,"recall":0.8387096774193549,"precision":0.5462184873949579,"share":0.6761363636363636,"brier":0.2111429052890938,"meanProbability":0.44350626161742307,"meanProbabilityMinusFrequency":0.003165352526514004,"ece":0.03418518569424301,"calibration":[{"lower":0,"upper":0.1,"count":3,"meanProbability":0.06915722642258743,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":22,"meanProbability":0.16727582298833013,"observedFrequency":0.18181818181818182,"lowSample":false},{"lower":0.2,"upper":0.3,"count":52,"meanProbability":0.24762552339656402,"observedFrequency":0.23076923076923078,"lowSample":false},{"lower":0.3,"upper":0.4,"count":82,"meanProbability":0.357001480878032,"observedFrequency":0.35365853658536583,"lowSample":false},{"lower":0.4,"upper":0.5,"count":74,"meanProbability":0.4455096174870162,"observedFrequency":0.4594594594594595,"lowSample":false},{"lower":0.5,"upper":0.6,"count":43,"meanProbability":0.5436488364343308,"observedFrequency":0.4418604651162791,"lowSample":false},{"lower":0.6,"upper":0.7,"count":39,"meanProbability":0.6361406263207436,"observedFrequency":0.6923076923076923,"lowSample":false},{"lower":0.7,"upper":0.8,"count":24,"meanProbability":0.7534685473411747,"observedFrequency":0.8333333333333334,"lowSample":false},{"lower":0.8,"upper":0.9,"count":13,"meanProbability":0.833744187099173,"observedFrequency":0.7692307692307693,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":1,"actual":90,"correct":0,"recall":0,"precision":0,"share":0.002840909090909091,"brier":0.18786361270917193,"meanProbability":0.24775847168315776,"meanProbabilityMinusFrequency":-0.007923346498660415,"ece":0.05625293965620454,"calibration":[{"lower":0,"upper":0.1,"count":6,"meanProbability":0.0908394147296571,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":55,"meanProbability":0.15826495830001291,"observedFrequency":0.12727272727272726,"lowSample":false},{"lower":0.2,"upper":0.3,"count":225,"meanProbability":0.25202210505219463,"observedFrequency":0.3022222222222222,"lowSample":false},{"lower":0.3,"upper":0.4,"count":66,"meanProbability":0.3220666545583203,"observedFrequency":0.22727272727272727,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":113,"actual":107,"correct":58,"recall":0.5420560747663551,"precision":0.5132743362831859,"share":0.3210227272727273,"brier":0.1864928813020018,"meanProbability":0.3087352666994194,"meanProbabilityMinusFrequency":0.004757993972146692,"ece":0.04276722705097956,"calibration":[{"lower":0,"upper":0.1,"count":27,"meanProbability":0.07200280751442546,"observedFrequency":0.1111111111111111,"lowSample":false},{"lower":0.1,"upper":0.2,"count":65,"meanProbability":0.15241379750026296,"observedFrequency":0.15384615384615385,"lowSample":false},{"lower":0.2,"upper":0.3,"count":100,"meanProbability":0.25265548635063445,"observedFrequency":0.22,"lowSample":false},{"lower":0.3,"upper":0.4,"count":67,"meanProbability":0.3426252927110297,"observedFrequency":0.31343283582089554,"lowSample":false},{"lower":0.4,"upper":0.5,"count":44,"meanProbability":0.4443820144581943,"observedFrequency":0.5454545454545454,"lowSample":false},{"lower":0.5,"upper":0.6,"count":32,"meanProbability":0.5477154848714524,"observedFrequency":0.53125,"lowSample":false},{"lower":0.6,"upper":0.7,"count":12,"meanProbability":0.6346750114567736,"observedFrequency":0.4166666666666667,"lowSample":true},{"lower":0.7,"upper":0.8,"count":4,"meanProbability":0.7483702606879805,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":1,"meanProbability":0.9131126588063375,"observedFrequency":1,"lowSample":true}]}],"confusion":[[130,1,24],[59,0,31],[49,0,58]],"reasonCounts":{}},"delta":{"logLoss":0.00024863670433017404,"brier":0.00020247428101527465}}.

Diagnostics: {"availablePredictions":352,"inputPredictions":352,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":704,"pearson":0.664245333329548,"spearman":0.643875309188859},"unresidualizedComposite":{"n":704,"pearson":0.664245333329548,"spearman":0.643875309188859}},{"h2Column":2,"representation":{"n":704,"pearson":-0.28198713457566543,"spearman":-0.25399084058098614},"unresidualizedComposite":{"n":704,"pearson":-0.28198713457566543,"spearman":-0.25399084058098614}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":704,"pearson":0.4374636879095021,"spearman":0.4324680630951628},"unresidualizedComposite":{"n":704,"pearson":0.4374636879095021,"spearman":0.4324680630951628}},{"h2Column":2,"representation":{"n":704,"pearson":-0.3160872598017257,"spearman":-0.2780416754940831},"unresidualizedComposite":{"n":704,"pearson":-0.3160872598017257,"spearman":-0.2780416754940831}}]}],"crossRepresentation":{"n":704,"pearson":-0.005940708820113153,"spearman":-0.0051197066454625245},"crossComposite":{"n":704,"pearson":-0.005940708820113153,"spearman":-0.0051197066454625245},"contribution":{"n":704,"mean":-0.0033094794381404403,"p10":-0.07452933357467141,"p25":-0.03792084400198681,"median":-0.0039029834033467176,"p75":0.029711375373580998,"p90":0.06517903224002633,"maxAbsolute":0.15839410181557131},"rateRatio":{"n":704,"mean":0.9981382080409019,"p10":0.9281803810319048,"p25":0.96278915046232,"median":0.9961046233661709,"p75":1.030157166643713,"p90":1.0673501077490226,"maxAbsolute":1.1716278443938541}}.

## 135 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: 5b8a6b012ac840b44d989868011dc037ed0f715ac586dcb84450dfa9377f1ce3; map parameter hash: 9bb420beb1df9d8668312ed449471e9c2f91b0462267fd07ba4f62307397d85c; beta hash: 7adddcecd2724fe6b672b02aacb8d9cc89dd278819005564b53d80bfe2339d45.

Fit census: {"total":380,"used":261,"pass":119,"fail":0,"invalid":0}; beta: [0.05014928540181797,0.256436831264948]; map: [[-0.049143039352821945,0.20945233024039467,-0.026433304870460635],[-0.048215090510960894,0.21471185804741408,-0.051906937199478725]].

Full: {"targets":380,"predicted":351,"pass":29,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_HOME_HISTORY":14,"PASS_INSUFFICIENT_AWAY_HISTORY":14,"PASS_INSUFFICIENT_HOME_HISTORY|PASS_INSUFFICIENT_AWAY_HISTORY":1},"coverage":0.9236842105263158}; paired N=351; COMPLETE.

V1: LL=0.9915049278920861; Brier=0.5931659662252553; accuracy=0.5356125356125356.

- HOME: recall=0.7985611510791367; precision=0.5336538461538461; share=0.5925925925925926; OVR Brier=0.2064378525490154; ECE=0.053071198634932135.
- DRAW: recall=0.020202020202020204; precision=0.6666666666666666; share=0.008547008547008548; OVR Brier=0.20253529361081724; ECE=0.03333243957562338.
- AWAY: recall=0.6637168141592921; precision=0.5357142857142857; share=0.39886039886039887; OVR Brier=0.18419282006542273; ECE=0.05704153398322058.

H2: LL=0.9832825636742641; Brier=0.5874787959827785; accuracy=0.5327635327635327.

- HOME: recall=0.7985611510791367; precision=0.5414634146341464; share=0.584045584045584; OVR Brier=0.20375540689283048; ECE=0.04861977459060073.
- DRAW: recall=0; precision=0; share=0.002849002849002849; OVR Brier=0.20110709870531898; ECE=0.03331454044808465.
- AWAY: recall=0.672566371681416; precision=0.5241379310344828; share=0.4131054131054131; OVR Brier=0.18261629038462832; ECE=0.05127612793280685.

candidate: LL=0.9788658471265259; Brier=0.5845725270178187; accuracy=0.5413105413105413.

- HOME: recall=0.8201438848920863; precision=0.5507246376811594; share=0.5897435897435898; OVR Brier=0.20240566310568173; ECE=0.049938772391087585.
- DRAW: recall=0; precision=0; share=0.002849002849002849; OVR Brier=0.20110457993194034; ECE=0.033672238736653815.
- AWAY: recall=0.672566371681416; precision=0.5314685314685315; share=0.4074074074074074; OVR Brier=0.18106228398019725; ECE=0.06273336071251759.

Delta: {"v1":{"logLoss":-0.012639080765560196,"brier":-0.008593439207436604},"h2":{"logLoss":-0.004416716547738231,"brier":-0.002906268964959824}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":351,"predicted":351,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.991133402864055,"brier":0.592551743600594,"accuracy":0.5384615384615384,"floorHits":0,"classes":[{"name":"HOME","predicted":207,"actual":139,"correct":112,"recall":0.8057553956834532,"precision":0.5410628019323671,"share":0.5897435897435898,"brier":0.20614149680707067,"meanProbability":0.41043857134415074,"meanProbabilityMinusFrequency":0.014427175332754744,"ece":0.0429326056667238,"calibration":[{"lower":0,"upper":0.1,"count":2,"meanProbability":0.08503562538046916,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":25,"meanProbability":0.1607486108456325,"observedFrequency":0.08,"lowSample":false},{"lower":0.2,"upper":0.3,"count":72,"meanProbability":0.25164479101558407,"observedFrequency":0.2222222222222222,"lowSample":false},{"lower":0.3,"upper":0.4,"count":74,"meanProbability":0.35353908341944,"observedFrequency":0.2972972972972973,"lowSample":false},{"lower":0.4,"upper":0.5,"count":74,"meanProbability":0.450805491017948,"observedFrequency":0.5,"lowSample":false},{"lower":0.5,"upper":0.6,"count":57,"meanProbability":0.5415465399348088,"observedFrequency":0.5263157894736842,"lowSample":false},{"lower":0.6,"upper":0.7,"count":37,"meanProbability":0.6436331183437617,"observedFrequency":0.6756756756756757,"lowSample":false},{"lower":0.7,"upper":0.8,"count":9,"meanProbability":0.7477094601179961,"observedFrequency":0.6666666666666666,"lowSample":true},{"lower":0.8,"upper":0.9,"count":1,"meanProbability":0.8232652623410431,"observedFrequency":1,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":99,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.20153729861539788,"meanProbability":0.25113530578503945,"meanProbabilityMinusFrequency":-0.0309159762662426,"ece":0.03091597626624263,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":29,"meanProbability":0.17223447361991545,"observedFrequency":0.20689655172413793,"lowSample":false},{"lower":0.2,"upper":0.3,"count":300,"meanProbability":0.2543617817876026,"observedFrequency":0.27666666666666667,"lowSample":false},{"lower":0.3,"upper":0.4,"count":22,"meanProbability":0.31114354814956885,"observedFrequency":0.45454545454545453,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":144,"actual":113,"correct":77,"recall":0.6814159292035398,"precision":0.5347222222222222,"share":0.41025641025641024,"brier":0.18487294817812547,"meanProbability":0.33842612287080953,"meanProbabilityMinusFrequency":0.01648880093348761,"ece":0.058105330344198035,"calibration":[{"lower":0,"upper":0.1,"count":6,"meanProbability":0.07760769369409606,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":58,"meanProbability":0.15397414359348105,"observedFrequency":0.1206896551724138,"lowSample":false},{"lower":0.2,"upper":0.3,"count":89,"meanProbability":0.2467473641786416,"observedFrequency":0.16853932584269662,"lowSample":false},{"lower":0.3,"upper":0.4,"count":88,"meanProbability":0.3490699981425032,"observedFrequency":0.3181818181818182,"lowSample":false},{"lower":0.4,"upper":0.5,"count":54,"meanProbability":0.451480475692597,"observedFrequency":0.5,"lowSample":false},{"lower":0.5,"upper":0.6,"count":41,"meanProbability":0.5450234741149911,"observedFrequency":0.6341463414634146,"lowSample":false},{"lower":0.6,"upper":0.7,"count":11,"meanProbability":0.637858936382551,"observedFrequency":0.5454545454545454,"lowSample":true},{"lower":0.7,"upper":0.8,"count":4,"meanProbability":0.7425977405763844,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[112,0,27],[59,0,40],[36,0,77]],"reasonCounts":{}},"delta":{"logLoss":-0.012267555737529134,"brier":-0.00797921658277534}}.

Diagnostics: {"availablePredictions":351,"inputPredictions":351,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":702,"pearson":0.35785061269078455,"spearman":0.398760458900109},"unresidualizedComposite":{"n":702,"pearson":0.673476181175662,"spearman":0.6832750438877025}},{"h2Column":2,"representation":{"n":702,"pearson":-0.03334569174720296,"spearman":-0.05634142288545772},"unresidualizedComposite":{"n":702,"pearson":-0.2646752707666129,"spearman":-0.26730466020202487}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":702,"pearson":-0.08298902862895687,"spearman":-0.06051968444039921},"unresidualizedComposite":{"n":702,"pearson":0.43509702753923346,"spearman":0.42285410038244337}},{"h2Column":2,"representation":{"n":702,"pearson":-0.21227328481779884,"spearman":-0.2589912187479572},"unresidualizedComposite":{"n":702,"pearson":-0.5315972545481973,"spearman":-0.5564028974945711}}]}],"crossRepresentation":{"n":702,"pearson":-0.47096468553991616,"spearman":-0.4506680613745709},"crossComposite":{"n":702,"pearson":-0.013739336311215225,"spearman":-0.010758186672294338},"contribution":{"n":702,"mean":-0.0033636315021081608,"p10":-0.05062070736861344,"p25":-0.026517700418643448,"median":0.0007928202851356476,"p75":0.02158524029032546,"p90":0.0368520141125897,"maxAbsolute":0.09496503011257443},"rateRatio":{"n":702,"mean":0.997178633792699,"p10":0.9506392139221852,"p25":0.9738308176391832,"median":1.000793156084744,"p75":1.0218198875290967,"p90":1.0375394688247843,"maxAbsolute":1.0942340372508743}}.

## 135 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: 99d8a33b52e4e690fd1800ba844ee1c595989d38dbac901f1a64f5910b8a285c.

Fit census: {"total":380,"used":274,"pass":106,"fail":0,"invalid":0}; beta: [-0.22845130230723018,0.060294182680536525]; map: null.

Full: {"targets":380,"predicted":351,"pass":29,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_HOME_HISTORY":14,"PASS_INSUFFICIENT_AWAY_HISTORY":14,"PASS_INSUFFICIENT_HOME_HISTORY|PASS_INSUFFICIENT_AWAY_HISTORY":1},"coverage":0.9236842105263158}; paired N=351; COMPLETE.

V1: LL=0.9915049278920861; Brier=0.5931659662252553; accuracy=0.5356125356125356.

- HOME: recall=0.7985611510791367; precision=0.5336538461538461; share=0.5925925925925926; OVR Brier=0.2064378525490154; ECE=0.053071198634932135.
- DRAW: recall=0.020202020202020204; precision=0.6666666666666666; share=0.008547008547008548; OVR Brier=0.20253529361081724; ECE=0.03333243957562338.
- AWAY: recall=0.6637168141592921; precision=0.5357142857142857; share=0.39886039886039887; OVR Brier=0.18419282006542273; ECE=0.05704153398322058.

H2: LL=0.9832825636742641; Brier=0.5874787959827785; accuracy=0.5327635327635327.

- HOME: recall=0.7985611510791367; precision=0.5414634146341464; share=0.584045584045584; OVR Brier=0.20375540689283048; ECE=0.04861977459060073.
- DRAW: recall=0; precision=0; share=0.002849002849002849; OVR Brier=0.20110709870531898; ECE=0.03331454044808465.
- AWAY: recall=0.672566371681416; precision=0.5241379310344828; share=0.4131054131054131; OVR Brier=0.18261629038462832; ECE=0.05127612793280685.

candidate: LL=0.990228621489415; Brier=0.5919627759886231; accuracy=0.5327635327635327.

- HOME: recall=0.7985611510791367; precision=0.5441176470588235; share=0.5811965811965812; OVR Brier=0.2056739936176833; ECE=0.041544474639103525.
- DRAW: recall=0; precision=0; share=0.002849002849002849; OVR Brier=0.20136130583486217; ECE=0.03098232780399942.
- AWAY: recall=0.672566371681416; precision=0.5205479452054794; share=0.41595441595441596; OVR Brier=0.18492747653607758; ECE=0.04591726887869053.

Delta: {"v1":{"logLoss":-0.001276306402671068,"brier":-0.001203190236632179},"h2":{"logLoss":0.006946057815150897,"brier":0.004483980005844601}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":351,"predicted":351,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.991133402864055,"brier":0.592551743600594,"accuracy":0.5384615384615384,"floorHits":0,"classes":[{"name":"HOME","predicted":207,"actual":139,"correct":112,"recall":0.8057553956834532,"precision":0.5410628019323671,"share":0.5897435897435898,"brier":0.20614149680707067,"meanProbability":0.41043857134415074,"meanProbabilityMinusFrequency":0.014427175332754744,"ece":0.0429326056667238,"calibration":[{"lower":0,"upper":0.1,"count":2,"meanProbability":0.08503562538046916,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":25,"meanProbability":0.1607486108456325,"observedFrequency":0.08,"lowSample":false},{"lower":0.2,"upper":0.3,"count":72,"meanProbability":0.25164479101558407,"observedFrequency":0.2222222222222222,"lowSample":false},{"lower":0.3,"upper":0.4,"count":74,"meanProbability":0.35353908341944,"observedFrequency":0.2972972972972973,"lowSample":false},{"lower":0.4,"upper":0.5,"count":74,"meanProbability":0.450805491017948,"observedFrequency":0.5,"lowSample":false},{"lower":0.5,"upper":0.6,"count":57,"meanProbability":0.5415465399348088,"observedFrequency":0.5263157894736842,"lowSample":false},{"lower":0.6,"upper":0.7,"count":37,"meanProbability":0.6436331183437617,"observedFrequency":0.6756756756756757,"lowSample":false},{"lower":0.7,"upper":0.8,"count":9,"meanProbability":0.7477094601179961,"observedFrequency":0.6666666666666666,"lowSample":true},{"lower":0.8,"upper":0.9,"count":1,"meanProbability":0.8232652623410431,"observedFrequency":1,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":99,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.20153729861539788,"meanProbability":0.25113530578503945,"meanProbabilityMinusFrequency":-0.0309159762662426,"ece":0.03091597626624263,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":29,"meanProbability":0.17223447361991545,"observedFrequency":0.20689655172413793,"lowSample":false},{"lower":0.2,"upper":0.3,"count":300,"meanProbability":0.2543617817876026,"observedFrequency":0.27666666666666667,"lowSample":false},{"lower":0.3,"upper":0.4,"count":22,"meanProbability":0.31114354814956885,"observedFrequency":0.45454545454545453,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":144,"actual":113,"correct":77,"recall":0.6814159292035398,"precision":0.5347222222222222,"share":0.41025641025641024,"brier":0.18487294817812547,"meanProbability":0.33842612287080953,"meanProbabilityMinusFrequency":0.01648880093348761,"ece":0.058105330344198035,"calibration":[{"lower":0,"upper":0.1,"count":6,"meanProbability":0.07760769369409606,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":58,"meanProbability":0.15397414359348105,"observedFrequency":0.1206896551724138,"lowSample":false},{"lower":0.2,"upper":0.3,"count":89,"meanProbability":0.2467473641786416,"observedFrequency":0.16853932584269662,"lowSample":false},{"lower":0.3,"upper":0.4,"count":88,"meanProbability":0.3490699981425032,"observedFrequency":0.3181818181818182,"lowSample":false},{"lower":0.4,"upper":0.5,"count":54,"meanProbability":0.451480475692597,"observedFrequency":0.5,"lowSample":false},{"lower":0.5,"upper":0.6,"count":41,"meanProbability":0.5450234741149911,"observedFrequency":0.6341463414634146,"lowSample":false},{"lower":0.6,"upper":0.7,"count":11,"meanProbability":0.637858936382551,"observedFrequency":0.5454545454545454,"lowSample":true},{"lower":0.7,"upper":0.8,"count":4,"meanProbability":0.7425977405763844,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[112,0,27],[59,0,40],[36,0,77]],"reasonCounts":{}},"delta":{"logLoss":-0.0009047813746400069,"brier":-0.0005889676119709142}}.

Diagnostics: {"availablePredictions":351,"inputPredictions":351,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":702,"pearson":0.673476181175662,"spearman":0.6832750438877025},"unresidualizedComposite":{"n":702,"pearson":0.673476181175662,"spearman":0.6832750438877025}},{"h2Column":2,"representation":{"n":702,"pearson":-0.2646752707666129,"spearman":-0.26730466020202487},"unresidualizedComposite":{"n":702,"pearson":-0.2646752707666129,"spearman":-0.26730466020202487}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":702,"pearson":0.43509702753923346,"spearman":0.42285410038244337},"unresidualizedComposite":{"n":702,"pearson":0.43509702753923346,"spearman":0.42285410038244337}},{"h2Column":2,"representation":{"n":702,"pearson":-0.5315972545481973,"spearman":-0.5564028974945711},"unresidualizedComposite":{"n":702,"pearson":-0.5315972545481973,"spearman":-0.5564028974945711}}]}],"crossRepresentation":{"n":702,"pearson":-0.013739336311215225,"spearman":-0.010758186672294338},"crossComposite":{"n":702,"pearson":-0.013739336311215225,"spearman":-0.010758186672294338},"contribution":{"n":702,"mean":0.001090795063694713,"p10":-0.06426464085445885,"p25":-0.031671727404967334,"median":0.0014396536903712785,"p75":0.03703989947745335,"p90":0.05847199846107486,"maxAbsolute":0.10508426359453012},"rateRatio":{"n":702,"mean":1.002120588590331,"p10":0.9377567979547494,"p25":0.9688245905890246,"median":1.001440695113824,"p75":1.0377344401938526,"p90":1.060215306564266,"maxAbsolute":1.110804206767546}}.

## 78 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: f7eaa5f1161b3a7b17545fde8cbdb5dab222e8de4b3d7a2004e7ad6ea4b395c7; map parameter hash: 351b18ad746f5d676ae8301feb59bf194355163ccd90113e5f7b71a1d8e902ac; beta hash: 016bdbb24e363bc4df083c0e73b410fa355eb08100add6525ed5e349ee5ec9ec.

Fit census: {"total":306,"used":207,"pass":99,"fail":0,"invalid":0}; beta: [0.08831527827367178,0.02433425409124074]; map: [[-0.13052996828519528,0.2859113473016767,-0.025329780780498308],[-0.033301996826668095,0.14918895304964935,-0.13209663380987494]].

Full: {"targets":306,"predicted":286,"pass":20,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_AWAY_HISTORY":10,"PASS_INSUFFICIENT_HOME_HISTORY":10},"coverage":0.934640522875817}; paired N=286; COMPLETE.

V1: LL=1.0446896587374959; Brier=0.6279990190911756; accuracy=0.4755244755244755.

- HOME: recall=0.7567567567567568; precision=0.4666666666666667; share=0.6293706293706294; OVR Brier=0.21977341411909262; ECE=0.08318975252703728.
- DRAW: recall=0; precision=0; share=0.0034965034965034965; OVR Brier=0.19449299265329636; ECE=0.050308610633035836.
- AWAY: recall=0.5148514851485149; precision=0.49523809523809526; share=0.36713286713286714; OVR Brier=0.21373261231878707; ECE=0.042007477448459674.

H2: LL=1.0317129928865303; Brier=0.6188062923457082; accuracy=0.5034965034965035.

- HOME: recall=0.7837837837837838; precision=0.5028901734104047; share=0.6048951048951049; OVR Brier=0.21440820659846477; ECE=0.06737772561140966.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1940357333744969; ECE=0.04887679042745522.
- AWAY: recall=0.5643564356435643; precision=0.504424778761062; share=0.3951048951048951; OVR Brier=0.21036235237274709; ECE=0.07203512731416226.

candidate: LL=1.0299786557995585; Brier=0.6175824965448113; accuracy=0.5.

- HOME: recall=0.7747747747747747; precision=0.5; share=0.6013986013986014; OVR Brier=0.21328483458519515; ECE=0.05978223915249396.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.19405435948272956; ECE=0.0444272235451147.
- AWAY: recall=0.5643564356435643; precision=0.5; share=0.3986013986013986; OVR Brier=0.21024330247688694; ECE=0.07904991186404549.

Delta: {"v1":{"logLoss":-0.014711002937937367,"brier":-0.01041652254636427},"h2":{"logLoss":-0.0017343370869717933,"brier":-0.0012237958008968208}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":286,"predicted":286,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":1.0334647540488424,"brier":0.6198591636398328,"accuracy":0.486013986013986,"floorHits":0,"classes":[{"name":"HOME","predicted":178,"actual":111,"correct":86,"recall":0.7747747747747747,"precision":0.48314606741573035,"share":0.6223776223776224,"brier":0.21504373727544507,"meanProbability":0.4433923733516763,"meanProbabilityMinusFrequency":0.0552804852397882,"ece":0.060973563328102436,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.09698354031336522,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":19,"meanProbability":0.16785239978751018,"observedFrequency":0.10526315789473684,"lowSample":true},{"lower":0.2,"upper":0.3,"count":40,"meanProbability":0.2596552464083307,"observedFrequency":0.275,"lowSample":false},{"lower":0.3,"upper":0.4,"count":62,"meanProbability":0.34696443478062006,"observedFrequency":0.22580645161290322,"lowSample":false},{"lower":0.4,"upper":0.5,"count":61,"meanProbability":0.45047109907734306,"observedFrequency":0.4262295081967213,"lowSample":false},{"lower":0.5,"upper":0.6,"count":46,"meanProbability":0.5428889772257502,"observedFrequency":0.4782608695652174,"lowSample":false},{"lower":0.6,"upper":0.7,"count":34,"meanProbability":0.647393433061828,"observedFrequency":0.5588235294117647,"lowSample":false},{"lower":0.7,"upper":0.8,"count":19,"meanProbability":0.7262989461598874,"observedFrequency":0.7368421052631579,"lowSample":true},{"lower":0.8,"upper":0.9,"count":4,"meanProbability":0.8408370330823245,"observedFrequency":0.75,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":74,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.19370121229394455,"meanProbability":0.2207843442263771,"meanProbabilityMinusFrequency":-0.037956914514881646,"ece":0.04360260536380145,"calibration":[{"lower":0,"upper":0.1,"count":2,"meanProbability":0.07911465159705025,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":68,"meanProbability":0.17222707120904468,"observedFrequency":0.25,"lowSample":false},{"lower":0.2,"upper":0.3,"count":214,"meanProbability":0.23656798044454805,"observedFrequency":0.26635514018691586,"lowSample":false},{"lower":0.3,"upper":0.4,"count":2,"meanProbability":0.3245522441007162,"observedFrequency":0,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":108,"actual":101,"correct":53,"recall":0.5247524752475248,"precision":0.49074074074074076,"share":0.3776223776223776,"brier":0.21111421407044378,"meanProbability":0.33582328242194665,"meanProbabilityMinusFrequency":-0.01732357072490651,"ece":0.05701643517432962,"calibration":[{"lower":0,"upper":0.1,"count":8,"meanProbability":0.0766036628129777,"observedFrequency":0.125,"lowSample":true},{"lower":0.1,"upper":0.2,"count":53,"meanProbability":0.15485821116825974,"observedFrequency":0.1509433962264151,"lowSample":false},{"lower":0.2,"upper":0.3,"count":70,"meanProbability":0.25258808673454863,"observedFrequency":0.2857142857142857,"lowSample":false},{"lower":0.3,"upper":0.4,"count":56,"meanProbability":0.3437754587529182,"observedFrequency":0.42857142857142855,"lowSample":false},{"lower":0.4,"upper":0.5,"count":57,"meanProbability":0.4451638361354319,"observedFrequency":0.47368421052631576,"lowSample":false},{"lower":0.5,"upper":0.6,"count":23,"meanProbability":0.542112801058683,"observedFrequency":0.30434782608695654,"lowSample":false},{"lower":0.6,"upper":0.7,"count":14,"meanProbability":0.6338794173520694,"observedFrequency":0.7142857142857143,"lowSample":true},{"lower":0.7,"upper":0.8,"count":5,"meanProbability":0.715061517934994,"observedFrequency":0.8,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[86,0,25],[44,0,30],[48,0,53]],"reasonCounts":{}},"delta":{"logLoss":-0.00348609824928392,"brier":-0.0022766670950215007}}.

Diagnostics: {"availablePredictions":286,"inputPredictions":286,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":572,"pearson":0.19654660540862812,"spearman":0.17609488191089315},"unresidualizedComposite":{"n":572,"pearson":0.6954685350163621,"spearman":0.677795123701543}},{"h2Column":2,"representation":{"n":572,"pearson":-0.02694283810979508,"spearman":-0.011587471770305231},"unresidualizedComposite":{"n":572,"pearson":-0.3060146004115651,"spearman":-0.2746968511815707}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":572,"pearson":0.08480637575927052,"spearman":0.045454769875048436},"unresidualizedComposite":{"n":572,"pearson":0.46208043320162084,"spearman":0.46510251560636207}},{"h2Column":2,"representation":{"n":572,"pearson":-0.09657230953620276,"spearman":0.013169379835740864},"unresidualizedComposite":{"n":572,"pearson":-0.45454201149760004,"spearman":-0.3466308679629665}}]}],"crossRepresentation":{"n":572,"pearson":-0.4835118348032137,"spearman":-0.502958791971363},"crossComposite":{"n":572,"pearson":0.010174426108581925,"spearman":-0.013127509381899128},"contribution":{"n":572,"mean":0.0008334178704409107,"p10":-0.011997036973935707,"p25":-0.006640467937280813,"median":0.00006358534622114947,"p75":0.007472615796289181,"p90":0.01593904581462484,"maxAbsolute":0.02978697362824184},"rateRatio":{"n":572,"mean":1.000890964366469,"p10":0.9880746428602863,"p25":0.9933815314175063,"median":1.0000635878922886,"p75":1.0075006055049547,"p90":1.0160667505137806,"maxAbsolute":1.0302350433423613}}.

## 78 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: c0c7477aca240d3aa3326babeb0995edfe157900b29179cc00dca1563b8c6b25.

Fit census: {"total":306,"used":214,"pass":92,"fail":0,"invalid":0}; beta: [-0.07682350416698663,-0.2157218393806334]; map: null.

Full: {"targets":306,"predicted":286,"pass":20,"fail":0,"invalid":0,"reasons":{"PASS_INSUFFICIENT_AWAY_HISTORY":10,"PASS_INSUFFICIENT_HOME_HISTORY":10},"coverage":0.934640522875817}; paired N=286; COMPLETE.

V1: LL=1.0446896587374959; Brier=0.6279990190911756; accuracy=0.4755244755244755.

- HOME: recall=0.7567567567567568; precision=0.4666666666666667; share=0.6293706293706294; OVR Brier=0.21977341411909262; ECE=0.08318975252703728.
- DRAW: recall=0; precision=0; share=0.0034965034965034965; OVR Brier=0.19449299265329636; ECE=0.050308610633035836.
- AWAY: recall=0.5148514851485149; precision=0.49523809523809526; share=0.36713286713286714; OVR Brier=0.21373261231878707; ECE=0.042007477448459674.

H2: LL=1.0317129928865303; Brier=0.6188062923457082; accuracy=0.5034965034965035.

- HOME: recall=0.7837837837837838; precision=0.5028901734104047; share=0.6048951048951049; OVR Brier=0.21440820659846477; ECE=0.06737772561140966.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1940357333744969; ECE=0.04887679042745522.
- AWAY: recall=0.5643564356435643; precision=0.504424778761062; share=0.3951048951048951; OVR Brier=0.21036235237274709; ECE=0.07203512731416226.

candidate: LL=1.0358245722547366; Brier=0.621686979949544; accuracy=0.4965034965034965.

- HOME: recall=0.7837837837837838; precision=0.4887640449438202; share=0.6223776223776224; OVR Brier=0.21676122704070647; ECE=0.06614199278850513.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1938420846212652; ECE=0.043593936161296344.
- AWAY: recall=0.5445544554455446; precision=0.5092592592592593; share=0.3776223776223776; OVR Brier=0.2110836682875721; ECE=0.05374078212820353.

Delta: {"v1":{"logLoss":-0.008865086482759299,"brier":-0.006312039141631587},"h2":{"logLoss":0.004111579368206275,"brier":0.002880687603835863}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da","metrics":{"targets":286,"predicted":286,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":1.0334647540488424,"brier":0.6198591636398328,"accuracy":0.486013986013986,"floorHits":0,"classes":[{"name":"HOME","predicted":178,"actual":111,"correct":86,"recall":0.7747747747747747,"precision":0.48314606741573035,"share":0.6223776223776224,"brier":0.21504373727544507,"meanProbability":0.4433923733516763,"meanProbabilityMinusFrequency":0.0552804852397882,"ece":0.060973563328102436,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.09698354031336522,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":19,"meanProbability":0.16785239978751018,"observedFrequency":0.10526315789473684,"lowSample":true},{"lower":0.2,"upper":0.3,"count":40,"meanProbability":0.2596552464083307,"observedFrequency":0.275,"lowSample":false},{"lower":0.3,"upper":0.4,"count":62,"meanProbability":0.34696443478062006,"observedFrequency":0.22580645161290322,"lowSample":false},{"lower":0.4,"upper":0.5,"count":61,"meanProbability":0.45047109907734306,"observedFrequency":0.4262295081967213,"lowSample":false},{"lower":0.5,"upper":0.6,"count":46,"meanProbability":0.5428889772257502,"observedFrequency":0.4782608695652174,"lowSample":false},{"lower":0.6,"upper":0.7,"count":34,"meanProbability":0.647393433061828,"observedFrequency":0.5588235294117647,"lowSample":false},{"lower":0.7,"upper":0.8,"count":19,"meanProbability":0.7262989461598874,"observedFrequency":0.7368421052631579,"lowSample":true},{"lower":0.8,"upper":0.9,"count":4,"meanProbability":0.8408370330823245,"observedFrequency":0.75,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":74,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.19370121229394455,"meanProbability":0.2207843442263771,"meanProbabilityMinusFrequency":-0.037956914514881646,"ece":0.04360260536380145,"calibration":[{"lower":0,"upper":0.1,"count":2,"meanProbability":0.07911465159705025,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":68,"meanProbability":0.17222707120904468,"observedFrequency":0.25,"lowSample":false},{"lower":0.2,"upper":0.3,"count":214,"meanProbability":0.23656798044454805,"observedFrequency":0.26635514018691586,"lowSample":false},{"lower":0.3,"upper":0.4,"count":2,"meanProbability":0.3245522441007162,"observedFrequency":0,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":108,"actual":101,"correct":53,"recall":0.5247524752475248,"precision":0.49074074074074076,"share":0.3776223776223776,"brier":0.21111421407044378,"meanProbability":0.33582328242194665,"meanProbabilityMinusFrequency":-0.01732357072490651,"ece":0.05701643517432962,"calibration":[{"lower":0,"upper":0.1,"count":8,"meanProbability":0.0766036628129777,"observedFrequency":0.125,"lowSample":true},{"lower":0.1,"upper":0.2,"count":53,"meanProbability":0.15485821116825974,"observedFrequency":0.1509433962264151,"lowSample":false},{"lower":0.2,"upper":0.3,"count":70,"meanProbability":0.25258808673454863,"observedFrequency":0.2857142857142857,"lowSample":false},{"lower":0.3,"upper":0.4,"count":56,"meanProbability":0.3437754587529182,"observedFrequency":0.42857142857142855,"lowSample":false},{"lower":0.4,"upper":0.5,"count":57,"meanProbability":0.4451638361354319,"observedFrequency":0.47368421052631576,"lowSample":false},{"lower":0.5,"upper":0.6,"count":23,"meanProbability":0.542112801058683,"observedFrequency":0.30434782608695654,"lowSample":false},{"lower":0.6,"upper":0.7,"count":14,"meanProbability":0.6338794173520694,"observedFrequency":0.7142857142857143,"lowSample":true},{"lower":0.7,"upper":0.8,"count":5,"meanProbability":0.715061517934994,"observedFrequency":0.8,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[86,0,25],[44,0,30],[48,0,53]],"reasonCounts":{}},"delta":{"logLoss":0.0023598182058941486,"brier":0.0018278163097111833}}.

Diagnostics: {"availablePredictions":286,"inputPredictions":286,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":572,"pearson":0.6954685350163621,"spearman":0.677795123701543},"unresidualizedComposite":{"n":572,"pearson":0.6954685350163621,"spearman":0.677795123701543}},{"h2Column":2,"representation":{"n":572,"pearson":-0.3060146004115651,"spearman":-0.2746968511815707},"unresidualizedComposite":{"n":572,"pearson":-0.3060146004115651,"spearman":-0.2746968511815707}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":572,"pearson":0.46208043320162084,"spearman":0.46510251560636207},"unresidualizedComposite":{"n":572,"pearson":0.46208043320162084,"spearman":0.46510251560636207}},{"h2Column":2,"representation":{"n":572,"pearson":-0.45454201149760004,"spearman":-0.3466308679629665},"unresidualizedComposite":{"n":572,"pearson":-0.45454201149760004,"spearman":-0.3466308679629665}}]}],"crossRepresentation":{"n":572,"pearson":0.010174426108581925,"spearman":-0.013127509381899128},"crossComposite":{"n":572,"pearson":0.010174426108581925,"spearman":-0.013127509381899128},"contribution":{"n":572,"mean":0.007184336188407284,"p10":-0.040392809781512704,"p25":-0.021909194201268398,"median":0.002800238467951575,"p75":0.02620196734643467,"p90":0.07189911881432119,"maxAbsolute":0.14401292039756783},"rateRatio":{"n":572,"mean":1.008116317618303,"p10":0.9604121059012042,"p25":0.9783290694850644,"median":1.0028041775040273,"p75":1.0265482593458997,"p90":1.0745477139131039,"maxAbsolute":1.1548990301831372}}.

## Provenance / final fits / diagnostics

{
  "baseSha": "2763ce8aee4594c4ae48776b46254bf348cab32c",
  "sourceFreezeCommit": "3fbaa443ebf4288beba2de7f64992ef4cfba397b",
  "sourceHash": "7a7aaa8e8d9bd9e7df1764aac6bdc85be27baa27e0024c8cd93f989855e7c27b",
  "startedAt": "2026-09-12T11:08:27.935Z",
  "completedAt": "2026-09-12T11:12:52.071Z",
  "localDirectory": "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX\\football-v31-development-v1\\2026-09-12T11-08-27-935Z",
  "finalMapBetaSealHash": "4db27b40d0a8ff717ce93fc893e45b0c5e33f43debf7b64b0ece8b13371d2e1e",
  "protectedFiles": 667,
  "preservationHash": "69bdf6a14129803f685e8b23daea8dc9c1646da821b6a6f8b1c0fc0064b97885",
  "holdoutPredictions": false,
  "holdoutMetricsViewed": false,
  "holdoutMetricsComputed": false,
  "forwardChanged": false,
  "modelPromoted": false,
  "postResultTuning": false,
  "auditHash": "b2ceab64d5d0c3deb56e74cf50cb501a15b65fa91f631fabc48fa90e23685fde",
  "classifications": {
    "V31-R1": "BETTER_THAN_H2_ALL_4_DESCRIPTIVELY",
    "V31-R3": "MIXED"
  },
  "execution": "EXECUTED",
  "coefficientMovement": [
    {
      "leagueId": 39,
      "candidate": "V31-R1",
      "beta": [
        {
          "initial": 0.15436310222990213,
          "final": 0.220918986630824,
          "change": 0.06655588440092186,
          "absoluteChange": 0.06655588440092186,
          "relativeAbsoluteChange": 0.4311644650792016,
          "signReversal": false
        },
        {
          "initial": 0.07276651888872855,
          "final": 0.4891322523270494,
          "change": 0.41636573343832084,
          "absoluteChange": 0.41636573343832084,
          "relativeAbsoluteChange": 5.721941076706027,
          "signReversal": false
        }
      ],
      "map": [
        {
          "initial": -0.08555007685371936,
          "final": -0.08626864334360011,
          "change": -0.0007185664898807509,
          "absoluteChange": 0.0007185664898807509,
          "relativeAbsoluteChange": 0.008399366970872693,
          "signReversal": false
        },
        {
          "initial": 0.25423676902497944,
          "final": 0.26658092226805075,
          "change": 0.01234415324307131,
          "absoluteChange": 0.01234415324307131,
          "relativeAbsoluteChange": 0.04855376856153511,
          "signReversal": false
        },
        {
          "initial": -0.10497773093525983,
          "final": -0.11281301151520609,
          "change": -0.007835280579946258,
          "absoluteChange": 0.007835280579946258,
          "relativeAbsoluteChange": 0.07463754941301128,
          "signReversal": false
        },
        {
          "initial": -0.0493082391279992,
          "final": -0.07701098774040788,
          "change": -0.02770274861240868,
          "absoluteChange": 0.02770274861240868,
          "relativeAbsoluteChange": 0.561827984578706,
          "signReversal": false
        },
        {
          "initial": 0.18588609440713116,
          "final": 0.2358329959402388,
          "change": 0.04994690153310763,
          "absoluteChange": 0.04994690153310763,
          "relativeAbsoluteChange": 0.2686962771067372,
          "signReversal": false
        },
        {
          "initial": -0.11489059659358206,
          "final": -0.10303813825743395,
          "change": 0.011852458336148106,
          "absoluteChange": 0.011852458336148106,
          "relativeAbsoluteChange": 0.10316299756084825,
          "signReversal": false
        }
      ]
    },
    {
      "leagueId": 39,
      "candidate": "V31-R3",
      "beta": [
        {
          "initial": -0.6579268763712257,
          "final": -0.19595167272292183,
          "change": 0.4619752036483039,
          "absoluteChange": 0.4619752036483039,
          "relativeAbsoluteChange": 0.7021680071747686,
          "signReversal": false
        },
        {
          "initial": -0.6696121375685092,
          "final": 0.09194169829181151,
          "change": 0.7615538358603208,
          "absoluteChange": 0.7615538358603208,
          "relativeAbsoluteChange": 1.1373059016308598,
          "signReversal": true
        }
      ],
      "map": null
    },
    {
      "leagueId": 140,
      "candidate": "V31-R1",
      "beta": [
        {
          "initial": 0.2218286938325005,
          "final": 0.4911264973584418,
          "change": 0.26929780352594135,
          "absoluteChange": 0.26929780352594135,
          "relativeAbsoluteChange": 1.2139899436512214,
          "signReversal": false
        },
        {
          "initial": -0.18861302764908436,
          "final": 0.044130577996238804,
          "change": 0.23274360564532315,
          "absoluteChange": 0.23274360564532315,
          "relativeAbsoluteChange": 1.23397417742715,
          "signReversal": true
        }
      ],
      "map": [
        {
          "initial": -0.08965793222700168,
          "final": -0.08568559832805549,
          "change": 0.00397233389894619,
          "absoluteChange": 0.00397233389894619,
          "relativeAbsoluteChange": 0.044305437347013324,
          "signReversal": false
        },
        {
          "initial": 0.2574273601832427,
          "final": 0.2787824870463673,
          "change": 0.02135512686312463,
          "absoluteChange": 0.02135512686312463,
          "relativeAbsoluteChange": 0.08295593307534817,
          "signReversal": false
        },
        {
          "initial": 0.024403168817394884,
          "final": 0.026309697472273404,
          "change": 0.0019065286548785206,
          "absoluteChange": 0.0019065286548785206,
          "relativeAbsoluteChange": 0.07812627405665133,
          "signReversal": false
        },
        {
          "initial": -0.04449026588315577,
          "final": -0.034336771492608865,
          "change": 0.010153494390546906,
          "absoluteChange": 0.010153494390546906,
          "relativeAbsoluteChange": 0.2282183347074819,
          "signReversal": false
        },
        {
          "initial": 0.14067855570618784,
          "final": 0.1459898274779809,
          "change": 0.005311271771793052,
          "absoluteChange": 0.005311271771793052,
          "relativeAbsoluteChange": 0.037754665202035714,
          "signReversal": false
        },
        {
          "initial": -0.04726065422648521,
          "final": -0.04971118395646566,
          "change": -0.002450529729980451,
          "absoluteChange": 0.002450529729980451,
          "relativeAbsoluteChange": 0.05185137129581157,
          "signReversal": false
        }
      ]
    },
    {
      "leagueId": 140,
      "candidate": "V31-R3",
      "beta": [
        {
          "initial": 0.0004510895478701145,
          "final": 0.20574872878529857,
          "change": 0.20529763923742844,
          "absoluteChange": 0.20529763923742844,
          "relativeAbsoluteChange": 455.11504358008597,
          "signReversal": false
        },
        {
          "initial": -0.3142629889575861,
          "final": -0.1909397480823042,
          "change": 0.12332324087528188,
          "absoluteChange": 0.12332324087528188,
          "relativeAbsoluteChange": 0.39242050514553584,
          "signReversal": false
        }
      ],
      "map": null
    },
    {
      "leagueId": 135,
      "candidate": "V31-R1",
      "beta": [
        {
          "initial": -0.501975445802791,
          "final": 0.05014928540181797,
          "change": 0.5521247312046089,
          "absoluteChange": 0.5521247312046089,
          "relativeAbsoluteChange": 1.0999038614759653,
          "signReversal": true
        },
        {
          "initial": 0.3336657164233968,
          "final": 0.256436831264948,
          "change": -0.07722888515844883,
          "absoluteChange": 0.07722888515844883,
          "relativeAbsoluteChange": 0.23145585943403055,
          "signReversal": false
        }
      ],
      "map": [
        {
          "initial": -0.05209400193553844,
          "final": -0.049143039352821945,
          "change": 0.0029509625827164945,
          "absoluteChange": 0.0029509625827164945,
          "relativeAbsoluteChange": 0.05664687820237041,
          "signReversal": false
        },
        {
          "initial": 0.21934025628840326,
          "final": 0.20945233024039467,
          "change": -0.009887926048008588,
          "absoluteChange": 0.009887926048008588,
          "relativeAbsoluteChange": 0.04508030680427072,
          "signReversal": false
        },
        {
          "initial": -0.020434659819115925,
          "final": -0.026433304870460635,
          "change": -0.00599864505134471,
          "absoluteChange": 0.00599864505134471,
          "relativeAbsoluteChange": 0.29355247919190625,
          "signReversal": false
        },
        {
          "initial": -0.040050625224656314,
          "final": -0.048215090510960894,
          "change": -0.00816446528630458,
          "absoluteChange": 0.00816446528630458,
          "relativeAbsoluteChange": 0.2038536287637852,
          "signReversal": false
        },
        {
          "initial": 0.1674030781218197,
          "final": 0.21471185804741408,
          "change": 0.047308779925594374,
          "absoluteChange": 0.047308779925594374,
          "relativeAbsoluteChange": 0.2826040026048245,
          "signReversal": false
        },
        {
          "initial": -0.08954009324315655,
          "final": -0.051906937199478725,
          "change": 0.037633156043677826,
          "absoluteChange": 0.037633156043677826,
          "relativeAbsoluteChange": 0.42029391170590596,
          "signReversal": false
        }
      ]
    },
    {
      "leagueId": 135,
      "candidate": "V31-R3",
      "beta": [
        {
          "initial": -0.6061327483745486,
          "final": -0.22845130230723018,
          "change": 0.37768144606731835,
          "absoluteChange": 0.37768144606731835,
          "relativeAbsoluteChange": 0.6231002153903373,
          "signReversal": false
        },
        {
          "initial": 0.3121538733567965,
          "final": 0.060294182680536525,
          "change": -0.25185969067625996,
          "absoluteChange": 0.25185969067625996,
          "relativeAbsoluteChange": 0.8068446755692844,
          "signReversal": false
        }
      ],
      "map": null
    },
    {
      "leagueId": 78,
      "candidate": "V31-R1",
      "beta": [
        {
          "initial": -0.29645916684823115,
          "final": 0.08831527827367178,
          "change": 0.38477444512190295,
          "absoluteChange": 0.38477444512190295,
          "relativeAbsoluteChange": 1.29790031191339,
          "signReversal": true
        },
        {
          "initial": -0.17472393026937666,
          "final": 0.02433425409124074,
          "change": 0.1990581843606174,
          "absoluteChange": 0.1990581843606174,
          "relativeAbsoluteChange": 1.139272588784627,
          "signReversal": true
        }
      ],
      "map": [
        {
          "initial": -0.10329281954959005,
          "final": -0.13052996828519528,
          "change": -0.027237148735605232,
          "absoluteChange": 0.027237148735605232,
          "relativeAbsoluteChange": 0.2636886944743424,
          "signReversal": false
        },
        {
          "initial": 0.2117760876855857,
          "final": 0.2859113473016767,
          "change": 0.07413525961609102,
          "absoluteChange": 0.07413525961609102,
          "relativeAbsoluteChange": 0.3500643553589311,
          "signReversal": false
        },
        {
          "initial": -0.05269297331445666,
          "final": -0.025329780780498308,
          "change": 0.02736319253395835,
          "absoluteChange": 0.02736319253395835,
          "relativeAbsoluteChange": 0.5192949042875719,
          "signReversal": false
        },
        {
          "initial": -0.05753316854753622,
          "final": -0.033301996826668095,
          "change": 0.024231171720868125,
          "absoluteChange": 0.024231171720868125,
          "relativeAbsoluteChange": 0.4211687333168059,
          "signReversal": false
        },
        {
          "initial": 0.1611122569830992,
          "final": 0.14918895304964935,
          "change": -0.011923303933449841,
          "absoluteChange": 0.011923303933449841,
          "relativeAbsoluteChange": 0.07400618771482176,
          "signReversal": false
        },
        {
          "initial": -0.09536712049300715,
          "final": -0.13209663380987494,
          "change": -0.03672951331686779,
          "absoluteChange": 0.03672951331686779,
          "relativeAbsoluteChange": 0.3851381181165159,
          "signReversal": false
        }
      ]
    },
    {
      "leagueId": 78,
      "candidate": "V31-R3",
      "beta": [
        {
          "initial": -0.18125232531159696,
          "final": -0.07682350416698663,
          "change": 0.10442882114461033,
          "absoluteChange": 0.10442882114461033,
          "relativeAbsoluteChange": 0.5761516215865548,
          "signReversal": false
        },
        {
          "initial": -0.4165259352853631,
          "final": -0.2157218393806334,
          "change": 0.20080409590472967,
          "absoluteChange": 0.20080409590472967,
          "relativeAbsoluteChange": 0.48209265952949176,
          "signReversal": false
        }
      ],
      "map": null
    }
  ]
}

MODEL_PROMOTED=NO
FORWARD_MODEL_CHANGED=NO
2025_HOLDOUT_PREDICTIONS_GENERATED=NO
2025_HOLDOUT_METRICS_VIEWED=NO
2025_HOLDOUT_METRICS_COMPUTED=NO

## Post-execution integrity verification

Source commit: c18c72372e4fbc3e0551cb4c5d947f34285e0ff0. Source-freeze commit: 3fbaa443ebf4288beba2de7f64992ef4cfba397b. Source freeze SHA256: 7a7aaa8e8d9bd9e7df1764aac6bdc85be27baa27e0024c8cd93f989855e7c27b.

185 tests passed; TypeScript strict and ESLint passed before real fitting. Post-run: 4304 local seals, 1313 prefix-map populations, 2684 predicted rows, 667 protected files verified. No source change or rerun.

Final aggregate hashes are canonical SHA256 of ordered [{leagueId,parameterHash}], league order 39,140,135,78. Per-league hashes remain in the sealed result audit.

FINAL_R1_MAP_HASH = 244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26

FINAL_R1_BETA_HASH = dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4

FINAL_R3_BETA_HASH = 469c39f9c7d89083cfd49b8f2f3893a5c645a29bf74107cfb0ebc3d253d20ad8

FINAL_MAP_BETA_SEAL = 4db27b40d0a8ff717ce93fc893e45b0c5e33f43debf7b64b0ece8b13371d2e1e

Loader disclosure: mixed 2023/2024 archive bytes were hash-checked and fixture-ID indexed; 2024 records were not JSON-decoded or score-projected until the final-map/beta seal enabled the exposed stage. No 2025 raw path was accessed.
