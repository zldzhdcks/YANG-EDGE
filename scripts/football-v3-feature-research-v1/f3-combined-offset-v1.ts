import {predict} from './candidate-v1';
export const predictF3=(...args:Parameters<typeof predict> extends [unknown,...infer Rest]?Rest:never)=>predict('F3',...args);
export const DIMENSION=6;
