/** First-real one-shot window: executedAt + 86400000, kickoffUtc <= windowEnd. Do not invent a new window. */
export const FIRST_BATCH_WINDOW_MS=86400000;
export const SEAL_DEADLINE_MS=60000;
export const SCOPE='ONE_SHOT_24H_NO_RETRY';

export function windowEndUtc(executedAt:string){
 const t=Date.parse(executedAt);
 if(!Number.isFinite(t))throw Error('INVALID_EXECUTED_AT');
 return new Date(t+FIRST_BATCH_WINDOW_MS).toISOString();
}

export function withinWindow(kickoffUtc:string,windowEnd:string){
 const k=Date.parse(kickoffUtc),e=Date.parse(windowEnd);
 if(!Number.isFinite(k)||!Number.isFinite(e))throw Error('INVALID_WINDOW_TIME');
 return k<=e;
}

export function leadTimeMs(kickoffUtc:string,at:string){
 const k=Date.parse(kickoffUtc),t=Date.parse(at);
 if(!Number.isFinite(k)||!Number.isFinite(t))throw Error('INVALID_LEAD_TIME');
 return k-t;
}
