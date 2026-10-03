import liff from '@line/liff';
import { unwrapMemberEnvelope } from './memberApi';
export function getLineRegistrationIdToken(){
 const token=liff.getIDToken();
 if(!token)throw new Error('LINE 登入已失效，請重新開啟會員中心。');
 return token;
}
/** Keeps the authenticated UCell session while independently proving the LINE account. */
export async function prepareLineIdentityLink(){
 const id=import.meta.env.VITE_LIFF_ID;
 if(!id)throw new Error('LINE 登入尚未設定');
 await liff.init({liffId:id});
 if(!liff.isLoggedIn()){
  liff.login({redirectUri:window.location.origin+'/me'});
  return null;
 }
 return getLineRegistrationIdToken();
}

async function command(path:string,body:Record<string,string>,key?:string){
 let idToken:string|null=null;try{idToken=liff.getIDToken();}catch{throw new Error('LINE 登入已失效，請重新開啟會員中心。');}
 if(!idToken)throw new Error('LINE 登入已失效，請重新開啟會員中心。');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+'/existing-member-line-links/'+path,{
   method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,
   headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify({...body,idToken}),
  });
  if(!response.ok)throw new Error(response.status===503?'LINE 驗證暫時無法使用，請稍後重試。':'綁定未完成。請確認公司核驗、核准憑證及目前 LINE 帳號；已綁定帳號請聯絡客服辦理安全復原。');
  return unwrapMemberEnvelope(await response.json()) as Record<string,unknown>;
 }finally{clearTimeout(timer);}
}
export async function requestLineBinding(memberNo:string,verificationReference:string,key:string){
 const result=await command('requests',{memberNo,verificationReference},key);
 if(typeof result.requestId!=='string'||result.status!=='PENDING')throw new Error('綁定申請回應格式異常。');
 return result.requestId;
}
export async function completeLineBinding(requestId:string,completionToken:string){
 const result=await command('complete',{requestId,completionToken});
 if(typeof result.accessToken!=='string'||!result.accessToken||typeof result.expiresAt!=='string'||!Number.isFinite(Date.parse(result.expiresAt))||Date.parse(result.expiresAt)<=Date.now())throw new Error('綁定登入回應格式異常。');
 sessionStorage.setItem('ucell_member_token',result.accessToken);
 sessionStorage.removeItem('ucell_qualification_id');
}
