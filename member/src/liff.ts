import liff from '@line/liff';
import { unwrapMemberEnvelope } from './memberApi';
import { parsePerson } from './validation';

async function request(path:string,init:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+path,{...init,signal:controller.signal,cache:'no-store',credentials:'same-origin'});
  let body:unknown;
  try{body=await response.json();}catch(error){if(controller.signal.aborted)throw error;}
  return {ok:response.ok,status:response.status,body};
 } finally {clearTimeout(timer);}
}

export class LineReauthenticationRequired extends Error {}

const transitionKey='ucell_referral_transition',bindingKey='ucell_referral_binding_key',anonymousKey='ucell_referral_anonymous_id';

function uuid(value:string|null){
 return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:undefined;
}

export async function prepareReferralLanding(){
 if(typeof window==='undefined')return;
 const match=window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);if(!match)return;
 let anonymousId:string|undefined;
 try{anonymousId=uuid(localStorage.getItem(anonymousKey));}catch{/* Browser persistence is optional; backend can issue a new anonymous ID. */}
 const response=await request('/referrals/landing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:match[1],...(anonymousId?{anonymousId}:{})})});
 if(!response.ok)throw new Error('推薦連結無效或已過期');
 const data=unwrapMemberEnvelope(response.body) as {anonymousId?:unknown;transitionState?:unknown;transitionExpiresAt?:unknown};
 if(typeof data.anonymousId!=='string'||!uuid(data.anonymousId)||typeof data.transitionState!=='string'||!data.transitionState||typeof data.transitionExpiresAt!=='string'||!Number.isFinite(Date.parse(data.transitionExpiresAt))||Date.parse(data.transitionExpiresAt)<=Date.now())throw new Error('推薦連結回應格式異常');
 try{localStorage.setItem(anonymousKey,data.anonymousId);}catch{/* Transition remains usable without durable anonymous storage. */}
 sessionStorage.setItem(transitionKey,data.transitionState);sessionStorage.setItem(bindingKey,crypto.randomUUID());
 const query=new URLSearchParams(window.location.search),contentId=uuid(query.get('content'));query.delete('content');const suffix=query.toString()?'?'+query.toString():'';
 window.history.replaceState({},'',(contentId?'/content/'+encodeURIComponent(contentId):'/')+suffix);
}

async function bindPendingReferral(accessToken:string){
 const transitionState=sessionStorage.getItem(transitionKey);if(!transitionState)return undefined;
 let key=sessionStorage.getItem(bindingKey);if(!uuid(key)){key=crypto.randomUUID();sessionStorage.setItem(bindingKey,key);}
 const resolvedKey=key as string;
 const response=await request('/member/referrals/bind',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json','Idempotency-Key':resolvedKey},body:JSON.stringify({transitionState})});
 if(!response.ok)return '推薦歸因未能綁定；會員登入仍有效，推薦關係尚未建立。';
 sessionStorage.removeItem(transitionKey);sessionStorage.removeItem(bindingKey);return undefined;
}

async function resumeCachedSession(){
 const cached=sessionStorage.getItem('ucell_member_token');
 if(!cached)return undefined;
 try{
  const response=await request('/member/me',{headers:{Authorization:'Bearer '+cached}});
  if(response.ok){
   parsePerson(unwrapMemberEnvelope(response.body));
  }else{
   if(response.status!==401)throw new Error('會員登入驗證暫時無法使用，請稍後重試');
   sessionStorage.removeItem('ucell_member_token');
   sessionStorage.removeItem('ucell_qualification_id');
   return undefined;
  }
 }catch(error){
  for(const key of ['ucell_member_token','ucell_qualification_id']){
   try{sessionStorage.removeItem(key);}catch{/* Keep authentication failed even when storage is unavailable. */}
  }
  throw error;
 }
 await prepareReferralLanding();
 return {mode:'connected' as const,referralWarning:await bindPendingReferral(cached)};
}

/** Client LINE profile is never identity proof; backend verifies exchange and session. */
export async function initLiff() {
 sessionStorage.removeItem('ucell_line_id_token');
 if (import.meta.env.VITE_ENABLE_MOCK === 'true') return { mode: 'mock' as const };

 // A valid UCell Member session is entry-channel neutral. Validate it before
 // requiring LIFF so a normal browser can resume the same authenticated session.
 const resumed=await resumeCachedSession();
 if(resumed)return resumed;

 const id = import.meta.env.VITE_LIFF_ID;
 if (!id) throw new Error('LINE 登入尚未設定，請聯絡客服');

 await liff.init({ liffId: id });
 // Let the SDK consume its callback before a referral landing rewrites the URL.
 await prepareReferralLanding();

 if (!liff.isLoggedIn()) {
  // Preserve the existing LINE OA / LIFF behavior: inside LINE, login continues
  // automatically. In a normal browser, present an explicit Web entry screen.
  if(liff.isInClient()){
   liff.login();
   return { mode: 'redirect' as const };
  }
  return { mode: 'web-login' as const };
 }

 const idToken=liff.getIDToken();
 if(!idToken)throw new LineReauthenticationRequired('LINE 登入憑證不存在，請重新登入');
 const response=await request('/auth/member/line/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
 if(!response.ok){
  const code=(response.body as {code?:string}|undefined)?.code;
  if((response.status===401&&['LINE_TOKEN_INVALID','LINE_TOKEN_EXPIRED'].includes(code??''))||(response.status===409&&code==='LINE_TOKEN_REPLAYED'))throw new LineReauthenticationRequired('LINE 登入憑證已失效，請重新登入 LINE');
  throw new Error(response.status===409?(code==='RETRYABLE_CONFLICT'?'登入遇到操作衝突，請重試':'登入憑證已使用，請重新 LINE 登入'):'會員登入驗證失敗，請確認帳號已綁定');
 }
 const data=unwrapMemberEnvelope(response.body) as {accessToken?:unknown;expiresAt?:unknown};
 if(typeof data.accessToken!=='string'||!data.accessToken||typeof data.expiresAt!=='string'||Date.parse(data.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(data.expiresAt)))throw new Error('會員登入回應格式異常');
 sessionStorage.setItem('ucell_member_token',data.accessToken);
 return {mode:'connected' as const,referralWarning:await bindPendingReferral(data.accessToken)};
}

export async function startWebLineLogin(){
 const id=import.meta.env.VITE_LIFF_ID;
 if(!id)throw new Error('LINE 登入尚未設定，請聯絡客服');
 await liff.init({liffId:id});
 if(liff.isLoggedIn()){
  // Re-run backend exchange rather than reusing the cached Web entry result.
  boot=undefined;
  return {mode:'connected' as const};
 }
 const redirectUri=typeof window!=='undefined'?window.location.href:undefined;
 liff.login(redirectUri?{redirectUri}:undefined);
 return {mode:'redirect' as const};
}

/** Explicit credential refresh; does not revoke other UCell sessions or lose referral state. */
export async function restartLineLogin(){
 const id=import.meta.env.VITE_LIFF_ID;
 if(!id)throw new Error('LINE 登入尚未設定，請聯絡客服');
 await liff.init({liffId:id});
 if(liff.isLoggedIn())liff.logout();
 for(const key of ['ucell_member_token','ucell_qualification_id'])sessionStorage.removeItem(key);
 boot=undefined;
 const redirectUri=typeof window!=='undefined'?window.location.href:undefined;
 liff.login(redirectUri?{redirectUri}:undefined);
 return {mode:'redirect' as const};
}

let boot: ReturnType<typeof initLiff> | undefined;
export function bootstrapLiff() { return boot ??= initLiff().catch(error => { boot = undefined; throw error; }); }
