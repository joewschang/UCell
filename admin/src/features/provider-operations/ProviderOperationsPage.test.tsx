import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {ProviderOperationsPage} from './ProviderOperationsPage';

vi.mock('../../lib/api',async importOriginal=>({...await importOriginal<typeof import('../../lib/api')>(),get:vi.fn()}));

it('renders safe provider health and backlog fields without sensitive evidence',async()=>{
 vi.mocked(get).mockImplementation(async path=>path.endsWith('/health')?{data:{generatedAt:'2026-09-19T00:00:00Z',state:'CRITICAL',total:9,dueBacklog:3,expiredLeases:1,manualReview:2,oldestDueReceivedAt:'2026-09-18T22:00:00Z',counts:{byDomain:{PAYMENT:9}}}}:{data:{generatedAt:'2026-09-19T00:00:00Z',limit:50,truncated:false,items:[{providerWebhookInboxId:'inbox-1',domain:'PAYMENT',provider:'ACME',connectionId:'primary',status:'RETRY_PENDING',attemptCount:2,lastErrorCode:'TEMPORARY',receivedAt:'2026-09-18T22:00:00Z',nextAttemptAt:'2026-09-18T23:00:00Z',correlationId:'correlation-1',due:true,leaseExpired:false}]}} as never);
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});let tree:ReturnType<typeof create>;
 await act(async()=>{tree=create(<QueryClientProvider client={client}><ProviderOperationsPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const output=JSON.stringify(tree!.toJSON());expect(output).toContain('Provider Webhook 營運');expect(output).toContain('CRITICAL');expect(output).toContain('ACME');expect(output).toContain('TEMPORARY');expect(output).not.toMatch(/payloadHash|verificationEvidenceHash|safeEvidenceRef|leaseOwner/);act(()=>tree!.unmount());
});
