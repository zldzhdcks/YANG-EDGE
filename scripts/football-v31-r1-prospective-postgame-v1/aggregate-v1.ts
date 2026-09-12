import type {Outcome,Scorecard} from './grader-v1';

export const CHECKPOINT=25;

export type BatchScore={batchId:string;TOTAL_SEALED:number;RESULT_AVAILABLE:number;RESULT_PENDING:number;RESULT_BLOCKED:number;R1_PREDICTED_GRADED:number;R1_PASS_PRESERVED:number;V1_PREDICTED_GRADED:number;H2_PREDICTED_GRADED:number;NEW_POSTGAME_APPENDED:number;outcomes:Outcome[];receiptHash?:string;runId?:string};

export type AggregateScorecard={
 TOTAL_BATCHES:number;TOTAL_SEALED:number;RESULT_AVAILABLE:number;RESULT_PENDING:number;RESULT_BLOCKED:number;
 R1_PREDICTED_GRADED:number;R1_PASS_PRESERVED:number;V1_PREDICTED_GRADED:number;H2_PREDICTED_GRADED:number;
 NEW_POSTGAME_APPENDED:number;checkpoint:{next:number;R1_PREDICTED_GRADED:number};
 INTERPRETATION:'EARLY_DESCRIPTIVE_ONLY';MODEL_PROMOTED:'NO';WATCH_STARTED:'NO';
 batches:BatchScore[];
};

export function fromCard(batchId:string,card:Scorecard,outcomes:Outcome[],extra:Partial<BatchScore>={}):BatchScore{
 return {
  batchId,TOTAL_SEALED:card.TOTAL_SEALED,RESULT_AVAILABLE:card.RESULT_AVAILABLE,RESULT_PENDING:card.RESULT_PENDING,RESULT_BLOCKED:card.RESULT_BLOCKED,
  R1_PREDICTED_GRADED:card.R1_PREDICTED_GRADED,R1_PASS_PRESERVED:card.R1_PASS_PRESERVED,V1_PREDICTED_GRADED:card.V1_PREDICTED_GRADED,H2_PREDICTED_GRADED:card.H2_PREDICTED_GRADED,
  NEW_POSTGAME_APPENDED:outcomes.filter(o=>o.status==='GRADED').length,outcomes,...extra,
 };
}

export function aggregateScorecard(batches:BatchScore[]):AggregateScorecard{
 const sum=(k:keyof Omit<BatchScore,'batchId'|'outcomes'|'receiptHash'|'runId'>)=>batches.reduce((n,b)=>n+(b[k] as number),0);
 const r1=sum('R1_PREDICTED_GRADED');
 return {
  TOTAL_BATCHES:batches.length,TOTAL_SEALED:sum('TOTAL_SEALED'),RESULT_AVAILABLE:sum('RESULT_AVAILABLE'),RESULT_PENDING:sum('RESULT_PENDING'),RESULT_BLOCKED:sum('RESULT_BLOCKED'),
  R1_PREDICTED_GRADED:r1,R1_PASS_PRESERVED:sum('R1_PASS_PRESERVED'),V1_PREDICTED_GRADED:sum('V1_PREDICTED_GRADED'),H2_PREDICTED_GRADED:sum('H2_PREDICTED_GRADED'),
  NEW_POSTGAME_APPENDED:sum('NEW_POSTGAME_APPENDED'),checkpoint:{next:CHECKPOINT,R1_PREDICTED_GRADED:r1},
  INTERPRETATION:'EARLY_DESCRIPTIVE_ONLY',MODEL_PROMOTED:'NO',WATCH_STARTED:'NO',batches,
 };
}
