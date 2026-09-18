import {
  PrismaService,
  ProviderWebhookWorkerLeaseService,
  runProviderWebhookBatch,
  type ProviderWebhookHandler,
  type ProviderWebhookWorkerLease,
  type ProviderWebhookWorkerRunResult,
} from '@ucell/database';
import { loadProviderEnablementManifest, validateProviderEnablementManifest, type ProviderDeploymentEnvironment } from './provider-enablement';

export type ProviderHandlerRegistration = Readonly<{
  domain: ProviderWebhookWorkerLease['domain'];
  provider: string;
  connectionId: string;
  handler: ProviderWebhookHandler;
}>;

export type ProviderRuntimeConfig = Readonly<{
  enabled: boolean;
  leaseOwner: string;
  leaseMs: number;
  batchSize: number;
  maxAttempts: number;
  retryBackoffSeconds: readonly number[];
}>;

export type ProviderRuntimeResult = Readonly<{
  enabled: boolean;
  result: ProviderWebhookWorkerRunResult | null;
}>;

/** Runtime wiring only. A deployment must explicitly enable the worker and
 * register an exact domain/provider/connection handler. Empty or ambiguous
 * registries fail before any Inbox row is claimed. */
export async function pollProviderWebhooks(
  db: PrismaService,
  registrations: readonly ProviderHandlerRegistration[],
  environment: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<ProviderRuntimeResult> {
  const config = providerRuntimeConfig(environment);
  if (!config.enabled) return Object.freeze({ enabled: false, result: null });
  const resolve = handlerResolver(registrations);
  const deploymentEnvironment=providerDeploymentEnvironment(environment);
  validateProviderEnablementManifest(loadProviderEnablementManifest(environment),deploymentEnvironment,now,registrations);
  const result = await runProviderWebhookBatch(new ProviderWebhookWorkerLeaseService(db), resolve, config, now);
  return Object.freeze({ enabled: true, result });
}

export function providerDeploymentEnvironment(environment:NodeJS.ProcessEnv):ProviderDeploymentEnvironment{
  const value=environment.UCELL_DEPLOYMENT_ENVIRONMENT;
  if(!value||!['LOCAL','CONNECTED_DEV','UAT','PRODUCTION'].includes(value))throw new Error('PROVIDER_DEPLOYMENT_ENVIRONMENT_REQUIRED');
  return value as ProviderDeploymentEnvironment;
}
export function providerRuntimeConfig(environment: NodeJS.ProcessEnv): ProviderRuntimeConfig {
  const enabled = parseBoolean(environment.UCELL_PROVIDER_WORKER_ENABLED, false);
  if (!enabled) return Object.freeze({ enabled:false,leaseOwner:'disabled',leaseMs:120_000,batchSize:20,maxAttempts:3,retryBackoffSeconds:[30,120] });
  const leaseOwner = requiredToken(environment.UCELL_PROVIDER_WORKER_LEASE_OWNER, 'PROVIDER_WORKER_LEASE_OWNER_REQUIRED');
  const maxAttempts = integer(environment.UCELL_PROVIDER_WORKER_MAX_ATTEMPTS, 3, 1, 100, 'PROVIDER_WORKER_MAX_ATTEMPTS_INVALID');
  const retryBackoffSeconds = csvIntegers(environment.UCELL_PROVIDER_WORKER_RETRY_BACKOFF_SECONDS ?? '30,120');
  if (retryBackoffSeconds.length !== maxAttempts - 1) throw new Error('PROVIDER_WORKER_BACKOFF_CONFIG_INVALID');
  return Object.freeze({
    enabled:true,leaseOwner,
    leaseMs:integer(environment.UCELL_PROVIDER_WORKER_LEASE_MS,120_000,1_000,900_000,'PROVIDER_WORKER_LEASE_MS_INVALID'),
    batchSize:integer(environment.UCELL_PROVIDER_WORKER_BATCH_SIZE,20,1,100,'PROVIDER_WORKER_BATCH_SIZE_INVALID'),
    maxAttempts,retryBackoffSeconds:Object.freeze(retryBackoffSeconds),
  });
}

export function handlerResolver(registrations: readonly ProviderHandlerRegistration[]) {
  if (!registrations.length) throw new Error('PROVIDER_HANDLER_REGISTRY_EMPTY');
  const handlers = new Map<string,ProviderWebhookHandler>();
  for (const item of registrations) {
    const key = handlerKey(item.domain,item.provider,item.connectionId);
    if (handlers.has(key)) throw new Error('PROVIDER_HANDLER_REGISTRY_DUPLICATE');
    handlers.set(key,item.handler);
  }
  return (lease:ProviderWebhookWorkerLease)=>handlers.get(handlerKey(lease.domain,lease.provider,lease.connectionId))??null;
}

function handlerKey(domain:string,provider:string,connectionId:string):string {
  return [domain,requiredToken(provider,'PROVIDER_HANDLER_PROVIDER_INVALID'),requiredToken(connectionId,'PROVIDER_HANDLER_CONNECTION_INVALID')].join('\u0000');
}
function parseBoolean(value:string|undefined,fallback:boolean):boolean {
  if(value===undefined)return fallback;if(value==='true')return true;if(value==='false')return false;throw new Error('PROVIDER_WORKER_ENABLED_INVALID');
}
function requiredToken(value:string|undefined,code:string):string {
  if(!value||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/ .test(value))return (()=>{throw new Error(code)})();return value;
}
function integer(value:string|undefined,fallback:number,min:number,max:number,code:string):number {
  const parsed=value===undefined?fallback:Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(code);return parsed;
}
function csvIntegers(value:string):number[]{
  if(value==='')return [];const parsed=value.split(',').map(item=>Number(item));if(parsed.some(item=>!Number.isSafeInteger(item)||item<1))throw new Error('PROVIDER_WORKER_BACKOFF_CONFIG_INVALID');return parsed;
}
