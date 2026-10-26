import {UnprocessableEntityException} from '@nestjs/common';
import {normalizeContact} from './contact-verification.service';

/** Initial membership collects contact details, never identity evidence. */
export function networkProfile(input:{alias:string;mobile?:string;email?:string;birthDate?:string;gender?:string}){
 const alias=input.alias?.trim();
 if(!alias||alias.length>80)throw new UnprocessableEntityException({code:'DISPLAY_NAME_REQUIRED'});
 const mobile=input.mobile?.trim()?normalizeContact('SMS',input.mobile):null;
 const email=input.email?.trim()?normalizeContact('EMAIL',input.email):null;
 if(!mobile&&!email)throw new UnprocessableEntityException({code:'CONTACT_REQUIRED'});
 let birthDate:Date|null=null;
 if(input.birthDate){birthDate=new Date(input.birthDate+'T00:00:00.000Z');if(!Number.isFinite(birthDate.getTime())||birthDate.toISOString().slice(0,10)!==input.birthDate||birthDate>=new Date())throw new UnprocessableEntityException({code:'INVALID_BIRTH_DATE'});}
 const genderCode=input.gender||'UNDISCLOSED';
 if(!['MALE','FEMALE','OTHER','UNDISCLOSED'].includes(genderCode))throw new UnprocessableEntityException({code:'INVALID_GENDER'});
 return {preferredName:alias,mobile,email,birthDate,genderCode};
}
export async function lockNetworkContacts(tx:any,profile:{mobile:string|null;email:string|null}){
 for(const contact of [profile.email,profile.mobile].filter(Boolean).sort())await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${contact},0))) q`;
}
