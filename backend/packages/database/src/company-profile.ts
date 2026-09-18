import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {captureParameters,ParameterSnapshot,verifySnapshot,snapshotDecimal,pending} from './parameter-snapshot';
export const COMPANY_PROFILE='COMPANY_BOOTSTRAP_PROFILE_V1';
export const COMPANY_PROFILE_APPROVAL='https://github.com/joewschang/UCell/issues/2#issuecomment-5725701382';
/** Registry keys only: economic rates/caps remain values from the sealed Core snapshot. */
const required:Array<[string,string]>=[
 ['binary.weekly.cap','LEADER'],['referral.g1.rate','LEADER'],['binary.pair.rate','*'],
 ...Array.from({length:6},(_,i)=>['equalization.rate','LEADER:G'+(i+2)] as [string,string]),
 ...Array.from({length:5},(_,i)=>['matching.rate',String(i+1)] as [string,string]),
];
export function resolveLeaderProfile(value:unknown){
 const snapshot=verifySnapshot(value),at=Date.parse(snapshot.effectiveAt);
 if(!snapshot.ruleVersionCode||!Number.isFinite(at))pending('COMPANY_PROFILE_INVALID','Effective rule and timestamp required');
 const keys=new Set<string>(),ids=new Set<string>();
 for(const row of snapshot.parameters){
  const key=JSON.stringify([row.code,row.scope]);
  if(keys.has(key)||ids.has(row.id)||!row.id)pending('COMPANY_PROFILE_AMBIGUOUS','Parameter identity/scope is ambiguous');
  keys.add(key);ids.add(row.id);
  if(!Number.isFinite(Date.parse(row.from))||Date.parse(row.from)>at||row.to!==null&&(!Number.isFinite(Date.parse(row.to))||Date.parse(row.to)<=at))
   pending('COMPANY_PROFILE_INTERVAL_INVALID','Parameter is outside its effective interval');
 }
 const rows=required.map(([code,scope])=>{
  const amount=snapshotDecimal(snapshot,code,scope);
  if(!amount.isFinite()||amount.isNegative()||code.endsWith('.rate')&&amount.gt(1)||code==='binary.weekly.cap'&&!amount.gt(0))
   pending('COMPANY_PROFILE_INVALID','LEADER parameter is outside its declared domain');
  return snapshot.parameters.find(row=>row.code===code&&row.scope===scope)!;
 });
 const parameterIds=rows.map(r=>r.id).sort();
 return {profileVersion:COMPANY_PROFILE,planCode:'LEADER' as const,ruleVersion:snapshot.ruleVersionCode,
  parameterVersion:createHash('sha256').update(JSON.stringify(parameterIds)).digest('hex'),snapshotHash:snapshot.hash,
  parameterIds,effectiveAt:snapshot.effectiveAt,effectiveFrom:new Date(Math.max(...rows.map(r=>Date.parse(r.from)))).toISOString(),
  effectiveTo:rows.some(r=>r.to!==null)?new Date(Math.min(...rows.filter(r=>r.to!==null).map(r=>Date.parse(r.to!)))).toISOString():null,
  parameterSnapshot:snapshot,approvalReference:COMPANY_PROFILE_APPROVAL};
}
/** Bind only immutable canonical Company bootstrap identities; never upgrade MEMBER_ORIGIN. */
export async function bindCompanyLeaderProfile(tx:Prisma.TransactionClient,qualificationId:string,value:ParameterSnapshot){
 const profile=resolveLeaderProfile(value),at=new Date(profile.effectiveAt);
 const q=await tx.qualification.findUniqueOrThrow({where:{qualificationId}});
 if(q.kind!=='COMPANY_BOOTSTRAP')pending('COMPANY_PROFILE_KIND_MISMATCH','Member-origin Qualifications retain their own historical plan');
 const slot=await tx.treeCanonicalPosition.findUnique({where:{occupantQualificationId:qualificationId},include:{binaryTree:true}});
 const owners=await tx.qualificationOwnerInterval.findMany({where:{qualificationId,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},take:2});
 if(!slot||slot.positionNo<1||slot.positionNo>3||slot.binaryTree.effectiveAt>at||owners.length!==1||owners[0].ownerType!=='COMPANY'||owners[0].companyPrincipalId!==slot.binaryTree.companyPrincipalId)
  pending('COMPANY_PROFILE_IDENTITY_MISSING','Exact historical canonical position and company owner required');
 const from=new Date(Math.max(Date.parse(profile.effectiveFrom),slot.binaryTree.effectiveAt.getTime()));
 const stored=await tx.companyBootstrapProfileBinding.upsert({where:{qualificationId_snapshotHash:{qualificationId,snapshotHash:profile.snapshotHash}},update:{},
  create:{qualificationId,binaryTreeId:slot.binaryTreeId,companyPosition:slot.positionNo,profileVersion:profile.profileVersion,planCode:profile.planCode,
   ruleVersion:profile.ruleVersion,parameterVersion:profile.parameterVersion,snapshotHash:profile.snapshotHash,
   effectiveAt:at,effectiveFrom:from,effectiveTo:profile.effectiveTo?new Date(profile.effectiveTo):null,
   parameterSnapshot:profile.parameterSnapshot as unknown as Prisma.InputJsonValue,approvalReference:profile.approvalReference}});
 if(stored.parameterVersion!==profile.parameterVersion||stored.ruleVersion!==profile.ruleVersion||stored.planCode!=='LEADER')pending('COMPANY_PROFILE_BINDING_CONFLICT','Stored binding conflicts with sealed parameter evidence');
 return stored;
}

/** Resolve the registry's unique effective rule; ambiguity is never resolved by ordering. */
export async function effectiveCompanyParameters(tx:Prisma.TransactionClient,at:Date){
 const versions=await tx.runtimeRuleParameter.findMany({where:{effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},distinct:['ruleVersionCode'],select:{ruleVersionCode:true}});
 if(versions.length!==1)pending('COMPANY_RULE_VERSION_AMBIGUOUS','Exactly one effective RuleVersion is required');
 return captureParameters(tx,at,versions[0].ruleVersionCode);
}
export async function companyPlanAt(tx:Prisma.TransactionClient,qid:string,at:Date,parameters?:ParameterSnapshot){
 const q=await tx.qualification.findUnique({where:{qualificationId:qid}});
 if(q?.kind!=='COMPANY_BOOTSTRAP')return null;
 return (await bindCompanyLeaderProfile(tx,qid,parameters??await effectiveCompanyParameters(tx,at))).planCode;
}
