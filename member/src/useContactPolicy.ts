import {uiText} from "../../shared/design-system/i18n";
import {useEffect,useState} from 'react';
import {unwrapMemberEnvelope} from './memberApi';
export async function getContactPolicy(purpose:'REGISTRATION'|'PROFILE'='REGISTRATION'){
 const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+'/auth/member/contact-verification/policy'+(purpose==='PROFILE'?'?purpose=PROFILE':''),{cache:'no-store'});
 if(!response.ok)throw Error('CONTACT_POLICY_UNAVAILABLE');
 const policy=unwrapMemberEnvelope(await response.json()) as {emailRequired?:unknown;smsRequired?:unknown};
 if(typeof policy?.emailRequired!=='boolean'||typeof policy.smsRequired!=='boolean')throw Error('CONTACT_POLICY_INVALID');
 return {emailRequired:policy.emailRequired,smsRequired:policy.smsRequired};
}
export function useContactPolicy(purpose:'REGISTRATION'|'PROFILE'='REGISTRATION'){
 const [policy,setPolicy]=useState({smsRequired:true,emailRequired:true});
 useEffect(()=>{let active=true;getContactPolicy(purpose).then(p=>{if(active)setPolicy(p)}).catch(()=>{/* Retain strict requirements on failure. */});return()=>{active=false}},[purpose]);
 return policy;
}
export const deferredSmsMessage=uiText("Stage 手機簡訊驗證尚未開放；目前先完成 Email 驗證，手機資料仍標示為尚未驗證。");

export const deferredRegistrationMessage=uiText("目前註冊暫免手機與 Email 驗證，請確認聯絡資料正確；資料將保留為尚未驗證。");
