import {createCommandClient} from './commands';
const API_BASE=import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(public status:number,public body:unknown,message:string){super(message);}
}

export function adminToken(){return sessionStorage.getItem('ucell_admin_token');}
export function setAdminToken(token:string,expiresAt?:string){
  sessionStorage.setItem('ucell_admin_token',token);
  if(expiresAt)sessionStorage.setItem('ucell_admin_expires_at',expiresAt);
}
export function clearAdminToken(){
  commands.clear();
  putCommands.clear();
  sessionStorage.removeItem('ucell_admin_token');
  sessionStorage.removeItem('ucell_admin_expires_at');
}

export interface RequestOptions extends RequestInit {
  idempotencyKey?:string;
  skipUnauthorizedEvent?:boolean;
}

export async function api<T>(path:string,init:RequestOptions={}):Promise<T>{
  if(import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_READ_ONLY==='true' &&
    !['GET','HEAD','OPTIONS'].includes((init.method??'GET').toUpperCase())){
    throw new ApiError(405,null,'本機 Admin DEV 只讀模式：此寫入操作尚未開放。');
  }
  const headers=new Headers(init.headers);
  if(import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_FULL_ACCESS==='true'){
    const actor=sessionStorage.getItem('ucell_dev_actor_id');
    if(actor) headers.set('x-ucell-dev-actor-id',actor);
  }
  if(typeof init.body==='string' && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  headers.set('x-request-id',crypto.randomUUID());
  const t=adminToken(); if(t) headers.set('Authorization',`Bearer ${t}`);
  if(init.idempotencyKey) headers.set('Idempotency-Key',init.idempotencyKey);

  const {idempotencyKey:_,skipUnauthorizedEvent,...fetchInit}=init;
  const controller=new AbortController();const abort=()=>controller.abort();
  init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)controller.abort();
  const timer=setTimeout(abort,15000);
  let res:Response,text:string;
  try{res=await fetch(`${API_BASE}${path}`,{...fetchInit,headers,signal:controller.signal});text=await res.text();}
  catch(error){if(controller.signal.aborted)throw new ApiError(0,null,'請求已取消或逾時；寫入操作請保留原資料重試，不要重複建立。');throw error;}
  finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
  let body:unknown=null;
  if(text){try{body=JSON.parse(text)}catch{body=text}}

  if(res.status===401&&!skipUnauthorizedEvent){
    window.dispatchEvent(new CustomEvent('ucell:admin-unauthorized'));
  }
  if(!res.ok){
    const detail=(body as any)?.message ?? (body as any)?.error?.message;
    const code=(body as any)?.code??(body as any)?.error?.code;
    const label:Record<number,string>={403:'沒有此操作權限',409:'操作衝突，請確認原資料後重試',422:'資料驗證或必要設定未完成'};
    throw new ApiError(res.status,body,[label[res.status],detail,typeof code==='string'?code:undefined].filter(Boolean).join(' · ') || `API ${res.status}: ${path}`);
  }
  return body as T;
}

export const get=<T>(p:string,options:RequestOptions={})=>api<T>(p,options);

const commands=createCommandClient((path,data,idempotencyKey)=>api(path,{
    method:'POST',
    body:data===undefined?undefined:JSON.stringify(data),
    idempotencyKey
  }),()=>JSON.stringify([adminToken(),sessionStorage.getItem('ucell_dev_actor_id'),sessionStorage.getItem('ucell_admin_user')]));
export function command<T>(path:string,data?:unknown,idempotencyKey?:string){return commands.execute<T>(path,data,idempotencyKey);}
const putCommands=createCommandClient((path,data,idempotencyKey)=>api(path,{
  method:'PUT',body:data===undefined?undefined:JSON.stringify(data),idempotencyKey
}),()=>JSON.stringify([adminToken(),sessionStorage.getItem('ucell_dev_actor_id'),sessionStorage.getItem('ucell_admin_user')]));
export function putCommand<T>(path:string,data?:unknown,idempotencyKey?:string){return putCommands.execute<T>(path,data,idempotencyKey);}

export const post=<T>(p:string,data?:unknown,options:RequestOptions={})=>api<T>(p,{
  ...options,method:'POST',
  body:data===undefined?undefined:JSON.stringify(data)
});

export function qs(values:Record<string,string|number|undefined|null>){
  const p=new URLSearchParams();
  Object.entries(values).forEach(([k,v])=>{
    if(v!==undefined&&v!==null&&String(v)!=='')p.set(k,String(v))
  });
  const s=p.toString();return s?`?${s}`:'';
}
