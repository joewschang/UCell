import { loadProviderEnablementManifest, validateProviderEnablementManifest, type ProviderDeploymentEnvironment } from '../apps/worker/src/provider-enablement';
const flag=process.env.UCELL_PROVIDER_WORKER_ENABLED;
if(flag!==undefined&&flag!=='true'&&flag!=='false')throw new Error('PROVIDER_WORKER_ENABLED_INVALID');
const enabled=flag==='true';
if(!enabled){console.log('PROVIDER_ENABLEMENT_PREFLIGHT_PASS: provider worker disabled');process.exit(0)}
const environment=process.env.UCELL_DEPLOYMENT_ENVIRONMENT as ProviderDeploymentEnvironment|undefined;
if(!environment)throw new Error('PROVIDER_DEPLOYMENT_ENVIRONMENT_REQUIRED');
validateProviderEnablementManifest(loadProviderEnablementManifest(process.env),environment,new Date());
console.log(`PROVIDER_ENABLEMENT_PREFLIGHT_PASS: ${environment} reference evidence accepted`);
