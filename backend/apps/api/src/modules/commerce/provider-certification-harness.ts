export type ProviderCertificationDomain='PAYMENT'|'INVOICE'|'LOGISTICS'|'IDENTITY';
export type ProviderCertificationCase='VALID'|'TAMPERED'|'WRONG_KEY'|'EXPIRED'|'REPLAY';
export type ProviderCertificationVerdict='ACCEPT'|'REJECT';
export type ProviderCertificationEvidenceClass='OFFICIAL_PROVIDER_VECTOR'|'ENGINEERING_FIXTURE';
export type ProviderCertificationVector=Readonly<{case:ProviderCertificationCase;vectorId:string;inputRef:string;expected:ProviderCertificationVerdict}>;
export type ProviderCertificationManifest=Readonly<{domain:ProviderCertificationDomain;provider:string;environment:'STAGE'|'UAT';providerApiVersion:string;verificationConfigVersion:string;evidenceClass:ProviderCertificationEvidenceClass;approvalReference:string;vectors:readonly ProviderCertificationVector[]}>;
export type ProviderCertificationResult=Readonly<{status:'PASS'|'FAIL'|'ENGINEERING_ONLY'|'OPERATIONAL_CREDENTIAL_PENDING';domain:ProviderCertificationDomain;provider:string;environment:'STAGE'|'UAT';providerApiVersion:string;verificationConfigVersion:string;approvalReference:string;executedAt:string;cases:readonly Readonly<{case:ProviderCertificationCase;vectorId:string;expected:ProviderCertificationVerdict;actual:ProviderCertificationVerdict;passed:boolean}>[]}>;

const requiredCases:readonly ProviderCertificationCase[]=Object.freeze(['VALID','TAMPERED','WRONG_KEY','EXPIRED','REPLAY']);
const token=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

/** Executes reference-only certification vectors. Raw callbacks, signatures, keys and
 * tokens stay in the approved external evidence store used by the injected executor. */
export async function runProviderCertification(manifest:ProviderCertificationManifest|undefined,executor:(vector:ProviderCertificationVector)=>Promise<ProviderCertificationVerdict>,now=new Date()):Promise<ProviderCertificationResult>{
  validDate(now);
  if(!manifest)return pending(now);
  validateManifest(manifest);
  const cases=[] as Array<{case:ProviderCertificationCase;vectorId:string;expected:ProviderCertificationVerdict;actual:ProviderCertificationVerdict;passed:boolean}>;
  for(const vector of manifest.vectors){
    let actual:ProviderCertificationVerdict;
    try{actual=await executor(vector);}catch{actual='REJECT';}
    if(!['ACCEPT','REJECT'].includes(actual))throw new Error('PROVIDER_CERTIFICATION_VERDICT_INVALID');
    cases.push({case:vector.case,vectorId:vector.vectorId,expected:vector.expected,actual,passed:actual===vector.expected});
  }
  const passed=cases.every(item=>item.passed);
  return Object.freeze({status:manifest.evidenceClass==='ENGINEERING_FIXTURE'?'ENGINEERING_ONLY':passed?'PASS':'FAIL',domain:manifest.domain,provider:manifest.provider,environment:manifest.environment,providerApiVersion:manifest.providerApiVersion,verificationConfigVersion:manifest.verificationConfigVersion,approvalReference:manifest.approvalReference,executedAt:now.toISOString(),cases:Object.freeze(cases.map(item=>Object.freeze(item)))});
}

function validateManifest(value:ProviderCertificationManifest):void{
  if(!value||!['PAYMENT','INVOICE','LOGISTICS','IDENTITY'].includes(value.domain)||!['STAGE','UAT'].includes(value.environment)||!['OFFICIAL_PROVIDER_VECTOR','ENGINEERING_FIXTURE'].includes(value.evidenceClass))invalid();
  for(const field of [value.provider,value.providerApiVersion,value.verificationConfigVersion,value.approvalReference])if(!token.test(field))invalid();
  if(!Array.isArray(value.vectors)||value.vectors.length!==requiredCases.length)invalid();
  const seen=new Set<string>();
  for(const vector of value.vectors){
    if(!requiredCases.includes(vector.case)||seen.has(vector.case)||!token.test(vector.vectorId)||!isEvidenceRef(vector.inputRef)||!['ACCEPT','REJECT'].includes(vector.expected))invalid();
    if(vector.case==='VALID'&&vector.expected!=='ACCEPT')invalid();
    if(vector.case!=='VALID'&&vector.expected!=='REJECT')invalid();
    seen.add(vector.case);
  }
  if(requiredCases.some(item=>!seen.has(item)))invalid();
}
function isEvidenceRef(value:string):boolean{return typeof value==='string'&&/^(?:kv|evidence|provider-vector):\/\/[A-Za-z0-9][A-Za-z0-9._:/-]{0,240}$/.test(value)}
function validDate(value:Date):void{if(!(value instanceof Date)||Number.isNaN(value.getTime()))throw new Error('PROVIDER_CERTIFICATION_TIME_INVALID')}
function invalid():never{throw new Error('PROVIDER_CERTIFICATION_MANIFEST_INVALID')}
function pending(now:Date):ProviderCertificationResult{return Object.freeze({status:'OPERATIONAL_CREDENTIAL_PENDING',domain:'PAYMENT',provider:'UNCONFIGURED',environment:'STAGE',providerApiVersion:'PENDING',verificationConfigVersion:'PENDING',approvalReference:'PENDING',executedAt:now.toISOString(),cases:Object.freeze([])})}