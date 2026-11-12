import type {ReactNode} from 'react';
import type {ListMeta} from './pages.mjs';
type GridSort = {key:string;descending:boolean;part?:number};
export const timeViews: {gridHeader:(column:{key:string;label:string},sort:GridSort|null,set:(value:GridSort)=>void,reset:()=>void,ordinary:ReactNode)=>ReactNode;useListSort:<T>(identity:string)=>[T|null,(value:T)=>void];useGridOrder<T>(rows:T[],columns:{key:string;label:string;value:(row:T)=>string}[],sort:{key:string;descending:boolean}|null,term:string,normalize:(s:string)=>string,source?:ListMeta,adapt?:(row:any,index:number)=>T):{ordered:T[];remote:{pending:boolean;error?:string}}};
