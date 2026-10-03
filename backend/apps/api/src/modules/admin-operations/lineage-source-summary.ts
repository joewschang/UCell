import {createHash} from 'node:crypto';

/** Public lineage identifies stored snapshots without forwarding arbitrary JSON. */
export function lineageSourceSummary(value:unknown,kind:'OFFERING'|'RULE'){
 if(value===null||value===undefined)return null;
 const source=typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const reference=`${kind}-SNAPSHOT-${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20)}`;
 const code=(input:unknown)=>typeof input==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(input)&&!/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(input)?input:null;
 if(kind==='RULE')return {reference,ruleVersionCode:code(source.ruleVersionCode)};
 return {reference,offeringCode:code(source.offeringCode),offeringType:['QUALIFICATION_PACKAGE','REPURCHASE_PLAN','CORE_PRODUCT','RETAIL_PRODUCT','PROMOTIONAL_BUNDLE'].includes(String(source.offeringType))?source.offeringType:null,version:Number.isSafeInteger(source.version)&&Number(source.version)>0?source.version:null};
}
