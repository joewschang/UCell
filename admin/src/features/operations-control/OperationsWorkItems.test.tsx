import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {CandidateTaskForm,WorkItemActions,WorkItem} from './OperationsWorkItems';
import * as api from '../../lib/api';
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),post:vi.fn()}));
afterEach(()=>vi.clearAllMocks());
const wrap=(child:React.ReactNode)=><QueryClientProvider client={new QueryClient()}>{child}</QueryClientProvider>;
const candidate={stream:'SALES',reference:'ERP-PROJECTION-'+'a'.repeat(40),code:'ERP_TRANSPORT_FAILED',evidenceHash:'b'.repeat(64),asOf:'2026-10-01T00:00:00Z'};
it('retains the command key after an uncertain result and changes it when assignment changes',async()=>{
 vi.mocked(api.post).mockRejectedValue(new Error('連線逾時'));let tree:any;await act(async()=>{tree=create(wrap(<CandidateTaskForm candidate={candidate}/>));});
 const submit=()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}});
 await act(submit);await act(submit);const first=vi.mocked(api.post).mock.calls[0][1] as any;expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(first);expect(first).toMatchObject({...candidate,assigneeRole:'FINANCE'});
 await act(async()=>tree.root.findByType('select').props.onChange({target:{value:'COMPLIANCE_AUDIT'}}));await act(submit);expect((vi.mocked(api.post).mock.calls[2][1] as any).commandKey).not.toBe(first.commandKey);
 await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'2026-10-02T08:30'}}));await act(submit);expect((vi.mocked(api.post).mock.calls[3][1] as any).dueAt).toBe('2026-10-02T00:30:00.000Z');await act(async()=>tree.unmount());
});
const item:WorkItem={reference:'OPS-EXCEPTION-'+'c'.repeat(40),kind:'EXCEPTION',source:{reference:candidate.reference,link:null,orderNo:'100',fulfillmentKey:null},code:'ERP_RESULT_MISMATCH',status:'OPEN',priority:'HIGH',assigneeRole:null,dueAt:null,createdAt:candidate.asOf,closedAt:null,evidenceHash:'b'.repeat(64)};
it('requires a business note, sends the observed status, and explains blocked source reconciliation',async()=>{
 vi.mocked(api.post).mockRejectedValue(new api.ApiError(409,{code:'OPERATIONS_SOURCE_RECONCILIATION_REQUIRED'},'Conflict'));let tree:any;await act(async()=>{tree=create(wrap(<WorkItemActions item={item}/>));});
 const button=()=>tree.root.findAllByType('button').find((row:any)=>row.children.includes('例外已結案'));expect(button().props.disabled).toBe(true);
 await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'CASE-FIX-01'}}));expect(button().props.disabled).toBe(false);await act(async()=>button().props.onClick());
 expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/exceptions/'+item.reference+'/transitions'),expect.objectContaining({expectedStatus:'OPEN',status:'RESOLVED',noteReference:'CASE-FIX-01'}));expect(JSON.stringify(tree.toJSON())).toContain('來源尚未完成 ERP 對帳');await act(async()=>tree.unmount());
});
it('renders completed items without mutation actions',async()=>{
 let tree:any;await act(async()=>{tree=create(wrap(<WorkItemActions item={{...item,kind:'TASK',status:'COMPLETED',closedAt:'2026-10-01T01:00:00Z'}}/>));});expect(tree.root.findAllByType('button')).toHaveLength(0);await act(async()=>tree.unmount());
});
