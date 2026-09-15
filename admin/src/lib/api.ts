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
  headers.set('Content-Type','application/json');
  headers.set('x-request-id',crypto.randomUUID());
  const t=adminToken(); if(t) headers.set('Authorization',`Bearer ${t}`);
  if(init.idempotencyKey) headers.set('Idempotency-Key',init.idempotencyKey);

  const {idempotencyKey:_,skipUnauthorizedEvent,...fetchInit}=init;
  const res=await fetch(`${API_BASE}${path}`,{...fetchInit,headers});
  const text=await res.text();
  let body:unknown=null;
  if(text){try{body=JSON.parse(text)}catch{body=text}}

  if(res.status===401&&!skipUnauthorizedEvent){
    window.dispatchEvent(new CustomEvent('ucell:admin-unauthorized'));
  }
  if(!res.ok){
    const detail=(body as any)?.message ?? (body as any)?.error?.message;
    throw new ApiError(res.status,body,detail || `API ${res.status}: ${path}`);
  }
  return body as T;
}

export const get=<T>(p:string)=>api<T>(p);

export function command<T>(
  path:string,data?:unknown,idempotencyKey=crypto.randomUUID()
){
  return api<T>(path,{
    method:'POST',
    body:data===undefined?undefined:JSON.stringify(data),
    idempotencyKey
  });
}

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
