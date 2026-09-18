import * as fs from 'node:fs';

export type ProviderDeploymentEnvironment='LOCAL'|'CONNECTED_DEV'|'UAT'|'PRODUCTION';
export type ProviderEnablementEntry=Readonly<{
  domain:'PAYMENT'|'INVOICE'|'LOGISTICS'|'IDENTITY'; provider:string; connectionId:string;
  providerConnectionVersionId:string; connectionEnvironment:'TEST'|'STAGE'|'PRODUCTION';
  credentialSecretRef:string; webhookVerificationRef:string; configHash:string;
  effectiveFrom:string; effectiveTo?:string|null; approvalReference:string;
  certificationEvidenceClass:'OFFICIAL_PROVIDER_VECTOR'|'ENGINEERING_FIXTURE';
  certificationStatus:'PASS'|'FAIL'|'ENGINEERING_ONLY'|'OPERATIONAL_CREDENTIAL_PENDING';
  certificationEvidenceRef:string; uatApprovalReference:string;
}>;
export type ProviderEnablementManifest=Readonly<{deploymentEnvironment:ProviderDeploymentEnvironment;entries:readonly ProviderEnablementEntry[]}>;
const token=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=/^[0-9a-f]{64}$/;
const evidence=/^(?:evidence|provider-certification):\/\/[A-Za-z0-9][A-Za-z0-9._:/-]{0,240}$/;
const approval=/^(?:approval|uat-approval):\/\/[A-Za-z0-9][A-Za-z0-9._:/-]{0,240}$/;
const keyVault=/^https:\/\/[a-z0-9-]{3,24}\.vault\.azure\.net\/secrets\/[A-Za-z0-9-]{1,127}\/[A-Za-z0-9]{8,}$/;

export function loadProviderEnablementManifest(environment:NodeJS.ProcessEnv):ProviderEnablementManifest{
  const path=environment.UCELL_PROVIDER_ENABLEMENT_MANIFEST_PATH;
  if(!path)throw new Error('PROVIDER_ENABLEMENT_MANIFEST_REQUIRED');
  let parsed:unknown;
  try{parsed=JSON.parse(fs.readFileSync(path,'utf8'));}catch{throw new Error('PROVIDER_ENABLEMENT_MANIFEST_INVALID')}
  return parsed as ProviderEnablementManifest;
}

/** Validates references and approvals only; it never reads secret values or replaces official provider UAT. */
export function validateProviderEnablementManifest(manifest:ProviderEnablementManifest,expected:ProviderDeploymentEnvironment,now=new Date(),expectedConnections?:readonly Readonly<{domain:string;provider:string;connectionId:string}>[]):void{
  if(!manifest||manifest.deploymentEnvironment!==expected||!Array.isArray(manifest.entries)||manifest.entries.length===0)fail('PROVIDER_ENABLEMENT_MANIFEST_INVALID');
  if(!['LOCAL','CONNECTED_DEV','UAT','PRODUCTION'].includes(expected)||Number.isNaN(now.getTime()))fail('PROVIDER_ENABLEMENT_MANIFEST_INVALID');
  const seen=new Set<string>();
  for(const item of manifest.entries){
    if(!item||!['PAYMENT','INVOICE','LOGISTICS','IDENTITY'].includes(item.domain)||!token.test(item.provider)||!token.test(item.connectionId)||!uuid.test(item.providerConnectionVersionId))fail('PROVIDER_ENABLEMENT_MANIFEST_INVALID');
    const key=`${item.domain}\u0000${item.provider}\u0000${item.connectionId}`;
    if(seen.has(key))fail('PROVIDER_ENABLEMENT_DUPLICATE'); seen.add(key);
    if(!hash.test(item.configHash)||!keyVault.test(item.credentialSecretRef)||!keyVault.test(item.webhookVerificationRef))fail('PROVIDER_ENABLEMENT_SECRET_REFERENCE_INVALID');
    const from=date(item.effectiveFrom),to=item.effectiveTo?date(item.effectiveTo):null;
    if(from>now||(to!==null&&to<=now)||(to!==null&&to<=from))fail('PROVIDER_CONNECTION_VERSION_NOT_EFFECTIVE');
    if(!approval.test(item.approvalReference)||!approval.test(item.uatApprovalReference)||!evidence.test(item.certificationEvidenceRef))fail('PROVIDER_ENABLEMENT_EVIDENCE_REQUIRED');
    if(item.certificationEvidenceClass!=='OFFICIAL_PROVIDER_VECTOR'||item.certificationStatus!=='PASS')fail('PROVIDER_CERTIFICATION_NOT_APPROVED');
    if(expected==='PRODUCTION'&&item.connectionEnvironment!=='PRODUCTION')fail('PROVIDER_CONNECTION_ENVIRONMENT_MISMATCH');
    if(expected==='UAT'&&item.connectionEnvironment!=='STAGE')fail('PROVIDER_CONNECTION_ENVIRONMENT_MISMATCH');
    if(!['UAT','PRODUCTION'].includes(expected))fail('PROVIDER_RUNTIME_ENVIRONMENT_NOT_APPROVED');
  }
  if(expectedConnections){
    const expectedKeys=new Set(expectedConnections.map(item=>`${item.domain}\u0000${item.provider}\u0000${item.connectionId}`));
    if(expectedKeys.size!==expectedConnections.length||expectedKeys.size!==seen.size||[...expectedKeys].some(key=>!seen.has(key)))fail('PROVIDER_ENABLEMENT_REGISTRY_MISMATCH');
  }
}
function date(value:string):Date{const result=new Date(value);if(typeof value!=='string'||Number.isNaN(result.getTime())||result.toISOString()!==value)fail('PROVIDER_ENABLEMENT_MANIFEST_INVALID');return result}
function fail(code:string):never{throw new Error(code)}
