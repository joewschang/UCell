export type DateOrder={field:string;descending:boolean};
type Page<T>={data:{items:T[];hasMore:boolean}};
export function nextDateOrder(current:DateOrder|null,field:string):DateOrder;
export function dateButton(order:DateOrder|null,field:string,label:string,change:(order:DateOrder)=>void):{
  type:'button';className:string;'aria-label':string;'aria-pressed':boolean;onClick:()=>void;children:string;
};
export function orderedByDate<T>(rows:T[],order:DateOrder|null):T[];
export function readVerificationPages<T>(read:(page:number,signal?:AbortSignal)=>Promise<Page<T>>,page:number,all:boolean,signal?:AbortSignal):Promise<Page<T>>;
export function verificationPage<T>(result:Page<T>|undefined,page:number,order:DateOrder|null):Page<T>|undefined;
