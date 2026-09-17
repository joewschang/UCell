import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {ApiError,command,get} from '../../lib/api';
import {ProviderOperationsPage} from './ProviderOperationsPage';

let role='SUPER_ADMIN';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role}})}));
vi.mock('@ucell/design-system',async importOriginal=>({
 ...await importOriginal<typeof import('@ucell/design-system')>(),
 UCellButton:({children,...props}:any)=><button {...props}>{children}</button>,
 ConfirmDialog:({open,title,onConfirm,children}:any)=>open?<section><h2>{title}</h2>{children}<input aria-label="操作原因" required/><button onClick={()=>onConfirm('provider incident reviewed')}>確認測試</button></section>:null,
}));
vi.mock('../../lib/api',async importOriginal=>({...await importOriginal<typeof import('../../lib/api')>(),get:vi.fn(),command:vi.fn()}));

const health={data:{generatedAt:'2026-09-19T00:00:00Z',state:'CRITICAL',total:9,dueBacklog:3,expiredLeases:1,manualReview:2,oldestDueReceivedAt:'2026-09-18T22:00:00Z',counts:{byDomain:{PAYMENT:9}}}};
const item={providerWebhookInboxId:'inbox-1',domain:'PAYMENT',provider:'ACME',connectionId:'primary',status:'MANUAL_REVIEW',attemptCount:2,lastErrorCode:'TEMPORARY',receivedAt:'2026-09-18T22:00:00Z',nextAttemptAt:null,correlationId:'correlation-1',due:true,leaseExpired:false};
const backlog={data:{generatedAt:'2026-09-19T00:00:00Z',limit:50,truncated:false,items:[item]}};

async function render(){
 vi.mocked(get).mockImplementation(async path=>path.endsWith('/health')?health:backlog as never);
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});let tree!:ReactTestRenderer;
 await act(async()=>{tree=create(<QueryClientProvider client={client}><ProviderOperationsPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,100));});
 return tree;
}

beforeEach(()=>{role='SUPER_ADMIN';vi.clearAllMocks()});

it('renders safe provider fields and exposes governed retry only for super admin',async()=>{
 const tree=await render(),output=JSON.stringify(tree.toJSON());
 expect(output).toContain('Provider Webhook 營運');expect(output).toContain('CRITICAL');expect(output).toContain('ACME');expect(output).toContain('TEMPORARY');expect(output).toContain('人工重試');expect(output).not.toMatch(/payloadHash|verificationEvidenceHash|safeEvidenceRef|leaseOwner/);
 act(()=>tree.unmount());
 role='COMPLIANCE_AUDIT';const readOnly=await render();expect(JSON.stringify(readOnly.toJSON())).not.toContain('人工重試');act(()=>readOnly.unmount());
});

it('requires confirmation reason and submits the governed retry command',async()=>{
 vi.mocked(command).mockResolvedValue({data:{status:'RETRY_PENDING'}});
 const tree=await render();
 await act(async()=>{tree.root.findAllByType('button').find(node=>node.children.includes('人工重試'))!.props.onClick()});
 expect(tree.root.findByProps({'aria-label':'操作原因'}).props.required).toBe(true);
 await act(async()=>{tree.root.findAllByType('button').find(node=>node.children.includes('確認測試'))!.props.onClick();await new Promise(resolve=>setTimeout(resolve,0))});
 expect(command).toHaveBeenCalledWith('/admin/provider-operations/webhooks/inbox-1/retry',{reason:'provider incident reviewed'});
 expect(JSON.stringify(tree.toJSON())).toContain('已提交人工重試');act(()=>tree.unmount());
});

it.each([
 [409,'此 webhook 狀態已變更或正在處理，請重新整理後確認。'],
 [422,'此 webhook 不符合人工重試條件，請檢查狀態與必要設定。'],
 [500,'provider unavailable'],
])('shows an actionable retry error for HTTP %s',async(status,message)=>{
 vi.mocked(command).mockRejectedValue(new ApiError(status,null,status===500?'provider unavailable':'failure'));
 const tree=await render();
 await act(async()=>{tree.root.findAllByType('button').find(node=>node.children.includes('人工重試'))!.props.onClick()});
 await act(async()=>{tree.root.findAllByType('button').find(node=>node.children.includes('確認測試'))!.props.onClick();await new Promise(resolve=>setTimeout(resolve,0))});
 expect(JSON.stringify(tree.toJSON())).toContain(message);expect(tree.root.findByProps({role:'alert'})).toBeTruthy();act(()=>tree.unmount());
});
