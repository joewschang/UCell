export type ListMeta = {source:unknown[]; mapper:(value:any,index:number,rows:any[])=>any};
export function renderMeta(list:unknown):ListMeta|undefined;
export function trackRead<T>(path:string,envelope:T,read:(path:string,options:{signal:AbortSignal})=>Promise<unknown>):T;
