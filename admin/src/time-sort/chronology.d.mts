export function timeValues(input:unknown):number[];
export function timeLabel(label:string):boolean;
export function compareTime(a:number|undefined,b:number|undefined,descending?:boolean):number;
export function sortRendered<T>(rows:T[],read:(row:T)=>number|undefined,descending:boolean):T[];
