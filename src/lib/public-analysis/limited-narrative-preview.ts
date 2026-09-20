/** Metadata-only fallback. No provider, model or private evidence imports. */
export function limitedNarrativePreview(home:string|null,away:string|null,predictionAvailable:boolean){
 const h=home||'홈팀 미확인',a=away||'원정팀 미확인';
 const paragraphs=[
 `${h}와 ${a}의 맞대결은 현재 확인된 경기 정보부터 살펴볼 필요가 있다. 추가 근거가 부족한 부분은 판단을 보류한다.`,
 '경기 흐름을 구체적으로 전망할 검증된 자료가 아직 연결되지 않았다. 따라서 한 팀이 경기를 지배하거나 특정 득점 양상이 나타날 것이라고 단정하지 않는다.',
 `${h}의 홈팀 관점에서는 실제 출전 명단과 확인된 과거 경기 자료가 중요하다. 현재 본문에는 그 근거가 없어 홈 이점의 크기나 선수별 기여를 확정하지 않는다.`,
 `${a}의 원정팀 관점에서도 출전 가능 선수와 원정 경기 근거를 확인해야 한다. 팀 이름만으로 수비적 운영이나 역습 전략을 예상하지 않는다.`,
 '핵심 전술 포인트는 아직 제한적으로만 다룰 수 있다. 빌드업, 압박, 전환과 세트피스에 관한 검증된 자료가 없어 구체적인 전술 평가는 보류한다.',
 '핵심 변수는 확인된 선발 명단과 부상·징계 근거의 확보 여부다. 정보가 없다는 이유로 결장이 없거나 예상 명단이 확정됐다고 해석하지 않는다.',
 '배당의 시장 종류와 선택지 연결이 확인되기 전에는 시장이 어느 쪽을 선호하는지 단정하지 않는다. 낮은 배당 자체도 수익이나 결과를 보장하지 않는다.',
 predictionAvailable?'공식 분석이 존재한다는 상태는 확인되지만 이 제한 프리뷰에는 봉인 확률 원문이 연결되지 않았다. 수치를 추정하지 않고 공식 분석 참조에서 확인하도록 한다.':'현재 연결된 공식 Prediction이 없거나 판단이 보류된 상태다. 이 경우에도 프리뷰를 유지하며 근거 없는 승패 확률을 만들지 않는다.',
 '이 프리뷰에서는 확정 선발과 부상·징계 상태를 아직 확인하지 못했다. 실제 발표 여부와 정보 수집 여부는 다를 수 있으므로 확인되지 않은 선수 상태를 단정하지 않는다.',
 '현재 결론은 확인된 경기 편성을 중심으로 정보를 살피되 승패와 전술 판단은 추가 근거를 기다린다는 것이다. 검증된 새 사전 근거가 확보되면 별도 버전에서 설명을 보완한다.',
 ];
 return {headline:`${h} vs ${a} — 제한된 사전 프리뷰`,summary:paragraphs[0],body:paragraphs.join('\n\n'),paragraphs,engineAnalysis:paragraphs[7],oddsAnalysis:paragraphs[6],lineupAnalysis:paragraphs[8],dataQualityNote:'경기 메타데이터만 사용한 제한 프리뷰. 선수·전술·확률을 추정하지 않음.',status:'LIMITED_NARRATIVE_PREVIEW' as const,TACTICAL_DETAIL_LEVEL:'LIMITED' as const};
}
