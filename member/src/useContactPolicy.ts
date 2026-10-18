import {useEffect,useState} from 'react';
import {unwrapMemberEnvelope} from './memberApi';
export async function getContactPolicy(){
 const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+'/auth/member/contact-verification/policy',{cache:'no-store'});
 if(!response.ok)throw Error('CONTACT_POLICY_UNAVAILABLE');
 const policy=unwrapMemberEnvelope(await response.json()) as {emailRequired?:unknown;smsRequired?:unknown;registrationMode?:unknown};
 if(policy?.emailRequired!==true||typeof policy.smsRequired!=='boolean')throw Error('CONTACT_POLICY_INVALID');
 if(policy.registrationMode!==undefined&&!['ALL','EITHER'].includes(String(policy.registrationMode)))throw Error('CONTACT_POLICY_INVALID');
 return {emailRequired:true as const,smsRequired:policy.smsRequired,registrationMode:policy.registrationMode==='EITHER'?'EITHER':'ALL'};
}
export function useContactPolicy(){
 const [smsRequired,setSmsRequired]=useState(true);
 const [registrationMode,setRegistrationMode]=useState('ALL');
 useEffect(()=>{let active=true;getContactPolicy().then(p=>{if(active){setSmsRequired(p.smsRequired);setRegistrationMode(p.registrationMode)}}).catch(()=>{/* Retain strict requirements on failure. */});return()=>{active=false}},[]);
 return {smsRequired,registrationMode};
}
export const deferredSmsMessage='Stage 手機簡訊驗證尚未開放；目前先完成 Email 驗證，手機資料仍標示為尚未驗證。';
