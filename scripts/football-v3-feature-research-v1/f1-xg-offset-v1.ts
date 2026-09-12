import {predict} from './candidate-v1';
export const predictF1=(...args:Parameters<typeof predict> extends [unknown,...infer Rest]?Rest:never)=>predict('F1',...args);
export const DIMENSION=2;
