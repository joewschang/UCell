import liff from '@line/liff';
import { unwrapMemberEnvelope } from './memberApi';
import { parsePerson } from './validation';
async function request(path:string,init:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{return await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+path,{...init,signal:controller.signal,cache:'no-store',credentials:'same-origin'});}
 finally{clearTimeout(timer);}
}
/** Client LINE profile is never identity proof; backend verifies exchange and session. */
export async function initLiff() {
    // Remove raw credentials persisted by the previous prototype.
    sessionStorage.removeItem('ucell_line_id_token');
    if (import.meta.env.VITE_ENABLE_MOCK === 'true')
        return { mode: 'mock' as const };
    const id = import.meta.env.VITE_LIFF_ID;
    if (!id)
        throw new Error('LINE 登入尚未設定，請聯絡客服');
    await liff.init({ liffId: id });
    if (!liff.isLoggedIn()) {
        liff.login();
        return { mode: 'redirect' as const };
    }
    const cached=sessionStorage.getItem('ucell_member_token');
    if(cached){
        const response=await request('/member/me',{headers:{Authorization:'Bearer '+cached}});
        if(response.ok){parsePerson(unwrapMemberEnvelope(await response.json()));return {mode:'connected' as const};}
        sessionStorage.removeItem('ucell_member_token');
        sessionStorage.removeItem('ucell_qualification_id');
        if(response.status!==401)throw new Error('會員登入驗證暫時無法使用，請稍後重試');
    }
    const idToken=liff.getIDToken();
    if(!idToken)throw new Error('LINE 登入憑證不存在，請重新登入');
    const response=await request('/auth/member/line/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
    if(!response.ok)throw new Error(response.status===409?'登入憑證已使用，請重新 LINE 登入':'會員登入驗證失敗，請確認帳號已綁定');
    const data=unwrapMemberEnvelope(await response.json()) as {accessToken?:unknown;expiresAt?:unknown};
    if(typeof data.accessToken!=='string'||!data.accessToken||typeof data.expiresAt!=='string'||Date.parse(data.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(data.expiresAt)))throw new Error('會員登入回應格式異常');
    sessionStorage.setItem('ucell_member_token',data.accessToken);
    return {mode:'connected' as const};
}
let boot: ReturnType<typeof initLiff> | undefined;
export function bootstrapLiff() { return boot ??= initLiff().catch(error => { boot = undefined; throw error; }); }
