import { unwrapMemberEnvelope } from './memberApi';

type SessionData={accessToken:string;expiresAt:string};
const apiBase=()=>import.meta.env.VITE_API_BASE_URL||'/api/v1';

async function request(path:string,init:RequestInit={}){
 const response=await fetch(apiBase()+path,{...init,cache:'no-store',credentials:'same-origin'});
 let body:unknown;try{body=await response.json();}catch{body=undefined;}
 if(!response.ok){
  const envelope=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:undefined;
  const code=typeof envelope?.code==='string'?envelope.code:
   typeof (envelope?.error as any)?.code==='string'?(envelope?.error as any).code:undefined;
  throw new Error(code||'AUTH_REQUEST_FAILED');
 }
 return unwrapMemberEnvelope(body);
}

function storeSession(value:unknown){
 const data=value as Partial<SessionData>;
 if(typeof data.accessToken!=='string'||!data.accessToken||typeof data.expiresAt!=='string'||!Number.isFinite(Date.parse(data.expiresAt)))throw new Error('AUTH_SESSION_INVALID');
 sessionStorage.setItem('ucell_member_token',data.accessToken);
 return data as SessionData;
}

export async function passwordLogin(memberNo:string,password:string){
 return storeSession(await request('/auth/member/password/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberNo,password})}));
}
export async function googleExchange(idToken:string){
 return storeSession(await request('/auth/member/google/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})}));
}
export async function otpLoginChallenge(mobile:string){
 return request('/auth/member/otp/challenges',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({mobile})}) as Promise<{challengeId:string;expiresAt:string}>;
}
export async function otpLogin(challengeId:string,code:string){
 return storeSession(await request('/auth/member/otp/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId,code})}));
}
export async function forgotPassword(identifier:string){
 return request('/auth/member/password/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});
}
export async function resetPassword(token:string,newPassword:string){
 return request('/auth/member/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,newPassword})});
}

export type RegistrationContract={contractVersionId:string;title:string;versionCode:string;contentText:string;contentHash:string};
export async function registrationContract(){return request('/auth/member/register/contract') as Promise<RegistrationContract>;}
export async function registrationOtpChallenge(registrationSessionId:string,mobile:string){
 return request('/auth/member/register/otp/challenge',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({registrationSessionId,mobile})}) as Promise<{challengeId:string;expiresAt:string}>;
}
export async function verifyRegistrationOtp(challengeId:string,code:string){
 return request('/auth/otp/challenges/'+encodeURIComponent(challengeId)+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
}
export async function completeRegistration(input:{registrationSessionId:string;challengeId:string;contractVersionId:string;legalName:string;alias:string;gender:string;birthDate:string;mobile:string;email:string;password:string;googleIdToken?:string}){
 return storeSession(await request('/auth/member/register/complete',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({...input,accepted:true})}));
}

declare global{interface Window{google?:any}}
let googleScript:Promise<void>|undefined;
function loadGoogle(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(googleScript)return googleScript;
 googleScript=new Promise<void>((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-ucell-google-identity]');
  if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('GOOGLE_SCRIPT_FAILED')),{once:true});return;}
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.ucellGoogleIdentity='true';
  script.onload=()=>resolve();script.onerror=()=>reject(new Error('GOOGLE_SCRIPT_FAILED'));document.head.appendChild(script);
 });
 return googleScript;
}
export async function renderGoogleButton(element:HTMLElement,onAuthenticated:()=>void,onUnbound:(idToken:string)=>void,onError:(message:string)=>void){
 const clientId=import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID;
 if(!clientId){onError('Google 登入尚未設定');return;}
 try{
  await loadGoogle();
  window.google.accounts.id.initialize({client_id:clientId,callback:async(result:{credential?:string})=>{
   try{if(!result.credential)throw new Error('GOOGLE_CREDENTIAL_MISSING');await googleExchange(result.credential);onAuthenticated();}catch(e){if(e instanceof Error&&e.message==='GOOGLE_ACCOUNT_UNBOUND'){onUnbound(result.credential);return;}onError(e instanceof Error?e.message:'Google 登入失敗');}
  }});
  element.replaceChildren();
  window.google.accounts.id.renderButton(element,{theme:'outline',size:'large',shape:'rectangular',text:'continue_with',width:320});
 }catch(e){onError(e instanceof Error?e.message:'Google 登入載入失敗');}
}
