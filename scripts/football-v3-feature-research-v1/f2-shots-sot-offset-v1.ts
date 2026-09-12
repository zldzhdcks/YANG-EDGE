import {predict} from './candidate-v1';
export const predictF2=(...args:Parameters<typeof predict> extends [unknown,...infer Rest]?Rest:never)=>predict('F2',...args);
export const DIMENSION=4;
