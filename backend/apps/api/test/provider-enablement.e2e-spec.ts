import { validateProviderEnablementManifest, type ProviderEnablementEntry } from '../../worker/src/provider-enablement';

describe('Provider production enablement contract',()=>{
  const now=new Date('2026-09-19T00:00:00.000Z');
  const valid:ProviderEnablementEntry={domain:'PAYMENT',provider:'LINE_PAY',connectionId:'primary',providerConnectionVersionId:'10000000-0000-4000-8000-000000000001',connectionEnvironment:'PRODUCTION',credentialSecretRef:'https://ucell-prod-kv.vault.azure.net/secrets/line-pay-credential/12345678',webhookVerificationRef:'https://ucell-prod-kv.vault.azure.net/secrets/line-pay-webhook/12345678',configHash:'a'.repeat(64),effectiveFrom:'2026-09-01T00:00:00.000Z',effectiveTo:null,approvalReference:'approval://provider/line-pay/production-v1',certificationEvidenceClass:'OFFICIAL_PROVIDER_VECTOR',certificationStatus:'PASS',certificationEvidenceRef:'provider-certification://line-pay/uat-v1',uatApprovalReference:'uat-approval://line-pay/v1'};
  const manifest=(entry:ProviderEnablementEntry=valid)=>({deploymentEnvironment:'PRODUCTION' as const,entries:[entry]});
  it('accepts only complete reference evidence for an effective production connection',()=>{expect(()=>validateProviderEnablementManifest(manifest(),'PRODUCTION',now)).not.toThrow()});
  it.each([
    [{certificationEvidenceClass:'ENGINEERING_FIXTURE',certificationStatus:'ENGINEERING_ONLY'},'PROVIDER_CERTIFICATION_NOT_APPROVED'],
    [{connectionEnvironment:'STAGE'},'PROVIDER_CONNECTION_ENVIRONMENT_MISMATCH'],
    [{effectiveTo:'2026-09-18T00:00:00.000Z'},'PROVIDER_CONNECTION_VERSION_NOT_EFFECTIVE'],
    [{credentialSecretRef:'raw-secret-value'},'PROVIDER_ENABLEMENT_SECRET_REFERENCE_INVALID'],
    [{uatApprovalReference:'PENDING'},'PROVIDER_ENABLEMENT_EVIDENCE_REQUIRED'],
  ])('fails closed for incomplete or unsafe evidence %#',(change,code)=>{expect(()=>validateProviderEnablementManifest(manifest({...valid,...change} as ProviderEnablementEntry),'PRODUCTION',now)).toThrow(code as string)});
  it('rejects duplicate provider connection registrations',()=>{expect(()=>validateProviderEnablementManifest({deploymentEnvironment:'PRODUCTION',entries:[valid,valid]},'PRODUCTION',now)).toThrow('PROVIDER_ENABLEMENT_DUPLICATE')});
  it('does not allow provider processing in local or Connected DEV modes',()=>{expect(()=>validateProviderEnablementManifest({deploymentEnvironment:'CONNECTED_DEV',entries:[{...valid,connectionEnvironment:'STAGE'}]},'CONNECTED_DEV',now)).toThrow('PROVIDER_RUNTIME_ENVIRONMENT_NOT_APPROVED')});
  it('binds the approved manifest exactly to the runtime handler registry',()=>{
    expect(()=>validateProviderEnablementManifest(manifest(),'PRODUCTION',now,[{domain:'PAYMENT',provider:'OTHER',connectionId:'primary'}])).toThrow('PROVIDER_ENABLEMENT_REGISTRY_MISMATCH');
    expect(()=>validateProviderEnablementManifest(manifest(),'PRODUCTION',now,[{domain:'PAYMENT',provider:'LINE_PAY',connectionId:'primary'}])).not.toThrow();
  });
});
