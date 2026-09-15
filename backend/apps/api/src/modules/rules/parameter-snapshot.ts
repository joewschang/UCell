import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@ucell/database';
import { createHash } from 'node:crypto';

export interface ParameterSnapshot {
  format: 'UCELL_PARAMETER_SNAPSHOT_V1';
  ruleVersionCode: string;
  effectiveAt: string;
  parameters: Array<{ id:string; code:string; scope:string; value:Prisma.JsonValue; from:string; to:string|null }>;
  hash: string;
}

export function pending(code:string, message:string):never {
  throw new UnprocessableEntityException({code,message});
}

function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value!==null && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}

export async function captureParameters(tx:Prisma.TransactionClient, at:Date, ruleVersionCode:string):Promise<ParameterSnapshot> {
  if(!Number.isFinite(at.getTime())) pending('INVALID_PARAMETER_TIME','Parameter snapshot time is invalid');
  const rows=await tx.runtimeRuleParameter.findMany({where:{ruleVersionCode,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},orderBy:[{parameterCode:'asc'},{scopeKey:'asc'},{effectiveFrom:'asc'}]});
  const keys=new Set<string>();
  const parameters=rows.map(row=>{
    const key=JSON.stringify([row.parameterCode,row.scopeKey]);
    if(keys.has(key)) pending('PARAMETER_OVERLAP',`Overlapping effective parameters: ${key}`);
    keys.add(key);
    return {id:row.runtimeRuleParameterId,code:row.parameterCode,scope:row.scopeKey,value:row.valueJson,from:row.effectiveFrom.toISOString(),to:row.effectiveTo?.toISOString()??null};
  });
  const body={format:'UCELL_PARAMETER_SNAPSHOT_V1' as const,ruleVersionCode,effectiveAt:at.toISOString(),parameters};
  return {...body,hash:createHash('sha256').update(canonical(body)).digest('hex')};
}

export function verifySnapshot(value:unknown):ParameterSnapshot {
  const s=value as ParameterSnapshot;
  if(!s || s.format!=='UCELL_PARAMETER_SNAPSHOT_V1' || !Array.isArray(s.parameters) || typeof s.hash!=='string') pending('HISTORICAL_SNAPSHOT_MISSING','Historical parameters cannot be inferred from current configuration');
  const {hash,...body}=s;
  if(createHash('sha256').update(canonical(body)).digest('hex')!==hash) pending('PARAMETER_SNAPSHOT_CORRUPT','Historical parameter snapshot hash does not match');
  return s;
}

export function snapshotValue(snapshot:ParameterSnapshot,code:string,scope='*'):Prisma.JsonValue {
  const rows=snapshot.parameters.filter(p=>p.code===code&&p.scope===scope);
  if(rows.length!==1) pending('CONFIGURATION_PENDING',`Required snapshot parameter ${code}/${scope} is not uniquely configured`);
  return rows[0].value;
}

export function snapshotDecimal(snapshot:ParameterSnapshot,code:string,scope='*'):Prisma.Decimal {
  try {return new Prisma.Decimal(String(snapshotValue(snapshot,code,scope)));}
  catch(e) {if(e instanceof UnprocessableEntityException) throw e; return pending('INVALID_PARAMETER',`Invalid decimal ${code}/${scope}`);}
}
