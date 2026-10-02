import {Prisma} from '@prisma/client';
import {erpBusinessReference} from './erp-business-projection';
export const MEMBER_MESSAGE_CATEGORIES=['SERVICE','ORDER','ACCOUNT','SHIPMENT','REPURCHASE','ACTIVE','QUALIFICATION','AWARD','PAYOUT','LEARNING','EVENT'];
const uuid=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ig;
export const memberMessageReference=(id:string)=>erpBusinessReference('MESSAGE',id);
export const memberMessageText=(text:string)=>text.replace(uuid,'〔內部參考碼已隱藏〕').replace(/((?:銀行)?帳號|bank\s*account|IBAN|卡號)[：:\s]*[A-Z0-9][A-Z0-9 -]{7,}/gi,'$1〔敏感資料已隱藏〕');
/** Same-origin routes only; source access is checked again by the destination API. */
export function safeMemberMessageLink(value:string|null|undefined):string|null{
 if(!value||value.length>200)return null;
 if(/^\/(orders|active|qualifications|repurchase|bonuses|payouts|growth|learning|events)$/.test(value))return value;
 if(/^\/learning\?course=[A-Z][A-Z0-9_-]{2,39}$/.test(value)||/^\/events\?event=[A-Z][A-Z0-9_-]{2,39}$/.test(value))return value;
 return null;
}
type Input={messageKey:string;personId:string;qualificationId?:string|null;category:string;title:string;body:string;sourceType:string;sourceReference:string;deepLink?:string;publishedAt?:Date;expiresAt?:Date};
/** Personal UCell delivery only. This function never creates LINE broadcast work. */
export async function appendMemberMessage(tx:Prisma.TransactionClient,input:Input){
 const publishedAt=input.publishedAt??new Date(),deepLink=safeMemberMessageLink(input.deepLink);
 if(!input.messageKey||input.messageKey.length>300||!MEMBER_MESSAGE_CATEGORIES.includes(input.category)||!input.title.trim()||input.title.length>160||!input.body.trim()||input.body.length>4000||memberMessageText(input.title)!==input.title||memberMessageText(input.body)!==input.body||!/^[A-Z][A-Z0-9_]{1,39}$/.test(input.sourceType)||!/^[A-Z][A-Za-z0-9:._-]{2,119}$/.test(input.sourceReference)||memberMessageText(input.sourceReference)!==input.sourceReference||input.deepLink&&!deepLink||!Number.isFinite(publishedAt.getTime())||input.expiresAt&&(!Number.isFinite(input.expiresAt.getTime())||input.expiresAt<=publishedAt))throw new Error('MEMBER_MESSAGE_FAILURE: invalid personal message evidence');
 const data={messageKey:input.messageKey,personId:input.personId,qualificationId:input.qualificationId??null,category:input.category,title:input.title,body:input.body,sourceType:input.sourceType,sourceReference:input.sourceReference,deepLink,publishedAt,expiresAt:input.expiresAt??null};
 const row=await tx.memberNotification.upsert({where:{messageKey:input.messageKey},update:{},create:data});
 for(const key of ['personId','qualificationId','category','title','body','sourceType','sourceReference','deepLink'] as const)if(row[key]!==data[key])throw new Error('MEMBER_MESSAGE_FAILURE: conflicting personal message evidence');
 if((row.expiresAt?.getTime()??null)!==(data.expiresAt?.getTime()??null)||input.publishedAt&&row.publishedAt.getTime()!==input.publishedAt.getTime())throw new Error('MEMBER_MESSAGE_FAILURE: conflicting publication evidence');
 return row;
}
