import liff from '@line/liff';
import { unwrapMemberEnvelope } from './memberApi';
import { parsePerson } from './validation';
async function request(path:string,init:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+path,{...init,signal:controller.signal,cache:'no-store',credentials:'same-origin'});let body:unknown;try{body=await response.json();}catch(error){if(controller.signal.aborted)throw error;}return {ok:response.ok,status:response.status,body};}
 finally{clearTimeout(timer);}
}
const transitionKey='ucell_referral_transition',bindingKey='ucell_referral_binding_key',anonymousKey='ucell_referral_anonymous_id';
const intendedDestinationKey='ucell_line_intended_destination';
export function lineExchangeFailureMessage(status:number,code:unknown){
 if(status===401&&code==='LINE_ACCOUNT_UNBOUND')return '此 LINE 尚未完成會員帳號綁定，請聯絡客服完成公司核驗。';
 if(status===401&&code==='MEMBER_SECURITY_LOCKED')return '此會員帳號目前已安全鎖定，請聯絡客服協助重新綁定。';
 if(status===401&&code==='MEMBER_PERSON_DISABLED')return '此會員帳號目前無法登入，請聯絡客服。';
 if(status===503)return 'LINE 登入服務尚未設定或暫時無法使用，請稍後再試。';
 if(status===409)return code==='RETRYABLE_CONFLICT'?'登入遇到操作衝突，請重試':'登入憑證已使用，請重新 LINE 登入';
 return '會員登入驗證失敗，請確認帳號已綁定。';
}
function intendedDestination(){
 const value=window.location.pathname+window.location.search+window.location.hash;
 return value.startsWith('/')&&!value.startsWith('//')?value:'/';
}
function uuid(value:string|null){return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:undefined;}
export async function prepareReferralLanding(){
 if(typeof window==='undefined')return;
 const match=window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);if(!match)return;
 let anonymousId:string|undefined;try{anonymousId=uuid(localStorage.getItem(anonymousKey));}catch{/* Browser persistence is optional; backend can issue a new anonymous ID. */}
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
/** Client LINE profile is never identity proof; backend verifies exchange and session. */
export async function initLiff() {
    // Remove raw credentials persisted by the previous prototype.
    sessionStorage.removeItem('ucell_line_id_token');
    if (import.meta.env.VITE_ENABLE_MOCK === 'true')
        return { mode: 'mock' as const };
    // Local UAT can exercise the real Member API with an already-issued,
    // synthetic LINE session. This path is unavailable outside Vite DEV,
    // accepts only localhost and requires an explicit per-member env token.
    const uat = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('uat');
    const stageUat=import.meta.env.PROD&&import.meta.env.VITE_STAGE_UAT_MEMBER_ENABLED==='true';
    if (typeof window !== 'undefined' && ((import.meta.env.DEV && ['127.0.0.1', 'localhost'].includes(window.location.hostname))||stageUat) &&
        uat && /^[A-E]$/.test(uat)) {
        const token = stageUat ? import.meta.env.VITE_STAGE_UAT_MEMBER_TOKEN : import.meta.env[`VITE_LOCAL_UAT_MEMBER_${uat}_TOKEN`];
        if (!token) throw new Error('本機 UAT 身分未設定');
        const response = await request('/member/me', { headers: { Authorization: 'Bearer ' + token } });
        if (!response.ok) throw new Error('本機 UAT 身分已失效，請重新建立 fixture');
        parsePerson(unwrapMemberEnvelope(response.body));
        sessionStorage.setItem('ucell_member_token', token);
        return { mode: 'connected' as const };
    }
    await prepareReferralLanding();
    const id = import.meta.env.VITE_LIFF_ID;
    if (!id)
        throw new Error('LINE 登入尚未設定，請聯絡客服');
    await liff.init({ liffId: id });
    if (!liff.isLoggedIn()) {
      // Keep only an internal relative route; no external redirect can be supplied.
        if(typeof window!=='undefined'){
          const destination=intendedDestination();
          sessionStorage.setItem(intendedDestinationKey,destination);
          liff.login({redirectUri:window.location.origin+destination});
        }else liff.login();
        return { mode: 'redirect' as const };
    }
    const cached=sessionStorage.getItem('ucell_member_token');
    if(cached){
        const response=await request('/member/me',{headers:{Authorization:'Bearer '+cached}});
        if(response.ok){parsePerson(unwrapMemberEnvelope(response.body));return {mode:'connected' as const,referralWarning:await bindPendingReferral(cached)};}
        sessionStorage.removeItem('ucell_member_token');
        sessionStorage.removeItem('ucell_qualification_id');
        if(response.status!==401)throw new Error('會員登入驗證暫時無法使用，請稍後重試');
    }
    const idToken=liff.getIDToken();
    if(!idToken)throw new Error('LINE 登入憑證不存在，請重新登入');
    const response=await request('/auth/member/line/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
    if(!response.ok){const code=(response.body as {code?:string}|undefined)?.code;throw new Error(lineExchangeFailureMessage(response.status,code));}
    const data=unwrapMemberEnvelope(response.body) as {accessToken?:unknown;expiresAt?:unknown};
    if(typeof data.accessToken!=='string'||!data.accessToken||typeof data.expiresAt!=='string'||Date.parse(data.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(data.expiresAt)))throw new Error('會員登入回應格式異常');
    sessionStorage.setItem('ucell_member_token',data.accessToken);
    const destination=sessionStorage.getItem(intendedDestinationKey);
    sessionStorage.removeItem(intendedDestinationKey);
    if(destination&&destination!==window.location.pathname+window.location.search+window.location.hash)window.history.replaceState({},'',destination);
    return {mode:'connected' as const,referralWarning:await bindPendingReferral(data.accessToken)};
}
let boot: ReturnType<typeof initLiff> | undefined;
export function bootstrapLiff() { return boot ??= initLiff().catch(error => { boot = undefined; throw error; }); }
