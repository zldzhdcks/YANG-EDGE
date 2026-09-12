# FOOTBALL V31 DEVELOPMENT V1

DESCRIPTIVE_ONLY. 2024 is exposed, not independent validation. No promotion or post-result tuning. Raw state/maps/traces remain LOCAL_ONLY.

## 39 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: 7ef3e778a4e50cdd1880a30bf534398d2e31f8c65981c5377a9e54cff71a1e95; map parameter hash: 8ee2d43f2e9c227160127924923c45ad8f0999cd14cba2053a95a30dadc0368c; beta hash: 8b56dd030405dfbdc80e4b72a5e10e758f6f3ac553659e2dc9dcd74dc0feab80.

Fit census: {"total":188,"used":78,"pass":110,"fail":0,"invalid":0}; beta: [0.15436310222990213,0.07276651888872855]; map: [[-0.08555007685371936,0.25423676902497944,-0.10497773093525983],[-0.0493082391279992,0.18588609440713116,-0.11489059659358206]].

Full: {"targets":184,"predicted":184,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=184; COMPLETE.

V1: LL=0.9544332890292452; Brier=0.5622254851663714; accuracy=0.5869565217391305.

- HOME: recall=0.9259259259259259; precision=0.5905511811023622; share=0.6902173913043478; OVR Brier=0.19811010771136567; ECE=0.056285037942863436.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18673768780765695; ECE=0.035368338560660455.
- AWAY: recall=0.5789473684210527; precision=0.5789473684210527; share=0.30978260869565216; OVR Brier=0.177377689647348; ECE=0.05188446182481947.

H2: LL=0.9256994925214426; Brier=0.5437435183165971; accuracy=0.5815217391304348.

- HOME: recall=0.8518518518518519; precision=0.6; share=0.625; OVR Brier=0.19178619319943865; ECE=0.060210596913282365.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18442792083670173; ECE=0.04092424247649979.
- AWAY: recall=0.6666666666666666; precision=0.5507246376811594; share=0.375; OVR Brier=0.1675294042804563; ECE=0.08292069713365413.

candidate: LL=0.9216214102977844; Brier=0.5409897829888183; accuracy=0.5760869565217391.

- HOME: recall=0.8271604938271605; precision=0.6036036036036037; share=0.6032608695652174; OVR Brier=0.1899140802082497; ECE=0.05952268247168194.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1841361989127531; ECE=0.04271950700593057.
- AWAY: recall=0.6842105263157895; precision=0.5342465753424658; share=0.3967391304347826; OVR Brier=0.16693950386781495; ECE=0.07737177996291839.

Delta: {"v1":{"logLoss":-0.03281187873146074,"brier":-0.021235702177553106},"h2":{"logLoss":-0.0040780822236581304,"brier":-0.0027537353277787835}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":184,"predicted":184,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":1.0136597162986631,"brier":0.6057962774598954,"accuracy":0.5108695652173914,"floorHits":0,"classes":[{"name":"HOME","predicted":134,"actual":81,"correct":70,"recall":0.8641975308641975,"precision":0.5223880597014925,"share":0.7282608695652174,"brier":0.22484851175829917,"meanProbability":0.4563053439450415,"meanProbabilityMinusFrequency":0.016087952640693685,"ece":0.04609094286619614,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.2,"upper":0.3,"count":10,"meanProbability":0.27023300094125535,"observedFrequency":0.1,"lowSample":true},{"lower":0.3,"upper":0.4,"count":54,"meanProbability":0.36468176699668,"observedFrequency":0.3333333333333333,"lowSample":false},{"lower":0.4,"upper":0.5,"count":56,"meanProbability":0.4522377314178675,"observedFrequency":0.4107142857142857,"lowSample":false},{"lower":0.5,"upper":0.6,"count":49,"meanProbability":0.5461779071603686,"observedFrequency":0.5510204081632653,"lowSample":false},{"lower":0.6,"upper":0.7,"count":14,"meanProbability":0.6269210093788251,"observedFrequency":0.7857142857142857,"lowSample":true},{"lower":0.7,"upper":0.8,"count":1,"meanProbability":0.7001133170921487,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":46,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.18684972390593996,"meanProbability":0.22613892239963493,"meanProbabilityMinusFrequency":-0.023861077600365068,"ece":0.04157118480747342,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":19,"meanProbability":0.19101736121336668,"observedFrequency":0.10526315789473684,"lowSample":true},{"lower":0.2,"upper":0.3,"count":165,"meanProbability":0.23018322338472036,"observedFrequency":0.26666666666666666,"lowSample":false},{"lower":0.3,"upper":0.4,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":50,"actual":57,"correct":24,"recall":0.42105263157894735,"precision":0.48,"share":0.2717391304347826,"brier":0.19409804179565568,"meanProbability":0.3175557336553237,"meanProbabilityMinusFrequency":0.0077731249596715,"ece":0.05755351402809117,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":15,"meanProbability":0.1749343243798892,"observedFrequency":0.2,"lowSample":true},{"lower":0.2,"upper":0.3,"count":68,"meanProbability":0.25014780568932604,"observedFrequency":0.16176470588235295,"lowSample":false},{"lower":0.3,"upper":0.4,"count":68,"meanProbability":0.35399551056337386,"observedFrequency":0.38235294117647056,"lowSample":false},{"lower":0.4,"upper":0.5,"count":27,"meanProbability":0.431245713935692,"observedFrequency":0.4444444444444444,"lowSample":false},{"lower":0.5,"upper":0.6,"count":6,"meanProbability":0.5134767242389915,"observedFrequency":0.8333333333333334,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[70,0,11],[31,0,15],[33,0,24]],"reasonCounts":{}},"delta":{"logLoss":-0.0920383060008787,"brier":-0.06480649447107711}}.

Diagnostics: {"availablePredictions":184,"inputPredictions":184,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":368,"pearson":0.10364115497497052,"spearman":0.134462259798525},"unresidualizedComposite":{"n":368,"pearson":0.6223016055904714,"spearman":0.6275339684447668}},{"h2Column":2,"representation":{"n":368,"pearson":-0.07411114941837692,"spearman":-0.0661473277450462},"unresidualizedComposite":{"n":368,"pearson":-0.5330472202019462,"spearman":-0.49673005259847647}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":368,"pearson":0.16402513117145298,"spearman":0.036029619270247906},"unresidualizedComposite":{"n":368,"pearson":0.5522429593215502,"spearman":0.45199293421674885}},{"h2Column":2,"representation":{"n":368,"pearson":-0.07514040044878256,"spearman":0.005018815441086528},"unresidualizedComposite":{"n":368,"pearson":-0.44765831772503883,"spearman":-0.3824169775283821}}]}],"crossRepresentation":{"n":368,"pearson":-0.5304717070777754,"spearman":-0.5146121861645107},"crossComposite":{"n":368,"pearson":-0.00853938094549883,"spearman":-0.024848229171783483},"contribution":{"n":368,"mean":0.000058508754338475374,"p10":-0.02844227843000073,"p25":-0.014463095720657421,"median":0.001154227757970874,"p75":0.014856534518527587,"p90":0.02635338954427057,"maxAbsolute":0.055485206310014114},"rateRatio":{"n":368,"mean":1.0002853956772995,"p10":0.9719583974917942,"p25":0.9856409924317238,"median":1.0011548944578759,"p75":1.0149674413852163,"p90":1.0267037787681144,"maxAbsolute":1.0570533792367616}}.

## 39 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: be4c7b753159177883fed17c39033466739ea10a9716c6f2a95f9e18de83605b.

Fit census: {"total":188,"used":83,"pass":105,"fail":0,"invalid":0}; beta: [-0.6579268763712257,-0.6696121375685092]; map: null.

Full: {"targets":184,"predicted":184,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=184; COMPLETE.

V1: LL=0.9544332890292452; Brier=0.5622254851663714; accuracy=0.5869565217391305.

- HOME: recall=0.9259259259259259; precision=0.5905511811023622; share=0.6902173913043478; OVR Brier=0.19811010771136567; ECE=0.056285037942863436.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18673768780765695; ECE=0.035368338560660455.
- AWAY: recall=0.5789473684210527; precision=0.5789473684210527; share=0.30978260869565216; OVR Brier=0.177377689647348; ECE=0.05188446182481947.

H2: LL=0.9256994925214426; Brier=0.5437435183165971; accuracy=0.5815217391304348.

- HOME: recall=0.8518518518518519; precision=0.6; share=0.625; OVR Brier=0.19178619319943865; ECE=0.060210596913282365.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.18442792083670173; ECE=0.04092424247649979.
- AWAY: recall=0.6666666666666666; precision=0.5507246376811594; share=0.375; OVR Brier=0.1675294042804563; ECE=0.08292069713365413.

candidate: LL=1.0118731913708208; Brier=0.6046316411197838; accuracy=0.5271739130434783.

- HOME: recall=0.8395061728395061; precision=0.5230769230769231; share=0.7065217391304348; OVR Brier=0.22528747548907546; ECE=0.05552241235063306.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.1872178645510765; ECE=0.02331832371439355.
- AWAY: recall=0.5087719298245614; precision=0.5370370370370371; share=0.29347826086956524; OVR Brier=0.19212630107963183; ECE=0.07004203278404368.

Delta: {"v1":{"logLoss":0.05743990234157559,"brier":0.04240615595341246},"h2":{"logLoss":0.0861736988493782,"brier":0.060888122803186784}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":184,"predicted":184,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":1.0136597162986631,"brier":0.6057962774598954,"accuracy":0.5108695652173914,"floorHits":0,"classes":[{"name":"HOME","predicted":134,"actual":81,"correct":70,"recall":0.8641975308641975,"precision":0.5223880597014925,"share":0.7282608695652174,"brier":0.22484851175829917,"meanProbability":0.4563053439450415,"meanProbabilityMinusFrequency":0.016087952640693685,"ece":0.04609094286619614,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.2,"upper":0.3,"count":10,"meanProbability":0.27023300094125535,"observedFrequency":0.1,"lowSample":true},{"lower":0.3,"upper":0.4,"count":54,"meanProbability":0.36468176699668,"observedFrequency":0.3333333333333333,"lowSample":false},{"lower":0.4,"upper":0.5,"count":56,"meanProbability":0.4522377314178675,"observedFrequency":0.4107142857142857,"lowSample":false},{"lower":0.5,"upper":0.6,"count":49,"meanProbability":0.5461779071603686,"observedFrequency":0.5510204081632653,"lowSample":false},{"lower":0.6,"upper":0.7,"count":14,"meanProbability":0.6269210093788251,"observedFrequency":0.7857142857142857,"lowSample":true},{"lower":0.7,"upper":0.8,"count":1,"meanProbability":0.7001133170921487,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":46,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.18684972390593996,"meanProbability":0.22613892239963493,"meanProbabilityMinusFrequency":-0.023861077600365068,"ece":0.04157118480747342,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":19,"meanProbability":0.19101736121336668,"observedFrequency":0.10526315789473684,"lowSample":true},{"lower":0.2,"upper":0.3,"count":165,"meanProbability":0.23018322338472036,"observedFrequency":0.26666666666666666,"lowSample":false},{"lower":0.3,"upper":0.4,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":50,"actual":57,"correct":24,"recall":0.42105263157894735,"precision":0.48,"share":0.2717391304347826,"brier":0.19409804179565568,"meanProbability":0.3175557336553237,"meanProbabilityMinusFrequency":0.0077731249596715,"ece":0.05755351402809117,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":15,"meanProbability":0.1749343243798892,"observedFrequency":0.2,"lowSample":true},{"lower":0.2,"upper":0.3,"count":68,"meanProbability":0.25014780568932604,"observedFrequency":0.16176470588235295,"lowSample":false},{"lower":0.3,"upper":0.4,"count":68,"meanProbability":0.35399551056337386,"observedFrequency":0.38235294117647056,"lowSample":false},{"lower":0.4,"upper":0.5,"count":27,"meanProbability":0.431245713935692,"observedFrequency":0.4444444444444444,"lowSample":false},{"lower":0.5,"upper":0.6,"count":6,"meanProbability":0.5134767242389915,"observedFrequency":0.8333333333333334,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[70,0,11],[31,0,15],[33,0,24]],"reasonCounts":{}},"delta":{"logLoss":-0.00178652492784237,"brier":-0.0011646363401115467}}.

Diagnostics: {"availablePredictions":184,"inputPredictions":184,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":368,"pearson":0.6223016055904714,"spearman":0.6275339684447668},"unresidualizedComposite":{"n":368,"pearson":0.6223016055904714,"spearman":0.6275339684447668}},{"h2Column":2,"representation":{"n":368,"pearson":-0.5330472202019462,"spearman":-0.49673005259847647},"unresidualizedComposite":{"n":368,"pearson":-0.5330472202019462,"spearman":-0.49673005259847647}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":368,"pearson":0.5522429593215502,"spearman":0.45199293421674885},"unresidualizedComposite":{"n":368,"pearson":0.5522429593215502,"spearman":0.45199293421674885}},{"h2Column":2,"representation":{"n":368,"pearson":-0.44765831772503883,"spearman":-0.3824169775283821},"unresidualizedComposite":{"n":368,"pearson":-0.44765831772503883,"spearman":-0.3824169775283821}}]}],"crossRepresentation":{"n":368,"pearson":-0.00853938094549883,"spearman":-0.024848229171783483},"crossComposite":{"n":368,"pearson":-0.00853938094549883,"spearman":-0.024848229171783483},"contribution":{"n":368,"mean":0.029969719151720645,"p10":-0.21220876886692505,"p25":-0.11592078482932613,"median":0.005044293327618679,"p75":0.1526001581793553,"p90":0.2953258543003079,"maxAbsolute":0.7339601291875921},"rateRatio":{"n":368,"mean":1.0524567385446488,"p10":0.8087962822270365,"p25":0.8905459330064324,"median":1.005057273942044,"p75":1.164859230663709,"p90":1.3435779264033534,"maxAbsolute":2.0833144878089698}}.

## 140 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: c4fd2aafd06ac4053a3222fd052d6309bd93de1b87ef34a9cf0631d1c5476d1d; map parameter hash: f505456835aaa5e7c733befd0d62ec12f0cc9b3bb9c95231277745992ba435ff; beta hash: afc457f845504f5b1411187027a3132ec8fe67454e4fee2767c907ce0cd90e68.

Fit census: {"total":180,"used":69,"pass":111,"fail":0,"invalid":0}; beta: [0.2218286938325005,-0.18861302764908436]; map: [[-0.08965793222700168,0.2574273601832427,0.024403168817394884],[-0.04449026588315577,0.14067855570618784,-0.04726065422648521]].

Full: {"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=200; COMPLETE.

V1: LL=1.0029849318635575; Brier=0.6003455190322573; accuracy=0.515.

- HOME: recall=0.8068181818181818; precision=0.5298507462686567; share=0.67; OVR Brier=0.2182841616003337; ECE=0.055681041588980934.
- DRAW: recall=0; precision=0; share=0.005; OVR Brier=0.18899234816402213; ECE=0.03386706766402259.
- AWAY: recall=0.5161290322580645; precision=0.49230769230769234; share=0.325; OVR Brier=0.19306900926790108; ECE=0.04950822266065052.

H2: LL=0.9909957614797095; Brier=0.5927407060677549; accuracy=0.565.

- HOME: recall=0.8295454545454546; precision=0.5615384615384615; share=0.65; OVR Brier=0.21461264995785598; ECE=0.05995174170711019.
- DRAW: recall=0.04; precision=0.6666666666666666; share=0.015; OVR Brier=0.18792946145934708; ECE=0.039639783408511924.
- AWAY: recall=0.6129032258064516; precision=0.5671641791044776; share=0.335; OVR Brier=0.19019859465055158; ECE=0.08640724106343957.

candidate: LL=0.9842820957514232; Brier=0.5879776141290785; accuracy=0.56.

- HOME: recall=0.8295454545454546; precision=0.5615384615384615; share=0.65; OVR Brier=0.21247806418450715; ECE=0.0414681174527959.
- DRAW: recall=0.04; precision=0.6666666666666666; share=0.015; OVR Brier=0.18706096097081087; ECE=0.06476294882684575.
- AWAY: recall=0.5967741935483871; precision=0.5522388059701493; share=0.335; OVR Brier=0.18843858897375917; ECE=0.08780574421813866.

Delta: {"v1":{"logLoss":-0.018702836112134302,"brier":-0.01236790490317885},"h2":{"logLoss":-0.006713665728286244,"brier":-0.0047630919386764115}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9901800576616822,"brier":0.5926207233513727,"accuracy":0.565,"floorHits":0,"classes":[{"name":"HOME","predicted":132,"actual":88,"correct":74,"recall":0.8409090909090909,"precision":0.5606060606060606,"share":0.66,"brier":0.2153362792682072,"meanProbability":0.4379025390865186,"meanProbabilityMinusFrequency":-0.0020974609134813706,"ece":0.07490632695997554,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":17,"meanProbability":0.16959295401009983,"observedFrequency":0.11764705882352941,"lowSample":true},{"lower":0.2,"upper":0.3,"count":26,"meanProbability":0.26895951941634244,"observedFrequency":0.3076923076923077,"lowSample":false},{"lower":0.3,"upper":0.4,"count":40,"meanProbability":0.34956352705829863,"observedFrequency":0.3,"lowSample":false},{"lower":0.4,"upper":0.5,"count":51,"meanProbability":0.4475498948217663,"observedFrequency":0.4117647058823529,"lowSample":false},{"lower":0.5,"upper":0.6,"count":32,"meanProbability":0.5514878176937735,"observedFrequency":0.75,"lowSample":false},{"lower":0.6,"upper":0.7,"count":19,"meanProbability":0.6356023537857863,"observedFrequency":0.5263157894736842,"lowSample":true},{"lower":0.7,"upper":0.8,"count":13,"meanProbability":0.7318289189465992,"observedFrequency":0.6923076923076923,"lowSample":true},{"lower":0.8,"upper":0.9,"count":2,"meanProbability":0.8295317708143453,"observedFrequency":1,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":3,"actual":50,"correct":2,"recall":0.04,"precision":0.6666666666666666,"share":0.015,"brier":0.18716615889540292,"meanProbability":0.2501407097084494,"meanProbabilityMinusFrequency":0.0001407097084494424,"ece":0.054661463080297054,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":29,"meanProbability":0.17148803287234646,"observedFrequency":0.27586206896551724,"lowSample":false},{"lower":0.2,"upper":0.3,"count":141,"meanProbability":0.25163274665868546,"observedFrequency":0.2127659574468085,"lowSample":false},{"lower":0.3,"upper":0.4,"count":30,"meanProbability":0.3191590569839063,"observedFrequency":0.4,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":65,"actual":62,"correct":37,"recall":0.5967741935483871,"precision":0.5692307692307692,"share":0.325,"brier":0.19011828518776205,"meanProbability":0.31195675120503163,"meanProbabilityMinusFrequency":0.001956751205031608,"ece":0.08881480500849671,"calibration":[{"lower":0,"upper":0.1,"count":7,"meanProbability":0.07547668872601046,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":37,"meanProbability":0.15466843980902717,"observedFrequency":0.1891891891891892,"lowSample":false},{"lower":0.2,"upper":0.3,"count":62,"meanProbability":0.2500919646564885,"observedFrequency":0.16129032258064516,"lowSample":false},{"lower":0.3,"upper":0.4,"count":46,"meanProbability":0.34718842533114375,"observedFrequency":0.3695652173913043,"lowSample":false},{"lower":0.4,"upper":0.5,"count":26,"meanProbability":0.44695364544180277,"observedFrequency":0.6923076923076923,"lowSample":false},{"lower":0.5,"upper":0.6,"count":12,"meanProbability":0.5489963835781503,"observedFrequency":0.4166666666666667,"lowSample":true},{"lower":0.6,"upper":0.7,"count":8,"meanProbability":0.6252960284246762,"observedFrequency":0.5,"lowSample":true},{"lower":0.7,"upper":0.8,"count":2,"meanProbability":0.726396080616631,"observedFrequency":0.5,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[74,0,14],[34,2,14],[24,1,37]],"reasonCounts":{}},"delta":{"logLoss":-0.005897961910258931,"brier":-0.004643109222294273}}.

Diagnostics: {"availablePredictions":200,"inputPredictions":200,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.13143541907198353,"spearman":0.10375208595053718},"unresidualizedComposite":{"n":400,"pearson":0.607281408745654,"spearman":0.5763947274670467}},{"h2Column":2,"representation":{"n":400,"pearson":-0.016518717443129903,"spearman":0.01941743385896162},"unresidualizedComposite":{"n":400,"pearson":-0.17098481765247017,"spearman":-0.09535822098888118}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.06491735670635171,"spearman":0.04139650872817955},"unresidualizedComposite":{"n":400,"pearson":0.4845828272340575,"spearman":0.4197950612191326}},{"h2Column":2,"representation":{"n":400,"pearson":-0.027775572618108358,"spearman":-0.04741585884911781},"unresidualizedComposite":{"n":400,"pearson":-0.30106603934664045,"spearman":-0.2854332214576341}}]}],"crossRepresentation":{"n":400,"pearson":-0.4311521039417018,"spearman":-0.39836236476477976},"crossComposite":{"n":400,"pearson":-0.019580961453241473,"spearman":-0.03784598653741586},"contribution":{"n":400,"mean":-0.00005302113748736803,"p10":-0.05965723240467193,"p25":-0.030725952360860287,"median":0.0006118893633889052,"p75":0.029244189376108627,"p90":0.0648808114076348,"maxAbsolute":0.14376955907817834},"rateRatio":{"n":400,"mean":1.0010730715210645,"p10":0.9420873953127605,"p25":0.9697412952600507,"median":1.0006120768796491,"p75":1.0296760052472231,"p90":1.0670318390906164,"maxAbsolute":1.1546180066279088}}.

## 140 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: f8cb3edd073cef336d6a87a06f2b200bc560b6784a39ce667d988c3efb143ab6.

Fit census: {"total":180,"used":74,"pass":106,"fail":0,"invalid":0}; beta: [0.0004510895478701145,-0.3142629889575861]; map: null.

Full: {"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=200; COMPLETE.

V1: LL=1.0029849318635575; Brier=0.6003455190322573; accuracy=0.515.

- HOME: recall=0.8068181818181818; precision=0.5298507462686567; share=0.67; OVR Brier=0.2182841616003337; ECE=0.055681041588980934.
- DRAW: recall=0; precision=0; share=0.005; OVR Brier=0.18899234816402213; ECE=0.03386706766402259.
- AWAY: recall=0.5161290322580645; precision=0.49230769230769234; share=0.325; OVR Brier=0.19306900926790108; ECE=0.04950822266065052.

H2: LL=0.9909957614797095; Brier=0.5927407060677549; accuracy=0.565.

- HOME: recall=0.8295454545454546; precision=0.5615384615384615; share=0.65; OVR Brier=0.21461264995785598; ECE=0.05995174170711019.
- DRAW: recall=0.04; precision=0.6666666666666666; share=0.015; OVR Brier=0.18792946145934708; ECE=0.039639783408511924.
- AWAY: recall=0.6129032258064516; precision=0.5671641791044776; share=0.335; OVR Brier=0.19019859465055158; ECE=0.08640724106343957.

candidate: LL=0.9916329531718531; Brier=0.5933566821638305; accuracy=0.56.

- HOME: recall=0.8295454545454546; precision=0.5572519083969466; share=0.655; OVR Brier=0.21519361754599764; ECE=0.035632897838345105.
- DRAW: recall=0.04; precision=0.6666666666666666; share=0.015; OVR Brier=0.1871957176125694; ECE=0.0576534354468335.
- AWAY: recall=0.5967741935483871; precision=0.5606060606060606; share=0.33; OVR Brier=0.19096734700526405; ECE=0.0908480845043759.

Delta: {"v1":{"logLoss":-0.011351978691704456,"brier":-0.006988836868426773},"h2":{"logLoss":0.0006371916921436016,"brier":0.0006159760960756655}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9901800576616822,"brier":0.5926207233513727,"accuracy":0.565,"floorHits":0,"classes":[{"name":"HOME","predicted":132,"actual":88,"correct":74,"recall":0.8409090909090909,"precision":0.5606060606060606,"share":0.66,"brier":0.2153362792682072,"meanProbability":0.4379025390865186,"meanProbabilityMinusFrequency":-0.0020974609134813706,"ece":0.07490632695997554,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":17,"meanProbability":0.16959295401009983,"observedFrequency":0.11764705882352941,"lowSample":true},{"lower":0.2,"upper":0.3,"count":26,"meanProbability":0.26895951941634244,"observedFrequency":0.3076923076923077,"lowSample":false},{"lower":0.3,"upper":0.4,"count":40,"meanProbability":0.34956352705829863,"observedFrequency":0.3,"lowSample":false},{"lower":0.4,"upper":0.5,"count":51,"meanProbability":0.4475498948217663,"observedFrequency":0.4117647058823529,"lowSample":false},{"lower":0.5,"upper":0.6,"count":32,"meanProbability":0.5514878176937735,"observedFrequency":0.75,"lowSample":false},{"lower":0.6,"upper":0.7,"count":19,"meanProbability":0.6356023537857863,"observedFrequency":0.5263157894736842,"lowSample":true},{"lower":0.7,"upper":0.8,"count":13,"meanProbability":0.7318289189465992,"observedFrequency":0.6923076923076923,"lowSample":true},{"lower":0.8,"upper":0.9,"count":2,"meanProbability":0.8295317708143453,"observedFrequency":1,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":3,"actual":50,"correct":2,"recall":0.04,"precision":0.6666666666666666,"share":0.015,"brier":0.18716615889540292,"meanProbability":0.2501407097084494,"meanProbabilityMinusFrequency":0.0001407097084494424,"ece":0.054661463080297054,"calibration":[{"lower":0,"upper":0.1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.1,"upper":0.2,"count":29,"meanProbability":0.17148803287234646,"observedFrequency":0.27586206896551724,"lowSample":false},{"lower":0.2,"upper":0.3,"count":141,"meanProbability":0.25163274665868546,"observedFrequency":0.2127659574468085,"lowSample":false},{"lower":0.3,"upper":0.4,"count":30,"meanProbability":0.3191590569839063,"observedFrequency":0.4,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":65,"actual":62,"correct":37,"recall":0.5967741935483871,"precision":0.5692307692307692,"share":0.325,"brier":0.19011828518776205,"meanProbability":0.31195675120503163,"meanProbabilityMinusFrequency":0.001956751205031608,"ece":0.08881480500849671,"calibration":[{"lower":0,"upper":0.1,"count":7,"meanProbability":0.07547668872601046,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":37,"meanProbability":0.15466843980902717,"observedFrequency":0.1891891891891892,"lowSample":false},{"lower":0.2,"upper":0.3,"count":62,"meanProbability":0.2500919646564885,"observedFrequency":0.16129032258064516,"lowSample":false},{"lower":0.3,"upper":0.4,"count":46,"meanProbability":0.34718842533114375,"observedFrequency":0.3695652173913043,"lowSample":false},{"lower":0.4,"upper":0.5,"count":26,"meanProbability":0.44695364544180277,"observedFrequency":0.6923076923076923,"lowSample":false},{"lower":0.5,"upper":0.6,"count":12,"meanProbability":0.5489963835781503,"observedFrequency":0.4166666666666667,"lowSample":true},{"lower":0.6,"upper":0.7,"count":8,"meanProbability":0.6252960284246762,"observedFrequency":0.5,"lowSample":true},{"lower":0.7,"upper":0.8,"count":2,"meanProbability":0.726396080616631,"observedFrequency":0.5,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[74,0,14],[34,2,14],[24,1,37]],"reasonCounts":{}},"delta":{"logLoss":0.0014528955101709151,"brier":0.0007359588124578043}}.

Diagnostics: {"availablePredictions":200,"inputPredictions":200,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.607281408745654,"spearman":0.5763947274670467},"unresidualizedComposite":{"n":400,"pearson":0.607281408745654,"spearman":0.5763947274670467}},{"h2Column":2,"representation":{"n":400,"pearson":-0.17098481765247017,"spearman":-0.09535822098888118},"unresidualizedComposite":{"n":400,"pearson":-0.17098481765247017,"spearman":-0.09535822098888118}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.4845828272340575,"spearman":0.4197950612191326},"unresidualizedComposite":{"n":400,"pearson":0.4845828272340575,"spearman":0.4197950612191326}},{"h2Column":2,"representation":{"n":400,"pearson":-0.30106603934664045,"spearman":-0.2854332214576341},"unresidualizedComposite":{"n":400,"pearson":-0.30106603934664045,"spearman":-0.2854332214576341}}]}],"crossRepresentation":{"n":400,"pearson":-0.019580961453241473,"spearman":-0.03784598653741586},"crossComposite":{"n":400,"pearson":-0.019580961453241473,"spearman":-0.03784598653741586},"contribution":{"n":400,"mean":0.003369455767854529,"p10":-0.062327561813538296,"p25":-0.02341976583199823,"median":0.0045455984759400075,"p75":0.03094641930421489,"p90":0.05945467853351456,"maxAbsolute":0.10579990343854583},"rateRatio":{"n":400,"mean":1.0043458129451983,"p10":0.9395751049697135,"p25":0.9768523513717874,"median":1.0045559454242379,"p75":1.0314302396676165,"p90":1.0612576765534845,"maxAbsolute":1.1115994270285225}}.

## 135 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: 7406b9403810a775a827163b6f85b6eed4c58194c85191af0231cb23a785668c; map parameter hash: daf0e39970a76dc77689bf789a2f2c09a60607448b8de5cf28b598eb7e1ad441; beta hash: 69da94b60f380958efb3fd05d84637b0ad9e4a8568792a084b0665fd1ec0be06.

Fit census: {"total":174,"used":55,"pass":119,"fail":0,"invalid":0}; beta: [-0.501975445802791,0.3336657164233968]; map: [[-0.05209400193553844,0.21934025628840326,-0.020434659819115925],[-0.040050625224656314,0.1674030781218197,-0.08954009324315655]].

Full: {"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=200; COMPLETE.

V1: LL=1.0172629955609198; Brier=0.6133088439423379; accuracy=0.475.

- HOME: recall=0.8026315789473685; precision=0.45185185185185184; share=0.675; OVR Brier=0.21552679525265045; ECE=0.11696539609463523.
- DRAW: recall=0.015873015873015872; precision=1; share=0.005; OVR Brier=0.22001882228195538; ECE=0.07321294031293052.
- AWAY: recall=0.5409836065573771; precision=0.515625; share=0.32; OVR Brier=0.17776322640773198; ECE=0.08497896763636557.

H2: LL=0.9964182317593141; Brier=0.5979570687416925; accuracy=0.5.

- HOME: recall=0.7894736842105263; precision=0.47244094488188976; share=0.635; OVR Brier=0.2092217880886012; ECE=0.1152560406598077.
- DRAW: recall=0; precision=0; share=0.005; OVR Brier=0.22115403081286433; ECE=0.07199518231854103.
- AWAY: recall=0.6557377049180327; precision=0.5555555555555556; share=0.36; OVR Brier=0.16758124984022693; ECE=0.08679005894064509.

candidate: LL=0.9901011823244855; Brier=0.5940444568310588; accuracy=0.51.

- HOME: recall=0.8157894736842105; precision=0.4806201550387597; share=0.645; OVR Brier=0.2074197618978099; ECE=0.1021421917795338.
- DRAW: recall=0.015873015873015872; precision=1; share=0.005; OVR Brier=0.2203980908091891; ECE=0.07312270730383413.
- AWAY: recall=0.639344262295082; precision=0.5571428571428572; share=0.35; OVR Brier=0.16622660412405924; ECE=0.1224935745364531.

Delta: {"v1":{"logLoss":-0.027161813236434296,"brier":-0.01926438711127909},"h2":{"logLoss":-0.006317049434828581,"brier":-0.003912611910633745}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9933161789130327,"brier":0.5968471504833173,"accuracy":0.51,"floorHits":0,"classes":[{"name":"HOME","predicted":130,"actual":76,"correct":62,"recall":0.8157894736842105,"precision":0.47692307692307695,"share":0.65,"brier":0.2083986138717841,"meanProbability":0.4396579720692384,"meanProbabilityMinusFrequency":0.05965797206923838,"ece":0.1025852449534169,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.07380543725372203,"observedFrequency":1,"lowSample":true},{"lower":0.1,"upper":0.2,"count":15,"meanProbability":0.15140505723704084,"observedFrequency":0.06666666666666667,"lowSample":true},{"lower":0.2,"upper":0.3,"count":41,"meanProbability":0.2524774124314394,"observedFrequency":0.24390243902439024,"lowSample":false},{"lower":0.3,"upper":0.4,"count":30,"meanProbability":0.3601183519338499,"observedFrequency":0.13333333333333333,"lowSample":false},{"lower":0.4,"upper":0.5,"count":36,"meanProbability":0.44711557930802176,"observedFrequency":0.3611111111111111,"lowSample":false},{"lower":0.5,"upper":0.6,"count":34,"meanProbability":0.5395170991068817,"observedFrequency":0.5882352941176471,"lowSample":false},{"lower":0.6,"upper":0.7,"count":25,"meanProbability":0.6499230625434899,"observedFrequency":0.52,"lowSample":false},{"lower":0.7,"upper":0.8,"count":14,"meanProbability":0.742089418044201,"observedFrequency":0.8571428571428571,"lowSample":true},{"lower":0.8,"upper":0.9,"count":3,"meanProbability":0.8179613191097884,"observedFrequency":0.3333333333333333,"lowSample":true},{"lower":0.9,"upper":1,"count":1,"meanProbability":0.9006340520756309,"observedFrequency":1,"lowSample":true}]},{"name":"DRAW","predicted":2,"actual":63,"correct":2,"recall":0.031746031746031744,"precision":1,"share":0.01,"brier":0.21976818273054505,"meanProbability":0.24646109550340892,"meanProbabilityMinusFrequency":-0.06853890449659109,"ece":0.0737670873595965,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.07388838987060768,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":33,"meanProbability":0.16924093176306224,"observedFrequency":0.2727272727272727,"lowSample":false},{"lower":0.2,"upper":0.3,"count":143,"meanProbability":0.25303811235105017,"observedFrequency":0.32867132867132864,"lowSample":false},{"lower":0.3,"upper":0.4,"count":23,"meanProbability":0.32386651723608334,"observedFrequency":0.30434782608695654,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":68,"actual":61,"correct":38,"recall":0.6229508196721312,"precision":0.5588235294117647,"share":0.34,"brier":0.16868035388098845,"meanProbability":0.31388093242735304,"meanProbabilityMinusFrequency":0.008880932427353017,"ece":0.09244382976507882,"calibration":[{"lower":0,"upper":0.1,"count":11,"meanProbability":0.06566856590871516,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":43,"meanProbability":0.14554650117994053,"observedFrequency":0.046511627906976744,"lowSample":false},{"lower":0.2,"upper":0.3,"count":50,"meanProbability":0.24864682401702423,"observedFrequency":0.16,"lowSample":false},{"lower":0.3,"upper":0.4,"count":40,"meanProbability":0.34551008797996435,"observedFrequency":0.475,"lowSample":false},{"lower":0.4,"upper":0.5,"count":27,"meanProbability":0.4572070793168142,"observedFrequency":0.5555555555555556,"lowSample":false},{"lower":0.5,"upper":0.6,"count":17,"meanProbability":0.541733628901836,"observedFrequency":0.5294117647058824,"lowSample":true},{"lower":0.6,"upper":0.7,"count":10,"meanProbability":0.6478715605474851,"observedFrequency":0.7,"lowSample":true},{"lower":0.7,"upper":0.8,"count":2,"meanProbability":0.7549047756637222,"observedFrequency":0.5,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[62,0,14],[45,2,16],[23,0,38]],"reasonCounts":{}},"delta":{"logLoss":-0.003214996588547181,"brier":-0.002802693652258492}}.

Diagnostics: {"availablePredictions":200,"inputPredictions":200,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.01943687565701764,"spearman":0.035180282376764856},"unresidualizedComposite":{"n":400,"pearson":0.5719108558815561,"spearman":0.575047719048244}},{"h2Column":2,"representation":{"n":400,"pearson":-0.018195966129865373,"spearman":0.0007365046031537697},"unresidualizedComposite":{"n":400,"pearson":-0.3988839329885068,"spearman":-0.3495246845292783}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.1268876486604848,"spearman":0.15103369396058725},"unresidualizedComposite":{"n":400,"pearson":0.6000861019652085,"spearman":0.5668987306170663}},{"h2Column":2,"representation":{"n":400,"pearson":0.021523198760396368,"spearman":-0.01119306995668723},"unresidualizedComposite":{"n":400,"pearson":-0.4172078572344892,"spearman":-0.3879399246245289}}]}],"crossRepresentation":{"n":400,"pearson":-0.5080410322509253,"spearman":-0.5021643260270376},"crossComposite":{"n":400,"pearson":0.0059171478873002665,"spearman":0.004731029568934806},"contribution":{"n":400,"mean":0.0018156663746499446,"p10":-0.13793481127704035,"p25":-0.0690564816050287,"median":0.0014298802838665376,"p75":0.0780589389446954,"p90":0.13335824873088423,"maxAbsolute":0.2934538554964533},"rateRatio":{"n":400,"mean":1.007252770484006,"p10":0.8711556967593592,"p25":0.9332741401286078,"median":1.0014312297403434,"p75":1.0811863908396901,"p90":1.1426594534215826,"maxAbsolute":1.3054086542510017}}.

## 135 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: 959b1890980c24730513603bbd1f7ca73ca6d22e6491a65adbb1d5cfded1d245.

Fit census: {"total":174,"used":68,"pass":106,"fail":0,"invalid":0}; beta: [-0.6061327483745486,0.3121538733567965]; map: null.

Full: {"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=200; COMPLETE.

V1: LL=1.0172629955609198; Brier=0.6133088439423379; accuracy=0.475.

- HOME: recall=0.8026315789473685; precision=0.45185185185185184; share=0.675; OVR Brier=0.21552679525265045; ECE=0.11696539609463523.
- DRAW: recall=0.015873015873015872; precision=1; share=0.005; OVR Brier=0.22001882228195538; ECE=0.07321294031293052.
- AWAY: recall=0.5409836065573771; precision=0.515625; share=0.32; OVR Brier=0.17776322640773198; ECE=0.08497896763636557.

H2: LL=0.9964182317593141; Brier=0.5979570687416925; accuracy=0.5.

- HOME: recall=0.7894736842105263; precision=0.47244094488188976; share=0.635; OVR Brier=0.2092217880886012; ECE=0.1152560406598077.
- DRAW: recall=0; precision=0; share=0.005; OVR Brier=0.22115403081286433; ECE=0.07199518231854103.
- AWAY: recall=0.6557377049180327; precision=0.5555555555555556; share=0.36; OVR Brier=0.16758124984022693; ECE=0.08679005894064509.

candidate: LL=0.990676724086375; Brier=0.5943685271625517; accuracy=0.505.

- HOME: recall=0.8157894736842105; precision=0.47692307692307695; share=0.65; OVR Brier=0.20707407889858506; ECE=0.09334309827883468.
- DRAW: recall=0.015873015873015872; precision=1; share=0.005; OVR Brier=0.21980356136064372; ECE=0.07005837839834576.
- AWAY: recall=0.6229508196721312; precision=0.5507246376811594; share=0.345; OVR Brier=0.16749088690332273; ECE=0.11284003202318328.

Delta: {"v1":{"logLoss":-0.026586271474544843,"brier":-0.018940316779786137},"h2":{"logLoss":-0.005741507672939128,"brier":-0.0035885415791407915}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":200,"predicted":200,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9933161789130327,"brier":0.5968471504833173,"accuracy":0.51,"floorHits":0,"classes":[{"name":"HOME","predicted":130,"actual":76,"correct":62,"recall":0.8157894736842105,"precision":0.47692307692307695,"share":0.65,"brier":0.2083986138717841,"meanProbability":0.4396579720692384,"meanProbabilityMinusFrequency":0.05965797206923838,"ece":0.1025852449534169,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.07380543725372203,"observedFrequency":1,"lowSample":true},{"lower":0.1,"upper":0.2,"count":15,"meanProbability":0.15140505723704084,"observedFrequency":0.06666666666666667,"lowSample":true},{"lower":0.2,"upper":0.3,"count":41,"meanProbability":0.2524774124314394,"observedFrequency":0.24390243902439024,"lowSample":false},{"lower":0.3,"upper":0.4,"count":30,"meanProbability":0.3601183519338499,"observedFrequency":0.13333333333333333,"lowSample":false},{"lower":0.4,"upper":0.5,"count":36,"meanProbability":0.44711557930802176,"observedFrequency":0.3611111111111111,"lowSample":false},{"lower":0.5,"upper":0.6,"count":34,"meanProbability":0.5395170991068817,"observedFrequency":0.5882352941176471,"lowSample":false},{"lower":0.6,"upper":0.7,"count":25,"meanProbability":0.6499230625434899,"observedFrequency":0.52,"lowSample":false},{"lower":0.7,"upper":0.8,"count":14,"meanProbability":0.742089418044201,"observedFrequency":0.8571428571428571,"lowSample":true},{"lower":0.8,"upper":0.9,"count":3,"meanProbability":0.8179613191097884,"observedFrequency":0.3333333333333333,"lowSample":true},{"lower":0.9,"upper":1,"count":1,"meanProbability":0.9006340520756309,"observedFrequency":1,"lowSample":true}]},{"name":"DRAW","predicted":2,"actual":63,"correct":2,"recall":0.031746031746031744,"precision":1,"share":0.01,"brier":0.21976818273054505,"meanProbability":0.24646109550340892,"meanProbabilityMinusFrequency":-0.06853890449659109,"ece":0.0737670873595965,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.07388838987060768,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":33,"meanProbability":0.16924093176306224,"observedFrequency":0.2727272727272727,"lowSample":false},{"lower":0.2,"upper":0.3,"count":143,"meanProbability":0.25303811235105017,"observedFrequency":0.32867132867132864,"lowSample":false},{"lower":0.3,"upper":0.4,"count":23,"meanProbability":0.32386651723608334,"observedFrequency":0.30434782608695654,"lowSample":false},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":68,"actual":61,"correct":38,"recall":0.6229508196721312,"precision":0.5588235294117647,"share":0.34,"brier":0.16868035388098845,"meanProbability":0.31388093242735304,"meanProbabilityMinusFrequency":0.008880932427353017,"ece":0.09244382976507882,"calibration":[{"lower":0,"upper":0.1,"count":11,"meanProbability":0.06566856590871516,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":43,"meanProbability":0.14554650117994053,"observedFrequency":0.046511627906976744,"lowSample":false},{"lower":0.2,"upper":0.3,"count":50,"meanProbability":0.24864682401702423,"observedFrequency":0.16,"lowSample":false},{"lower":0.3,"upper":0.4,"count":40,"meanProbability":0.34551008797996435,"observedFrequency":0.475,"lowSample":false},{"lower":0.4,"upper":0.5,"count":27,"meanProbability":0.4572070793168142,"observedFrequency":0.5555555555555556,"lowSample":false},{"lower":0.5,"upper":0.6,"count":17,"meanProbability":0.541733628901836,"observedFrequency":0.5294117647058824,"lowSample":true},{"lower":0.6,"upper":0.7,"count":10,"meanProbability":0.6478715605474851,"observedFrequency":0.7,"lowSample":true},{"lower":0.7,"upper":0.8,"count":2,"meanProbability":0.7549047756637222,"observedFrequency":0.5,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[62,0,14],[45,2,16],[23,0,38]],"reasonCounts":{}},"delta":{"logLoss":-0.002639454826657728,"brier":-0.0024786233207655384}}.

Diagnostics: {"availablePredictions":200,"inputPredictions":200,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.5719108558815561,"spearman":0.575047719048244},"unresidualizedComposite":{"n":400,"pearson":0.5719108558815561,"spearman":0.575047719048244}},{"h2Column":2,"representation":{"n":400,"pearson":-0.3988839329885068,"spearman":-0.3495246845292783},"unresidualizedComposite":{"n":400,"pearson":-0.3988839329885068,"spearman":-0.3495246845292783}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":400,"pearson":0.6000861019652085,"spearman":0.5668987306170663},"unresidualizedComposite":{"n":400,"pearson":0.6000861019652085,"spearman":0.5668987306170663}},{"h2Column":2,"representation":{"n":400,"pearson":-0.4172078572344892,"spearman":-0.3879399246245289},"unresidualizedComposite":{"n":400,"pearson":-0.4172078572344892,"spearman":-0.3879399246245289}}]}],"crossRepresentation":{"n":400,"pearson":0.0059171478873002665,"spearman":0.004731029568934806},"crossComposite":{"n":400,"pearson":0.0059171478873002665,"spearman":0.004731029568934806},"contribution":{"n":400,"mean":0.0039783781518353935,"p10":-0.15913794679733392,"p25":-0.07612148585566585,"median":0.01502693862307207,"p75":0.09014939741721491,"p90":0.14948002053798512,"maxAbsolute":0.3207660076052836},"rateRatio":{"n":400,"mean":1.0108670402514275,"p10":0.852878831193583,"p25":0.9267036453971528,"median":1.0151407275290536,"p75":1.094337770472367,"p90":1.1612303967380924,"maxAbsolute":1.3321322740039923}}.

## 78 / V31-R1

Status: PASS; map: FITTED; beta: FITTED.

Map hash: 3247fc3df542d3c9ba2e8c65ae61fbdb2a74d3a505c4d5e49d0f7c08aee71610; map parameter hash: ecaaaa4eff9cbdfe95e8e13d46ae7b7b08aabe4be207343fb7f9dc9dedde778c; beta hash: a6118b520b0e13035e672b5953fa0599ab1587f9265ca9720652152e9831fa05.

Fit census: {"total":143,"used":44,"pass":99,"fail":0,"invalid":0}; beta: [-0.29645916684823115,-0.17472393026937666]; map: [[-0.10329281954959005,0.2117760876855857,-0.05269297331445666],[-0.05753316854753622,0.1611122569830992,-0.09536712049300715]].

Full: {"targets":163,"predicted":163,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=163; COMPLETE.

V1: LL=0.9999639874750744; Brier=0.5994656455520103; accuracy=0.49079754601226994.

- HOME: recall=0.8; precision=0.4642857142857143; share=0.6871165644171779; OVR Brier=0.21956019684999376; ECE=0.11440933719473548.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.2095070291684226; ECE=0.08371306888323332.
- AWAY: recall=0.5490196078431373; precision=0.5490196078431373; share=0.3128834355828221; OVR Brier=0.17039841953359355; ECE=0.07050729245062415.

H2: LL=0.9953262744662597; Brier=0.5960362848127895; accuracy=0.5153374233128835.

- HOME: recall=0.8; precision=0.5; share=0.6380368098159509; OVR Brier=0.21915270514592536; ECE=0.09976354977342541.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.2064708879012026; ECE=0.08186053661483446.
- AWAY: recall=0.6274509803921569; precision=0.5423728813559322; share=0.3619631901840491; OVR Brier=0.17041269176566176; ECE=0.04653918459943597.

candidate: LL=0.9999372100763804; Brier=0.600374905733495; accuracy=0.5153374233128835.

- HOME: recall=0.8; precision=0.5048543689320388; share=0.6319018404907976; OVR Brier=0.22108302188590867; ECE=0.10786233728827013.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.20804228753100537; ECE=0.0793202596050383.
- AWAY: recall=0.6274509803921569; precision=0.5333333333333333; share=0.36809815950920244; OVR Brier=0.17124959631658107; ECE=0.0643006499761886.

Delta: {"v1":{"logLoss":-0.0000267773986940556,"brier":0.000909260181484628},"h2":{"logLoss":0.004610935610120714,"brier":0.0043386209207054716}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":163,"predicted":163,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9957669920871032,"brier":0.5968405994370001,"accuracy":0.5153374233128835,"floorHits":0,"classes":[{"name":"HOME","predicted":103,"actual":65,"correct":52,"recall":0.8,"precision":0.5048543689320388,"share":0.6319018404907976,"brier":0.21751754654087782,"meanProbability":0.4679311667567849,"meanProbabilityMinusFrequency":0.0691581606218156,"ece":0.08788966061073923,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.09792861431414465,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":9,"meanProbability":0.15152566731269082,"observedFrequency":0.2222222222222222,"lowSample":true},{"lower":0.2,"upper":0.3,"count":25,"meanProbability":0.2619921394973024,"observedFrequency":0.24,"lowSample":false},{"lower":0.3,"upper":0.4,"count":34,"meanProbability":0.3478639225845787,"observedFrequency":0.29411764705882354,"lowSample":false},{"lower":0.4,"upper":0.5,"count":22,"meanProbability":0.4560103370623207,"observedFrequency":0.3181818181818182,"lowSample":false},{"lower":0.5,"upper":0.6,"count":28,"meanProbability":0.5496383474204235,"observedFrequency":0.5,"lowSample":false},{"lower":0.6,"upper":0.7,"count":23,"meanProbability":0.6394242457951586,"observedFrequency":0.43478260869565216,"lowSample":false},{"lower":0.7,"upper":0.8,"count":16,"meanProbability":0.7568532340680325,"observedFrequency":0.8125,"lowSample":true},{"lower":0.8,"upper":0.9,"count":5,"meanProbability":0.8390866328798582,"observedFrequency":0.6,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":47,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.2067116281003382,"meanProbability":0.2149739250608032,"meanProbabilityMinusFrequency":-0.07336963322140538,"ece":0.07566320189332758,"calibration":[{"lower":0,"upper":0.1,"count":2,"meanProbability":0.09346292338083254,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":44,"meanProbability":0.1651244651063872,"observedFrequency":0.25,"lowSample":false},{"lower":0.2,"upper":0.3,"count":115,"meanProbability":0.23447809196077044,"observedFrequency":0.30434782608695654,"lowSample":false},{"lower":0.3,"upper":0.4,"count":2,"meanProbability":0.311683448989817,"observedFrequency":0.5,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":60,"actual":51,"correct":32,"recall":0.6274509803921569,"precision":0.5333333333333333,"share":0.36809815950920244,"brier":0.17261142479578376,"meanProbability":0.3170949081824119,"meanProbabilityMinusFrequency":0.004211472599589841,"ece":0.09831693165669794,"calibration":[{"lower":0,"upper":0.1,"count":15,"meanProbability":0.07492334015926413,"observedFrequency":0.06666666666666667,"lowSample":true},{"lower":0.1,"upper":0.2,"count":32,"meanProbability":0.15840182581879525,"observedFrequency":0.09375,"lowSample":false},{"lower":0.2,"upper":0.3,"count":36,"meanProbability":0.2487226297137078,"observedFrequency":0.3055555555555556,"lowSample":false},{"lower":0.3,"upper":0.4,"count":26,"meanProbability":0.3485393449153672,"observedFrequency":0.15384615384615385,"lowSample":false},{"lower":0.4,"upper":0.5,"count":31,"meanProbability":0.45066982819232576,"observedFrequency":0.5483870967741935,"lowSample":false},{"lower":0.5,"upper":0.6,"count":15,"meanProbability":0.5400888966998324,"observedFrequency":0.4666666666666667,"lowSample":true},{"lower":0.6,"upper":0.7,"count":6,"meanProbability":0.6578460709414402,"observedFrequency":1,"lowSample":true},{"lower":0.7,"upper":0.8,"count":2,"meanProbability":0.7292746587707295,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[52,0,13],[32,0,15],[19,0,32]],"reasonCounts":{}},"delta":{"logLoss":0.004170217989277192,"brier":0.0035343062964948713}}.

Diagnostics: {"availablePredictions":163,"inputPredictions":163,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":326,"pearson":0.24811055703915014,"spearman":0.21477241731645963},"unresidualizedComposite":{"n":326,"pearson":0.671257891926266,"spearman":0.6236455658935537}},{"h2Column":2,"representation":{"n":326,"pearson":-0.06468765288573468,"spearman":-0.021128366764658766},"unresidualizedComposite":{"n":326,"pearson":-0.41708678171520724,"spearman":-0.3421331682332414}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":326,"pearson":0.054493228153333434,"spearman":0.030647137519428845},"unresidualizedComposite":{"n":326,"pearson":0.4793993575788397,"spearman":0.44346918011352077}},{"h2Column":2,"representation":{"n":326,"pearson":-0.1097632941808241,"spearman":-0.06942568547566577},"unresidualizedComposite":{"n":326,"pearson":-0.4800916800006631,"spearman":-0.3864240965315992}}]}],"crossRepresentation":{"n":326,"pearson":-0.425322901228561,"spearman":-0.4299512925865152},"crossComposite":{"n":326,"pearson":0.03763727281936615,"spearman":-0.001345103930796507},"contribution":{"n":326,"mean":-0.0061171478806517,"p10":-0.06739445958786916,"p25":-0.03772081621298906,"median":-0.003715984514799856,"p75":0.028581762283770587,"p90":0.04802669856377722,"maxAbsolute":0.12811623373536968},"rateRatio":{"n":326,"mean":0.9949655014511767,"p10":0.9348263810744362,"p25":0.9629817744915184,"median":0.9962909546394325,"p75":1.0289941478485538,"p90":1.0491987391058648,"maxAbsolute":1.136685116175882}}.

## 78 / V31-R3

Status: PASS; map: FIXED_NO_FIT; beta: FITTED.

Map hash: null; map parameter hash: null; beta hash: c80d9b86f33e227172345cac2b046ca558995f1e4d93935a99fd7506b0d12341.

Fit census: {"total":143,"used":51,"pass":92,"fail":0,"invalid":0}; beta: [-0.18125232531159696,-0.4165259352853631]; map: null.

Full: {"targets":163,"predicted":163,"pass":0,"fail":0,"invalid":0,"reasons":{},"coverage":1}; paired N=163; COMPLETE.

V1: LL=0.9999639874750744; Brier=0.5994656455520103; accuracy=0.49079754601226994.

- HOME: recall=0.8; precision=0.4642857142857143; share=0.6871165644171779; OVR Brier=0.21956019684999376; ECE=0.11440933719473548.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.2095070291684226; ECE=0.08371306888323332.
- AWAY: recall=0.5490196078431373; precision=0.5490196078431373; share=0.3128834355828221; OVR Brier=0.17039841953359355; ECE=0.07050729245062415.

H2: LL=0.9953262744662597; Brier=0.5960362848127895; accuracy=0.5153374233128835.

- HOME: recall=0.8; precision=0.5; share=0.6380368098159509; OVR Brier=0.21915270514592536; ECE=0.09976354977342541.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.2064708879012026; ECE=0.08186053661483446.
- AWAY: recall=0.6274509803921569; precision=0.5423728813559322; share=0.3619631901840491; OVR Brier=0.17041269176566176; ECE=0.04653918459943597.

candidate: LL=0.9974290786608749; Brier=0.5983863554591123; accuracy=0.50920245398773.

- HOME: recall=0.7846153846153846; precision=0.5; share=0.6257668711656442; OVR Brier=0.21822652425483757; ECE=0.09111328509167627.
- DRAW: recall=0; precision=null; share=0; OVR Brier=0.20628886019380513; ECE=0.07684195178427727.
- AWAY: recall=0.6274509803921569; precision=0.5245901639344263; share=0.37423312883435583; OVR Brier=0.17387097101046872; ECE=0.06955581666733385.

Delta: {"v1":{"logLoss":-0.002534908814199488,"brier":-0.0010792900928979776},"h2":{"logLoss":0.002102804194615282,"brier":0.002350070646322866}}.

Reference: {"status":"REFERENCE_ONLY","candidate":"V3-F3","sourceHash":"b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8","metrics":{"targets":163,"predicted":163,"pass":0,"fail":0,"invalid":0,"coverage":1,"logLoss":0.9957669920871032,"brier":0.5968405994370001,"accuracy":0.5153374233128835,"floorHits":0,"classes":[{"name":"HOME","predicted":103,"actual":65,"correct":52,"recall":0.8,"precision":0.5048543689320388,"share":0.6319018404907976,"brier":0.21751754654087782,"meanProbability":0.4679311667567849,"meanProbabilityMinusFrequency":0.0691581606218156,"ece":0.08788966061073923,"calibration":[{"lower":0,"upper":0.1,"count":1,"meanProbability":0.09792861431414465,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":9,"meanProbability":0.15152566731269082,"observedFrequency":0.2222222222222222,"lowSample":true},{"lower":0.2,"upper":0.3,"count":25,"meanProbability":0.2619921394973024,"observedFrequency":0.24,"lowSample":false},{"lower":0.3,"upper":0.4,"count":34,"meanProbability":0.3478639225845787,"observedFrequency":0.29411764705882354,"lowSample":false},{"lower":0.4,"upper":0.5,"count":22,"meanProbability":0.4560103370623207,"observedFrequency":0.3181818181818182,"lowSample":false},{"lower":0.5,"upper":0.6,"count":28,"meanProbability":0.5496383474204235,"observedFrequency":0.5,"lowSample":false},{"lower":0.6,"upper":0.7,"count":23,"meanProbability":0.6394242457951586,"observedFrequency":0.43478260869565216,"lowSample":false},{"lower":0.7,"upper":0.8,"count":16,"meanProbability":0.7568532340680325,"observedFrequency":0.8125,"lowSample":true},{"lower":0.8,"upper":0.9,"count":5,"meanProbability":0.8390866328798582,"observedFrequency":0.6,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"DRAW","predicted":0,"actual":47,"correct":0,"recall":0,"precision":null,"share":0,"brier":0.2067116281003382,"meanProbability":0.2149739250608032,"meanProbabilityMinusFrequency":-0.07336963322140538,"ece":0.07566320189332758,"calibration":[{"lower":0,"upper":0.1,"count":2,"meanProbability":0.09346292338083254,"observedFrequency":0,"lowSample":true},{"lower":0.1,"upper":0.2,"count":44,"meanProbability":0.1651244651063872,"observedFrequency":0.25,"lowSample":false},{"lower":0.2,"upper":0.3,"count":115,"meanProbability":0.23447809196077044,"observedFrequency":0.30434782608695654,"lowSample":false},{"lower":0.3,"upper":0.4,"count":2,"meanProbability":0.311683448989817,"observedFrequency":0.5,"lowSample":true},{"lower":0.4,"upper":0.5,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.5,"upper":0.6,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.6,"upper":0.7,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.7,"upper":0.8,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]},{"name":"AWAY","predicted":60,"actual":51,"correct":32,"recall":0.6274509803921569,"precision":0.5333333333333333,"share":0.36809815950920244,"brier":0.17261142479578376,"meanProbability":0.3170949081824119,"meanProbabilityMinusFrequency":0.004211472599589841,"ece":0.09831693165669794,"calibration":[{"lower":0,"upper":0.1,"count":15,"meanProbability":0.07492334015926413,"observedFrequency":0.06666666666666667,"lowSample":true},{"lower":0.1,"upper":0.2,"count":32,"meanProbability":0.15840182581879525,"observedFrequency":0.09375,"lowSample":false},{"lower":0.2,"upper":0.3,"count":36,"meanProbability":0.2487226297137078,"observedFrequency":0.3055555555555556,"lowSample":false},{"lower":0.3,"upper":0.4,"count":26,"meanProbability":0.3485393449153672,"observedFrequency":0.15384615384615385,"lowSample":false},{"lower":0.4,"upper":0.5,"count":31,"meanProbability":0.45066982819232576,"observedFrequency":0.5483870967741935,"lowSample":false},{"lower":0.5,"upper":0.6,"count":15,"meanProbability":0.5400888966998324,"observedFrequency":0.4666666666666667,"lowSample":true},{"lower":0.6,"upper":0.7,"count":6,"meanProbability":0.6578460709414402,"observedFrequency":1,"lowSample":true},{"lower":0.7,"upper":0.8,"count":2,"meanProbability":0.7292746587707295,"observedFrequency":1,"lowSample":true},{"lower":0.8,"upper":0.9,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true},{"lower":0.9,"upper":1,"count":0,"meanProbability":null,"observedFrequency":null,"lowSample":true}]}],"confusion":[[52,0,13],[32,0,15],[19,0,32]],"reasonCounts":{}},"delta":{"logLoss":0.0016620865737717594,"brier":0.0015457560221122657}}.

Diagnostics: {"availablePredictions":163,"inputPredictions":163,"interpretation":"Descriptive, dependent repeated teams/history; not significance or promotion.","components":[{"component":0,"withH2":[{"h2Column":1,"representation":{"n":326,"pearson":0.671257891926266,"spearman":0.6236455658935537},"unresidualizedComposite":{"n":326,"pearson":0.671257891926266,"spearman":0.6236455658935537}},{"h2Column":2,"representation":{"n":326,"pearson":-0.41708678171520724,"spearman":-0.3421331682332414},"unresidualizedComposite":{"n":326,"pearson":-0.41708678171520724,"spearman":-0.3421331682332414}}]},{"component":1,"withH2":[{"h2Column":1,"representation":{"n":326,"pearson":0.4793993575788397,"spearman":0.44346918011352077},"unresidualizedComposite":{"n":326,"pearson":0.4793993575788397,"spearman":0.44346918011352077}},{"h2Column":2,"representation":{"n":326,"pearson":-0.4800916800006631,"spearman":-0.3864240965315992},"unresidualizedComposite":{"n":326,"pearson":-0.4800916800006631,"spearman":-0.3864240965315992}}]}],"crossRepresentation":{"n":326,"pearson":0.03763727281936615,"spearman":-0.001345103930796507},"crossComposite":{"n":326,"pearson":0.03763727281936615,"spearman":-0.001345103930796507},"contribution":{"n":326,"mean":0.015650291301059743,"p10":-0.10090726587984097,"p25":-0.05212047122648067,"median":0.0002100959588351341,"p75":0.07244184735617161,"p90":0.16272829718463094,"maxAbsolute":0.31091893151170297},"rateRatio":{"n":326,"mean":1.0209843137255803,"p10":0.9040168634228922,"p25":0.9492145530697629,"median":1.0002101293585919,"p75":1.0751305327835077,"p90":1.1767169705071625,"maxAbsolute":1.3646785842717999}}.

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
  "auditHash": "e28bc95c8b4b7d99dc967bfcad8cad76d152e1d96ba8946af6621e03fccc2e80",
  "finals": [
    {
      "leagueId": 39,
      "candidate": "V31-R1",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          0.220918986630824,
          0.4891322523270494
        ],
        "diagnostics": {
          "n": 270,
          "dimension": 2,
          "objective": 0.7540658616585529,
          "gradientInfinity": 4.6343818675209994e-14,
          "iterations": 3,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "3aed022b7c0a1914a621ad06fb6dd92dcb1600a3a2816e3a9bcc695aff79e594",
      "mapStatus": "FITTED",
      "mapHash": "af9684a3efe6f9f27bbb1bc39e5956898bcb61600b51e9c26d9ac9f52c58bba7",
      "mapParameterHash": "e89654b6bc1ff73a8d49eed83c1913ee1fe1ad6fcdf3f96fc20b8f05b0932c7e",
      "mapParameters": [
        [
          -0.08626864334360011,
          0.26658092226805075,
          -0.11281301151520609
        ],
        [
          -0.07701098774040788,
          0.2358329959402388,
          -0.10303813825743395
        ]
      ],
      "inputHash": "33f86a638b4d0f3cddf4e11cd199e6ac026c99fa32f07f4782a8191ad9b7c50a",
      "fitCounts": {
        "total": 380,
        "used": 270,
        "pass": 110,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 39,
      "candidate": "V31-R3",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          -0.19595167272292183,
          0.09194169829181151
        ],
        "diagnostics": {
          "n": 275,
          "dimension": 2,
          "objective": 0.7599733117501061,
          "gradientInfinity": 1.0932260319988611e-9,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "567f42ceddb00138a20a4428770d8f0090931fc2ede7bec689f73c9f211706ef",
      "mapStatus": "FIXED_NO_FIT",
      "mapHash": null,
      "mapParameterHash": null,
      "mapParameters": null,
      "inputHash": "1d07fefead72e38f647e722ab525840a84739207d6855ff91e314c010c587c38",
      "fitCounts": {
        "total": 380,
        "used": 275,
        "pass": 105,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 140,
      "candidate": "V31-R1",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          0.4911264973584418,
          0.044130577996238804
        ],
        "diagnostics": {
          "n": 269,
          "dimension": 2,
          "objective": 0.8853392583840085,
          "gradientInfinity": 7.096191070745625e-8,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "595d198f403788e466afedf80a7db5adaf982302b8d245e060e71fdc47fb1701",
      "mapStatus": "FITTED",
      "mapHash": "04897f029112b0e01a80963d1659ce9b4b146c32f10f7a60aa5d5eaa52be5805",
      "mapParameterHash": "c3c4b3c23b7295b1a803dab94ab7001fa23251414c945581cc8ceec06906e5f4",
      "mapParameters": [
        [
          -0.08568559832805549,
          0.2787824870463673,
          0.026309697472273404
        ],
        [
          -0.034336771492608865,
          0.1459898274779809,
          -0.04971118395646566
        ]
      ],
      "inputHash": "40a54c1ca544a1d5ae23f3cd2423dc4527abd73924c33862d2333a3e07cc75d7",
      "fitCounts": {
        "total": 380,
        "used": 269,
        "pass": 111,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 140,
      "candidate": "V31-R3",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          0.20574872878529857,
          -0.1909397480823042
        ],
        "diagnostics": {
          "n": 274,
          "dimension": 2,
          "objective": 0.8912718407744323,
          "gradientInfinity": 1.529447887964474e-8,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "10e03eca9029676f9cec502b19ed7e1e62ee20d0ee0d2848d0ae6d18ba005f1d",
      "mapStatus": "FIXED_NO_FIT",
      "mapHash": null,
      "mapParameterHash": null,
      "mapParameters": null,
      "inputHash": "9fd9976a8ede964789d7898abdc914138afea76c75e3fbb5fab5de7ae24de116",
      "fitCounts": {
        "total": 380,
        "used": 274,
        "pass": 106,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 135,
      "candidate": "V31-R1",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          0.05014928540181797,
          0.256436831264948
        ],
        "diagnostics": {
          "n": 261,
          "dimension": 2,
          "objective": 0.8765508297308914,
          "gradientInfinity": 2.8703487774551367e-10,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "7adddcecd2724fe6b672b02aacb8d9cc89dd278819005564b53d80bfe2339d45",
      "mapStatus": "FITTED",
      "mapHash": "5b8a6b012ac840b44d989868011dc037ed0f715ac586dcb84450dfa9377f1ce3",
      "mapParameterHash": "9bb420beb1df9d8668312ed449471e9c2f91b0462267fd07ba4f62307397d85c",
      "mapParameters": [
        [
          -0.049143039352821945,
          0.20945233024039467,
          -0.026433304870460635
        ],
        [
          -0.048215090510960894,
          0.21471185804741408,
          -0.051906937199478725
        ]
      ],
      "inputHash": "4a5cce1ed6f96ce4aee514b69b492beebbc6a4b4dbc8afb98db3250f22a35562",
      "fitCounts": {
        "total": 380,
        "used": 261,
        "pass": 119,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 135,
      "candidate": "V31-R3",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          -0.22845130230723018,
          0.060294182680536525
        ],
        "diagnostics": {
          "n": 274,
          "dimension": 2,
          "objective": 0.8836357361867789,
          "gradientInfinity": 6.928805727031331e-9,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "99d8a33b52e4e690fd1800ba844ee1c595989d38dbac901f1a64f5910b8a285c",
      "mapStatus": "FIXED_NO_FIT",
      "mapHash": null,
      "mapParameterHash": null,
      "mapParameters": null,
      "inputHash": "4a27bf9d61795fbc9b5a8d197178d81ac027286910260cee7f73c07fb452650b",
      "fitCounts": {
        "total": 380,
        "used": 274,
        "pass": 106,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 78,
      "candidate": "V31-R1",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          0.08831527827367178,
          0.02433425409124074
        ],
        "diagnostics": {
          "n": 207,
          "dimension": 2,
          "objective": 0.8148028403497736,
          "gradientInfinity": 3.324470831509872e-10,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "016bdbb24e363bc4df083c0e73b410fa355eb08100add6525ed5e349ee5ec9ec",
      "mapStatus": "FITTED",
      "mapHash": "f7eaa5f1161b3a7b17545fde8cbdb5dab222e8de4b3d7a2004e7ad6ea4b395c7",
      "mapParameterHash": "351b18ad746f5d676ae8301feb59bf194355163ccd90113e5f7b71a1d8e902ac",
      "mapParameters": [
        [
          -0.13052996828519528,
          0.2859113473016767,
          -0.025329780780498308
        ],
        [
          -0.033301996826668095,
          0.14918895304964935,
          -0.13209663380987494
        ]
      ],
      "inputHash": "15603402200558668f9884a69798bd18e889efa07a6a237ca40580e9c5ceed49",
      "fitCounts": {
        "total": 306,
        "used": 207,
        "pass": 99,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    },
    {
      "leagueId": 78,
      "candidate": "V31-R3",
      "status": "PASS",
      "beta": {
        "status": "FITTED",
        "parameters": [
          -0.07682350416698663,
          -0.2157218393806334
        ],
        "diagnostics": {
          "n": 214,
          "dimension": 2,
          "objective": 0.8082227369965234,
          "gradientInfinity": 6.547760797242456e-8,
          "iterations": 2,
          "kappa": 0.01,
          "initialization": [
            0,
            0
          ]
        }
      },
      "betaHash": "c0c7477aca240d3aa3326babeb0995edfe157900b29179cc00dca1563b8c6b25",
      "mapStatus": "FIXED_NO_FIT",
      "mapHash": null,
      "mapParameterHash": null,
      "mapParameters": null,
      "inputHash": "f790c6d089f40bd4503a5fd4e8a9063a48da071b078d9f3c34b4d79c0e5d2662",
      "fitCounts": {
        "total": 306,
        "used": 214,
        "pass": 92,
        "fail": 0,
        "invalid": 0
      },
      "comparison": null,
      "reference": null,
      "diagnostics": null
    }
  ],
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
